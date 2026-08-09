"use strict";

const { libraryIdentitiesMatch } = require("./main-library-readiness-core.js");

function normalizeReadiness(input = {}) {
  return Object.freeze({
    ready: input.ready === true,
    libraryId: String(input.libraryId || ""),
    reason: String(input.reason || (input.ready === true ? "host-ready" : "host-pending"))
  });
}

function createCancellationController() {
  if (typeof AbortController === "function") return new AbortController();
  let aborted = false;
  const listeners = new Set();
  const signal = {
    get aborted() { return aborted; },
    addEventListener(_type, listener) { listeners.add(listener); },
    removeEventListener(_type, listener) { listeners.delete(listener); }
  };
  return {
    signal,
    abort() {
      if (aborted) return;
      aborted = true;
      for (const listener of listeners) listener();
      listeners.clear();
    }
  };
}

// Owns the bootstrap boundary between Eagle's library lifecycle and the
// sorting runtime. Library identity is only permission to begin the bounded
// main-window readiness wait; it is never permission to inject by itself.
function createStartupReadinessGate({
  waitUntilReady = async ({ libraryId }) => ({
    ready: true,
    libraryId,
    reason: "host-ready",
    attempts: 1,
    elapsedMs: 0
  }),
  inject = async () => undefined,
  activate = async () => undefined,
  diagnose = () => undefined
} = {}) {
  let generation = 0;
  let phase = "booting";
  let libraryId = "";
  let reason = "boot";
  let active = false;
  let stopped = false;
  let injectedGeneration = -1;
  let failedGeneration = -1;
  let inFlight = null;
  let readinessController = null;
  let lastDiagnosticKey = "";

  function status() {
    return Object.freeze({
      phase,
      generation,
      libraryId,
      reason,
      active,
      stopped,
      injectionAttempted: injectedGeneration === generation,
      injectionFailed: failedGeneration === generation
    });
  }

  function emit(nextPhase, payload = {}) {
    const key = [nextPhase, generation, libraryId, payload.reason || reason].join("|");
    if (key === lastDiagnosticKey) return;
    lastDiagnosticKey = key;
    diagnose(nextPhase, Object.freeze({
      generation,
      libraryId,
      readinessReason: String(payload.reason || reason || ""),
      ...payload
    }));
  }

  function reset(nextReason = "reset") {
    readinessController?.abort();
    generation += 1;
    phase = "booting";
    libraryId = "";
    reason = String(nextReason || "reset");
    active = false;
    stopped = false;
    injectedGeneration = -1;
    failedGeneration = -1;
    inFlight = null;
    readinessController = null;
    lastDiagnosticKey = "";
    return status();
  }

  async function observe(input = {}) {
    if (stopped) return status();
    const readiness = normalizeReadiness(input);
    if (!readiness.ready || !readiness.libraryId) {
      if (inFlight || libraryId) reset(readiness.reason);
      phase = "waiting_library";
      reason = readiness.reason;
      active = false;
      emit("BOOTSTRAP_WAIT", { reason });
      return status();
    }

    if (libraryId && !libraryIdentitiesMatch(libraryId, readiness.libraryId)) {
      reset("library-identity-changed");
    }
    libraryId = readiness.libraryId;
    reason = readiness.reason;
    if (active && injectedGeneration === generation) return status();
    if (failedGeneration === generation) {
      phase = "waiting_library";
      return status();
    }
    if (inFlight) return inFlight;

    const observedGeneration = generation;
    const observedLibraryId = readiness.libraryId;
    readinessController = createCancellationController();
    const signal = readinessController.signal;
    phase = "waiting_main";
    emit("BOOTSTRAP_MAIN_WAIT", { reason: "main-library-readiness-pending" });
    inFlight = Promise.resolve().then(async () => {
      let stage = "readiness";
      try {
        const verified = await waitUntilReady(Object.freeze({
          generation: observedGeneration,
          libraryId: observedLibraryId,
          readinessReason: readiness.reason,
          signal,
          isCurrent: () => (
            !stopped &&
            generation === observedGeneration &&
            libraryIdentitiesMatch(libraryId, observedLibraryId)
          )
        }));
        if (stopped || generation !== observedGeneration || !libraryIdentitiesMatch(libraryId, readiness.libraryId)) {
          return status();
        }
        if (!verified?.ready || verified?.cancelled) {
          failedGeneration = observedGeneration;
          phase = "waiting_library";
          active = false;
          reason = String(verified?.reason || "main-library-readiness-timeout");
          emit("BOOTSTRAP_TIMEOUT", {
            reason,
            attempts: Number(verified?.attempts || 0),
            elapsedMs: Number(verified?.elapsedMs || 0)
          });
          return status();
        }
        if (!libraryIdentitiesMatch(verified.libraryId, observedLibraryId)) {
          failedGeneration = observedGeneration;
          phase = "waiting_library";
          active = false;
          reason = "main-library-identity-mismatch";
          emit("BOOTSTRAP_TIMEOUT", {
            reason,
            attempts: Number(verified?.attempts || 0),
            elapsedMs: Number(verified?.elapsedMs || 0)
            ,matchedBy: String(verified?.matchedBy || "")
            ,evidence: verified?.evidence || {}
            ,missingReasons: verified?.missingReasons || []
            ,observedLibraryIds: verified?.observedLibraryIds || []
          });
          return status();
        }
        phase = "ready_to_inject";
        reason = String(verified.reason || readiness.reason || "main-window-ready");
        emit("BOOTSTRAP_READY", {
          reason,
          attempts: Number(verified?.attempts || 0),
          elapsedMs: Number(verified?.elapsedMs || 0)
          ,matchedBy: String(verified?.matchedBy || "")
          ,evidence: verified?.evidence || {}
          ,missingReasons: verified?.missingReasons || []
          ,observedLibraryIds: verified?.observedLibraryIds || []
        });
        injectedGeneration = observedGeneration;
        stage = "inject";
        emit("INJECT_START", { reason });
        await inject(Object.freeze({
          generation: observedGeneration,
          libraryId: observedLibraryId,
          readinessReason: reason,
          readiness: verified
        }));
        if (stopped || generation !== observedGeneration || !libraryIdentitiesMatch(libraryId, observedLibraryId)) {
          return status();
        }
        await activate(Object.freeze({
          generation: observedGeneration,
          libraryId: observedLibraryId,
          readinessReason: reason
        }));
        if (stopped || generation !== observedGeneration || !libraryIdentitiesMatch(libraryId, observedLibraryId)) {
          return status();
        }
        active = true;
        phase = "active";
        emit("INJECT_OK", { reason });
        return status();
      } catch (error) {
        if (signal.aborted || stopped || generation !== observedGeneration) {
          return status();
        }
        if (stage === "readiness") {
          failedGeneration = observedGeneration;
          phase = "waiting_library";
          active = false;
          reason = "main-readiness-failed";
          emit("BOOTSTRAP_TIMEOUT", {
            reason,
            error: String(error?.message || error || "unknown")
          });
        } else {
          failedGeneration = observedGeneration;
          phase = "waiting_library";
          active = false;
          reason = "inject-failed";
          emit("INJECT_FAIL", {
            reason,
            error: String(error?.message || error || "unknown")
          });
        }
        return status();
      }
    }).finally(() => {
      if (generation === observedGeneration) {
        inFlight = null;
        readinessController = null;
      }
    });
    return inFlight;
  }

  async function stop(nextReason = "stopped") {
    readinessController?.abort();
    generation += 1;
    phase = "stopped";
    reason = String(nextReason || "stopped");
    active = false;
    stopped = true;
    inFlight = null;
    readinessController = null;
    emit("BOOTSTRAP_STOPPED", { reason });
    return status();
  }

  return Object.freeze({ observe, reset, stop, status });
}

module.exports = {
  createStartupReadinessGate,
  normalizeReadiness
};
