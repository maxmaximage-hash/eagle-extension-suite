"use strict";

function normalizeSelectedFolder(selected) {
  const folders = Array.isArray(selected)
    ? selected
    : selected
      ? [selected]
      : [];
  if (!folders.length) return { ok: false, reason: "no-folder-selected" };
  if (folders.length !== 1) {
    return { ok: false, reason: "single-folder-required" };
  }
  const folder = folders[0];
  if (!folder?.id) return { ok: false, reason: "normal-folder-required" };
  const smart = folder.isSmart === true ||
    folder.isSmartFolder === true ||
    folder.smart === true ||
    folder.smartFolder === true ||
    folder.type === "smart" ||
    (Array.isArray(folder.conditions) && folder.conditions.length > 0);
  if (smart) return { ok: false, reason: "normal-folder-required" };
  return {
    ok: true,
    folderId: String(folder.id),
    folderName: String(folder.name || "未命名文件夹"),
    folder
  };
}

function createFolderCopyRuntime() {
  function normalizedName(value) {
    return String(value || "").trim() || "未命名文件夹";
  }

  function nextCopyName(sourceName, existingNames) {
    const base = normalizedName(sourceName);
    const names = new Set((Array.isArray(existingNames) ? existingNames : [])
      .map(normalizedName));
    const suffixMatch = base.match(/^(.*) 副本(?: (\d+))?$/);
    const first = suffixMatch ? `${suffixMatch[1]} 副本` : `${base} 副本`;
    if (!names.has(first)) return first;
    let index = 2;
    while (names.has(`${first} ${index}`)) index += 1;
    return `${first} ${index}`;
  }

  function canCopy(collection = {}) {
    return String(collection.kind || "") === "normal" &&
      Boolean(String(collection.id || ""));
  }

  function folderEntries(source, options = {}) {
    const existingNamesByParent = options.existingNamesByParent || {};
    const entries = [];
    const usedNamesByParent = new Map();
    const sourceRootParent = String(source?.parent || "");
    const rootName = nextCopyName(
      source?.name,
      existingNamesByParent[sourceRootParent] || []
    );

    function visit(folder, parentSourceId, parentTargetName) {
      if (!folder?.id) return;
      const sourceId = String(folder.id);
      const isRoot = entries.length === 0;
      const siblingKey = parentTargetName || "__root__";
      const usedNames = usedNamesByParent.get(siblingKey) || new Set();
      const requestedName = isRoot
        ? rootName
        : normalizedName(folder.name);
      let name = requestedName;
      if (!isRoot && usedNames.has(name)) {
        name = nextCopyName(name, Array.from(usedNames));
      }
      usedNames.add(name);
      usedNamesByParent.set(siblingKey, usedNames);
      entries.push({
        sourceId,
        parentSourceId: parentSourceId ? String(parentSourceId) : null,
        name,
        description: String(folder.description || ""),
        iconColor: folder.iconColor || null,
        sourceFolder: folder
      });
      for (const child of Array.isArray(folder.children) ? folder.children : []) {
        visit(child, sourceId, sourceId);
      }
    }

    visit(source, null, "");
    return entries;
  }

  function buildPlan(source, options = {}) {
    if (!canCopy({ kind: "normal", id: source?.id })) {
      return { ok: false, reason: "normal-folder-required", root: null, folders: [] };
    }
    const folders = folderEntries(source, options);
    const root = folders[0] ? {
      ...folders[0],
      parent: source.parent || null
    } : null;
    return {
      ok: Boolean(root),
      root,
      folders,
      sourceId: String(source.id)
    };
  }

  function addFolderMembership(item, targetFolderId) {
    const targetId = String(targetFolderId || "");
    if (!item?.id || !targetId) return null;
    const folders = Array.isArray(item.folders) ? item.folders.map(String) : [];
    if (folders.includes(targetId)) return null;
    return {
      item,
      itemId: String(item.id),
      folders: [...folders, targetId]
    };
  }

  return {
    addFolderMembership,
    buildPlan,
    canCopy,
    folderEntries,
    nextCopyName,
    normalizeSelectedFolder
  };
}

module.exports = { createFolderCopyRuntime, normalizeSelectedFolder };
