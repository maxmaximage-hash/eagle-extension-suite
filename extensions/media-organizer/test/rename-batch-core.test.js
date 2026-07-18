"use strict";

const assert = require("assert");
const { createMediaSortRuntime } = require("../lib/sort-core");
const { createRenameRuntime } = require("../lib/rename-core");
const { createRenameBatchRuntime } = require("../lib/rename-batch-core");

const sortRuntime = createMediaSortRuntime({
  imageExtensions: ["jpg"],
  videoExtensions: ["mov"],
  language: "zh_CN"
});
const renameRuntime = createRenameRuntime({
  isMedia: sortRuntime.isMedia
});
const runtime = createRenameBatchRuntime({ sortRuntime, renameRuntime });

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

console.log("rename-batch-core tests passed");
