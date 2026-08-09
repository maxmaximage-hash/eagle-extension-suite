"use strict";

const assert = require("assert");
const {
  createMainLibraryReadinessWaiter
} = require("../lib/main-library-readiness-waiter-core.js");

async function run() {
  let observations = 0;
  let waits = 0;
  let now = 0;
  const transient = createMainLibraryReadinessWaiter({
    observe: async () => {
      observations += 1;
      return observations < 3
        ? { ready: false, libraryId: "library-a", reason: "scope-pending" }
        : { ready: true, libraryId: "library-a", reason: "main-window-ready" };
    },
    wait: async () => {
      waits += 1;
      now += 250;
      return true;
    },
    now: () => now,
    intervalMs: 250,
    maxAttempts: 6,
    maxElapsedMs: 2000
  });
  const ready = await transient.waitFor({ libraryId: "library-a" });
  assert.strictEqual(ready.ready, true);
  assert.strictEqual(ready.attempts, 3);
  assert.strictEqual(ready.elapsedMs, 500);
  assert.strictEqual(waits, 2);

  // R81: a NAS library can legitimately take longer than the old ten-second
  // startup window. The waiter must remain bounded, but its host-only probes
  // must back off instead of hammering Eagle every 250ms or permanently
  // abandoning this generation.
  const backoffDelays = [];
  let backoffObservations = 0;
  const delayedNas = createMainLibraryReadinessWaiter({
    observe: async () => {
      backoffObservations += 1;
      return backoffObservations < 5
        ? { ready: false, libraryId: "nas-library", reason: "main-pending" }
        : { ready: true, libraryId: "nas-library", reason: "scope-route-ready" };
    },
    wait: async ({ delayMs }) => {
      backoffDelays.push(delayMs);
      return true;
    },
    intervalMs: 250,
    maxIntervalMs: 2_000,
    backoffFactor: 2,
    maxAttempts: 8,
    maxElapsedMs: 30_000
  });
  const delayedReady = await delayedNas.waitFor({ libraryId: "nas-library" });
  assert.strictEqual(delayedReady.ready, true);
  assert.deepStrictEqual(
    backoffDelays,
    [250, 500, 1_000, 2_000],
    "R81: readiness waits must use bounded exponential backoff"
  );

  let timeoutObservations = 0;
  const timeout = createMainLibraryReadinessWaiter({
    observe: async () => {
      timeoutObservations += 1;
      return { ready: false, libraryId: "library-timeout", reason: "hash-pending" };
    },
    wait: async () => true,
    now: () => 0,
    maxAttempts: 4,
    maxElapsedMs: 10_000
  });
  const timedOut = await timeout.waitFor({ libraryId: "library-timeout" });
  assert.strictEqual(timedOut.ready, false);
  assert.strictEqual(timedOut.cancelled, false);
  assert.strictEqual(timedOut.reason, "main-library-readiness-timeout");
  assert.strictEqual(timedOut.attempts, 4, "timeout must be bounded by observation count");
  assert.strictEqual(timeoutObservations, 4);

  const controller = new AbortController();
  let cancelledObservations = 0;
  const cancelled = createMainLibraryReadinessWaiter({
    observe: async () => {
      cancelledObservations += 1;
      return { ready: false, libraryId: "library-cancel", reason: "scope-pending" };
    },
    wait: async ({ signal }) => {
      controller.abort();
      return !signal.aborted;
    },
    maxAttempts: 10
  });
  const cancelledResult = await cancelled.waitFor({
    libraryId: "library-cancel",
    signal: controller.signal
  });
  assert.strictEqual(cancelledResult.cancelled, true);
  assert.strictEqual(cancelledObservations, 1, "cancellation must stop further observations");

  // R54.2 real qa.34 failure: the public Eagle API reports a decoded NAS
  // library path while the loaded main Angular scope may expose the same
  // identity URL-encoded. Strict string equality kept the waiter pending even
  // after Eagle logged Library loaded and the real sidebar/grid were usable.
  const decodedLibrary = "/Volumes/团队文件-MAX线上协作中台/引力环球.library";
  const encodedLibrary = "/Volumes/%E5%9B%A2%E9%98%9F%E6%96%87%E4%BB%B6-MAX%E7%BA%BF%E4%B8%8A%E5%8D%8F%E4%BD%9C%E4%B8%AD%E5%8F%B0/%E5%BC%95%E5%8A%9B%E7%8E%AF%E7%90%83.library";
  const encodedIdentity = createMainLibraryReadinessWaiter({
    observe: async () => ({
      ready: true,
      libraryId: encodedLibrary,
      reason: "scope-route-ready",
      matchedBy: "scope-route",
      evidence: { libraryMatch: true, routeReady: true, bodyScopePresent: true }
    }),
    wait: async () => true,
    maxAttempts: 2
  });
  const encodedReady = await encodedIdentity.waitFor({ libraryId: decodedLibrary });
  assert.strictEqual(
    encodedReady.ready,
    true,
    "encoded and decoded forms of the same loaded Library must not false-negative"
  );
  assert.strictEqual(encodedReady.matchedBy, "scope-route");
  assert.strictEqual(encodedReady.evidence.libraryMatch, true);

  let wrongLibraryAttempts = 0;
  const wrongLibrary = createMainLibraryReadinessWaiter({
    observe: async () => {
      wrongLibraryAttempts += 1;
      return { ready: true, libraryId: "old-library", reason: "old-main-window" };
    },
    wait: async () => true,
    maxAttempts: 2
  });
  const mismatch = await wrongLibrary.waitFor({ libraryId: "new-library" });
  assert.strictEqual(mismatch.ready, false, "old main-window identity must not authorize injection");
  assert.strictEqual(wrongLibraryAttempts, 2);
}

run().then(() => {
  console.log("main library readiness waiter core tests passed");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
