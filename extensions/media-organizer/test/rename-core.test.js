"use strict";

const assert = require("assert");
const { createRenameRuntime } = require("../lib/rename-core");

const runtime = createRenameRuntime({
  isMedia: (item) => ["jpg", "heic", "mov"].includes(item.ext)
});

assert.strictEqual(runtime.sceneNameFromFolder("22-海上甬定"), "海上甬定");
assert.strictEqual(runtime.sceneNameFromFolder(" 9–杭州 "), "杭州");
assert.strictEqual(runtime.groupFromName("1-旧名字71"), "1");
assert.strictEqual(runtime.groupFromName("2-环境5"), "2");
assert.strictEqual(runtime.groupFromName("3-说明"), null);

const plan = runtime.buildPlan([
  { id: "p2", name: "1-旧名字71", ext: "jpg" },
  { id: "p1", name: "1-旧名字6", ext: "heic" },
  { id: "e2", name: "2-旧名字5", ext: "mov" },
  { id: "doc", name: "1-说明", ext: "pdf" },
  { id: "other", name: "其他文件", ext: "jpg" },
  { id: "e1", name: "2-海上甬定2", ext: "jpg" }
], { folderName: "22-海上甬定" });

assert.strictEqual(plan.error, null);
assert.deepStrictEqual(plan.groups, { people: 2, environment: 2 });
assert.strictEqual(plan.ignoredCount, 2);
assert.deepStrictEqual(
  plan.entries.map((entry) => [entry.id, entry.newName]),
  [
    ["p2", "1-海上甬定1"],
    ["p1", "1-海上甬定2"],
    ["e2", "2-海上甬定1"],
    ["e1", "2-海上甬定2"]
  ]
);
assert.strictEqual(plan.changes.length, 3);
assert.strictEqual(
  runtime.signature(plan).includes("e1:2-海上甬定2>2-海上甬定2"),
  true
);

const reordered = runtime.buildPlan([
  { id: "p1", name: "1-海上甬定1", ext: "jpg" },
  { id: "p3", name: "1-海上甬定3", ext: "jpg" },
  { id: "p2", name: "1-海上甬定2", ext: "jpg" }
], { folderName: "22-海上甬定" });
assert.deepStrictEqual(
  reordered.changes.map((entry) => [entry.id, entry.newName]),
  [
    ["p3", "1-海上甬定2"],
    ["p2", "1-海上甬定3"]
  ]
);

const afterDelete = runtime.buildPlan([
  { id: "p1", name: "1-海上甬定1", ext: "jpg" },
  { id: "p3", name: "1-海上甬定3", ext: "jpg" }
], { folderName: "22-海上甬定" });
assert.deepStrictEqual(
  afterDelete.changes.map((entry) => [entry.id, entry.newName]),
  [["p3", "1-海上甬定2"]]
);

const afterImport = runtime.buildPlan([
  { id: "p1", name: "1-海上甬定1", ext: "jpg" },
  { id: "new", name: "1-相机原名", ext: "heic" },
  { id: "p2", name: "1-海上甬定2", ext: "jpg" }
], { folderName: "22-海上甬定" });
assert.deepStrictEqual(
  afterImport.entries.map((entry) => [entry.id, entry.newName]),
  [
    ["p1", "1-海上甬定1"],
    ["new", "1-海上甬定2"],
    ["p2", "1-海上甬定3"]
  ]
);

const emptyScene = runtime.buildPlan([
  { id: "p", name: "1-old", ext: "jpg" }
], { folderName: "22-" });
assert.strictEqual(emptyScene.error, "scene-name-empty");

console.log("rename-core tests passed");
