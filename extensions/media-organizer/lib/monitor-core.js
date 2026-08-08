"use strict";

function createScanContextKey(context = {}) {
  return JSON.stringify([
    String(context.contextId || ""),
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

module.exports = {
  createScanContextKey,
  shouldRefreshAfterMetadataScan,
  canWarmTakenAtMetadata
};
