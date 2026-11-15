"use strict";

function createPublicSortControlsRuntime(options = {}) {
  const renameRuntime = options.renameRuntime;
  if (!renameRuntime || typeof renameRuntime.buildPlan !== "function") {
    throw new Error("renameRuntime.buildPlan is required");
  }
  const storage = options.storage || {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value)
  };
  const storagePrefix = String(
    options.storagePrefix || "eagle.photoTakenSort.publicControls.v1"
  );

  function storageKey(folderId) {
    return `${storagePrefix}:${String(folderId || "")}`;
  }

  function normalizeState(value) {
    return {
      locked: Boolean(value?.locked),
      manualEnabled: value?.manualEnabled !== false,
      autoRenameEnabled: Boolean(value?.autoRenameEnabled)
    };
  }

  function readState(folderId) {
    if (!folderId) return normalizeState();
    try {
      const raw = storage.getItem(storageKey(folderId));
      return raw ? normalizeState(JSON.parse(raw)) : normalizeState();
    } catch {
      return normalizeState();
    }
  }

  function writeState(folderId, value) {
    const state = normalizeState(value);
    if (folderId) storage.setItem(storageKey(folderId), JSON.stringify(state));
    return state;
  }

  function updateState(folderId, patch) {
    return writeState(folderId, { ...readState(folderId), ...patch });
  }

  function canMutate(folderId) {
    return !readState(folderId).locked;
  }

  function buildAutoRenamePlan(items, config = {}) {
    const state = normalizeState(config.state);
    if (state.locked) {
      return {
        sceneName: "",
        entries: [],
        changes: [],
        groups: { people: 0, environment: 0 },
        ignoredCount: Array.isArray(items) ? items.length : 0,
        error: "locked"
      };
    }
    if (!state.autoRenameEnabled) {
      return {
        sceneName: "",
        entries: [],
        changes: [],
        groups: { people: 0, environment: 0 },
        ignoredCount: Array.isArray(items) ? items.length : 0,
        error: "auto-rename-disabled"
      };
    }
    return renameRuntime.buildPlan(items, {
      folderName: config.folderName
    });
  }

  return Object.freeze({
    readState,
    writeState,
    updateState,
    canMutate,
    buildAutoRenamePlan,
    normalizeState
  });
}

module.exports = { createPublicSortControlsRuntime };
