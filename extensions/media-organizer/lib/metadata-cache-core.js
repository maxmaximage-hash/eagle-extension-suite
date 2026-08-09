"use strict";

const CACHE_SCHEMA_VERSION = 3;

function createMetadataCacheRuntime(options = {}) {
  const normalizeLibraryId = typeof options.normalizeLibraryId === "function"
    ? options.normalizeLibraryId
    : (value) => String(value || "");

  function libraryIdOf(value) {
    const raw = String(value || "");
    return raw ? String(normalizeLibraryId(raw) || "") : "";
  }

  function empty() {
    return {
      version: CACHE_SCHEMA_VERSION,
      activeLibraryId: "",
      libraries: Object.create(null)
    };
  }

  function normalizePartition(value = {}) {
    return {
      items: value?.items && typeof value.items === "object"
        ? { ...value.items }
        : {}
    };
  }

  function load(raw = {}) {
    const cache = empty();
    if (
      Number(raw?.version) === CACHE_SCHEMA_VERSION &&
      raw?.libraries && typeof raw.libraries === "object"
    ) {
      for (const [rawLibraryId, value] of Object.entries(raw.libraries)) {
        const libraryId = libraryIdOf(rawLibraryId);
        if (!libraryId) continue;
        cache.libraries[libraryId] = normalizePartition(value);
      }
      return cache;
    }
    if (Number(raw?.version) === 2 && raw?.items && raw?.libraryPath) {
      const libraryId = libraryIdOf(raw.libraryPath);
      if (libraryId) {
        cache.libraries[libraryId] = normalizePartition({ items: raw.items });
      }
    }
    return cache;
  }

  function activate(cache, libraryId) {
    const normalized = libraryIdOf(libraryId);
    cache.activeLibraryId = normalized;
    if (normalized && !cache.libraries[normalized]) {
      cache.libraries[normalized] = normalizePartition();
    }
    return normalized;
  }

  function items(cache, libraryId = cache?.activeLibraryId) {
    const normalized = libraryIdOf(libraryId);
    if (!normalized) return {};
    if (!cache.libraries[normalized]) {
      cache.libraries[normalized] = normalizePartition();
    }
    return cache.libraries[normalized].items;
  }

  function itemSignature(item = {}) {
    const size = Number(item.size);
    const modified = Number(
      item.modifiedAt ?? item.mtime ?? item.modificationTime
    );
    if (!Number.isFinite(size) || !Number.isFinite(modified)) return "";
    return `${Math.trunc(size)}:${Math.trunc(modified)}`;
  }

  function lookup(cache, item = {}, libraryId = cache?.activeLibraryId) {
    const id = String(item.id || "");
    const signature = itemSignature(item);
    const cached = id ? items(cache, libraryId)[id] : null;
    if (
      !cached || !signature ||
      (cached.hostSignature !== signature && cached.signature !== signature)
    ) {
      return { hit: false, value: null, record: cached || null };
    }
    return {
      hit: true,
      value: Number.isFinite(cached.takenAt) ? cached.takenAt : null,
      record: cached
    };
  }

  function classify(cache, sourceItems = [], libraryId = cache?.activeLibraryId) {
    const hits = [];
    const misses = [];
    for (const item of Array.isArray(sourceItems) ? sourceItems : []) {
      const result = lookup(cache, item, libraryId);
      if (result.hit) hits.push({ item, value: result.value });
      else misses.push(item);
    }
    return { hits, misses };
  }

  function write(
    cache,
    item = {},
    value = {},
    libraryId = cache?.activeLibraryId
  ) {
    const id = String(item.id || "");
    if (!id) return null;
    const hostSignature = itemSignature(item);
    const record = {
      signature: String(value.signature || hostSignature || ""),
      hostSignature: String(value.hostSignature || hostSignature || ""),
      mediaType: String(value.mediaType || ""),
      takenAt: Number.isFinite(value.takenAt) ? value.takenAt : null
    };
    if (value.missingSentinel === true) record.missingSentinel = true;
    items(cache, libraryId)[id] = record;
    return record;
  }

  function serialize(cache) {
    const libraries = {};
    for (const [libraryId, partition] of Object.entries(cache?.libraries || {})) {
      libraries[libraryId] = normalizePartition(partition);
    }
    return {
      version: CACHE_SCHEMA_VERSION,
      activeLibraryId: String(cache?.activeLibraryId || ""),
      libraries
    };
  }

  return Object.freeze({
    empty,
    load,
    activate,
    items,
    itemSignature,
    lookup,
    classify,
    write,
    serialize
  });
}

module.exports = {
  CACHE_SCHEMA_VERSION,
  createMetadataCacheRuntime
};
