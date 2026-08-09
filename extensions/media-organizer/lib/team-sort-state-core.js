"use strict";

const crypto = require("crypto");

const TEAM_SORT_FORMAT = "gravity-eagle-team-sort-state";
const TEAM_IMPORT_MARKER_KEY = "eagle.photoTakenSort.teamImport.v1";
const TEAM_IMPORT_BACKUP_KEY = "eagle.photoTakenSort.teamImportBackup.v1";
const TEAM_STATE_SUFFIX = ".eagle-team-state.json";

const TEAM_GLOBAL_STORAGE_KEYS = [
  "eagle.list.meta.type",
  "eagle.list.sortIncrease",
  "eagle.photoTakenSort.fallbackOrder",
  "eagle.photoTakenSort.manualEnabled",
  "eagle.photoTakenSort.rules.v1"
];

const TEAM_LIBRARY_STORAGE_KEYS = [
  "eagle.photoTakenSort.autoRename.v1",
  "eagle.photoTakenSort.folderLocks.v1",
  "eagle.photoTakenSort.protection.v2",
  "eagle.photoTakenSort.sortingLocks.v3",
  "eagle.photoTakenSort.manualMode.v1",
  "eagle.photoTakenSort.manualViews.v2",
  "eagle.photoTakenSort.metaProfiles.v1",
  "eagle.photoTakenSort.rules.v2"
];

