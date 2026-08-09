"use strict";

const SORT_SCHEMA_VERSION = 3;
const TAKEN_AT_SOURCES = Object.freeze([
  "DateTimeOriginal",
  "DateCreated",
  "CreateDate",
  "ModifyDate"
]);

function createMediaSortRuntime(options = {}) {
  // Eagle injects this factory through Function#toString, so runtime
  // constants must live inside the function as well as in module exports.
  const SORT_SCHEMA_VERSION = 3;
  const TAKEN_AT_SOURCES = Object.freeze([
    "DateTimeOriginal",
    "DateCreated",
    "CreateDate",
    "ModifyDate"
  ]);
  const imageExtensions = new Set(options.imageExtensions || []);
  const videoExtensions = new Set(options.videoExtensions || []);
  const locale = String(options.language || "").replace(/_/g, "-") || undefined;
  const validFields = new Set([
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
    {
      field: "NAME",
      direction: "asc",
      options: { groupPrefix: true, prefixOnly: true }
    },
    { field: "TAKEN_AT", direction: "asc" }
  ];
  let collator;
  try {
    collator = new Intl.Collator(locale, {
      numeric: true,
      sensitivity: "base",
      usage: "sort"
    });
  } catch {
    collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
      usage: "sort"
    });
  }

  function extensionOf(item) {
    return normalizeText(item && item.ext || "").replace(/^\./, "").toLowerCase();
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

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(/[‐‑‒–—―]/g, "-")
      .replace(/[＿]/g, "_")
      .replace(/[．]/g, ".")
      .replace(/\s+/g, " ")
      .trim();
  }

  function filenameParts(item) {
    const name = normalizeText(item && item.name || "");
    const extension = extensionOf(item);
    const group = name.match(/^(\d+)\s*[-_.]\s*/);
    return {
      name,
      extension,
      groupNumber: group ? Number(group[1]) : null,
      groupText: group ? group[0] : ""
    };
  }

  function nameGroup(item) {
    const parts = filenameParts(item);
    return Number.isFinite(parts.groupNumber)
      ? String(parts.groupNumber)
      : parts.name;
  }

  function compareStrings(a, b) {
    return collator.compare(normalizeText(a), normalizeText(b));
  }

  function compareFilenames(a, b, rule = {}) {
    const left = filenameParts(a);
    const right = filenameParts(b);
    const groupPrefix = rule.options?.groupPrefix !== false;
    if (groupPrefix) {
      const leftGrouped = Number.isFinite(left.groupNumber);
      const rightGrouped = Number.isFinite(right.groupNumber);
      if (leftGrouped !== rightGrouped) return leftGrouped ? -1 : 1;
      if (leftGrouped && left.groupNumber !== right.groupNumber) {
        return left.groupNumber - right.groupNumber;
      }
      // Prefix grouping is an option of the filename key. In prefix-only
      // mode the next configured key decides order inside each group.
      if (rule.options?.prefixOnly) return 0;
    }
    const nameResult = compareStrings(left.name, right.name);
    if (nameResult !== 0) return nameResult;
    return compareStrings(left.extension, right.extension);
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function timestampValue(value) {
    if (value && typeof value === "object") {
      for (const key of ["takenAt", "timestamp", ...TAKEN_AT_SOURCES]) {
        const candidate = numberOrNull(value[key]);
        if (candidate !== null) return candidate;
      }
      return null;
    }
    return numberOrNull(value);
  }

  function resolveTakenAt(item, timestamps = Object.create(null)) {
    if (!item) return null;
    const cached = timestampValue(timestamps[item.id]);
    if (cached !== null) return cached;
    for (const key of ["takenAt", ...TAKEN_AT_SOURCES]) {
      const value = timestampValue(item[key]);
      if (value !== null) return value;
    }
    return null;
  }

  function valueForField(item, field, timestamps) {
    if (!item) return null;
    switch (field) {
      case "NAME":
        return filenameParts(item).name;
      case "TAKEN_AT":
        return resolveTakenAt(item, timestamps);
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

  function normalizeRule(rule) {
    if (!rule) return null;
    const legacyNameGroup = rule.field === "NAME_GROUP";
    const field = legacyNameGroup ? "NAME" : rule.field;
    if (!validFields.has(field)) return null;
    const normalized = {
      field,
      direction: rule.direction === "desc" ? "desc" : "asc"
    };
    if (field === "NAME") {
      normalized.options = {
        groupPrefix: legacyNameGroup || rule.options?.groupPrefix !== false,
        prefixOnly: legacyNameGroup || rule.options?.prefixOnly === true
      };
    }
    return normalized;
  }

  function normalizeRules(rules) {
    if (!Array.isArray(rules)) return defaultRules.map(cloneRule);
    const normalized = rules
      .map(normalizeRule)
      .filter(Boolean)
      .slice(0, 8);
    return normalized.length ? normalized : defaultRules.map(cloneRule);
  }

  function cloneRule(rule) {
    return {
      field: rule.field,
      direction: rule.direction,
      ...(rule.options ? { options: { ...rule.options } } : {})
    };
  }

  function compareField(a, b, rule, timestamps) {
    if (rule.field === "NAME") {
      const result = compareFilenames(a, b, rule);
      return rule.direction === "desc" ? -result : result;
    }
    const aValue = valueForField(a, rule.field, timestamps);
    const bValue = valueForField(b, rule.field, timestamps);
    const aValid = aValue !== null && aValue !== undefined && aValue !== "";
    const bValid = bValue !== null && bValue !== undefined && bValue !== "";
    // Missing values are always last; changing direction never moves them.
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

  function applyManualOrder(items, manualOrder) {
    if (!Array.isArray(manualOrder) || manualOrder.length === 0) {
      return items.slice();
    }
    const byId = new Map(items.map((item) => [String(item?.id || ""), item]));
    const used = new Set();
    const result = [];
    for (const rawId of manualOrder) {
      const id = String(rawId || "");
      if (!id || used.has(id) || !byId.has(id)) continue;
      used.add(id);
      result.push(byId.get(id));
    }
    for (const item of items) {
      const id = String(item?.id || "");
      if (!used.has(id)) result.push(item);
    }
    return result;
  }

  function moveItems(items, selectedIds, targetId, insertAfter) {
    const selected = new Set(Array.from(selectedIds || []).map(String));
    const normalizedTargetId = String(targetId || "");
    if (!normalizedTargetId || selected.size === 0 || selected.has(normalizedTargetId)) {
      return items.slice();
    }
    const moved = items.filter((item) => selected.has(String(item?.id || "")));
    if (moved.length === 0) return items.slice();
    const remaining = items.filter((item) => !selected.has(String(item?.id || "")));
    let targetIndex = remaining.findIndex(
      (item) => String(item?.id || "") === normalizedTargetId
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

  function buildSortResult(items, config = {}) {
    const timestamps = config.timestamps || Object.create(null);
    const collectionId = config.collectionId || config.folderId || "";
    const rules = normalizeRules(config.rules);
    const decorated = items.map((item, sourceIndex) => ({ item, sourceIndex }));
    decorated.sort((left, right) => {
      const a = left.item;
      const b = right.item;
      // `item.pinned` belongs to Eagle's native manual layout. The plugin
      // keeps its own explicit relative manual overlay at L4; accepting the
      // native value here would silently let L0 base-state override an active
      // plugin automatic rule (R73).
      for (const rule of rules) {
        const result = compareField(a, b, rule, timestamps);
        if (result !== 0) return result;
      }
      const filenameResult = compareFilenames(a, b, {
        field: "NAME",
        direction: "asc",
        options: { groupPrefix: true }
      });
      if (filenameResult !== 0) return filenameResult;
      const idResult = compareStrings(a?.id, b?.id);
      return idResult !== 0 ? idResult : left.sourceIndex - right.sourceIndex;
    });
    const baseItems = decorated.map((entry) => entry.item);
    const manualOrder = config.manualOrder;
    const manualApplied = Array.isArray(manualOrder) && manualOrder.length > 0;
    const finalItems = manualApplied
      ? applyManualOrder(baseItems, manualOrder)
      : baseItems.slice();
    return {
      schemaVersion: SORT_SCHEMA_VERSION,
      rules,
      baseItems,
      finalItems,
      manualApplied,
      missingTakenAt: baseItems.filter(
        (item) => resolveTakenAt(item, timestamps) === null
      ).map((item) => String(item?.id || ""))
    };
  }

  function sortDesired(items, config) {
    return buildSortResult(items, config).finalItems;
  }

  return {
    SORT_SCHEMA_VERSION,
    TAKEN_AT_SOURCES,
    applyManualOrder,
    buildSortResult,
    collectFolderTree,
    compareFilenames,
    defaultRules: defaultRules.map(cloneRule),
    filenameParts,
    isMedia,
    mediaKind,
    moveItems,
    nameGroup,
    normalizeRules,
    normalizeText,
    resolveTakenAt,
    sortDesired
  };
}

module.exports = {
  SORT_SCHEMA_VERSION,
  TAKEN_AT_SOURCES,
  createMediaSortRuntime
};
