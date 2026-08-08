"use strict";

function normalizeTag(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function collectFolderMedia(folders, itemsByFolder, isMedia) {
  const uniqueItems = new Map();
  for (const folder of folders) {
    for (const item of itemsByFolder[folder.id] || []) {
      if (!item?.id || !isMedia(item)) continue;
      if (!uniqueItems.has(String(item.id))) uniqueItems.set(String(item.id), item);
    }
  }
  return Array.from(uniqueItems.values());
}

function createFolderTagPlan(folders, itemsByFolder, tag, isMedia) {
  const normalizedTag = normalizeTag(tag);
  const mediaItems = collectFolderMedia(folders, itemsByFolder, isMedia);
  if (!normalizedTag) {
    return {
      tag: "",
      folderCount: folders.length,
      mediaCount: mediaItems.length,
      alreadyTagged: 0,
      changes: [],
      error: "请输入地点标签"
    };
  }

  const changes = [];
  let alreadyTagged = 0;
  for (const item of mediaItems) {
    if ((item.tags || []).includes(normalizedTag)) {
      alreadyTagged += 1;
    } else {
      changes.push({ id: String(item.id), item });
    }
  }

  return {
    tag: normalizedTag,
    folderCount: folders.length,
    mediaCount: mediaItems.length,
    alreadyTagged,
    changes,
    error: ""
  };
}

module.exports = {
  collectFolderMedia,
  createFolderTagPlan,
  normalizeTag
};
