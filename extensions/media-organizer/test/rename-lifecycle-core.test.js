"use strict";

const assert = require("assert");
const {
  createRenameLifecycleRuntime
} = require("../lib/rename-lifecycle-core.js");

const runtime = createRenameLifecycleRuntime();

const runningInA = {
  state: "running",
  sourceContextId: "library|folder:a"
};
assert.strictEqual(
  runtime.isActiveForContext(runningInA, "library|folder:a"),
  true
);
assert.strictEqual(
  runtime.isActiveForContext(runningInA, "library|folder:b"),
  false,
  "a rename task must not become a permission lock in another collection"
);
assert.strictEqual(
  runtime.isActiveForContext({
    state: "accepted",
    sourceContextId: "library|folder:a"
  }, "library|folder:a"),
  true
);
assert.strictEqual(
  runtime.isActiveForContext({
    state: "done",
    sourceContextId: "library|folder:a"
  }, "library|folder:a"),
  false
);

assert.strictEqual(
  runtime.canToggleAutoNumber({
    canAutoNumber: true,
    renameRunning: true
  }),
  true,
  "task lifecycle is not permission to disable the auto-number setting"
);
assert.strictEqual(
  runtime.canToggleAutoNumber({
    canAutoNumber: false,
    renameRunning: false
  }),
  false
);

assert.deepStrictEqual(
  runtime.enqueueRejection({
    request: {
      id: "rename-a",
      sourceContextId: "library|folder:a",
      signature: "sig-a"
    },
    result: {
      accepted: false,
      retryable: false,
      reason: "duplicate-signature"
    }
  }),
  {
    requestId: "rename-a",
    sourceContextId: "library|folder:a",
    state: "done",
    retryable: false,
    reason: "duplicate-signature",
    signature: "sig-a"
  },
  "a rejected duplicate must settle instead of leaving the UI busy forever"
);

console.log("rename lifecycle core tests passed");
