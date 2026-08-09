"use strict";

const fsDefault = require("fs").promises;
const pathDefault = require("path");
const { AVATAR_FOLDERS } = require("./avatar-source-exporter");

async function readNdjsonItems(fs, cachePath, sourceFolderIds) {
  const text = await fs.readFile(cachePath, "utf8");
  const selected = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    let item;
    try {
      item = JSON.parse(line);
    } catch {
      continue;
    }
    const folders = Array.isArray(item?.folders) ? item.folders.map(String) : [];
    if (!folders.some((folderId) => sourceFolderIds.has(folderId))) continue;
    if (!item?.id || item.isDeleted) continue;
    selected.set(String(item.id), item);
  }
  return [...selected.values()];
}

async function sourceFilePath(fs, path, infoDirectory, metadata) {
  const direct = path.join(infoDirectory, `${metadata.name}.${metadata.ext}`);
  try {
    const stat = await fs.stat(direct);
    if (stat.isFile()) return direct;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const entries = await fs.readdir(infoDirectory, { withFileTypes: true });
  const extension = `.${String(metadata.ext || "").toLowerCase()}`;
  const matching = entries.filter((entry) =>
    entry.isFile() &&
    entry.name.toLowerCase().endsWith(extension) &&
    !/_thumbnail\.[^.]+$/i.test(entry.name)
  );
  if (matching.length !== 1) throw new Error(`avatar-source-file-unavailable:${metadata.id}`);
  return path.join(infoDirectory, matching[0].name);
}

async function readBoundedAvatarLibrary(options = {}) {
  const fs = options.fs || fsDefault;
  const path = options.path || pathDefault;
  const libraryPath = String(options.libraryPath || "");
  const cachePath = String(options.cachePath || "");
  const folders = options.folders || AVATAR_FOLDERS;
  if (!libraryPath || !cachePath) throw new Error("avatar-source-library-and-cache-required");
  const byFolder = Object.fromEntries(folders.map((folder) => [folder.folderId, []]));
  const sourceFolderIds = new Set(folders.map((folder) => folder.folderId));
  const cached = await readNdjsonItems(fs, cachePath, sourceFolderIds);
  for (const cachedItem of cached) {
    const infoDirectory = path.join(libraryPath, "images", `${cachedItem.id}.info`);
    const metadata = JSON.parse(await fs.readFile(path.join(infoDirectory, "metadata.json"), "utf8"));
    if (String(metadata.id) !== String(cachedItem.id) || metadata.isDeleted) continue;
    const folderId = (metadata.folders || []).map(String).find((id) => sourceFolderIds.has(id));
    if (!folderId) continue;
    byFolder[folderId].push({ ...metadata, filePath: await sourceFilePath(fs, path, infoDirectory, metadata) });
  }
  for (const folder of folders) {
    byFolder[folder.folderId].sort((left, right) => String(left.id).localeCompare(String(right.id)));
  }
  return byFolder;
}

module.exports = { readBoundedAvatarLibrary, readNdjsonItems, sourceFilePath };
