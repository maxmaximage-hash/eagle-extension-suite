"use strict";

function createRenameRuntime(options = {}) {
  const isMedia = typeof options.isMedia === "function"
    ? options.isMedia
    : () => true;

  function groupFromName(name) {
    const match = String(name || "").match(/^([12])-/);
    return match ? match[1] : null;
  }

  function sceneNameFromFolder(folderName) {
    return String(folderName || "")
      .trim()
      .replace(/^\d+\s*[-‐‑‒–—]\s*/, "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/[\\/:*?"<>|%]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildPlan(items, config = {}) {
    const sceneName = sceneNameFromFolder(config.folderName);
    const counters = { "1": 0, "2": 0 };
    const entries = [];
    let ignoredCount = 0;

    for (const item of Array.isArray(items) ? items : []) {
      const group = groupFromName(item && item.name);
      if (!item || !item.id || !group || !isMedia(item)) {
        ignoredCount += 1;
        continue;
      }
      counters[group] += 1;
      const nextName = group + "-" + sceneName + counters[group];
      entries.push({
        id: String(item.id),
        group,
        index: counters[group],
        oldName: String(item.name || ""),
        newName: nextName,
        changed: String(item.name || "") !== nextName
      });
    }

    return {
      sceneName,
      entries,
      changes: entries.filter((entry) => entry.changed),
      groups: {
        people: counters["1"],
        environment: counters["2"]
      },
      ignoredCount,
      error: sceneName ? null : "scene-name-empty"
    };
  }

  function signature(plan) {
    if (!plan || plan.error) return "";
    return plan.entries
      .map((entry) => entry.id + ":" + entry.oldName + ">" + entry.newName)
      .join("|");
  }

  return {
    buildPlan,
    groupFromName,
    sceneNameFromFolder,
    signature
  };
}

module.exports = { createRenameRuntime };
