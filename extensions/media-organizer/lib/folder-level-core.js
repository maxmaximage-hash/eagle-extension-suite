"use strict";

function createFolderLevelRuntime() {
  const ORDINAL_PREFIX = /^\s*[0-9０-９]+\s*[-‐‑‒–—－]\s*/u;

  function normalizeDigits(value) {
    return String(value || "").replace(/[０-９]/g, (digit) =>
      String(digit.charCodeAt(0) - 0xff10)
    );
  }

  function stripOrdinalPrefix(name) {
    return normalizeDigits(name).replace(ORDINAL_PREFIX, "").trim();
  }

  function numberedName(name, index) {
    const baseName = stripOrdinalPrefix(name);
    return String(index) + "-" + baseName;
  }

  function directChildren(folder) {
    return Array.isArray(folder?.children) ? folder.children : [];
  }

  function descendants(folder) {
    const result = [];
    const stack = directChildren(folder).slice().reverse();
    const visited = new Set();
    while (stack.length) {
      const current = stack.pop();
      const id = String(current?.id || "");
      if (!id || visited.has(id)) continue;
      visited.add(id);
      result.push(current);
      const children = directChildren(current);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push(children[index]);
      }
    }
    return result;
  }

  function currentTarget(options = {}) {
    const folder = options.folder;
    const collectionKind = options.collectionKind || "normal";
    const children = directChildren(folder);
    if (collectionKind === "normal" && folder?.id && children.length) {
      return {
        kind: "direct-folders",
        items: children,
        count: children.length
      };
    }
    const media = Array.isArray(options.directMedia) ? options.directMedia : [];
    return { kind: "direct-media", items: media, count: media.length };
  }

  function actionAvailability(options = {}) {
    const locked = options.locked === true;
    const target = currentTarget(options);
    const collectionKind = options.collectionKind || "normal";
    return {
      locked,
      targetKind: target.kind,
      targetCount: target.count,
      canToggleLock: collectionKind !== "global",
      canManualDrag:
        !locked &&
        collectionKind !== "global" &&
        target.count > 0 &&
        (target.kind !== "direct-folders" || collectionKind === "normal"),
      canAutoNumber:
        !locked && collectionKind === "normal" && target.count > 0,
      canChangeSort: !locked,
      canApplyToDescendants:
        !locked && collectionKind === "normal" && descendants(options.folder).length > 0
    };
  }

  function buildFolderRenamePlan(children, options = {}) {
    const ordered = Array.isArray(children) ? children : [];
    const token = String(options.token || "preview").replace(/[^a-zA-Z0-9_-]/g, "");
    const entries = ordered
      .filter((folder) => folder?.id)
      .map((folder, index) => {
        const oldName = String(folder.name || "");
        const newName = numberedName(oldName, index + 1);
        return {
          id: String(folder.id),
          index: index + 1,
          oldName,
          newName,
          tempName: "__eagle_folder_number_" + token + "_" + String(index + 1),
          changed: oldName !== newName
        };
      });
    const changes = entries.filter((entry) => entry.changed);
    return {
      kind: "direct-folders",
      entries,
      changes,
      phases: {
        temporary: changes.map((entry) => ({ id: entry.id, name: entry.tempName })),
        final: changes.map((entry) => ({ id: entry.id, name: entry.newName }))
      }
    };
  }

  function applyModeToTree(folder, enabled, isLocked = () => false) {
    const result = { applied: [], skipped: [] };
    for (const current of [folder, ...descendants(folder)]) {
      if (!current?.id) continue;
      if (isLocked(current)) {
        result.skipped.push(String(current.id));
      } else {
        result.applied.push({ id: String(current.id), enabled: enabled === true });
      }
    }
    return result;
  }

  return {
    actionAvailability,
    applyModeToTree,
    buildFolderRenamePlan,
    currentTarget,
    descendants,
    directChildren,
    numberedName,
    stripOrdinalPrefix
  };
}

module.exports = { createFolderLevelRuntime };
