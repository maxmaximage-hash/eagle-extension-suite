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
    let ordinal = 0;

    for (const item of Array.isArray(items) ? items : []) {
      if (!item || !item.id || !isMedia(item)) {
        ignoredCount += 1;
        continue;
      }
      ordinal += 1;
      const oldName = String(item.name || "");
      const newName = group + "-" + sceneName + String(ordinal);
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

  return {
    buildPlan,
    normalizeGroup,
    sceneNameFromFolder
  };
}

module.exports = { createSelectedRenameRuntime };
