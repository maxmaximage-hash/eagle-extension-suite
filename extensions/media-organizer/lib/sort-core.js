"use strict";

function createMediaSortRuntime(options) {
  const imageExtensions = new Set(options.imageExtensions || []);
  const videoExtensions = new Set(options.videoExtensions || []);
  const locale = String(options.language || "").replace(/_/g, "-") || undefined;
  const validFields = new Set([
    "NAME_GROUP",
    "NAME",
    "TAKEN_AT",
    "MEDIA_KIND",
    "EXT",
    "IMPORT",
    "MTIME",
    "BTIME",
    "FILESIZE",
    "RESOLUTION",
    "RATING",
    "DURATION"
  ]);
  const defaultRules = [
    { field: "NAME_GROUP", direction: "asc" },
    { field: "TAKEN_AT", direction: "asc" }
  ];
  let collator;
  try {
    collator = new Intl.Collator(locale, {
      numeric: true,
      sensitivity: "base"
    });
  } catch {
    collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function extensionOf(item) {
    return String(item && item.ext || "").toLowerCase();
  }

  function mediaKind(item) {
    const extension = extensionOf(item);
    if (imageExtensions.has(extension)) return 0;
    if (videoExtensions.has(extension)) return 1;
    return 2;
  }

  function isMedia(item) {
    return mediaKind(item) < 2;
  }

  function compareStrings(a, b) {
    return collator.compare(String(a || ""), String(b || ""));
  }

  function nameGroup(item) {
    const name = String(item && item.name || "").trim();
    const match = name.match(/^(.+?)(?:\s*[-_.]\s*|\s+)/);
    return match ? match[1].trim() : name;
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function valueForField(item, field, timestamps) {
    if (!item) return null;
    switch (field) {
      case "NAME_GROUP":
        return nameGroup(item);
      case "NAME":
        return String(item.name || "");
      case "TAKEN_AT":
        return numberOrNull(timestamps[item.id]);
      case "MEDIA_KIND":
        return mediaKind(item);
      case "EXT":
        return extensionOf(item);
      case "MTIME":
        return numberOrNull(item.mtime || item.modificationTime);
      case "BTIME":
        return numberOrNull(item.btime || item.modificationTime);
      case "FILESIZE":
        return numberOrNull(item.size);
      case "RESOLUTION":
        return numberOrNull(Number(item.width) * Number(item.height));
      case "RATING":
        return numberOrNull(item.star || 0);
      case "DURATION":
        return numberOrNull(item.duration || 0);
      case "IMPORT":
      default:
        return numberOrNull(item.modificationTime);
    }
  }

  function normalizeRules(rules) {
    if (!Array.isArray(rules)) return defaultRules.map((rule) => ({ ...rule }));
    const normalized = rules
      .filter((rule) => rule && validFields.has(rule.field))
      .slice(0, 8)
      .map((rule) => ({
        field: rule.field,
        direction:
          rule.field === "NAME_GROUP"
            ? "asc"
            : rule.direction === "desc"
              ? "desc"
              : "asc"
      }));
    return normalized.length
      ? normalized
      : defaultRules.map((rule) => ({ ...rule }));
  }

  function compareField(a, b, rule, timestamps) {
    const aValue = valueForField(a, rule.field, timestamps);
    const bValue = valueForField(b, rule.field, timestamps);
    const aValid = aValue !== null && aValue !== undefined && aValue !== "";
    const bValid = bValue !== null && bValue !== undefined && bValue !== "";
    if (aValid !== bValid) return aValid ? -1 : 1;
    if (!aValid) return 0;

    let result;
    if (typeof aValue === "string" || typeof bValue === "string") {
      result = compareStrings(aValue, bValue);
    } else {
      result = aValue === bValue ? 0 : aValue < bValue ? -1 : 1;
    }
    return rule.direction === "desc" ? -result : result;
  }

  function pinnedValue(item, folderId) {
    if (!folderId || !item || !item.pinned) return null;
    return numberOrNull(item.pinned[folderId]);
  }

  function applyManualOrder(items, manualOrder) {
    if (!Array.isArray(manualOrder) || manualOrder.length === 0) return items;
    const positions = new Map();
    manualOrder.forEach((id, index) => positions.set(String(id), index));
    return items.slice().sort((a, b) => {
      const aPosition = positions.get(String(a && a.id || ""));
      const bPosition = positions.get(String(b && b.id || ""));
      const aKnown = Number.isFinite(aPosition);
      const bKnown = Number.isFinite(bPosition);
      if (aKnown && bKnown) return aPosition - bPosition;
      if (aKnown !== bKnown) return aKnown ? -1 : 1;
      return 0;
    });
  }

  function moveItems(items, selectedIds, targetId, insertAfter) {
    const selected = new Set(
      Array.from(selectedIds || []).map((id) => String(id))
    );
    const normalizedTargetId = String(targetId || "");
    if (!normalizedTargetId || selected.size === 0) return items.slice();
    if (selected.has(normalizedTargetId)) return items.slice();

    const moved = items.filter((item) => selected.has(String(item && item.id)));
    if (moved.length === 0) return items.slice();
    const remaining = items.filter(
      (item) => !selected.has(String(item && item.id))
    );
    let targetIndex = remaining.findIndex(
      (item) => String(item && item.id) === normalizedTargetId
    );
    if (targetIndex < 0) return items.slice();
    if (insertAfter) targetIndex += 1;

    const result = remaining.slice();
    result.splice(targetIndex, 0, ...moved);
    return result;
  }

  function collectFolderTree(folder) {
    if (!folder || !folder.id) return [];
    const result = [];
    const visited = new Set();
    const stack = [folder];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || !current.id || visited.has(current.id)) continue;
      visited.add(current.id);
      result.push(current);
      const children = Array.isArray(current.children) ? current.children : [];
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push(children[index]);
      }
    }
    return result;
  }

  function sortDesired(items, config) {
    const timestamps = config.timestamps || Object.create(null);
    const folderId = config.folderId || "";
    const rules = normalizeRules(config.rules);

    const sorted = items.slice().sort((a, b) => {
      const aPinned = pinnedValue(a, folderId);
      const bPinned = pinnedValue(b, folderId);
      const aIsPinned = Number.isFinite(aPinned);
      const bIsPinned = Number.isFinite(bPinned);
      if (aIsPinned !== bIsPinned) return aIsPinned ? -1 : 1;
      if (aIsPinned && bIsPinned && aPinned !== bPinned) {
        return bPinned - aPinned;
      }

      for (const rule of rules) {
        const result = compareField(a, b, rule, timestamps);
        if (result !== 0) return result;
      }

      const nameResult = compareStrings(a && a.name, b && b.name);
      if (nameResult !== 0) return nameResult;
      return compareStrings(a && a.id, b && b.id);
    });

    return applyManualOrder(sorted, config.manualOrder);
  }

  return {
    applyManualOrder,
    collectFolderTree,
    defaultRules: defaultRules.map((rule) => ({ ...rule })),
    isMedia,
    mediaKind,
    moveItems,
    nameGroup,
    normalizeRules,
    sortDesired
  };
}

module.exports = {
  createMediaSortRuntime
};
