"use strict";

const assert = require("assert");
const {
  createFolderCopyRuntime,
  normalizeSelectedFolder
} = require("../lib/folder-copy-core");

const runtime = createFolderCopyRuntime();

assert.strictEqual(
  runtime.nextCopyName("旅行", ["旅行", "旅行 副本"]),
  "旅行 副本 2"
);
assert.strictEqual(
  runtime.nextCopyName("旅行 副本", ["旅行 副本", "旅行 副本 2"]),
  "旅行 副本 3"
);

const source = {
  id: "source",
  name: "旅行",
  description: "说明",
  parent: "parent",
  children: [
    { id: "child", name: "精选", description: "子说明", children: [] }
  ]
};
const plan = runtime.buildPlan(source, {
  existingNamesByParent: {
    parent: ["旅行", "旅行 副本"],
    source: ["精选"],
    "source-copy": ["精选"]
  },
  existingFolderIds: new Set(["source", "child"])
});
assert.strictEqual(plan.root.name, "旅行 副本 2");
assert.strictEqual(plan.root.parent, "parent");
assert.deepStrictEqual(plan.folders.map((entry) => [entry.sourceId, entry.parentSourceId]), [
  ["source", null],
  ["child", "source"]
]);

assert.strictEqual(
  runtime.canCopy({ kind: "normal", id: "source" }),
  true
);
assert.strictEqual(
  runtime.canCopy({ kind: "smart", id: "smart-1" }),
  false
);
assert.strictEqual(
  runtime.canCopy({ kind: "normal", id: "" }),
  false
);

assert.deepStrictEqual(
  normalizeSelectedFolder([{ id: "folder-1", name: "普通文件夹", conditions: [] }]),
  {
    ok: true,
    folderId: "folder-1",
    folderName: "普通文件夹",
    folder: { id: "folder-1", name: "普通文件夹", conditions: [] }
  }
);
assert.equal(normalizeSelectedFolder([]).reason, "no-folder-selected");
assert.equal(
  normalizeSelectedFolder([
    { id: "one", name: "一" },
    { id: "two", name: "二" }
  ]).reason,
  "single-folder-required"
);
assert.equal(
  normalizeSelectedFolder([{ id: "smart", name: "智能", conditions: [{ property: "name" }] }]).reason,
  "normal-folder-required"
);

console.log("folder copy core tests passed");
