"use strict";

const SORT_MODES = new Set(["native", "automatic", "manual"]);

function idOf(value) {
  return String(value && typeof value === "object" ? value.id || "" : value || "");
}

function uniqueIds(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const id = idOf(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function memberFingerprint(values) {
  const ids = uniqueIds(values).sort();
  let hash = 2166136261;
  for (const id of ids) {
    for (let index = 0; index < id.length; index += 1) {
      hash ^= id.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 31;
    hash = Math.imul(hash, 16777619);
  }
  return ids.length + ":" + (hash >>> 0).toString(16);
}

function normalizeMode(mode, pluginSort) {
  if (SORT_MODES.has(String(mode || ""))) return String(mode);
  return pluginSort === true ? "automatic" : "native";
}

function sameMembers(items, order) {
  const source = uniqueIds(items);
  const candidate = uniqueIds(order);
  if (source.length !== candidate.length) return false;
  const expected = new Set(source);
  return candidate.every((id) => expected.has(id));
}

function applyManualOrder(items, order) {
  const source = Array.isArray(items) ? items.slice() : [];
  const ids = uniqueIds(order);
  if (!ids.length) return source;
  const byId = new Map(source.map((item) => [idOf(item), item]));
  const result = [];
  const used = new Set();
  for (const id of ids) {
    if (!byId.has(id) || used.has(id)) continue;
    used.add(id);
    result.push(byId.get(id));
  }
  for (const item of source) {
    if (!used.has(idOf(item))) result.push(item);
  }
  return result;
}

function normalizeManualOverlay(overlay) {
  const relations = Array.isArray(overlay)
    ? overlay
    : Array.isArray(overlay?.relations) ? overlay.relations : [];
  const result = [];
  const seen = new Set();
  for (const relation of relations) {
    const itemId = idOf(relation?.itemId || relation?.id);
    const anchorId = idOf(relation?.anchorId || relation?.anchor);
    const direction = relation?.relation === "before" ? "before" : "after";
    if (!itemId || !anchorId || itemId === anchorId) continue;
    const key = itemId + "|" + direction + "|" + anchorId;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ itemId, relation: direction, anchorId });
  }
  return result;
}

function applyManualOverlay(items, overlay, metrics = null) {
  const source = Array.isArray(items) ? items.slice() : [];
  const byId = new Map(source.map((item) => [idOf(item), item]));
  const baseIds = source.map(idOf);
  const baseIndex = new Map(baseIds.map((id, index) => [id, index]));
  const outgoing = new Map(baseIds.map((id) => [id, []]));
  const indegree = new Map(baseIds.map((id) => [id, 0]));
  for (const relation of normalizeManualOverlay(overlay)) {
    if (!byId.has(relation.itemId) || !byId.has(relation.anchorId)) continue;
    const from = relation.relation === "before"
      ? relation.itemId
      : relation.anchorId;
    const to = relation.relation === "before"
      ? relation.anchorId
      : relation.itemId;
    const edges = outgoing.get(from);
    if (edges.some((id) => id === to)) continue;
    edges.push(to);
    indegree.set(to, indegree.get(to) + 1);
  }
  // A binary heap keyed by stable base index preserves the old deterministic
  // topological order without sorting the ready set once per node (R53).
  const ready = [];
  const pushReady = (id) => {
    ready.push(id);
    let index = ready.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (metrics) metrics.comparisons = (metrics.comparisons || 0) + 1;
      if (baseIndex.get(ready[parent]) <= baseIndex.get(ready[index])) break;
      [ready[parent], ready[index]] = [ready[index], ready[parent]];
      index = parent;
    }
  };
  const takeReady = () => {
    const first = ready[0];
    const last = ready.pop();
    if (ready.length && last !== undefined) {
      ready[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < ready.length) {
          if (metrics) metrics.comparisons = (metrics.comparisons || 0) + 1;
          if (baseIndex.get(ready[left]) < baseIndex.get(ready[smallest])) smallest = left;
        }
        if (right < ready.length) {
          if (metrics) metrics.comparisons = (metrics.comparisons || 0) + 1;
          if (baseIndex.get(ready[right]) < baseIndex.get(ready[smallest])) smallest = right;
        }
        if (smallest === index) break;
        [ready[index], ready[smallest]] = [ready[smallest], ready[index]];
        index = smallest;
      }
    }
    return first;
  };
  for (const id of baseIds) if (indegree.get(id) === 0) pushReady(id);
  const orderedIds = [];
  while (ready.length) {
    const id = takeReady();
    orderedIds.push(id);
    for (const next of outgoing.get(id)) {
      const nextDegree = indegree.get(next) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) pushReady(next);
    }
  }
  if (orderedIds.length !== baseIds.length) {
    const used = new Set(orderedIds);
    for (const id of baseIds) if (!used.has(id)) orderedIds.push(id);
  }
  return orderedIds.map((id) => byId.get(id)).filter(Boolean);
}

