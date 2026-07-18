"use strict";

const assert = require("assert");
const {
  collectFolderMedia,
  createFolderTagPlan,
  normalizeTag
} = require("../lib/folder-tag-core");

const shared = { id: "shared", ext: "jpg", tags: [] };
const itemsByFolder = {
  root: [
    { id: "photo", ext: "jpg", tags: [] },
    { id: "tagged", ext: "mov", tags: ["杭州", "人物"] },
    { id: "document", ext: "pdf", tags: [] },
    shared
  ],
  child: [shared, { id: "video", ext: "mp4", tags: ["夜景"] }]
};
const folders = [{ id: "root" }, { id: "child" }];
const isMedia = (item) => ["jpg", "mov", "mp4"].includes(item.ext);
const plan = createFolderTagPlan(folders, itemsByFolder, "  杭州  ", isMedia);

assert.strictEqual(plan.tag, "杭州");
assert.strictEqual(plan.folderCount, 2);
assert.strictEqual(plan.mediaCount, 4);
assert.strictEqual(plan.alreadyTagged, 1);
assert.deepStrictEqual(
  plan.changes.map((entry) => entry.id).sort(),
  ["photo", "shared", "video"]
);
assert.strictEqual(normalizeTag("  New   York  "), "New York");
assert.deepStrictEqual(
  collectFolderMedia(folders, itemsByFolder, isMedia)
    .map((item) => item.id)
    .sort(),
  ["photo", "shared", "tagged", "video"]
);
assert.strictEqual(
  createFolderTagPlan(folders, itemsByFolder, "", isMedia).mediaCount,
  4
);
assert.strictEqual(
  createFolderTagPlan(folders, itemsByFolder, "", isMedia).error,
  "请输入地点标签"
);

console.log("folder tag core tests passed");
