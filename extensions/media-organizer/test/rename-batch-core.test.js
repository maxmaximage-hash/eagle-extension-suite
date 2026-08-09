"use strict";

const assert = require("assert");
const { createMediaSortRuntime } = require("../lib/sort-core");
const { createRenameRuntime } = require("../lib/rename-core");
const { createRenameBatchRuntime } = require("../lib/rename-batch-core");
const { createSortingSystemRuntime } = require("../lib/sorting-system-core");
const { createOrderCoordinator } = require("../lib/order-coordinator-core");

const sortRuntime = createMediaSortRuntime({
  imageExtensions: ["jpg"],
  videoExtensions: ["mov"],
  language: "zh_CN"
});
const renameRuntime = createRenameRuntime({
  isMedia: sortRuntime.isMedia
});
const sortingSystemRuntime = createSortingSystemRuntime({
  sortRuntime,
  renameRuntime,
  orderCoordinator: createOrderCoordinator({ sortRuntime })
});
const runtime = createRenameBatchRuntime({
  sortRuntime,
  renameRuntime,
  sortingSystemRuntime
});

const plan = runtime.buildPlan([
  {
    id: "a",
    name: "22-海上甬定",
    rules: [{ field: "TAKEN_AT", direction: "asc" }]
  },
  {
    id: "b",
    name: "24-健身房",
    rules: [{ field: "TAKEN_AT", direction: "desc" }]
  }
], {
  a: [
    { id: "a2", name: "1-old2", ext: "jpg" },
    { id: "a1", name: "1-old1", ext: "jpg" },
    { id: "shared", name: "2-shared", ext: "jpg" }
  ],
  b: [
    { id: "b1", name: "2-old1", ext: "mov" },
    { id: "b2", name: "2-old2", ext: "jpg" },
    { id: "shared", name: "2-shared", ext: "jpg" }
  ]
}, {
  a1: 100,
  a2: 200,
  b1: 300,
  b2: 400,
  shared: 50
});

assert.strictEqual(plan.folderCount, 2);
assert.deepStrictEqual(plan.conflictIds, ["shared"]);
assert.deepStrictEqual(
  plan.changes.map((entry) => [entry.id, entry.newName]),
  [
    ["a1", "1-海上甬定1"],
    ["a2", "1-海上甬定2"],
    ["b2", "2-健身房1"],
    ["b1", "2-健身房2"]
  ]
);
assert.strictEqual(plan.errorCount, 0);

const overlayPlan = runtime.buildPlan([
  {
    id: "overlay",
    name: "25-相对排序",
    rules: [{ field: "TAKEN_AT", direction: "asc" }],
    manualOverlay: [
      { itemId: "o2", relation: "after", anchorId: "o3" }
    ]
  }
], {
  overlay: [
    { id: "o1", name: "1-old1", ext: "jpg" },
    { id: "o2", name: "1-old2", ext: "jpg" },
    { id: "o3", name: "1-old3", ext: "jpg" }
  ]
}, {
  o1: 300,
  o2: 100,
  o3: 200
});
assert.deepStrictEqual(
  overlayPlan.changes.map((entry) => [entry.id, entry.newName]),
  [
    ["o3", "1-相对排序1"],
    ["o2", "1-相对排序2"],
    ["o1", "1-相对排序3"]
  ]
);

const limited = runtime.buildPlan([
  {
    id: "limited",
    name: "22-海上甬定",
    finalOrder: ["p1", "p3", "p2"],
    allowedChangeIds: ["p3", "p2"]
  }
], {
  limited: [
    { id: "p1", name: "1-旧场景9", ext: "jpg" },
    { id: "p2", name: "1-旧场景2", ext: "jpg" },
    { id: "p3", name: "1-旧场景3", ext: "jpg" }
  ]
});
assert.deepStrictEqual(
  limited.changes.map((entry) => entry.id),
  ["p3", "p2"],
  "the background transaction must preserve the manual-drop change boundary"
);

console.log("rename-batch-core tests passed");
