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

  function buildExecutionPhases(entries, token = Date.now().toString(36)) {
    const safeToken = String(token || "rename").replace(/[^a-zA-Z0-9_-]/g, "");
    const changes = (Array.isArray(entries) ? entries : []).filter(
      (entry) => entry?.id && entry?.oldName !== entry?.newName
    );
    const temporary = changes.map((entry, index) => ({
      id: String(entry.id),
      oldName: String(entry.oldName || ""),
      newName: "__eagle_number_" + safeToken + "_" + String(index + 1)
    }));
    const temporaryById = new Map(
      temporary.map((entry) => [entry.id, entry.newName])
    );
    return {
      temporary,
      final: changes.map((entry) => ({
        id: String(entry.id),
        oldName: temporaryById.get(String(entry.id)),
        newName: String(entry.newName || "")
      })),
      rollback: changes.map((entry) => ({
        id: String(entry.id),
        oldName: String(entry.newName || ""),
        newName: String(entry.oldName || "")
      }))
    };
  }

  function limitPlanToOrdinalChanges(plan, beforeItems, afterItems) {
    if (!plan || plan.error || !Array.isArray(plan.changes)) return plan;

    const before = Array.isArray(beforeItems) ? beforeItems : [];
    const after = Array.isArray(afterItems) ? afterItems : [];
    const beforeOrdinals = new Map();
    const afterOrdinals = new Map();
    const beforeIndexes = new Map();
    const afterIndexes = new Map();

    const collect = (items, ordinals, indexes) => {
      const counters = { "1": 0, "2": 0 };
      items.forEach((item, index) => {
        const id = String(item?.id || "");
        const group = groupFromName(item?.name);
        if (!id || !group || !isMedia(item)) return;
        counters[group] += 1;
        ordinals.set(id, group + ":" + String(counters[group]));
        indexes.set(id, index);
      });
    };
    collect(before, beforeOrdinals, beforeIndexes);
    collect(after, afterOrdinals, afterIndexes);

    const affectedIds = new Set();
    for (const [id, ordinal] of afterOrdinals) {
      if (beforeOrdinals.get(id) !== ordinal) affectedIds.add(id);
    }
    const changes = plan.changes.filter((entry) =>
      affectedIds.has(String(entry?.id || ""))
    );
    const positions = changes.flatMap((entry) => {
      const id = String(entry.id);
      return [beforeIndexes.get(id), afterIndexes.get(id)].filter(Number.isInteger);
    });

    return {
      ...plan,
      changes,
      affectedRange: positions.length
        ? {
            start: Math.min(...positions),
            end: Math.max(...positions),
            count: changes.length
          }
        : { start: -1, end: -1, count: 0 }
    };
  }

  return {
    buildPlan,
    buildExecutionPhases,
    groupFromName,
    limitPlanToOrdinalChanges,
    sceneNameFromFolder,
    signature
  };
}

module.exports = { createRenameRuntime };
