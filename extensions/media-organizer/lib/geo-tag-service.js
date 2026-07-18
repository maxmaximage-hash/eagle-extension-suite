"use strict";

const fs = require("fs");
const path = require("path");

const STATE_VERSION = 1;
const BATCH_SIZE = 50;

function defaultState() {
  return {
    version: STATE_VERSION,
    globalEnabled: true,
    libraries: {}
  };
}

function createLibraryState() {
  return {
    initializedAt: new Date().toISOString(),
    records: {},
    coordinateCache: {}
  };
}

function chunks(values, size = BATCH_SIZE) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function mapWithConcurrency(items, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await worker(items[index], index);
      }
    }
  );
  await Promise.all(runners);
}

function coordinateKey(location) {
  return `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
}

function statsForLibrary(library) {
  const stats = {
    pending: 0,
    tagged: 0,
    existing: 0,
    noGps: 0,
    unresolved: 0,
    unsupported: 0,
    total: 0
  };
  for (const record of Object.values(library?.records || {})) {
    stats.total += 1;
    if (record.status === "no_gps") stats.noGps += 1;
    else if (record.status in stats) stats[record.status] += 1;
  }
  return stats;
}

function statsForIds(library, ids, outcomes = {}) {
  const scoped = {
    pending: 0,
    suggested: 0,
    tagged: 0,
    existing: 0,
    noGps: 0,
    unresolved: 0,
    unsupported: 0,
    total: 0
  };
  const uniqueIds = new Set((ids || []).map(String));
  for (const id of uniqueIds) {
    scoped.total += 1;
    const status = outcomes[id] || library?.records?.[id]?.status;
    if (status === "no_gps") scoped.noGps += 1;
    else if (status in scoped) scoped[status] += 1;
  }
  return scoped;
}

function locationDistributionForIds(library, ids, outcomes = {}, suggestions = {}) {
  const locations = new Map();
  const uniqueIds = new Set((ids || []).map(String));
  for (const id of uniqueIds) {
    const record = library?.records?.[id];
    const suggestion = suggestions[id];
    const tag = String(suggestion?.tag || record?.tag || "").trim();
    const status = outcomes[id] || record?.status;
    if (!tag || !["suggested", "tagged", "existing"].includes(status)) continue;
    if (!locations.has(tag)) {
      locations.set(tag, {
        tag,
        total: 0,
        suggested: 0,
        added: 0,
        existing: 0
      });
    }
    const entry = locations.get(tag);
    entry.total += 1;
    if (status === "suggested") entry.suggested += 1;
    else if (status === "tagged") entry.added += 1;
    else entry.existing += 1;
  }
  return Array.from(locations.values()).sort(
    (left, right) => right.total - left.total || left.tag.localeCompare(right.tag)
  );
}

function createGeoTagService(options) {
  const {
    eagle,
    pluginPath,
    resolver,
    mediaTypeForExtension,
    readMediaLocation,
    onProgress = () => {},
    onStateChange = () => {},
    log = console
  } = options;
  const statePath = path.join(pluginPath, "geo-tag-state.json");
  let state = defaultState();
  let currentLibraryPath = "";
  let saveTimer = null;
  let activeJob = null;
  let progress = null;
  let resultScope = { kind: null, ids: [], outcomes: {}, suggestions: {} };

  function libraryKey() {
    return path.normalize(currentLibraryPath || eagle.library?.path || "unknown-library");
  }

  function currentLibrary() {
    const key = libraryKey();
    if (!state.libraries[key]) state.libraries[key] = createLibraryState();
    return state.libraries[key];
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const temporaryPath = `${statePath}.tmp`;
    await fs.promises.writeFile(temporaryPath, JSON.stringify(state), "utf8");
    await fs.promises.rename(temporaryPath, statePath);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveNow().catch((error) => log.warn("Unable to save geo tag state", error));
    }, 500);
  }

  function emitState() {
    onStateChange(getSnapshot());
  }

  function setProgress(nextProgress) {
    progress = nextProgress;
    onProgress(nextProgress);
    emitState();
  }

  async function readState() {
    try {
      const parsed = JSON.parse(await fs.promises.readFile(statePath, "utf8"));
      if (parsed.version === STATE_VERSION && parsed.libraries) state = parsed;
    } catch (error) {
      if (error.code !== "ENOENT") log.warn("Unable to read geo tag state", error);
    }
  }

  async function ensureLibraryInitialized() {
    const key = libraryKey();
    if (state.libraries[key]) return;
    const library = createLibraryState();
    state.libraries[key] = library;
    const ids = await eagle.item.getIdsWithModifiedAt();
    for (const entry of ids) {
      library.records[String(entry.id)] = {
        status: "pending",
        origin: "historical",
        modifiedAt: entry.modifiedAt || null
      };
    }
    await saveNow();
    emitState();
  }

  async function initialize(nextLibraryPath) {
    currentLibraryPath = nextLibraryPath || eagle.library?.path || currentLibraryPath;
    await readState();
    await ensureLibraryInitialized();
    emitState();
    return getSnapshot();
  }

  async function switchLibrary(nextLibraryPath) {
    currentLibraryPath = nextLibraryPath || eagle.library?.path || "";
    await ensureLibraryInitialized();
    emitState();
  }

  function findExistingGeoTag(tags, record) {
    const manualTag = String(record?.tag || "").trim();
    if (
      manualTag &&
      String(record?.source || "").includes("manual") &&
      (tags || []).includes(manualTag)
    ) {
      return manualTag;
    }
    return (tags || []).find((tag) => resolver.labels.has(String(tag)));
  }

  async function processItem(item, record, force, previewOnly = false) {
    const library = currentLibrary();
    const id = String(item.id);
    const mediaType = mediaTypeForExtension(item.ext);
    if (!mediaType) {
      library.records[id] = { status: "unsupported", processedAt: Date.now() };
      return "unsupported";
    }

    const existingTag = findExistingGeoTag(item.tags, record);
    if (existingTag) {
      if (record?.status !== "tagged" || record.tag !== existingTag) {
        library.records[id] = {
          status: "existing",
          tag: existingTag,
          processedAt: Date.now(),
          databaseVersion: resolver.version
        };
      }
      return "existing";
    }

    if (!force && record && !["pending"].includes(record.status)) {
      return record.status;
    }

    let location;
    try {
      location = await readMediaLocation(item.filePath, item.ext);
    } catch (error) {
      const attempts = Number(record?.attempts || 0) + 1;
      if (record?.origin === "automatic" && attempts < 3) {
        library.records[id] = {
          status: "pending",
          origin: "automatic",
          attempts,
          reason: error.message,
          retryAfter: Date.now() + attempts * 10000
        };
        return "pending";
      }
      library.records[id] = {
        status: "unresolved",
        reason: `元数据读取失败：${error.message}`,
        processedAt: Date.now(),
        databaseVersion: resolver.version
      };
      return "unresolved";
    }

    if (!location) {
      library.records[id] = {
        status: "no_gps",
        reason: "媒体没有 GPS 坐标",
        processedAt: Date.now(),
        databaseVersion: resolver.version
      };
      return "no_gps";
    }

    const key = coordinateKey(location);
    let resolved = library.coordinateCache[key];
    if (!resolved || resolved.databaseVersion !== resolver.version) {
      resolved = {
        ...resolver.resolve(location.latitude, location.longitude),
        databaseVersion: resolver.version
      };
      library.coordinateCache[key] = resolved;
    }

    if (resolved.status !== "resolved" || !resolved.label) {
      library.records[id] = {
        status: "unresolved",
        reason: resolved.reason || "坐标无法识别",
        processedAt: Date.now(),
        databaseVersion: resolver.version
      };
      return "unresolved";
    }

    if (previewOnly) {
      return {
        status: "suggested",
        suggestion: {
          tag: resolved.label,
          scope: resolved.scope
        }
      };
    }

    item.tags = Array.from(new Set([...(item.tags || []), resolved.label]));
    try {
      await item.save();
    } catch (error) {
      library.records[id] = {
        status: "unresolved",
        reason: `标签写入失败：${error.message}`,
        processedAt: Date.now(),
        databaseVersion: resolver.version
      };
      return "unresolved";
    }
    library.records[id] = {
      status: "tagged",
      tag: resolved.label,
      scope: resolved.scope,
      processedAt: Date.now(),
      databaseVersion: resolver.version
    };
    return "tagged";
  }

  async function processIds(ids, jobOptions = {}) {
    if (activeJob) return activeJob;
    const uniqueIds = Array.from(new Set((ids || []).map(String)));
    const { kind = "manual", force = false, previewOnly = false } = jobOptions;
    if (kind !== "automatic" || !resultScope.ids.length) {
      resultScope = { kind, ids: uniqueIds, outcomes: {}, suggestions: {} };
      emitState();
    }
    activeJob = (async () => {
      const library = currentLibrary();
      let processed = 0;
      const outcomes = {};
      setProgress({ kind, stage: "reading", current: 0, total: uniqueIds.length });

      for (const idBatch of chunks(uniqueIds)) {
        const items = await eagle.item.getByIds(idBatch);
        const itemById = new Map(items.map((item) => [String(item.id), item]));
        await mapWithConcurrency(idBatch, 3, async (id) => {
          const item = itemById.get(id);
          if (!item) {
            library.records[id] = {
              status: "unresolved",
              reason: "Eagle 中找不到项目",
              processedAt: Date.now()
            };
            outcomes.unresolved = (outcomes.unresolved || 0) + 1;
            if (resultScope.kind === kind) {
              resultScope.outcomes[id] = "unresolved";
            }
          } else {
            const itemResult = await processItem(
              item,
              library.records[id],
              force,
              previewOnly
            );
            const outcome = typeof itemResult === "string"
              ? itemResult
              : itemResult.status;
            if (itemResult?.suggestion && resultScope.kind === kind) {
              resultScope.suggestions[id] = itemResult.suggestion;
            }
            outcomes[outcome] = (outcomes[outcome] || 0) + 1;
            if (resultScope.kind === kind) {
              resultScope.outcomes[id] = outcome;
            }
          }
          processed += 1;
          if (processed % 10 === 0 || processed === uniqueIds.length) {
            setProgress({
              kind,
              stage: "processing",
              current: processed,
              total: uniqueIds.length,
              outcomes: { ...outcomes }
            });
          }
        });
        scheduleSave();
      }
      await saveNow();
      setProgress({
        kind,
        stage: "complete",
        current: processed,
        total: uniqueIds.length,
        outcomes
      });
      return { processed, outcomes };
    })().finally(() => {
      activeJob = null;
      setTimeout(() => {
        if (!activeJob && progress?.stage === "complete") {
          progress = null;
          emitState();
        }
      }, 3000);
    });
    return activeJob;
  }

  async function scanExisting() {
    await ensureLibraryInitialized();
    const library = currentLibrary();
    const ids = Object.entries(library.records)
      .filter(([, record]) => record.status === "pending")
      .map(([id]) => id);
    return processIds(ids, { kind: "historical", force: false });
  }

  async function scanCurrent(ids) {
    const library = currentLibrary();
    for (const id of ids || []) {
      const normalizedId = String(id);
      if (!library.records[normalizedId]) {
        library.records[normalizedId] = { status: "pending", origin: "manual" };
      }
    }
    return processIds(ids, {
      kind: "current",
      force: true,
      previewOnly: true
    });
  }

  async function retryExceptions() {
    const library = currentLibrary();
    const ids = Object.entries(library.records)
      .filter(([, record]) => record.status === "unresolved")
      .map(([id]) => id);
    return processIds(ids, { kind: "retry", force: true });
  }

  async function poll() {
    if (!state.globalEnabled || activeJob) return null;
    await ensureLibraryInitialized();
    const library = currentLibrary();
    const allIds = await eagle.item.getIdsWithModifiedAt();
    const now = Date.now();
    const automaticIds = [];
    for (const entry of allIds) {
      const id = String(entry.id);
      const record = library.records[id];
      if (!record) {
        library.records[id] = {
          status: "pending",
          origin: "automatic",
          modifiedAt: entry.modifiedAt || null
        };
        automaticIds.push(id);
      } else if (
        record.status === "pending" &&
        record.origin === "automatic" &&
        Number(record.retryAfter || 0) <= now
      ) {
        automaticIds.push(id);
      }
    }
    if (!automaticIds.length) return null;
    scheduleSave();
    return processIds(automaticIds, { kind: "automatic", force: false });
  }

  async function setGlobalEnabled(enabled) {
    state.globalEnabled = Boolean(enabled);
    await ensureLibraryInitialized();
    await saveNow();
    emitState();
    if (state.globalEnabled) return poll();
    return null;
  }

  async function markManualTags(ids, tag) {
    const library = currentLibrary();
    for (const id of ids || []) {
      library.records[String(id)] = {
        status: "existing",
        tag: String(tag || "").trim(),
        source: "folder-manual",
        processedAt: Date.now(),
        databaseVersion: resolver.version
      };
    }
    await saveNow();
    emitState();
  }

  async function confirmCurrentSuggestions() {
    if (activeJob) return activeJob;
    if (resultScope.kind !== "current") {
      throw new Error("请先扫描当前文件夹");
    }
    const entries = Object.entries(resultScope.suggestions || {});
    if (!entries.length) return { processed: 0, succeeded: 0, failed: 0 };

    activeJob = (async () => {
      const library = currentLibrary();
      let processed = 0;
      let succeeded = 0;
      let failed = 0;
      setProgress({
        kind: "current-confirm",
        stage: "processing",
        current: 0,
        total: entries.length
      });
      for (const entryBatch of chunks(entries)) {
        const ids = entryBatch.map(([id]) => id);
        const items = await eagle.item.getByIds(ids);
        const itemById = new Map(items.map((item) => [String(item.id), item]));
        await mapWithConcurrency(entryBatch, 3, async ([id, suggestion]) => {
          const item = itemById.get(id);
          if (!item) {
            failed += 1;
          } else {
            const originalTags = [...(item.tags || [])];
            item.tags = Array.from(new Set([...originalTags, suggestion.tag]));
            try {
              await item.save();
              library.records[id] = {
                status: "tagged",
                tag: suggestion.tag,
                scope: suggestion.scope,
                source: "current-confirmed",
                processedAt: Date.now(),
                databaseVersion: resolver.version
              };
              resultScope.outcomes[id] = "tagged";
              delete resultScope.suggestions[id];
              succeeded += 1;
            } catch (error) {
              item.tags = originalTags;
              failed += 1;
              log.warn(`Unable to confirm location for ${id}`, error);
            }
          }
          processed += 1;
          if (processed % 10 === 0 || processed === entries.length) {
            setProgress({
              kind: "current-confirm",
              stage: "processing",
              current: processed,
              total: entries.length,
              outcomes: { succeeded, failed }
            });
          }
        });
        scheduleSave();
      }
      await saveNow();
      setProgress({
        kind: "current-confirm",
        stage: "complete",
        current: processed,
        total: entries.length,
        outcomes: { succeeded, failed }
      });
      return { processed, succeeded, failed };
    })().finally(() => {
      activeJob = null;
      setTimeout(() => {
        if (!activeJob && progress?.stage === "complete") {
          progress = null;
          emitState();
        }
      }, 3000);
    });
    return activeJob;
  }

  async function assignManualLocation(ids, tag) {
    if (activeJob) return activeJob;
    const normalizedTag = String(tag || "").trim();
    if (!normalizedTag) throw new Error("请输入地点标签");
    const scopeIds = new Set(resultScope.ids.map(String));
    const uniqueIds = Array.from(
      new Set((ids || []).map(String).filter((id) => scopeIds.has(id)))
    );
    if (!uniqueIds.length) return { processed: 0, succeeded: 0, failed: 0 };

    activeJob = (async () => {
      const library = currentLibrary();
      let processed = 0;
      let succeeded = 0;
      let failed = 0;
      setProgress({
        kind: "manual-correction",
        stage: "processing",
        current: 0,
        total: uniqueIds.length
      });
      for (const idBatch of chunks(uniqueIds)) {
        const items = await eagle.item.getByIds(idBatch);
        const itemById = new Map(items.map((item) => [String(item.id), item]));
        await mapWithConcurrency(idBatch, 3, async (id) => {
          const item = itemById.get(id);
          const previousRecord = library.records[id];
          if (!item) {
            failed += 1;
          } else {
            const originalTags = [...(item.tags || [])];
            const previousManualTag = String(previousRecord?.tag || "").trim();
            item.tags = Array.from(new Set([
              ...originalTags.filter((existingTag) => {
                if (resolver.labels.has(String(existingTag))) return false;
                return !previousManualTag || existingTag !== previousManualTag;
              }),
              normalizedTag
            ]));
            try {
              await item.save();
              library.records[id] = {
                status: "existing",
                tag: normalizedTag,
                source: "manual-correction",
                processedAt: Date.now(),
                databaseVersion: resolver.version
              };
              resultScope.outcomes[id] = "existing";
              delete resultScope.suggestions[id];
              succeeded += 1;
            } catch (error) {
              item.tags = originalTags;
              failed += 1;
              log.warn(`Unable to apply manual location to ${id}`, error);
            }
          }
          processed += 1;
          if (processed % 10 === 0 || processed === uniqueIds.length) {
            setProgress({
              kind: "manual-correction",
              stage: "processing",
              current: processed,
              total: uniqueIds.length,
              outcomes: { succeeded, failed }
            });
          }
        });
        scheduleSave();
      }
      await saveNow();
      setProgress({
        kind: "manual-correction",
        stage: "complete",
        current: processed,
        total: uniqueIds.length,
        outcomes: { succeeded, failed }
      });
      return { processed, succeeded, failed };
    })().finally(() => {
      activeJob = null;
      setTimeout(() => {
        if (!activeJob && progress?.stage === "complete") {
          progress = null;
          emitState();
        }
      }, 3000);
    });
    return activeJob;
  }

  function clearResults() {
    resultScope = { kind: null, ids: [], outcomes: {}, suggestions: {} };
    emitState();
  }

  async function listResultItemsByTag(tag) {
    const normalizedTag = String(tag || "").trim();
    const library = currentLibrary();
    const ids = resultScope.ids.filter((id) => {
      const normalizedId = String(id);
      return (
        resultScope.suggestions[normalizedId]?.tag === normalizedTag ||
        library.records[normalizedId]?.tag === normalizedTag
      );
    });
    const result = [];
    for (const idBatch of chunks(ids)) {
      const items = await eagle.item.getByIds(idBatch);
      const itemById = new Map(items.map((item) => [String(item.id), item]));
      for (const id of idBatch) {
        const item = itemById.get(String(id));
        if (!item) continue;
        result.push({
          id: String(id),
          name: `${item.name || "未命名"}.${item.ext || ""}`.replace(/\.$/, ""),
          thumbnailURL: item.thumbnailURL || item.fileURL || ""
        });
      }
    }
    return result;
  }

  async function listExceptions(status) {
    const library = currentLibrary();
    const ids = resultScope.ids.filter(
      (id) => library.records[String(id)]?.status === status
    );
    const result = [];
    for (const idBatch of chunks(ids)) {
      const items = await eagle.item.getByIds(idBatch);
      const itemById = new Map(items.map((item) => [String(item.id), item]));
      for (const id of idBatch) {
        const item = itemById.get(id);
        if (!item) continue;
        result.push({
          id,
          name: `${item.name || "未命名"}.${item.ext || ""}`.replace(/\.$/, ""),
          thumbnailURL: item.thumbnailURL || item.fileURL || "",
          reason: library.records[id]?.reason || ""
        });
      }
    }
    return result;
  }

  function locationTagSuggestions(tagNames = []) {
    const recordTags = new Set(
      Object.values(currentLibrary().records || {})
        .map((record) => String(record?.tag || "").trim())
        .filter(Boolean)
    );
    return Array.from(
      new Set((tagNames || []).map((tag) => String(tag || "").trim()).filter(Boolean))
    ).filter((tag) => resolver.labels.has(tag) || recordTags.has(tag));
  }

  function getSnapshot() {
    const library = currentLibrary();
    return {
      globalEnabled: Boolean(state.globalEnabled),
      libraryPath: libraryKey(),
      stats: statsForLibrary(library),
      resultStats: statsForIds(library, resultScope.ids, resultScope.outcomes),
      resultLocations: locationDistributionForIds(
        library,
        resultScope.ids,
        resultScope.outcomes,
        resultScope.suggestions
      ),
      resultKind: resultScope.kind,
      progress,
      active: Boolean(activeJob),
      databaseVersion: resolver.version
    };
  }

  return {
    assignManualLocation,
    clearResults,
    confirmCurrentSuggestions,
    getSnapshot,
    initialize,
    listExceptions,
    listResultItemsByTag,
    locationTagSuggestions,
    markManualTags,
    poll,
    retryExceptions,
    scanCurrent,
    scanExisting,
    setGlobalEnabled,
    switchLibrary
  };
}

module.exports = {
  coordinateKey,
  createGeoTagService,
  locationDistributionForIds,
  statsForIds,
  statsForLibrary
};
