"use strict";

function createScanContextKey(context = {}) {
  return JSON.stringify([
    String(context.contextId || ""),
    String(context.currentSmartFolderId || ""),
    Math.max(0, Number(context.smartSnapshotGeneration) || 0),
    String(context.orderBy || ""),
    String(context.metaType || ""),
    String(context.itemFingerprint || ""),
    Array.isArray(context.rules) ? context.rules : []
  ]);
}

function shouldRefreshAfterMetadataScan(context = {}, options = {}) {
  // Metadata discovery is a background cache warm-up. Refreshing the host
  // grid is only safe after an explicit user switch or when a configured
  // multi-level rule actually depends on the newly discovered timestamps.
  return (
    (
      options.explicitSortChange === true ||
      options.sortNeedsMetadata === true
    ) &&
    context.folderLocked !== true
  );
}

function canWarmTakenAtMetadata(context = {}) {
  // Smart members belong to the host snapshot. Before READY, even a rendered
  // host grid is provisional: do not enumerate it, hydrate paths or touch the
  // timestamp cache. Normal/global behavior is intentionally unchanged.
  return !context.currentSmartFolderId || context.smartSnapshotPhase === "ready";
}

function reconcileMetadataPathHydration(sourceItems = [], hydratedItems = []) {
  const hydratedById = new Map(
    (Array.isArray(hydratedItems) ? hydratedItems : [])
      .filter((item) => item?.id)
      .map((item) => [String(item.id), item])
  );
  let hydratedCount = 0;
  const missingResponseIds = [];
  const items = (Array.isArray(sourceItems) ? sourceItems : []).map((item) => {
    const id = String(item?.id || "");
    if (!id || item?.filePath) return item;
    const hydrated = hydratedById.get(id);
    if (!hydrated) {
      missingResponseIds.push(id);
      return item;
    }
    if (hydrated.filePath) hydratedCount += 1;
    return hydrated;
  });
  const unresolvedIds = items
    .filter((item) => item?.id && !item.filePath)
    .map((item) => String(item.id));
  return { items, hydratedCount, unresolvedIds, missingResponseIds };
}

function nextMetadataRetryDelay(previousDelayMs, options = {}) {
  const initial = Math.max(1000, Number(options.initialDelayMs) || 5000);
  const maximum = Math.max(initial, Number(options.maximumDelayMs) || 60000);
  const previous = Math.max(0, Number(previousDelayMs) || 0);
  return previous > 0
    ? Math.min(maximum, Math.max(initial, previous * 2))
    : initial;
}

module.exports = {
  createScanContextKey,
  shouldRefreshAfterMetadataScan,
  canWarmTakenAtMetadata,
  reconcileMetadataPathHydration,
  nextMetadataRetryDelay
};
