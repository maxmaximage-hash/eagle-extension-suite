"use strict";

const COLLECTION_STATE_VERSION = 2;

function createCollectionRuntime() {
  // Eagle injects this factory through Function#toString, so it cannot rely
  // on module-scope bindings.
  const COLLECTION_STATE_VERSION = 2;
  function routedView(context = {}) {
    const explicitValue = context.view || context.currentView || context.locationView;
    const explicit = String(explicitValue || "").toLowerCase();
    if (explicit === "smartfolder") return "smartfolder";
    if (explicit === "all" || explicit === "global") return "global";
    if (explicitValue) return "unknown";

    const hash = String(context.locationHash || "");
    const match = hash.match(/[?&]view=([^&]+)/i);
    if (!match?.[1]) return "";
    let view = match[1];
    try {
      view = decodeURIComponent(view);
    } catch {}
    view = String(view || "").toLowerCase();
    if (view === "smartfolder") return "smartfolder";
    return view === "all" || view === "global" ? "global" : view ? "unknown" : "";
  }

  function smartFolderFromContext(context = {}) {
    if (context.currentSmartFolder?.id) return context.currentSmartFolder;
    if (routedView(context) !== "smartfolder") return null;
    const hash = String(context.locationHash || "");
    const match = hash.match(/[?&]smartfolder=([^&]+)/);
    if (!match?.[1]) return null;
    let id = match[1];
    try {
      id = decodeURIComponent(id);
    } catch {}
    return id ? { id } : null;
  }

  function fromContext(context = {}) {
    const route = routedView(context);
    // Explicit routes own their first frame. Eagle can briefly retain either
    // collection object while switching views, but that stale object must not
    // turn a smart or global result into an old normal-folder operation.
    if (route === "global") {
      return create("global", { id: "global", name: "全部" }, context.rootDir);
    }
    const smartFolder = smartFolderFromContext(context);
    if (smartFolder?.id) {
      return create("smart", smartFolder, context.rootDir);
    }
    if (routedView(context) === "unknown") {
      return create("global", { id: "global", name: "全部" }, context.rootDir);
    }
    if (context.currentFolder?.id) {
      return create("normal", context.currentFolder, context.rootDir);
    }
    return create("global", { id: "global", name: "全部" }, context.rootDir);
  }

  function scopedItems(context = {}) {
    const allData = Array.isArray(context.allData) ? context.allData : null;
    const filtered = Array.isArray(context.filtereds) ? context.filtereds : null;
    const raw = Array.isArray(context.raw) ? context.raw : [];

    // allData/filtereds are Eagle's current-view arrays. raw is commonly the
    // complete library, so a collection must not fall through to raw merely
    // because its current result is empty.
    if (smartFolderFromContext(context)?.id) return allData || filtered || [];
    if (routedView(context) === "global") return allData || filtered || raw;
    if (routedView(context) === "unknown") return allData || filtered || [];
    if (context.currentFolder?.id) {
      if (allData) return allData;
      if (filtered) return filtered;
      const folderId = String(context.currentFolder.id);
      return raw.filter((item) => {
        if (!Array.isArray(item?.folders)) return false;
        return item.folders.some((folder) => String(
          folder && typeof folder === "object" ? folder.id || "" : folder || ""
        ) === folderId);
      });
    }
    return allData || filtered || raw;
  }

  function directFolderItems(items, folderId) {
    const targetId = String(folderId || "");
    if (!targetId) return [];
    return (Array.isArray(items) ? items : []).filter((item) => {
      if (!Array.isArray(item?.folders)) return true;
      return item.folders.some((folder) => String(
        folder && typeof folder === "object" ? folder.id || "" : folder || ""
      ) === targetId);
    });
  }

  function create(kind, value, libraryId = "default") {
    const normalizedKind = kind === "smart"
      ? "smart"
      : kind === "normal" ? "normal" : "global";
    const id = String(value?.id || (normalizedKind === "global" ? "global" : ""));
    return {
      kind: normalizedKind,
      id,
      name: String(value?.name || ""),
      key: String(libraryId || "default") + "|" + normalizedKind + ":" + id,
      bucket: normalizedKind === "smart"
        ? "smartFolders"
        : normalizedKind === "normal" ? "folders" : "global",
      supportsTree: normalizedKind === "normal",
      isVirtual: normalizedKind === "smart"
    };
  }

  function emptyStore() {
    return {
      version: COLLECTION_STATE_VERSION,
      libraries: {}
    };
  }

  function ensureLibrary(store, libraryId, createIfMissing = true) {
    if (!store || typeof store !== "object") return null;
    store.version = COLLECTION_STATE_VERSION;
    store.libraries = store.libraries || {};
    const key = String(libraryId || "default");
    if (!store.libraries[key] && createIfMissing) {
      store.libraries[key] = { folders: {}, smartFolders: {}, global: null };
    }
    const library = store.libraries[key];
    if (!library) return null;
    library.folders = library.folders || {};
    library.smartFolders = library.smartFolders || {};
    if (!("global" in library)) library.global = null;
    return library;
  }

  function profile(store, libraryId, collection, createIfMissing = false) {
    const library = ensureLibrary(store, libraryId, createIfMissing);
    if (!library || !collection) return null;
    if (collection.bucket === "global") return library.global;
    if (!library[collection.bucket][collection.id] && createIfMissing) {
      library[collection.bucket][collection.id] = {};
    }
    return library[collection.bucket][collection.id] || null;
  }

  function setProfile(store, libraryId, collection, value) {
    const library = ensureLibrary(store, libraryId, true);
    if (collection.bucket === "global") library.global = value;
    else library[collection.bucket][collection.id] = value;
    return value;
  }

  function deleteProfile(store, libraryId, collection) {
    const library = ensureLibrary(store, libraryId, false);
    if (!library) return false;
    if (collection.bucket === "global") {
      const existed = library.global !== null;
      library.global = null;
      return existed;
    }
    return delete library[collection.bucket][collection.id];
  }

  function migrateLegacyProtection(legacyStore, existingStore = emptyStore()) {
    const target = existingStore && existingStore.version === COLLECTION_STATE_VERSION
      ? existingStore
      : emptyStore();
    for (const [libraryId, legacyLibrary] of Object.entries(
      legacyStore?.libraries || {}
    )) {
      const library = ensureLibrary(target, libraryId, true);
      for (const [folderId, legacyProfile] of Object.entries(
        legacyLibrary?.folders || {}
      )) {
        if (library.folders[folderId]?.protected === true) continue;
        const legacyOrder = Array.isArray(legacyProfile?.order)
          ? legacyProfile.order.map(String)
          : [];
        library.folders[folderId] = {
          protected: true,
          config: {
            orderBy: legacyProfile?.config?.orderBy || legacyProfile?.orderBy || "",
            sortIncrease:
              legacyProfile?.config?.sortIncrease !== false &&
              legacyProfile?.sortIncrease !== false,
            rules: Array.isArray(legacyProfile?.config?.rules)
              ? legacyProfile.config.rules
              : Array.isArray(legacyProfile?.rules) ? legacyProfile.rules : []
          },
          migratedAt: Date.now(),
          legacyOrderDiagnostic: {
            ignored: true,
            itemCount: legacyOrder.length
          }
        };
      }
    }
    let protectedCount = 0;
    let ignoredOrderCount = 0;
    for (const library of Object.values(target.libraries || {})) {
      const profiles = [
        ...Object.values(library?.folders || {}),
        ...Object.values(library?.smartFolders || {}),
        library?.global
      ];
      for (const profile of profiles) {
        if (profile?.protected !== true) continue;
        protectedCount += 1;
        if (profile.legacyOrderDiagnostic?.ignored === true) {
          ignoredOrderCount += Number(
            profile.legacyOrderDiagnostic.itemCount || 0
          );
        }
      }
    }
    return { store: target, protectedCount, ignoredOrderCount };
  }

  function mergeLegacyProtectionIntoLocks(
    legacyProtectionStore,
    existingLockStore = emptyStore()
  ) {
    const target = existingLockStore &&
      existingLockStore.version === COLLECTION_STATE_VERSION
      ? existingLockStore
      : emptyStore();
    let importedCount = 0;
    let preservedCount = 0;
    let suppressedCount = 0;
    for (const [libraryId, legacyLibrary] of Object.entries(
      legacyProtectionStore?.libraries || {}
    )) {
      const library = ensureLibrary(target, libraryId, true);
      for (const [folderId, legacyProfile] of Object.entries(
        legacyLibrary?.folders || {}
      )) {
        if (legacyProfile?.protected !== true) continue;
        const current = library.folders[folderId];
        if (current) {
          if (current.legacySuppressed === true) suppressedCount += 1;
          else preservedCount += 1;
          continue;
        }
        library.folders[folderId] = {
          locked: true,
          mode: "hard",
          migratedFrom: "folderLocks.v1",
          config: {
            orderBy: legacyProfile?.config?.orderBy || "",
            sortIncrease: legacyProfile?.config?.sortIncrease !== false,
            rules: Array.isArray(legacyProfile?.config?.rules)
              ? legacyProfile.config.rules
              : []
          },
          migratedAt: Date.now()
        };
        importedCount += 1;
      }
    }
    return { store: target, importedCount, preservedCount, suppressedCount };
  }

  function sourceFolderSummary(items) {
    const counts = new Map();
    for (const item of items || []) {
      for (const folder of item?.folders || []) {
        const id = String(
          folder && typeof folder === "object" ? folder.id || "" : folder || ""
        );
        if (id) counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
    return Array.from(counts, ([id, itemCount]) => ({ id, itemCount }))
      .sort((a, b) => b.itemCount - a.itemCount || a.id.localeCompare(b.id));
  }

  function applyScope(collection, descendants = []) {
    if (collection.kind === "smart") {
      return {
        kind: "smart-only",
        collectionCount: 1,
        description: "仅当前智能文件夹"
      };
    }
    if (collection.kind === "normal") {
      return {
        kind: "normal-tree",
        collectionCount: Math.max(1, descendants.length),
        description: "当前普通文件夹及全部子文件夹"
      };
    }
    return {
      kind: "global-only",
      collectionCount: 1,
      description: "当前全局视图"
    };
  }

  return {
    COLLECTION_STATE_VERSION,
    applyScope,
    create,
    deleteProfile,
    directFolderItems,
    emptyStore,
    ensureLibrary,
    fromContext,
    mergeLegacyProtectionIntoLocks,
    migrateLegacyProtection,
    profile,
    scopedItems,
    setProfile,
    sourceFolderSummary
  };
}

module.exports = { COLLECTION_STATE_VERSION, createCollectionRuntime };
