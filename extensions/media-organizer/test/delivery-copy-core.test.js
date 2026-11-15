"use strict";

const assert = require("assert");
const {
  createDeliveryCopyRuntime,
  partitionItemsByFolder,
  leafFolderGroups
} = require("../lib/delivery-copy-core");

const runtime = createDeliveryCopyRuntime({
  isMedia: (item) => ["jpg", "png", "mov"].includes(
    String(item?.ext || "").toLowerCase()
  )
});

const stats = runtime.buildStats({
  groups: [
    { id: "a", name: "1-人物组" },
    { id: "b", name: "2-环境组" },
    { id: "c", name: "3-无人物组" }
  ],
  itemsByFolder: {
    a: [
      { name: "1-人物组1", ext: "jpg" },
      { name: "1-人物组2", ext: "jpg" },
      { name: "2-人物组1", ext: "jpg" },
      { name: "notes.txt", ext: "txt" }
    ],
    b: [{ name: "2-环境组1", ext: "png" }],
    c: [{ name: "封面.jpg", ext: "jpg" }]
  }
});

assert.deepStrictEqual(
  {
    groupCount: stats.groupCount,
    groupsWithPeople: stats.groupsWithPeople,
    groupsWithoutPeople: stats.groupsWithoutPeople,
    peopleCount: stats.peopleCount,
    environmentCount: stats.environmentCount,
    totalMedia: stats.totalMedia
  },
  {
    groupCount: 3,
    groupsWithPeople: 1,
    groupsWithoutPeople: 2,
    peopleCount: 2,
    environmentCount: 2,
    totalMedia: 4
  }
);

assert.deepStrictEqual(
  leafFolderGroups(
    [
      { id: "parent", name: "1-黄煌13", parent: "root" },
      { id: "leaf-a", name: "1-amoo", parent: "parent" },
      { id: "leaf-b", name: "2-有山不远", parent: "parent" },
      { id: "direct", name: "2-肖帅18", parent: "root" }
    ],
    "root"
  ),
  [
    { id: "leaf-a", name: "1-amoo" },
    { id: "leaf-b", name: "2-有山不远" },
    { id: "direct", name: "2-肖帅18" }
  ]
);

assert.strictEqual(
  runtime.renderTemplate(
    "实际交付 {groups} 组，{groupsWithPeople} 组带人，{groupsWithoutPeople} 组不带人；人物 {peopleCount} 张，环境 {environmentCount} 张；{quarkLink}",
    stats,
    "https://pan.quark.cn/test"
  ),
  "实际交付 3 组，1 组带人，2 组不带人；人物 2 张，环境 2 张；https://pan.quark.cn/test"
);

assert.strictEqual(
  runtime.renderTemplate("链接：{quarkLink}", stats, "链接：https://pan.quark.cn/test"),
  "链接：https://pan.quark.cn/test"
);

const prefixStats = runtime.buildStats({
  groups: [{ id: "prefix" }],
  itemsByFolder: {
    prefix: [
      { name: "1-人物.jpg", ext: "jpg" },
      { name: "2-环境.jpg", ext: "jpg" },
      { name: "3-环境.png", ext: "png" },
      { name: "封面.jpg", ext: "jpg" },
      { name: "1-人物无扩展名.jpg" },
      { name: "人物路径.jpg", filePath: "/tmp/1-人物路径.jpg" }
    ]
  }
});
assert.strictEqual(prefixStats.peopleCount, 3);
assert.strictEqual(prefixStats.environmentCount, 2);
assert.strictEqual(prefixStats.totalMedia, 5);

assert.deepStrictEqual(
  partitionItemsByFolder(
    [{ id: "a" }, { id: "b" }],
    [
      { id: "1", folders: ["a"] },
      { id: "2", folders: ["a", "b"] },
      { id: "3", folders: ["other"] }
    ]
  ),
  {
    a: [
      { id: "1", folders: ["a"] },
      { id: "2", folders: ["a", "b"] }
    ],
    b: [{ id: "2", folders: ["a", "b"] }]
  }
);

console.log("delivery copy core tests passed");
