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

module.exports = {
  createScanContextKey,
  shouldRefreshAfterMetadataScan
};
