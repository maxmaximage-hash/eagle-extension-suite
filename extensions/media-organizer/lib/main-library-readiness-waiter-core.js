"use strict";

const {
  canonicalizeLibraryIdentity,
  libraryIdentitiesMatch
} = require("./main-library-readiness-core.js");

function normalizeObservation(input = {}) {
  return Object.freeze({
    ready: input.ready === true,
    libraryId: canonicalizeLibraryIdentity(input.libraryId),
    reason: String(input.reason || (input.ready === true ? "main-window-ready" : "main-window-pending")),
    matchedBy: String(input.matchedBy || ""),
    evidence: Object.freeze({ ...(input.evidence || {}) }),
    missingReasons: Object.freeze(Array.from(input.missingReasons || []).map(String)),
    observedLibraryIds: Object.freeze(Array.from(input.observedLibraryIds || []))
  });
}

function abortableDelay(delayMs, signal) {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve(true);
    }, delayMs);
    function onAbort() {
      clearTimeout(timer);
      resolve(false);
    }
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

// Re-observes only the host readiness adapter. It never reads plugin state,
// cache/team sidecars, collection members, metadata, paths, EXIF, or the DOM.
function createMainLibraryReadinessWaiter({
  observe = async () => ({ ready: false, reason: "main-window-pending" }),
  wait = ({ delayMs, signal }) => abortableDelay(delayMs, signal),
  now = () => Date.now(),
  intervalMs = 250,
  maxIntervalMs = intervalMs,
  backoffFactor = 1,
  maxAttempts = 40,
  maxElapsedMs = 10_000
} = {}) {
  const boundedIntervalMs = Math.max(1, Number(intervalMs) || 250);
  const boundedMaxIntervalMs = Math.max(
    boundedIntervalMs,
    Number(maxIntervalMs) || boundedIntervalMs
  );
  const boundedBackoffFactor = Math.max(1, Number(backoffFactor) || 1);
  const boundedMaxAttempts = Math.max(1, Number(maxAttempts) || 1);
  const boundedMaxElapsedMs = Math.max(0, Number(maxElapsedMs) || 0);

  async function waitFor({ libraryId = "", signal } = {}) {
    const targetLibraryId = canonicalizeLibraryIdentity(libraryId);
    const startedAt = Number(now()) || 0;
    let attempts = 0;
    let nextDelayMs = boundedIntervalMs;
    let lastReason = "main-window-pending";
    let lastObservation = normalizeObservation({
      ready: false,
      libraryId: targetLibraryId,
      reason: lastReason
    });

    while (attempts < boundedMaxAttempts) {
      if (signal?.aborted) {
        return Object.freeze({
          ready: false,
          cancelled: true,
          libraryId: targetLibraryId,
          reason: "main-readiness-cancelled",
          attempts,
          elapsedMs: Math.max(0, (Number(now()) || 0) - startedAt)
        });
      }
      attempts += 1;
      const observation = normalizeObservation(await observe(Object.freeze({
        libraryId: targetLibraryId,
        attempt: attempts,
        signal
      })));
      lastObservation = observation;
      lastReason = observation.reason;
      const elapsedMs = Math.max(0, (Number(now()) || 0) - startedAt);
      if (observation.ready && libraryIdentitiesMatch(observation.libraryId, targetLibraryId)) {
        return Object.freeze({
          ...observation,
          attempts,
          elapsedMs
        });
      }
      if (attempts >= boundedMaxAttempts || elapsedMs >= boundedMaxElapsedMs) {
        return Object.freeze({
          ready: false,
          cancelled: false,
          libraryId: targetLibraryId,
          reason: "main-library-readiness-timeout",
          lastReason,
          matchedBy: lastObservation.matchedBy,
          evidence: lastObservation.evidence,
          missingReasons: lastObservation.missingReasons,
          observedLibraryIds: lastObservation.observedLibraryIds,
          attempts,
          elapsedMs
        });
      }
      const continued = await wait(Object.freeze({
        delayMs: nextDelayMs,
        signal,
        attempt: attempts,
        libraryId: targetLibraryId
      }));
      nextDelayMs = Math.min(
        boundedMaxIntervalMs,
        Math.max(
          boundedIntervalMs,
          Math.round(nextDelayMs * boundedBackoffFactor)
        )
      );
      if (continued === false || signal?.aborted) {
        return Object.freeze({
          ready: false,
          cancelled: true,
          libraryId: targetLibraryId,
          reason: "main-readiness-cancelled",
          attempts,
          elapsedMs: Math.max(0, (Number(now()) || 0) - startedAt)
        });
      }
    }

    return Object.freeze({
      ready: false,
      cancelled: false,
      libraryId: targetLibraryId,
      reason: "main-library-readiness-timeout",
      lastReason,
      matchedBy: lastObservation.matchedBy,
      evidence: lastObservation.evidence,
      missingReasons: lastObservation.missingReasons,
      observedLibraryIds: lastObservation.observedLibraryIds,
      attempts,
      elapsedMs: Math.max(0, (Number(now()) || 0) - startedAt)
    });
  }

  return Object.freeze({ waitFor });
}

module.exports = {
  createMainLibraryReadinessWaiter,
  normalizeObservation
};
