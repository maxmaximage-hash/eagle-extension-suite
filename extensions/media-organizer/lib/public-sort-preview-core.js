"use strict";

function createPublicSortPreviewRuntime(options = {}) {
  const sortRuntime = options.sortRuntime;
  if (!sortRuntime || typeof sortRuntime.buildSortResult !== "function") {
    throw new Error("sortRuntime.buildSortResult is required");
  }

  function buildPreview(items, config = {}) {
    const source = Array.isArray(items) ? items.filter(Boolean) : [];
    const result = sortRuntime.buildSortResult(source, config);
    return {
      rules: Array.isArray(result.rules) ? result.rules : [],
      sourceItems: source,
      orderedItems: Array.isArray(result.finalItems) ? result.finalItems : [],
      missingTakenAt: Array.isArray(result.missingTakenAt)
        ? result.missingTakenAt
        : []
    };
  }

  function exportLines(preview) {
    return (Array.isArray(preview?.orderedItems) ? preview.orderedItems : [])
      .map((item, index) => `${index + 1}. ${String(item?.name || "")}`)
      .join("\n");
  }

  return Object.freeze({ buildPreview, exportLines });
}

module.exports = { createPublicSortPreviewRuntime };
