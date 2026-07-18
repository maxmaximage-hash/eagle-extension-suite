"use strict";

const assert = require("assert");
const {
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  extractVideoTimestamp,
  timestampFromValue
} = require("../lib/media-time");
const { createMediaSortRuntime } = require("../lib/sort-core");

const runtime = createMediaSortRuntime({
  imageExtensions: IMAGE_EXTENSIONS,
  videoExtensions: VIDEO_EXTENSIONS,
  language: "zh_CN"
});

assert.deepStrictEqual(runtime.defaultRules, [
  { field: "NAME_GROUP", direction: "asc" },
  { field: "TAKEN_AT", direction: "asc" }
]);

const items = [
  { id: "environment-new", name: "2-环境 02", ext: "jpg" },
  { id: "person-new", name: "1-人物 02", ext: "jpg" },
  { id: "document", name: "3-说明", ext: "pdf" },
  { id: "person-old", name: "1-人物 01", ext: "mov" },
  { id: "environment-old", name: "2-环境 01", ext: "heic" },
  { id: "person-missing", name: "1-人物 03", ext: "png" }
];

const timestamps = {
  "environment-new": 400,
  "person-new": 300,
  "person-old": 100,
  "environment-old": 200
};

assert.deepStrictEqual(
  runtime.sortDesired(items, {
    timestamps,
    rules: [
      { field: "NAME_GROUP", direction: "asc" },
      { field: "TAKEN_AT", direction: "asc" },
      { field: "NAME", direction: "asc" }
    ]
  }).map((item) => item.id),
  [
    "person-old",
    "person-new",
    "person-missing",
    "environment-old",
    "environment-new",
    "document"
  ]
);

const yearItems = [
  { id: "photo-2024", name: "2024", ext: "jpg" },
  { id: "photo-2025", name: "2025", ext: "jpg" }
];
assert.deepStrictEqual(
  runtime.sortDesired(yearItems, {
    timestamps: {
      "photo-2024": new Date("2024-01-20T21:22:20").getTime(),
      "photo-2025": new Date("2025-09-27T03:27:37").getTime()
    },
    rules: [{ field: "TAKEN_AT", direction: "desc" }]
  }).map((item) => item.id),
  ["photo-2025", "photo-2024"]
);

assert.deepStrictEqual(
  runtime.sortDesired(items, {
    timestamps,
    rules: [
      { field: "NAME_GROUP", direction: "desc" },
      { field: "TAKEN_AT", direction: "desc" }
    ]
  }).map((item) => item.id),
  [
    "person-new",
    "person-old",
    "person-missing",
    "environment-new",
    "environment-old",
    "document"
  ]
);
assert.deepStrictEqual(
  runtime.normalizeRules([
    { field: "NAME_GROUP", direction: "desc" },
    { field: "TAKEN_AT", direction: "desc" }
  ]),
  [
    { field: "NAME_GROUP", direction: "asc" },
    { field: "TAKEN_AT", direction: "desc" }
  ]
);

assert.deepStrictEqual(
  runtime.sortDesired(items, {
    timestamps,
    rules: [
      { field: "NAME_GROUP", direction: "asc" },
      { field: "TAKEN_AT", direction: "desc" }
    ]
  }).map((item) => item.id),
  [
    "person-new",
    "person-old",
    "person-missing",
    "environment-new",
    "environment-old",
    "document"
  ]
);

assert.deepStrictEqual(
  runtime.sortDesired(items, {
    timestamps,
    rules: [
      { field: "MEDIA_KIND", direction: "asc" },
      { field: "EXT", direction: "asc" },
      { field: "NAME", direction: "asc" }
    ]
  }).map((item) => item.id),
  [
    "environment-old",
    "person-new",
    "environment-new",
    "person-missing",
    "person-old",
    "document"
  ]
);

const baseOrder = runtime.sortDesired(items, {
  timestamps,
  rules: [{ field: "NAME", direction: "asc" }]
});
const swappedIds = baseOrder.map((item) => item.id);
[swappedIds[2], swappedIds[3]] = [swappedIds[3], swappedIds[2]];
assert.deepStrictEqual(
  runtime.sortDesired(items, {
    timestamps,
    rules: [{ field: "NAME", direction: "asc" }],
    manualOrder: swappedIds
  }).map((item) => item.id),
  swappedIds
);

assert.deepStrictEqual(
  runtime.applyManualOrder([
    { id: "new" },
    { id: "a" },
    { id: "b" },
    { id: "c" }
  ], ["c", "a", "b"]).map((item) => item.id),
  ["c", "a", "b", "new"]
);

const numbered = Array.from({ length: 100 }, (_, index) => ({
  id: String(index + 1),
  name: String(index + 1).padStart(3, "0"),
  ext: "jpg"
}));
const movedBefore = runtime.moveItems(numbered, ["51"], "50", false);
assert.deepStrictEqual(
  movedBefore.slice(48, 52).map((item) => item.id),
  ["49", "51", "50", "52"]
);
const movedAfter = runtime.moveItems(numbered, ["50", "51"], "10", true);
assert.deepStrictEqual(
  movedAfter.slice(8, 13).map((item) => item.id),
  ["9", "10", "50", "51", "11"]
);
assert.deepStrictEqual(
  runtime.moveItems(numbered, ["50"], "50", false).map((item) => item.id),
  numbered.map((item) => item.id)
);

const folderTree = {
  id: "root",
  children: [
    { id: "a", children: [{ id: "a-1", children: [] }] },
    { id: "b", children: [{ id: "shared", children: [] }] },
    { id: "shared", children: [] }
  ]
};
assert.deepStrictEqual(
  runtime.collectFolderTree(folderTree).map((folder) => folder.id),
  ["root", "a", "a-1", "b", "shared"]
);
const copiedProfiles = Object.fromEntries(
  runtime.collectFolderTree(folderTree).map((folder) => [
    folder.id,
    runtime.defaultRules.map((rule) => ({ ...rule }))
  ])
);
copiedProfiles["a-1"][0].direction = "desc";
assert.strictEqual(copiedProfiles.root[0].direction, "asc");
assert.strictEqual(copiedProfiles.b[0].direction, "asc");

const pinnedItems = [
  { id: "regular", name: "A", ext: "jpg", pinned: {} },
  { id: "pinned", name: "Z", ext: "jpg", pinned: { folder: 10 } }
];
assert.deepStrictEqual(
  runtime.sortDesired(pinnedItems, {
    timestamps: { regular: 1, pinned: 2 },
    folderId: "folder",
    rules: [{ field: "TAKEN_AT", direction: "asc" }]
  }).map((item) => item.id),
  ["pinned", "regular"]
);

assert.strictEqual(runtime.nameGroup({ name: "1-人物 023" }), "1");
assert.strictEqual(runtime.nameGroup({ name: "2_环境 010" }), "2");
assert.strictEqual(runtime.nameGroup({ name: "无分隔符" }), "无分隔符");

assert.strictEqual(
  timestampFromValue("2024:11:09 03:31:38"),
  new Date("2024-11-09 03:31:38").getTime()
);
assert.strictEqual(
  extractVideoTimestamp({
    format: { tags: { creation_time: "2026-03-06T16:44:00.000Z" } },
    streams: []
  }),
  1772815440000
);

console.log("sort-core tests passed");
