"use strict";

const assert = require("assert");
const { createSelectedRenameRuntime } = require("../lib/selected-rename-core");

const runtime = createSelectedRenameRuntime({
  isMedia: (item) => ["jpg", "heic", "mov"].includes(String(item?.ext || "").toLowerCase())
});

const people = runtime.buildPlan([
  { id: "p1", name: "IMG_001", ext: "jpg" },
  { id: "p2", name: "IMG_002", ext: "heic" },
  { id: "doc", name: "notes", ext: "pdf" }
], { folderName: "5-驾雾", group: "1" });
assert.strictEqual(people.error, null);
assert.strictEqual(people.sceneName, "驾雾");
assert.deepStrictEqual(
  people.entries.map((entry) => [entry.id, entry.newName]),
  [["p1", "1-驾雾1"], ["p2", "1-驾雾2"]]
);
assert.strictEqual(people.ignoredCount, 1);
assert.strictEqual(people.changes.length, 2);

const environment = runtime.buildPlan([
  { id: "e1", name: "IMG_010", ext: "jpg" },
  { id: "e2", name: "2-旧场景2", ext: "mov" }
], { folderName: "2-厚生林", group: "2" });
assert.deepStrictEqual(
  environment.entries.map((entry) => entry.newName),
  ["2-厚生林1", "2-厚生林2"]
);

const unchanged = runtime.buildPlan([
  { id: "p", name: "1-驾雾1", ext: "jpg" }
], { folderName: "5-驾雾", group: "1" });
assert.strictEqual(unchanged.changes.length, 0);

const invalid = runtime.buildPlan([
  { id: "p", name: "IMG_001", ext: "jpg" }
], { folderName: "5-", group: "1" });
assert.strictEqual(invalid.error, "scene-name-empty");

assert.throws(
  () => runtime.buildPlan([], { folderName: "5-驾雾", group: "3" }),
  /group/
);

console.log("selected rename core tests passed");