function overlayFromMove(items, selectedIds, targetId, insertAfter) {
  const source = Array.isArray(items) ? items.slice() : [];
  const selected = new Set(
    Array.from(selectedIds || []).map(String).filter(Boolean)
  );
  const normalizedTargetId = String(targetId || "");
  if (!normalizedTargetId || selected.size === 0 || selected.has(normalizedTargetId)) {
    return [];
  }
  const moved = source.filter((item) => selected.has(idOf(item)));
  if (!moved.length || !source.some((item) => idOf(item) === normalizedTargetId)) {
    return [];
  }
  const relations = [];
  let anchorId = normalizedTargetId;
  for (const item of moved) {
    relations.push({
      itemId: idOf(item),
      relation: insertAfter ? "after" : "before",
      anchorId
    });
    anchorId = idOf(item);
  }
  return relations;
}

function createOrderCoordinator({ sortRuntime } = {}) {
  if (!sortRuntime || typeof sortRuntime.sortDesired !== "function") {
    throw new TypeError("sortRuntime.sortDesired is required");
  }

  function resolve(input = {}) {
    const items = Array.isArray(input.items) ? input.items.slice() : [];
    const mode = normalizeMode(input.mode, input.pluginSort);
    const automaticItems = mode === "native"
      ? items.slice()
      : sortRuntime.sortDesired(items, {
        timestamps: input.timestamps || Object.create(null),
        rules: input.rules,
        collectionId: input.collectionId || input.collection?.id || "",
        manualOrder: []
      });
    const manualOrder = uniqueIds(input.manualOrder);
    const overlay = normalizeManualOverlay(input.manualOverlay);
    const itemIds = new Set(items.map(idOf));
    const validOverlay = overlay.filter(
      (relation) =>
        itemIds.has(relation.itemId) && itemIds.has(relation.anchorId)
    );
    const manualUsable = validOverlay.length > 0 ||
      (sameMembers(items, manualOrder) && manualOrder.length > 0);
    const overlayApplied = validOverlay.length > 0;
    const legacyManualApplied =
      !overlayApplied && mode === "manual" &&
      sameMembers(items, manualOrder) && manualOrder.length > 0;
    const finalItems = overlayApplied
      ? applyManualOverlay(automaticItems, validOverlay)
      : legacyManualApplied
        ? applyManualOrder(automaticItems, manualOrder)
        : automaticItems;
    const manualApplied = overlayApplied || legacyManualApplied;
    const authority = overlayApplied
      ? "automatic-rule+manual-overlay"
      : legacyManualApplied
      ? "manual"
        : mode === "automatic" ? "automatic-rule" : "native";

    return Object.freeze({
      mode,
      authority,
      locked: input.locked === true,
      manualApplied,
      manualAvailable: manualUsable,
      overlayApplied,
      manualOverlay: Object.freeze(
        validOverlay.map((relation) => ({ ...relation }))
      ),
      staleRelationCount: overlay.length - validOverlay.length,
      metadataReady: input.metadataReady !== false,
      memberFingerprint: memberFingerprint(items),
      baseIds: Object.freeze(automaticItems.map(idOf)),
      finalIds: Object.freeze(finalItems.map(idOf)),
      finalItems: Object.freeze(finalItems)
    });
  }

  function guard(action, input = {}) {
    const mutationActions = new Set([
      "manual-drag",
      "manual-reset",
      "sort",
      "rule-change",
      "rename"
    ]);
    if (input.locked === true && mutationActions.has(action)) {
      return { allowed: false, reason: "sorting-protected" };
    }
    if (mutationActions.has(action) && !input.collectionId) {
      return { allowed: false, reason: "collection-required" };
    }
    if (action === "manual-drag" && Number(input.targetCount || 0) < 1) {
      return { allowed: false, reason: "target-empty" };
    }
    return { allowed: true, reason: "" };
  }

  return Object.freeze({
    applyManualOverlay,
    guard,
    normalizeManualOverlay,
    overlayForMove: overlayFromMove,
    resolve
  });
}

module.exports = {
  SORT_MODES,
  idOf,
  uniqueIds,
  sameMembers,
  applyManualOrder,
  applyManualOverlay,
  normalizeManualOverlay,
  overlayFromMove,
  createOrderCoordinator,
  memberFingerprint,
  normalizeMode
};
