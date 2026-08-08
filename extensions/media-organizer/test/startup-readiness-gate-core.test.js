"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createStartupReadinessGate } = require(
  "../lib/startup-readiness-gate-core.js"
);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function run() {
  const events = [];
  let injectCalls = 0;
  let activeCalls = 0;
  const gate = createStartupReadinessGate({
    diagnose: (phase, payload) => events.push({ phase, payload }),
    inject: async () => {
      injectCalls += 1;
    },
    activate: async () => {
      activeCalls += 1;
    }
  });

  assert.strictEqual(gate.status().phase, "booting");
  await gate.observe({ ready: false, reason: "scope-unavailable" });
  assert.strictEqual(gate.status().phase, "waiting_library");
  assert.strictEqual(injectCalls, 0, "waiting must have zero injection/I/O");
  assert.strictEqual(activeCalls, 0, "waiting must have zero business activation");
  assert.strictEqual(events.filter((entry) => entry.phase === "BOOTSTRAP_WAIT").length, 1);

  await Promise.all([
    gate.observe({ ready: true, libraryId: "library-a", reason: "host-ready" }),
    gate.observe({ ready: true, libraryId: "library-a", reason: "host-ready" })
  ]);
  assert.strictEqual(injectCalls, 1, "same ready generation injects exactly once");
  assert.strictEqual(activeCalls, 1, "same ready generation activates exactly once");
  assert.strictEqual(gate.status().phase, "active");
  assert.strictEqual(gate.status().libraryId, "library-a");
  assert.deepStrictEqual(
    events.map((entry) => entry.phase),
    [
      "BOOTSTRAP_WAIT",
      "BOOTSTRAP_MAIN_WAIT",
      "BOOTSTRAP_READY",
      "INJECT_START",
      "INJECT_OK"
    ],
    "gate diagnostics must describe the complete bootstrap transition"
  );

  const transientMainReady = deferred();
  const transientEvents = [];
  let transientInjects = 0;
  const transient = createStartupReadinessGate({
    diagnose: (phase, payload) => transientEvents.push({ phase, payload }),
    waitUntilReady: async () => transientMainReady.promise,
    inject: async () => {
      transientInjects += 1;
    }
  });
  const transientBoot = transient.observe({
    ready: true,
    libraryId: "library-transient",
    reason: "eagle-library-path-ready"
  });
  await Promise.resolve();
  assert.strictEqual(
    transientInjects,
    0,
    "library identity alone must not inject before main-window readiness"
  );
  assert.strictEqual(transient.status().phase, "waiting_main");
  transientMainReady.resolve({
    ready: true,
    libraryId: "library-transient",
    reason: "main-window-ready",
    attempts: 3,
    elapsedMs: 500
  });
  await transientBoot;
  assert.strictEqual(transientInjects, 1, "transient main readiness must inject once");
  assert.deepStrictEqual(
    transientEvents.map((entry) => entry.phase),
    ["BOOTSTRAP_MAIN_WAIT", "BOOTSTRAP_READY", "INJECT_START", "INJECT_OK"]
  );

  const timeoutEvents = [];
  let timeoutWaits = 0;
  let timeoutInjects = 0;
  const timedOut = createStartupReadinessGate({
    diagnose: (phase, payload) => timeoutEvents.push({ phase, payload }),
    waitUntilReady: async () => {
      timeoutWaits += 1;
      return {
        ready: false,
        reason: "main-library-readiness-timeout",
        attempts: 40,
        elapsedMs: 10_000
      };
    },
    inject: async () => {
      timeoutInjects += 1;
    }
  });
  await timedOut.observe({ ready: true, libraryId: "library-timeout" });
  await timedOut.observe({ ready: true, libraryId: "library-timeout" });
  assert.strictEqual(timeoutWaits, 1, "bounded timeout must not create a retry storm");
  assert.strictEqual(timeoutInjects, 0, "timeout must fail open before injection");
  assert.strictEqual(timedOut.status().phase, "waiting_library");
  assert.strictEqual(
    timeoutEvents.filter((entry) => entry.phase === "BOOTSTRAP_TIMEOUT").length,
    1,
    "timeout must have one explicit diagnostic"
  );

  const cancelledMainReady = deferred();
  let cancelledInjects = 0;
  const cancelledWait = createStartupReadinessGate({
    waitUntilReady: async () => cancelledMainReady.promise,
    inject: async () => {
      cancelledInjects += 1;
    }
  });
  const cancelledBoot = cancelledWait.observe({
    ready: true,
    libraryId: "library-cancel-wait"
  });
  await Promise.resolve();
  cancelledWait.reset("library-changed");
  cancelledMainReady.resolve({
    ready: true,
    libraryId: "library-cancel-wait",
    reason: "late-main-ready"
  });
  await cancelledBoot;
  assert.strictEqual(cancelledInjects, 0, "generation reset must cancel a late readiness result");

  const pendingA = deferred();
  let generationInjects = 0;
  let generationActivations = 0;
  const generations = createStartupReadinessGate({
    inject: async ({ libraryId }) => {
      generationInjects += 1;
      if (libraryId === "library-a") await pendingA.promise;
    },
    activate: async () => {
      generationActivations += 1;
    }
  });
  const stale = generations.observe({ ready: true, libraryId: "library-a" });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(generationInjects, 1, "test must cancel an already-started injection");
  generations.reset("library-changed");
  pendingA.resolve();
  await stale;
  assert.strictEqual(generationActivations, 0, "old library generation must not activate");
  await generations.observe({ ready: true, libraryId: "library-b" });
  assert.strictEqual(generationInjects, 2);
  assert.strictEqual(generationActivations, 1);
  assert.strictEqual(generations.status().libraryId, "library-b");

  const failures = [];
  let failedInjects = 0;
  const failed = createStartupReadinessGate({
    diagnose: (phase) => failures.push(phase),
    inject: async () => {
      failedInjects += 1;
      throw new Error("bridge unavailable");
    }
  });
  await failed.observe({ ready: true, libraryId: "library-fail" });
  await failed.observe({ ready: true, libraryId: "library-fail" });
  assert.strictEqual(failedInjects, 1, "injection failure must not create a retry storm");
  assert.strictEqual(failed.status().phase, "waiting_library");
  assert.strictEqual(failures.filter((phase) => phase === "INJECT_FAIL").length, 1);

  await gate.stop("shutdown");
  assert.strictEqual(gate.status().phase, "stopped");
  assert.strictEqual(gate.status().active, false);

  const pendingStop = deferred();
  let stoppedActivations = 0;
  const stopped = createStartupReadinessGate({
    inject: async () => pendingStop.promise,
    activate: async () => {
      stoppedActivations += 1;
    }
  });
  const stoppedWork = stopped.observe({
    ready: true,
    libraryId: "library-stop",
    reason: "host-ready"
  });
  await Promise.resolve();
  await stopped.stop("host-exit");
  pendingStop.resolve();
  await stoppedWork;
  assert.strictEqual(stoppedActivations, 0, "stop must cancel in-flight activation");

  const source = fs.readFileSync(
    path.join(__dirname, "..", "lib", "startup-readiness-gate-core.js"),
    "utf8"
  );
  assert.doesNotMatch(source, /setTimeout|setInterval|sleep/i,
    "readiness must be evidence-driven, not fixed-delay based");
}

run().then(() => {
  console.log("startup readiness gate core tests passed");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
