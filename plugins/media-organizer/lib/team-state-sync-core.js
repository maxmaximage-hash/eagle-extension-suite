"use strict";

const crypto = require("crypto");

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableJson(value[key]);
    return result;
  }, {});
}

function fingerprint(value) {
  const comparable = value && typeof value === "object"
    ? { ...value }
    : value;
  if (comparable && typeof comparable === "object" && !Array.isArray(comparable)) {
    delete comparable.createdAt;
    delete comparable.updatedAt;
    delete comparable.revision;
    delete comparable.writerId;
    delete comparable.integrity;
    if (comparable.storage && typeof comparable.storage === "object") {
      comparable.storage = { ...comparable.storage };
      const legacyCurrentViewKeys = new Set([
        "eagle.list.meta.type",
        "eagle.list.sortIncrease",
        "eagle.photoTakenSort.fallbackOrder",
        "eagle.photoTakenSort.manualEnabled",
        "eagle.photoTakenSort.rules.v1"
      ]);
      for (const key of Object.keys(comparable.storage)) {
        if (
          legacyCurrentViewKeys.has(key) ||
          /^eagle\.list\.(?:orderBy|sortIncrease)\./.test(key)
        ) {
          delete comparable.storage[key];
        }
      }
    }
  }
  return crypto.createHash("sha256")
    .update(JSON.stringify(stableJson(comparable)))
    .digest("hex");
}

function createTeamStateSyncRuntime(options = {}) {
  const debounceMs = Number.isFinite(options.debounceMs)
    ? options.debounceMs
    : 5000;
  const now = options.now || (() => Date.now());
  const setTimer = options.setTimeout || setTimeout;
  const clearTimer = options.clearTimeout || clearTimeout;
  const writerId = String(options.writerId || "unknown-writer");
  let timer = null;
  let pending = null;
  let running = false;
  let lastLocalFingerprint = "";
  let lastWrittenFingerprint = "";
  let observedSidecar = null;
  let importedSidecar = null;
  let writeCount = 0;
  let lastErrorFingerprint = "";
  let blockedReason = "";

  function clearPending() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (pending?.resolve) {
      pending.resolve({ ok: false, skipped: "superseded", ...snapshot() });
    }
    pending = null;
  }

  function seed(options = {}) {
    lastLocalFingerprint = options.localFingerprint || "";
    lastWrittenFingerprint = options.writtenFingerprint || "";
    observedSidecar = options.sidecarIdentity || null;
    importedSidecar = options.importedSidecar || null;
    lastErrorFingerprint = "";
    blockedReason = "";
    clearPending();
    return snapshot();
  }

  function snapshot() {
    return {
      lastLocalFingerprint,
      lastWrittenFingerprint,
      observedSidecar,
      importedSidecar,
      lastErrorFingerprint,
      blockedReason,
      pending: Boolean(pending),
      running,
      writeCount
    };
  }

  function shouldUpgradeImportedState(state) {
    if (!state || state.schemaVersion !== 2) return true;
    const storage = state.storage || {};
    return !Object.prototype.hasOwnProperty.call(
      storage,
      "eagle.photoTakenSort.manualViews.v2"
    );
  }

  function block(reason) {
    blockedReason = String(reason || "team-state-blocked");
    clearPending();
    return snapshot();
  }

  async function runPending() {
    timer = null;
    if (!pending || running) return;
    const request = pending;
    pending = null;
    running = true;
    try {
      const result = await request.write(request.snapshot, {
        expectedSidecar: observedSidecar,
        writerId,
        revision: Number(request.baseRevision || 0) + 1,
        updatedAt: new Date(now()).toISOString()
      });
      lastLocalFingerprint = request.localFingerprint;
      lastWrittenFingerprint = request.localFingerprint;
      observedSidecar = result?.sidecarIdentity || observedSidecar;
      importedSidecar = null;
      writeCount += 1;
      request.resolve({ ok: true, result, ...snapshot() });
    } catch (error) {
      lastErrorFingerprint = request.localFingerprint;
      request.reject(error);
    } finally {
      running = false;
      if (pending && timer === null) {
        timer = setTimer(runPending, debounceMs);
      }
    }
  }

  function schedule(snapshotValue, options = {}) {
    if (blockedReason) {
      return Promise.resolve({
        ok: false,
        skipped: "blocked",
        ...snapshot()
      });
    }
    const localFingerprint = options.localFingerprint || fingerprint(snapshotValue);
    lastLocalFingerprint = localFingerprint;
    if (lastErrorFingerprint === localFingerprint && !pending) {
      return Promise.resolve({
        ok: false,
        skipped: "blocked-after-error",
        ...snapshot()
      });
    }
    const importedUpgrade = options.reason === "initial-import-upgrade";
    if (
      !importedUpgrade &&
      localFingerprint === lastWrittenFingerprint &&
      !pending
    ) {
      return Promise.resolve({ ok: true, skipped: "unchanged", ...snapshot() });
    }
    if (pending?.localFingerprint === localFingerprint) return pending.promise;
    clearPending();
    const write = options.write;
    if (typeof write !== "function") {
      return Promise.reject(new Error("team-state-write-required"));
    }
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    pending = {
      snapshot: snapshotValue,
      localFingerprint,
      baseRevision:
        options.baseRevision ||
        importedSidecar?.revision ||
        observedSidecar?.revision ||
        0,
      write,
      resolve: resolvePromise,
      reject: rejectPromise,
      promise
    };
    timer = setTimer(runPending, debounceMs);
    return promise;
  }

  function noteImportedState(state, sidecarIdentity, localFingerprint) {
    const upgrade = shouldUpgradeImportedState(state);
    seed({
      localFingerprint,
      writtenFingerprint: upgrade ? "" : localFingerprint,
      sidecarIdentity,
      importedSidecar: {
        revision: Number(state?.revision || 0),
        upgrade
      }
    });
    return upgrade;
  }

  return {
    fingerprint,
    noteImportedState,
    block,
    isBlocked: () => Boolean(blockedReason),
    schedule,
    seed,
    snapshot,
    shouldUpgradeImportedState,
    writerId
  };
}

module.exports = {
  createTeamStateSyncRuntime,
  fingerprint,
  stableJson
};
