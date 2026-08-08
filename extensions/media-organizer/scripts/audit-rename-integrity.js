"use strict";

const fs = require("fs");
const path = require("path");

function option(name) {
  const index = process.argv.indexOf("--" + name);
  return index >= 0 ? process.argv[index + 1] : "";
}

async function main() {
  const libraryPath = option("library");
  const folderId = option("folder-id");
  const outputPath = option("output");
  const apiBase = option("api") || "http://localhost:41595";
  if (!libraryPath || !folderId || !outputPath) {
    throw new Error("--library, --folder-id and --output are required");
  }

  const response = await fetch(
    apiBase + "/api/item/list?folders=" + encodeURIComponent(folderId) +
      "&limit=500"
  );
  const payload = await response.json();
  if (!response.ok || payload.status !== "success" || !Array.isArray(payload.data)) {
    throw new Error("Unable to read the scoped Eagle folder");
  }

  const entries = [];
  const invalid = [];
  for (const item of payload.data) {
    const extension = String(item.ext || "").replace(/^\./, "");
    const infoPath = path.join(libraryPath, "images", item.id + ".info");
    let files;
    try {
      files = await fs.promises.readdir(infoPath);
    } catch (error) {
      invalid.push({ id: item.id, reason: error.code || error.message });
      continue;
    }
    const suffix = "." + extension.toLowerCase();
    const rawFiles = files.filter((fileName) => {
      const lower = fileName.toLowerCase();
      return lower.endsWith(suffix) && !lower.endsWith("_thumbnail" + suffix);
    });
    const expectedFile = item.name + "." + extension;
    if (rawFiles.length === 1 && rawFiles[0] === expectedFile) continue;
    if (rawFiles.length !== 1) {
      invalid.push({ id: item.id, expectedFile, rawFiles });
      continue;
    }
    const rawPath = path.join(infoPath, rawFiles[0]);
    const stat = await fs.promises.stat(rawPath);
    entries.push({
      id: String(item.id),
      oldName: rawFiles[0].slice(0, -suffix.length),
      newName: String(item.name || ""),
      ext: extension,
      sourceFile: rawPath,
      expectedFile: path.join(infoPath, expectedFile),
      size: stat.size,
      mtimeMs: Math.trunc(stat.mtimeMs)
    });
  }

  const request = {
    version: 1,
    requestId: "recover-" + folderId + "-" + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    approved: false,
    status: "awaiting-approval",
    libraryPath: path.normalize(libraryPath),
    folderId,
    scopedItemCount: payload.data.length,
    mismatchCount: entries.length,
    invalidCount: invalid.length,
    entries,
    invalid
  };
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = outputPath + ".tmp";
  await fs.promises.writeFile(
    temporaryPath,
    JSON.stringify(request, null, 2) + "\n",
    "utf8"
  );
  await fs.promises.rename(temporaryPath, outputPath);
  console.log(JSON.stringify({
    outputPath,
    scopedItemCount: request.scopedItemCount,
    mismatchCount: request.mismatchCount,
    invalidCount: request.invalidCount
  }));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
