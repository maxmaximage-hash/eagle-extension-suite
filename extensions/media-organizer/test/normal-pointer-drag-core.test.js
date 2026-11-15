"use strict";

const assert = require("assert");
const { createNormalPointerDragRuntime } = require("../lib/normal-pointer-drag-core");

const runtime = createNormalPointerDragRuntime();
assert.strictEqual(runtime.down({
  pointerId: 1,
  button: 0,
  isPrimary: true,
  collectionKind: "normal",
  collectionId: "folder-A",
  manualAllowed: true,
  locked: false,
  sourceId: "a",
  selectedIds: ["a"],
  clientX: 10,
  clientY: 10
}).ok, true);
runtime.move({
  pointerId: 1,
  clientX: 30,
  clientY: 10,
  insideGrid: true,
  targetId: "b",
  insertAfter: true
});
assert.deepStrictEqual(runtime.up({
  pointerId: 1,
  clientX: 30,
  clientY: 10,
  insideGrid: true,
  targetId: "b",
  insertAfter: true
}), {
  ok: true,
  collectionId: "folder-A",
  sourceId: "a",
  selectedIds: ["a"],
  targetId: "b",
  insertAfter: true
});

assert.strictEqual(runtime.down({
  pointerId: 2,
  button: 0,
  isPrimary: true,
  collectionKind: "normal",
  collectionId: "folder-A",
  manualAllowed: true,
  locked: true,
  sourceId: "a",
  clientX: 0,
  clientY: 0
}).ok, false);

console.log("normal pointer drag core tests passed");
