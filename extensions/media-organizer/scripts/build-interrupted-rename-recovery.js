"use strict";

const fs = require("fs");
const path = require("path");

function argValue(name, fallback = "") {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function pathExists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function mediaRawNames(infoPath, ext) {
  const extension = `.${String(ext || "").replace(/^\./, "").toLowerCase()}`;
  return fs.readdirSync(infoPath)
    .filter((fileName) => {
      const lower = fileName.toLowerCase();
      return lower.endsWith(extension) &&
        !lower.endsWith(`_thumbnail${extension}`);
    })
    .map((fileName) => fileName.slice(0, -extension.length));
}

function main() {
  const pluginDir = argValue(
    "--plugin-dir",
    "/Users/max/Library/Application Support/Eagle/Plugins/com.max.eagle-photo-taken-sort"
  );
  const backupPath = argValue(
    "--backup",
    path.join(pluginDir, "rename-batch-backup.json")
  );
  const outputPath = argValue(
    "--output",
    path.join(pluginDir, "rename-recovery-request.json")
  );
  const folderId = argValue("--folder-id");
  const approve = hasFlag("--approve");
  const backup = readJson(backupPath);
  const libraryPath = path.normalize(argValue("--library", backup.libraryPath));
  if (!libraryPath || !pathExists(libraryPath)) {
    throw new Error(`Library path is unavailable: ${libraryPath}`);
  }
  if (!backup.requestId || !Array.isArray(backup.changes)) {
    throw new Error("Backup is not a rename batch backup");
  }

  const selectedChanges = backup.changes.filter((entry) => {
    return !folderId || String(entry.folderId || "") === folderId;
  });
  const entries = [];
  const skipped = [];
  for (const change of selectedChanges) {
    const id = String(change.id || "");
    const infoPath = path.join(libraryPath, "images", `${id}.info`);
    const metadataPath = path.join(infoPath, "metadata.json");
    if (!id || !pathExists(metadataPath)) {
      skipped.push({ id, reason: "metadata-missing" });
      continue;
    }
    const metadata = readJson(metadataPath);
    const ext = String(metadata.ext || "").replace(/^\./, "");
    const rawNames = mediaRawNames(infoPath, ext);
    const currentName = String(metadata.name || "");
    if (
      rawNames.length !== 1 ||
      rawNames[0] !== currentName ||
      !currentName.startsWith("__eagle_number_")
    ) {
      skipped.push({
        id,
        reason: "not-current-temp-name",
        currentName,
        rawNames
      });
      continue;
    }
    if (!String(change.oldName || "") || currentName === change.oldName) {
      skipped.push({ id, reason: "invalid-target", currentName });
      continue;
    }
    const targetPath = path.join(infoPath, `${change.oldName}.${ext}`);
    if (pathExists(targetPath)) {
      skipped.push({ id, reason: "target-exists", targetName: change.oldName });
      continue;
    }
    entries.push({
      id,
      folderId: String(change.folderId || ""),
      currentName,
      targetName: String(change.oldName || ""),
      interruptedRequestId: String(backup.requestId),
      ext
    });
  }

  if (entries.length === 0) {
    throw new Error("No interrupted temporary names were found to recover");
  }
  const distinctFolders = Array.from(new Set(entries.map((entry) => entry.folderId)));
  if (distinctFolders.length !== 1) {
    throw new Error(`Recovery must target exactly one folder: ${distinctFolders.join(",")}`);
  }
  const request = {
    version: 1,
    mode: "restore-interrupted-batch",
    requestId: `restore-interrupted-${distinctFolders[0]}-${backup.requestId}`,
    interruptedRequestId: String(backup.requestId),
    createdAt: new Date().toISOString(),
    approved: approve,
    status: "pending",
    libraryPath,
    folderId: distinctFolders[0],
    scopedItemCount: selectedChanges.length,
    entryCount: entries.length,
    skippedCount: skipped.length,
    entries,
    skipped
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(request, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    outputPath,
    approved: approve,
    folderId: request.folderId,
    entries: entries.length,
    skipped: skipped.length,
    requestId: request.requestId
  }, null, 2));
}

main();
