"use strict";

const fsDefault = require("fs").promises;
const os = require("os");
const pathDefault = require("path");
const { AVATAR_FOLDERS } = require("./avatar-source-exporter");
const { readBoundedAvatarLibrary } = require("./bounded-library-source-reader");

function withinTimeout(promise, timeoutMs, label) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`avatar-source-timeout:${label}`)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

function createEagleAvatarSourceAdapter(eagleApi, options = {}) {
  const folders = options.folders || AVATAR_FOLDERS;
  const fs = options.fs || fsDefault;
  const path = options.path || pathDefault;
  const cacheDirectory = options.cacheDirectory || path.join(
    os.homedir(), "Library", "Application Support", "Eagle", "library-caches"
  );
  const queryTimeoutMs = Number.isFinite(options.queryTimeoutMs) ? options.queryTimeoutMs : 12_000;

  function libraryPath() {
    const value = String(eagleApi?.library?.path || "");
    if (!value) throw new Error("avatar-source-eagle-library-unavailable");
    return value;
  }

  async function readSourceSnapshot() {
    const cachePath = await findMatchingCache();
    if (cachePath) {
      return readBoundedAvatarLibrary({ fs, path, libraryPath: libraryPath(), cachePath, folders });
    }
    if (!eagleApi?.item?.get) throw new Error("avatar-source-eagle-item-api-unavailable");
    try {
      const entries = await Promise.all(folders.map(async (folder) => {
        const items = await withinTimeout(
          eagleApi.item.get({ folders: [folder.folderId] }),
          queryTimeoutMs,
          `folder:${folder.folderId}`
        );
        if (!Array.isArray(items)) throw new Error(`avatar-source-folder-query-invalid:${folder.folderId}`);
        return [folder.folderId, items.filter((item) => {
          const itemFolders = Array.isArray(item?.folders) ? item.folders.map(String) : [];
          return itemFolders.length === 0 || itemFolders.includes(folder.folderId);
        })];
      }));
      return Object.fromEntries(entries);
    } catch (apiError) {
      throw apiError;
    }
  }

  async function findMatchingCache() {
    let entries;
    try {
      entries = await fs.readdir(cacheDirectory, { withFileTypes: true });
    } catch {
      return null;
    }
    const sourceIds = folders.map((folder) => folder.folderId);
    const candidates = [];
    for (const entry of entries) {
      if (!entry.isFile() || !/\.txt$/i.test(entry.name)) continue;
      const filePath = path.join(cacheDirectory, entry.name);
      try {
        const [stat, text] = await Promise.all([fs.stat(filePath), fs.readFile(filePath, "utf8")]);
        if (sourceIds.every((folderId) => text.includes(`\"${folderId}\"`))) {
          candidates.push({ filePath, mtimeMs: stat.mtimeMs });
        }
      } catch {}
    }
    candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
    return candidates[0]?.filePath || null;
  }

  return { libraryPath, readSourceSnapshot, findMatchingCache };
}

module.exports = { createEagleAvatarSourceAdapter, withinTimeout };
