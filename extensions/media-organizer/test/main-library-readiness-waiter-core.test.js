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
