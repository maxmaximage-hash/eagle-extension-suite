"use strict";

function createSelectedRenameRuntime(options = {}) {
  const isMedia = typeof options.isMedia === "function"
    ? options.isMedia
    : () => true;

  function sceneNameFromFolder(folderName) {
    return String(folderName || "")
      .trim()
      .replace(/^\d+\s*[-‐‑‒–—]\s*/, "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/[\\/:*?"<>|%]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeGroup(group) {
    const value = String(group || "");
    if (value !== "1" && value !== "2") {
      throw new Error("group must be 1 or 2");
    }
    return value;
  }

  function buildPlan(items, config = {}) {
    const group = normalizeGroup(config.group);
    const sceneName = sceneNameFromFolder(config.folderName);
    const entries = [];
    let ignoredCount = 0;
    const selectedIds = new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => String(item?.id || ""))
        .filter(Boolean)
    );
    // Selected rename is planned against the complete current folder when
    // available.  Exclude the selected records themselves so re-running the
    // action can keep their existing names, then reserve every newly assigned
    // target as we walk the selection in its visible order.
    const occupiedNames = new Set(
      (Array.isArray(config.availableItems) ? config.availableItems : [])
        .filter((item) => !selectedIds.has(String(item?.id || "")))
        .map((item) => String(item?.name || ""))
        .filter(Boolean)
    );
    let nextOrdinal = 1;

    for (const item of Array.isArray(items) ? items : []) {
      if (!item || !item.id || !isMedia(item)) {
        ignoredCount += 1;
        continue;
      }
      const oldName = String(item.name || "");
      let ordinal = nextOrdinal;
      let newName = group + "-" + sceneName + String(ordinal);
      while (occupiedNames.has(newName)) {
        ordinal += 1;
        newName = group + "-" + sceneName + String(ordinal);
      }
      occupiedNames.add(newName);
      nextOrdinal = ordinal + 1;
      entries.push({
        id: String(item.id),
        group,
        index: ordinal,
        oldName,
        newName,
        changed: oldName !== newName
      });
    }

    return {
      group,
      sceneName,
      entries,
      changes: entries.filter((entry) => entry.changed),
      ignoredCount,
      error: sceneName ? null : "scene-name-empty"
    };
  }

  function findConflicts(items, entries) {
    const owners = new Map();
    const changingIds = new Set(
      (Array.isArray(entries) ? entries : [])
        .map((entry) => String(entry?.id || ""))
        .filter(Boolean)
    );
    for (const item of Array.isArray(items) ? items : []) {
      const id = String(item?.id || "");
      const name = String(item?.name || "");
      if (id && name && !owners.has(name)) owners.set(name, id);
    }
    return (Array.isArray(entries) ? entries : [])
      .filter((entry) => {
        const target = String(entry?.newName || "");
        const owner = owners.get(target);
        return Boolean(
          target &&
          owner &&
          owner !== String(entry?.id || "") &&
          !changingIds.has(owner)
        );
      })
      .map((entry) => ({
        id: String(entry.id || ""),
        newName: String(entry.newName || ""),
        ownerId: owners.get(String(entry.newName || ""))
      }));
  }

  return {
    buildPlan,
    findConflicts,
    normalizeGroup,
    sceneNameFromFolder
  };
}

module.exports = { createSelectedRenameRuntime };
