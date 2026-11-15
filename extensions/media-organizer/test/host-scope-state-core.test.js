"use strict";

const assert = require("assert");
const { createHostScopeStateRuntime } = require("../lib/host-scope-state-core");

const runtime = createHostScopeStateRuntime();
assert.strictEqual(runtime.isPending(), false);
runtime.markPending("route-unresolved");
assert.strictEqual(runtime.isPending(), true);
assert.strictEqual(runtime.reason(), "route-unresolved");
assert.deepStrictEqual(runtime.guard(), {
  allowed: false,
  reason: "host-scope-pending"
});
runtime.markReady({ route: "folder-1" });
assert.strictEqual(runtime.isPending(), false);
assert.deepStrictEqual(runtime.guard(), { allowed: true, reason: "" });
assert.deepStrictEqual(runtime.snapshot(), {
  pending: false,
  reason: "",
  route: "folder-1"
});

console.log("host scope state core tests passed");
