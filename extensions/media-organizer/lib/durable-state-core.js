"use strict";

const KNOWN_STATE_FILES = Object.freeze([
  "photo-taken-cache.json",
  "diagnostic.log",
  "rename-batch-backup.json",
  "rename-batch-cancel.json",
  "rename-recovery-request.json"
]);

const KNOWN_STATE_DIRECTORIES = Object.freeze([
  "team-state-backups"
]);

function createDurableStateLayout({ applicationSupportRoot, pluginId } = {}) {
  const path = require("path");
  const root = path.join(
    String(applicationSupportRoot || ""),
    "Eagle",
    "PluginData",
    String(pluginId || "")
  );
  return Object.freeze({
    schemaVersion: 1,
    root,
    cachePath: path.join(root, "photo-taken-cache.json"),
    diagnosticPath: path.join(root, "diagnostic.log"),
    renameBackupPath: path.join(root, "rename-batch-backup.json"),
    renameCancelPath: path.join(root, "rename-batch-cancel.json"),
    renameRecoveryPath: path.join(root, "rename-recovery-request.json"),
    teamBackupRoot: path.join(root, "team-state-backups")
  });
}

async function migrateLegacyState({ fs, path, legacyRoot, layout } = {}) {
  if (!fs?.promises || !path || !layout?.root) {
    throw new TypeError("fs, path and durable layout are required");
  }
  await fs.promises.mkdir(layout.root, { recursive: true });
  const migrated = [];
  const preserved = [];
  for (const fileName of KNOWN_STATE_FILES) {
    const source = path.join(String(legacyRoot || ""), fileName);
    const destination = path.join(layout.root, fileName);
    try {
      await fs.promises.access(destination, fs.constants.F_OK);
      preserved.push(fileName);
      continue;
    } catch {}
    try {
      await fs.promises.access(source, fs.constants.F_OK);
    } catch {
      continue;
    }
    const temporary = `${destination}.migrate-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
    try {
      await fs.promises.copyFile(source, temporary, fs.constants.COPYFILE_EXCL);
      try {
        await fs.promises.link(temporary, destination);
        migrated.push(fileName);
      } catch (error) {
        if (error?.code === "EEXIST") preserved.push(fileName);
        else throw error;
      }
    } finally {
      await fs.promises.unlink(temporary).catch(() => {});
    }
  }
  const migratedDirectories = [];
  const preservedDirectories = [];
  for (const directoryName of KNOWN_STATE_DIRECTORIES) {
    const sourceRoot = path.join(String(legacyRoot || ""), directoryName);
    const destinationRoot = path.join(layout.root, directoryName);
    let entries;
    try {
      entries = await fs.promises.readdir(sourceRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    const pending = entries.map((entry) => ({
      entry,
      relativePath: entry.name
    }));
    while (pending.length) {
      const current = pending.shift();
      const source = path.join(sourceRoot, current.relativePath);
      if (current.entry.isDirectory()) {
        const children = await fs.promises.readdir(source, { withFileTypes: true });
        pending.push(...children.map((entry) => ({
          entry,
          relativePath: path.join(current.relativePath, entry.name)
        })));
        continue;
      }
      if (!current.entry.isFile()) continue;
      const destination = path.join(destinationRoot, current.relativePath);
      await fs.promises.mkdir(path.dirname(destination), { recursive: true });
      try {
        await fs.promises.access(destination, fs.constants.F_OK);
        preservedDirectories.push(path.join(directoryName, current.relativePath));
        continue;
      } catch {}
      const temporary = `${destination}.migrate-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
      try {
        await fs.promises.copyFile(source, temporary, fs.constants.COPYFILE_EXCL);
        try {
          await fs.promises.link(temporary, destination);
          migratedDirectories.push(path.join(directoryName, current.relativePath));
        } catch (error) {
          if (error?.code === "EEXIST") {
            preservedDirectories.push(path.join(directoryName, current.relativePath));
          } else {
            throw error;
          }
        }
      } finally {
        await fs.promises.unlink(temporary).catch(() => {});
      }
    }
  }
  return Object.freeze({
    migrated,
    preserved,
    migratedDirectories,
    preservedDirectories,
    schemaVersion: layout.schemaVersion
  });
}

module.exports = {
  KNOWN_STATE_FILES,
  KNOWN_STATE_DIRECTORIES,
  createDurableStateLayout,
  migrateLegacyState
};
