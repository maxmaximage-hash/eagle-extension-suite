"use strict";

const assert = require("assert");
const { createSortIntentRuntime } = require("../lib/sort-intent-core");

const runtime = createSortIntentRuntime({
  pluginKeys: ["PHOTO_TAKEN", "PHOTO_TAKEN_AT"],
  initial: {
    "library|normal:folder-a": {
      orderBy: "PHOTO_TAKEN",
      increase: true
    }
  }
});

const collection = { libraryId: "library", kind: "normal", id: "folder-a" };
assert.strictEqual(runtime.resolve({ ...collection, orderBy: "NAME" }), "PHOTO_TAKEN");
runtime.observe({ ...collection, orderBy: "PHOTO_TAKEN_AT", increase: false });
assert.strictEqual(runtime.resolve({ ...collection, orderBy: "NAME" }), "PHOTO_TAKEN_AT");
assert.strictEqual(runtime.increase({ ...collection, increase: true }), false);
runtime.clear({ ...collection, explicitNative: true });
assert.strictEqual(runtime.resolve({ ...collection, orderBy: "NAME" }), "NAME");

const other = { libraryId: "library", kind: "normal", id: "folder-b" };
runtime.observe({ ...other, orderBy: "PHOTO_TAKEN", increase: true });
assert.strictEqual(runtime.resolve({ ...collection, orderBy: "NAME" }), "NAME");
assert.strictEqual(runtime.resolve({ ...other, orderBy: "CREATEDATE" }), "PHOTO_TAKEN");
assert.strictEqual(
  runtime.resolveHost({ ...other, orderBy: "" }),
  "PHOTO_TAKEN",
  "R131/R140: an empty transient host callback must retain the saved plugin intent"
);
runtime.observe({ ...other, orderBy: "PHOTO_TAKEN", increase: true });
assert.strictEqual(
  runtime.resolveHost({ ...other, orderBy: "IMPORT" }),
  "IMPORT",
  "R131/R140: an explicit Eagle IMPORT selection must bypass stale plugin intent"
);
runtime.observe({ ...other, orderBy: "PHOTO_TAKEN", increase: true });
assert.strictEqual(
  runtime.resolveHost({ ...other, orderBy: "CREATEDATE" }),
  "CREATEDATE",
  "R131/R140: an explicit Eagle CREATEDATE selection must bypass stale plugin intent"
);
assert.deepStrictEqual(runtime.serialize(), {});

assert.strictEqual(
  runtime.resolveEffective({
    ...other,
    configuredOrder: "IMPORT",
    scopedOrder: "IMPORT",
    selectedOrder: "PHOTO_TAKEN",
    hostOrderBy: "CREATEDATE"
  }),
  "CREATEDATE",
  "R140: a stale plugin select must not override an explicit native host callback"
);
assert.strictEqual(
  runtime.resolveEffective({
    ...other,
    configuredOrder: "IMPORT",
    scopedOrder: "PHOTO_TAKEN",
    selectedOrder: "PHOTO_TAKEN",
    hostOrderBy: "CREATEDATE"
  }),
  "CREATEDATE",
  "R140: stale scoped and DOM plugin keys must not override an explicit native host callback"
);
assert.strictEqual(
  runtime.resolveEffective({
    ...other,
    configuredOrder: "PHOTO_TAKEN",
    scopedOrder: "PHOTO_TAKEN",
    selectedOrder: "IMPORT",
    hostOrderBy: "CREATEDATE"
  }),
  "PHOTO_TAKEN",
  "R71: persisted plugin collection intent must win over a stale native callback"
);

console.log("sort intent core tests passed");