function createTeamSortStateRuntime() {
  // This runtime is stringified into Eagle's main window. Resolve Node's
  // crypto module inside the factory instead of closing over module scope.
  const cryptoRuntime = typeof require === "function" ? require("crypto") : null;
  const TEAM_SORT_FORMAT = "gravity-eagle-team-sort-state";
  const TEAM_IMPORT_MARKER_KEY = "eagle.photoTakenSort.teamImport.v1";
  const TEAM_IMPORT_BACKUP_KEY = "eagle.photoTakenSort.teamImportBackup.v1";
  const TEAM_STATE_SUFFIX = ".eagle-team-state.json";
  const TEAM_GLOBAL_STORAGE_KEYS = [
    "eagle.list.meta.type",
    "eagle.list.sortIncrease",
    "eagle.photoTakenSort.fallbackOrder",
    "eagle.photoTakenSort.manualEnabled",
    "eagle.photoTakenSort.rules.v1"
  ];
  const TEAM_LIBRARY_STORAGE_KEYS = [
    "eagle.photoTakenSort.autoRename.v1",
    "eagle.photoTakenSort.folderLocks.v1",
    "eagle.photoTakenSort.protection.v2",
    "eagle.photoTakenSort.sortingLocks.v3",
    "eagle.photoTakenSort.manualMode.v1",
    "eagle.photoTakenSort.manualViews.v2",
    "eagle.photoTakenSort.metaProfiles.v1",
    "eagle.photoTakenSort.rules.v2"
  ];
  const importKeys = new Set([
    ...TEAM_GLOBAL_STORAGE_KEYS,
    ...TEAM_LIBRARY_STORAGE_KEYS
  ]);

  function sha256(value) {
    if (!cryptoRuntime) throw new Error("crypto-unavailable");
    return cryptoRuntime.createHash("sha256").update(value).digest("hex");
  }

  function cloneJson(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalizeLibraryId(value) {
    let normalized = String(value || "default");
    try {
      normalized = decodeURIComponent(normalized);
    } catch {}
    return normalized.replace(/\/+$/, "") || "default";
  }

  function resolveLibraryStore(store, currentLibraryId, create = true) {
    if (!store || typeof store !== "object") return null;
    if (!store.libraries || typeof store.libraries !== "object") {
      if (!create) return null;
      store.libraries = {};
    }

    const exactId = String(currentLibraryId || "default");
    if (store.libraries[exactId]) return store.libraries[exactId];

    const normalizedId = normalizeLibraryId(exactId);
    const matchingKey = Object.keys(store.libraries).find(
      (key) => normalizeLibraryId(key) === normalizedId
    );
    if (matchingKey) return store.libraries[matchingKey];
    if (!create) return null;

    store.libraries[exactId] = { folders: {} };
    return store.libraries[exactId];
  }

  function isLibraryReady(value) {
    const normalized = normalizeLibraryId(value);
    return normalized !== "default" && /\.library$/i.test(normalized);
  }

  function mergeMappedValue(existingValue, mappedValue) {
    const mapped = cloneJson(mappedValue);
    if (!mapped?.libraries || typeof mapped.libraries !== "object") {
      return mapped;
    }
    const existing = cloneJson(existingValue);
    if (!existing?.libraries || typeof existing.libraries !== "object") {
      return mapped;
    }
    return {
      ...existing,
      ...mapped,
      libraries: {
        ...existing.libraries,
        ...mapped.libraries
      }
    };
  }

  function containsMappedLibrary(existingValue, mappedValue, libraryId) {
    const expected = resolveLibraryStore(mappedValue, libraryId, false);
    if (!expected) return true;
    const actual = resolveLibraryStore(existingValue, libraryId, false);
    if (!actual) return false;
    const expectedFolders = Object.keys(expected.folders || {});
    if (!expectedFolders.every((folderId) => actual.folders?.[folderId])) {
      return false;
    }
    const expectedSmartFolders = Object.keys(expected.smartFolders || {});
    return expectedSmartFolders.every(
      (folderId) => actual.smartFolders?.[folderId]
    );
  }

  function payloadString(state) {
    const payload = cloneJson(state);
    delete payload.integrity;
    return JSON.stringify(payload);
  }

  function verifyState(state) {
    if (!state || typeof state !== "object") {
      return { ok: false, reason: "state must be an object" };
    }
    if (state.format !== TEAM_SORT_FORMAT) {
      return { ok: false, reason: "unsupported format" };
    }
    if (![1, 2].includes(state.schemaVersion)) {
      return { ok: false, reason: "unsupported schema version" };
    }
    const expected = state.integrity?.payloadSha256;
    if (!expected) return { ok: false, reason: "missing payload sha256" };
    const actual = sha256(payloadString(state));
    if (actual !== expected) {
      return {
        ok: false,
        reason: "payload sha256 mismatch",
        expected,
        actual
      };
    }
    if (!state.storage || typeof state.storage !== "object") {
      return { ok: false, reason: "missing storage payload" };
    }
    if (!Array.isArray(state.libraries) || state.libraries.length === 0) {
      return { ok: false, reason: "missing source libraries" };
    }
    return { ok: true, payloadSha256: expected };
  }

  function statePathForLibrary(libraryPath) {
    const normalized = normalizeLibraryId(libraryPath);
    if (!isLibraryReady(normalized)) return "";
    return normalized + TEAM_STATE_SUFFIX;
  }

  function normalizeFolderIds(folders) {
    const ids = [];
    const visit = (entry) => {
      if (entry && typeof entry === "object") {
        const id = String(entry.id || "");
        if (id) ids.push(id);
        for (const child of Array.isArray(entry.children) ? entry.children : []) {
          visit(child);
        }
        return;
      }
      const id = String(entry || "");
      if (id) ids.push(id);
    };
    for (const folder of Array.isArray(folders) ? folders : []) visit(folder);
    return Array.from(new Set(ids)).sort();
  }

  function libraryIdentity(folders) {
    const folderIds = normalizeFolderIds(folders);
    return {
      folderCount: folderIds.length,
      folderIds,
      folderIdsSha256: sha256(JSON.stringify(folderIds))
    };
  }

  function targetLibraryCompatibility(state, folders) {
    if (state?.schemaVersion === 1 || !state?.identity?.folderIds) {
      return {
        ok: true,
        legacy: true,
        matched: 0,
        missing: [],
        matchRatio: null,
        reason: "legacy-state-without-library-identity"
      };
    }

    const sourceIds = normalizeFolderIds(state.identity.folderIds);
    const targetIds = new Set(normalizeFolderIds(folders));
    const matchedIds = sourceIds.filter((id) => targetIds.has(id));
    const missing = sourceIds.filter((id) => !targetIds.has(id));
    const matchRatio = sourceIds.length
      ? matchedIds.length / sourceIds.length
      : 1;
    const minimumMatches = Math.min(3, sourceIds.length);
    const ok = sourceIds.length === 0 || (
      matchedIds.length >= minimumMatches && matchRatio >= 0.8
    );
    return {
      ok,
      legacy: false,
      matched: matchedIds.length,
      missing,
      matchRatio,
      reason: ok ? "library-identity-matched" : "library-identity-mismatch"
    };
  }

  function storageKeysForLibrary(libraryId) {
    const sourceLibraryId = String(libraryId || "default");
    return [
      ...TEAM_GLOBAL_STORAGE_KEYS,
      ...TEAM_LIBRARY_STORAGE_KEYS,
      "eagle.list.orderBy." + sourceLibraryId,
      "eagle.list.sortIncrease." + sourceLibraryId
    ];
  }

  function sourceLibraryEntry(store, sourceLibraryId) {
    const library = resolveLibraryStore(store, sourceLibraryId, false);
    return library ? cloneJson(library) : null;
  }

  function storageForLibrary(storage, libraryId) {
    const source = storage && typeof storage === "object" ? storage : {};
    const result = {};
    for (const key of storageKeysForLibrary(libraryId)) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const value = cloneJson(source[key]);
      if (TEAM_LIBRARY_STORAGE_KEYS.includes(key) && value?.libraries) {
        const library = sourceLibraryEntry(value, libraryId);
        result[key] = {
          ...value,
          libraries: library ? { [String(libraryId)]: library } : {}
        };
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  function createState(options = {}) {
    const libraryId = String(options.libraryId || "");
    if (!isLibraryReady(libraryId)) {
      throw new Error("library-not-ready");
    }
    const state = {
      format: TEAM_SORT_FORMAT,
      schemaVersion: 2,
      createdAt: options.createdAt || new Date().toISOString(),
      revision: Number(options.revision || 0),
      updatedAt: options.updatedAt || options.createdAt || new Date().toISOString(),
      writerId: String(options.writerId || ""),
      libraries: [libraryId],
      plugin: {
        id: options.pluginId || "com.max.eagle-photo-taken-sort",
        version: String(options.pluginVersion || "")
      },
      identity: libraryIdentity(options.folders),
      storage: storageForLibrary(options.storage, libraryId),
      safety: {
        autoRenameIncluded: Object.prototype.hasOwnProperty.call(
          options.storage || {},
          "eagle.photoTakenSort.autoRename.v1"
        ),
        autoRenameRequiresApproval: true
      }
    };
    state.integrity = {
      algorithm: "sha256",
      payloadSha256: sha256(payloadString(state))
    };
    return state;
  }

  function stampState(state, metadata = {}) {
    const stamped = cloneJson(state);
    stamped.revision = Number(metadata.revision || stamped.revision || 0);
    stamped.updatedAt = metadata.updatedAt || stamped.updatedAt || new Date().toISOString();
    stamped.writerId = String(metadata.writerId || stamped.writerId || "");
    stamped.integrity = {
      algorithm: "sha256",
      payloadSha256: sha256(payloadString(stamped))
    };
    return stamped;
  }

  function sourceLibrary(state) {
    return String(state?.libraries?.[0] || "");
  }

  function mapLibraryStore(value, fromLibraryId, toLibraryId) {
    const copy = cloneJson(value);
    if (!copy?.libraries || typeof copy.libraries !== "object") return copy;
    const source = resolveLibraryStore(copy, fromLibraryId, false);
    if (!source) return copy;
    copy.libraries[toLibraryId] = cloneJson(source);
    for (const key of Object.keys(copy.libraries)) {
      if (
        key !== toLibraryId &&
        normalizeLibraryId(key) === normalizeLibraryId(fromLibraryId)
      ) {
        delete copy.libraries[key];
      }
    }
    return copy;
  }

  function mappedEntries(state, currentLibraryId, options = {}) {
    const sourceLibraryId = sourceLibrary(state);
    const entries = [];
    const skipped = [];
    const includeAutoRename = options.includeAutoRename === true;

    for (const [key, value] of Object.entries(state.storage || {})) {
      if (key === "eagle.photoTakenSort.autoRename.v1") {
        if (includeAutoRename) {
          entries.push({
            key,
            value: mapLibraryStore(value, sourceLibraryId, currentLibraryId)
          });
        } else {
          skipped.push(key);
        }
        continue;
      }

      if (key === "eagle.list.sortIncrease." + sourceLibraryId) {
        entries.push({
          key: "eagle.list.sortIncrease." + currentLibraryId,
          value
        });
        continue;
      }

      if (key === "eagle.list.orderBy." + sourceLibraryId) {
        entries.push({
          key: "eagle.list.orderBy." + currentLibraryId,
          value
        });
        continue;
      }

      if (!importKeys.has(key)) {
        skipped.push(key);
        continue;
      }

      const mappedValue = value?.libraries
        ? mapLibraryStore(value, sourceLibraryId, currentLibraryId)
        : cloneJson(value);
      entries.push({ key, value: mappedValue });
    }

    return {
      entries,
      skipped,
      sourceLibraryId,
      currentLibraryId
    };
  }

  function countMappedFolders(entries, key) {
    const entry = entries.find((item) => item.key === key);
    const libraries = entry?.value?.libraries || {};
    return Object.values(libraries).reduce((total, library) => {
      return total + Object.keys(library?.folders || {}).length;
    }, 0);
  }

  return {
    TEAM_IMPORT_BACKUP_KEY,
    TEAM_IMPORT_MARKER_KEY,
    containsMappedLibrary,
    countMappedFolders,
    createState,
    isLibraryReady,
    libraryIdentity,
    mappedEntries,
    mergeMappedValue,
    normalizeLibraryId,
    payloadString,
    resolveLibraryStore,
    statePathForLibrary,
    storageForLibrary,
    storageKeysForLibrary,
    stampState,
    targetLibraryCompatibility,
    verifyState
  };
}

module.exports = {
  TEAM_IMPORT_BACKUP_KEY,
  TEAM_IMPORT_MARKER_KEY,
  TEAM_STATE_SUFFIX,
  TEAM_SORT_FORMAT,
  createTeamSortStateRuntime
};
