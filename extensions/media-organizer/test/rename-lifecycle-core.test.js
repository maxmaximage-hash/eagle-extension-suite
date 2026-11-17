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
  runtime.isSameFolderContext(
    "library|normal:folder-a",
    "tag-folder:folder-a",
    "folder-a"
  ),
  true,
  "a selected rename queued by the injected window must be accepted by the host monitor for the same folder"
);
assert.strictEqual(
  runtime.isSameFolderContext(
    "library|normal:folder-a",
    "tag-folder:folder-b",
    "folder-b"
  ),
  false,
  "a rename request must not cross into another folder"
);

const reset = runtime.resetForContext(
  {
    state: "running",
    kind: "selected-media",
    sourceContextId: "library|folder:a",
    message: "正在写入"
  },
  "library|folder:b"
);
assert.deepStrictEqual(reset, {
  changed: true,
  state: {
    state: "idle",
    sourceContextId: "library|folder:b",
    kind: "",
    message: "",
    result: null,
    progress: null
  }
}, "switching folders must release transient rename state from the old folder");
assert.strictEqual(
  runtime.resetForContext(
    { state: "running", sourceContextId: "library|folder:a" },
    "library|folder:a"
  ).changed,
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

assert.strictEqual(
  runtime.isStale({
    state: "running",
    sourceContextId: "library|folder:a",
    lastActivityAt: 1000
  }, 121001, 120000),
  true,
  "a lost rename callback must eventually release the busy UI"
);
assert.strictEqual(
  runtime.isStale({
    state: "running",
    sourceContextId: "library|folder:a",
    lastActivityAt: 1000
  }, 119999, 120000),
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
