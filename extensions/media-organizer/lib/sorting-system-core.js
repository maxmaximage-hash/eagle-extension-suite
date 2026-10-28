"use strict";

function createSortingSystemRuntime(options = {}) {
  const sortRuntime = options.sortRuntime;
  const renameRuntime = options.renameRuntime;
  const orderCoordinator = options.orderCoordinator;
  if (!sortRuntime || !renameRuntime) {
    throw new Error("sortRuntime and renameRuntime are required");
  }

  function idOf(value) {
    return String(value && typeof value === "object" ? value.id || "" : value || "");
  }

  function uniqueItems(items) {
    const result = [];
    const seen = new Set();
    for (const item of Array.isArray(items) ? items : []) {
      const id = idOf(item);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      result.push(item);
    }
    return result;
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

  function fingerprintIds(values) {
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

  function exactOrder(items, ids) {
    const source = uniqueItems(items);
    const order = uniqueIds(ids);
    if (source.length !== order.length) return null;
    const sourceIds = new Set(source.map(idOf));
    if (order.some((id) => !sourceIds.has(id))) return null;
    return sortRuntime.applyManualOrder(source, order);
  }

  // Eagle virtualizes smart grids: the rendered window is commonly only a
  // prefix (or a recycled slice) of the complete smart-query source.  A
  // successful manual overlay can therefore leave the host array in its old
  // order while the DOM already exposes the new order for the visible subset.
  // Reconcile that partial visible order into the complete source without
  // inventing an order for cards outside the current window.
  function partialRenderedOrder(items, renderedIds) {
    const source = uniqueItems(items);
    const rendered = uniqueIds(renderedIds);
    if (!source.length || !rendered.length || rendered.length >= source.length) {
      return null;
    }
    const sourceIds = new Set(source.map(idOf));
    if (rendered.some((id) => !sourceIds.has(id))) return null;
    const renderedSet = new Set(rendered);
    let renderedIndex = 0;
    return source.map((item) => {
      const id = idOf(item);
      if (!renderedSet.has(id)) return item;
      const nextId = rendered[renderedIndex++];
      return source.find((candidate) => idOf(candidate) === nextId) || item;
    });
  }

  function resolveOrder(input = {}) {
    const collection = input.collection || {};
    const contextId = String(input.contextId || collection.key || "");
    const targetKind = input.targetKind === "direct-folders"
      ? "direct-folders"
      : "direct-media";
    const sourceItems = uniqueItems(input.items);
    const sourceIds = sourceItems.map(idOf);
    if (
      !contextId ||
      !collection.id ||
      collection.kind === "global" ||
      collection.kind === "unknown"
    ) {
      return {
        operable: false,
        reason: "collection-required",
        contextId,
        collectionKind: collection.kind || "unknown",
        targetKind,
        sourceItems: [],
        automaticItems: [],
        finalItems: [],
        finalIds: [],
        authority: "none",
        membershipFingerprint: fingerprintIds([])
      };
    }

    const pluginSort = input.pluginSort === true;
    const sourceById = new Map(sourceItems.map((item) => [idOf(item), item]));
    const sortResult = orderCoordinator
      ? orderCoordinator.resolve({
          mode: input.sortMode,
          pluginSort,
          items: sourceItems,
          collectionId: collection.id,
          rules: input.rules,
          timestamps: input.timestamps,
          manualOrder: input.manualOrder,
          manualOverlay: input.manualOverlay,
          metadataReady: input.metadataReady
        })
      : null;
    const automaticItems = sortResult
      ? sortResult.baseIds.map((id) => sourceById.get(id)).filter(Boolean)
      : pluginSort
        ? sortRuntime.sortDesired(sourceItems, {
            timestamps: input.timestamps || Object.create(null),
            rules: input.rules,
            collectionId: collection.id,
            manualOrder: []
          })
        : sourceItems.slice();
    const manualOrder = uniqueIds(input.manualOrder);
    const renderedItems = input.preferRendered === true
      ? exactOrder(sourceItems, input.renderedIds) ||
        partialRenderedOrder(sourceItems, input.renderedIds)
      : null;

    let authority = sortResult?.authority ||
      (pluginSort ? "automatic-rule" : "adapter-order");
    let finalItems = sortResult
      ? sortResult.finalIds.map((id) => sourceById.get(id)).filter(Boolean)
      : automaticItems;
    if (renderedItems) {
      finalItems = renderedItems;
      authority = "visible-adapter";
    } else if (!sortResult && input.manualOverlay) {
      finalItems = typeof sortRuntime.applyManualOverlay === "function"
        ? sortRuntime.applyManualOverlay(automaticItems, input.manualOverlay)
        : automaticItems;
      authority = "automatic-rule+manual-overlay";
    } else if (!sortResult && manualOrder.length) {
      finalItems = sortRuntime.applyManualOrder(automaticItems, manualOrder);
      authority = "manual";
    }

    return {
      operable: true,
      reason: "",
      contextId,
      collectionKind: collection.kind,
      collectionId: String(collection.id),
      targetKind,
      sourceItems,
      automaticItems,
      finalItems,
      finalIds: finalItems.map(idOf),
      sortMode: sortResult?.mode || (pluginSort ? "automatic" : "native"),
      manualApplied: sortResult?.manualApplied === true ||
        (!sortResult && manualOrder.length > 0),
      metadataReady: sortResult?.metadataReady !== false,
      authority,
      membershipFingerprint: fingerprintIds(sourceIds)
    };
  }

  function guard(action, input = {}) {
    const collection = input.collection || {};
    const locked = input.locked === true;
    const targetCount = Math.max(0, Number(input.targetCount) || 0);
    const mutationActions = new Set([
      "sort",
      "manual-drag",
      "manual-reset",
      "manual-undo",
      "rename"
    ]);
    if (!collection.id || collection.kind === "global") {
      return { allowed: false, reason: "collection-required" };
    }
    if (locked && mutationActions.has(action)) {
      return { allowed: false, reason: "sorting-protected" };
    }
    if (mutationActions.has(action) && targetCount === 0) {
      return { allowed: false, reason: "target-empty" };
    }
    return { allowed: true, reason: "" };
  }

  function buildRenamePlan(orderSnapshot, config = {}) {
    if (!orderSnapshot?.operable) {
      return {
        contextId: orderSnapshot?.contextId || "",
        targetKind: orderSnapshot?.targetKind || "direct-media",
        orderSnapshot,
        sceneName: "",
        entries: [],
        changes: [],
        groups: { people: 0, environment: 0 },
        ignoredCount: 0,
        error: orderSnapshot?.reason || "collection-required"
      };
    }
    const plan = renameRuntime.buildPlan(orderSnapshot.finalItems, config);
    return {
      ...plan,
      contextId: orderSnapshot.contextId,
      targetKind: orderSnapshot.targetKind,
      orderSnapshot
    };
  }

  function createCurrentFolderRenameRequest(plan, config = {}) {
    const snapshot = plan?.orderSnapshot;
    if (
      !snapshot?.operable ||
      snapshot.targetKind !== "direct-media" ||
      !Array.isArray(plan?.changes) ||
      plan.changes.length === 0
    ) {
      return null;
    }
    return {
      id: String(config.id || ""),
      mode: "current-folder",
      collectionId: String(config.collectionId || snapshot.collectionId || ""),
      sourceContextId: snapshot.contextId,
      orderAuthority: snapshot.authority,
      orderRevision: Math.max(0, Number(config.orderRevision) || 0),
      snapshotVersion: String(
        config.snapshotVersion || config.orderRevision || "0"
      ),
      snapshotIdentity: String(
        config.snapshotIdentity || snapshot.membershipFingerprint || ""
      ),
      signature: String(
        config.signature || renameRuntime.signature(plan) || ""
      ),
      folders: [{
        id: String(config.folderId || snapshot.collectionId || ""),
        name: String(config.folderName || ""),
        finalOrder: snapshot.finalIds.slice(),
        allowedChangeIds: plan.changes.map((entry) => String(entry.id)),
        membershipFingerprint: snapshot.membershipFingerprint
      }]
    };
  }

  function resolveRequestedOrder(folderRequest, items) {
    const sourceItems = uniqueItems(items);
    const expectedIds = uniqueIds(folderRequest?.finalOrder);
    const actualIds = sourceItems.map(idOf);
    if (!expectedIds.length) {
      return { ok: false, reason: "final-order-required", items: [] };
    }
    if (
      folderRequest?.membershipFingerprint &&
      folderRequest.membershipFingerprint !== fingerprintIds(actualIds)
    ) {
      return { ok: false, reason: "membership-changed", items: [] };
    }
    const ordered = exactOrder(sourceItems, expectedIds);
    if (!ordered) {
      return { ok: false, reason: "final-order-mismatch", items: [] };
    }
    return {
      ok: true,
      reason: "",
      items: ordered,
      finalIds: ordered.map(idOf),
      membershipFingerprint: fingerprintIds(actualIds)
    };
  }

  return {
    buildRenamePlan,
    createCurrentFolderRenameRequest,
    exactOrder,
    partialRenderedOrder,
    fingerprintIds,
    guard,
    resolveOrder,
    resolveRequestedOrder,
    uniqueIds,
    uniqueItems
  };
}

module.exports = { createSortingSystemRuntime };
