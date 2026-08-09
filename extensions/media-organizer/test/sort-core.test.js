"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createMediaSortRuntime } = require("../lib/sort-core");

const runtime = createMediaSortRuntime({
  imageExtensions: ["jpg", "png", "heic"],
  videoExtensions: ["mov", "mp4"],
  language: "zh_CN"
});

// Both factories are injected into Eagle with Function#toString.
const isolatedFactory = Function(
  `"use strict"; return (${createMediaSortRuntime.toString()});`
)();
assert.strictEqual(isolatedFactory().SORT_SCHEMA_VERSION, 3);

assert.deepStrictEqual(runtime.defaultRules, [
  {
    field: "NAME",
    direction: "asc",
    options: { groupPrefix: true, prefixOnly: true }
  },
  { field: "TAKEN_AT", direction: "asc" }
]);
assert.deepStrictEqual(
  runtime.normalizeRules([
    { field: "NAME_GROUP", direction: "asc" },
    { field: "TAKEN_AT", direction: "desc" }
  ]),
  [
    {
      field: "NAME",
      direction: "asc",
      options: { groupPrefix: true, prefixOnly: true }
    },
    { field: "TAKEN_AT", direction: "desc" }
  ]
);

const naturalItems = [
  { id: "two", name: "2-作品", ext: "jpg" },
  { id: "ten", name: "10-作品", ext: "jpg" },
  { id: "fullwidth", name: "１－作品 ２", ext: "jpg" },
  { id: "spaced", name: "1-作品 10", ext: "jpg" },
  { id: "english", name: "Alpha 9", ext: "jpg" },
  { id: "english-ten", name: "Alpha 10", ext: "jpg" },
  { id: "dash", name: "3—中文", ext: "jpg" },
  { id: "duplicate-png", name: "同名", ext: "png" },
  { id: "duplicate-jpg", name: "同名", ext: "jpg" }
];
const naturalOrder = runtime.sortDesired(naturalItems, {
  rules: [{
    field: "NAME",
    direction: "asc",
    options: { groupPrefix: true, prefixOnly: false }
  }]
}).map((item) => item.id);
assert.ok(naturalOrder.indexOf("fullwidth") < naturalOrder.indexOf("spaced"));
assert.ok(naturalOrder.indexOf("two") < naturalOrder.indexOf("ten"));
assert.ok(naturalOrder.indexOf("english") < naturalOrder.indexOf("english-ten"));
assert.ok(naturalOrder.indexOf("duplicate-jpg") < naturalOrder.indexOf("duplicate-png"));
assert.strictEqual(runtime.normalizeText(" １—A　 10 "), "1-A 10");

const missingItems = [
  { id: "missing", name: "missing", ext: "jpg" },
  { id: "old", name: "old", ext: "jpg", DateTimeOriginal: 100 },
  { id: "new", name: "new", ext: "jpg" }
];
for (const direction of ["asc", "desc"]) {
  const result = runtime.sortDesired(missingItems, {
    timestamps: { new: { takenAt: 300 }, missing: null },
    rules: [{ field: "TAKEN_AT", direction }]
  });
  assert.strictEqual(result.at(-1).id, "missing");
}

// Manual movement consumes the visible order and remains independent of
// whether either the source or target has taken-time metadata.
const missingVisibleOrder = [missingItems[1], missingItems[0], missingItems[2]];
assert.deepStrictEqual(
  runtime.moveItems(missingVisibleOrder, ["missing"], "old", false)
    .map((item) => item.id),
  ["missing", "old", "new"]
);
assert.deepStrictEqual(
  runtime.moveItems(missingVisibleOrder, ["old"], "missing", false)
    .map((item) => item.id),
  ["old", "missing", "new"]
);

const multiKey = [
  { id: "a-old", name: "A", ext: "jpg", star: 1 },
  { id: "a-new", name: "A", ext: "jpg", star: 1 },
  { id: "b", name: "B", ext: "jpg", star: 2 }
];
assert.deepStrictEqual(
  runtime.sortDesired(multiKey, {
    timestamps: { "a-old": 100, "a-new": 200, b: 150 },
    rules: [
      { field: "RATING", direction: "desc" },
      { field: "NAME", direction: "asc" },
      { field: "TAKEN_AT", direction: "desc" }
    ]
  }).map((item) => item.id),
  ["b", "a-new", "a-old"]
);

const groupedTakenTime = [
  { id: "person-1-late", name: "1-habitas峡谷泳池8", ext: "jpg" },
  { id: "person-2-early", name: "2-habitas峡谷泳池1", ext: "jpg" },
  { id: "person-1-early", name: "1-habitas峡谷泳池1", ext: "jpg" },
  { id: "person-2-late", name: "2-habitas峡谷泳池8", ext: "jpg" }
];
assert.deepStrictEqual(
  runtime.sortDesired(groupedTakenTime, {
    timestamps: {
      "person-1-late": 400,
      "person-2-early": 100,
      "person-1-early": 200,
      "person-2-late": 300
    },
    rules: [
      { field: "NAME_GROUP", direction: "asc" },
      { field: "TAKEN_AT", direction: "asc" }
    ]
  }).map((item) => item.id),
  ["person-1-early", "person-1-late", "person-2-early", "person-2-late"],
  "NAME_GROUP must group 1-/2- prefixes and use camera time inside each group"
);

// Real 48-item screenshot sample captured from folder MKPBIEGNPKQR9.
const artIds = [
  "MLANP86PV8JNI", "MLANP86PW24SQ", "MLANP86PJ6SSH", "MLANP86PVKTKA",
  "ML0ZIVNT8CQAL", "ML0ZIVNTENK3L", "ML0ZIVNTDBYII", "ML0ZIVNT0BO8L",
  "MKPBRHGYHL1RH", "MKPBM76K8IXLQ", "MKPBM76KY4VBF", "MKV0OR6ZB5SLU",
  "MKV0OR6ZRJ0VS", "MKV0OR6Z2JI0H", "MKV0OR6Z7UFWT", "MKV0OR6YJ5OTE",
  "MKV0OR6YGX0PX", "MKV0OR6YPCZLI", "MKV0OR6YBUQU9", "MKV0OR6Y7UN9S",
  "MKV0OR6Y8320V", "MKV0OR6YN86NW", "MKV0OR6YIZILJ", "MKV0OR6Y7ZR16",
  "MKV0OR6YLUGOW", "MKV0OR6YA232U", "MKV0OR6YABS5L", "MKV0OR6YVV14V",
  "MKV0OR6YF2Q5L", "MKV0OR6YMATUL", "MKV0OR6YMNTCR", "MKV0OR6YEE3S2",
  "MKV0OR6XIOP1A", "MKV0OR6XATN0P", "MKV0OR6X8MFDM", "MKV0OR6XQXR9G",
  "MKV0OR6XUR44Y", "MKV0OR6XZC7EG", "MKV0OR6XDPJ5O", "MKV0OR6XPVDI0",
  "MKV0OR6XQZF7A", "MKV0OR6X0O61S", "MKV0OR6X1Z4N0", "MKV0OR6XBKX9I",
  "MKV0OR6WEW09A", "MKV0OR6WCW68Y", "MKV0OR6W8ELOT", "MKV0OR6W5P8VO"
];
const artTimes = [
  1768982703000, 1768982444000, 1768981465000, 1768985365000,
  1768981150000, 1768981933000, 1768982561000, 1768983369000,
  1768980470000, 1768984426000, 1768982854000, 1768985622000,
  1768985617000, 1768985601000, 1768985545000, 1768985444000,
  1768985438000, 1768985434000, 1768985343000, 1768985322000,
  1768985262000, 1768985217000, 1768985053000, 1768985006000,
  1768984986000, 1768984968000, 1768983952000, 1768983947000,
  1768983292000, 1768983189000, 1768982720000, 1768982705000,
  1768982690000, 1768982675000, 1768982655000, 1768982616000,
  1768982606000, 1768982573000, 1768982550000, 1768982541000,
  1768982532000, 1768982512000, 1768980935000, 1768980792000,
  1768980268000, 1768979912000, 1768979831000, 1768979812000
];
const artItems = artIds.map((id, index) => ({
  id,
  name: (index < 11 ? "1-艺术展" + (index + 1) : "2-艺术展" + (index - 10)),
  ext: "jpg",
  folders: ["MKPBIEGNPKQR9"]
}));
const artTimestamps = Object.fromEntries(
  artIds.map((id, index) => [id, artTimes[index]])
);
const teamState = JSON.parse(fs.readFileSync(path.join(
  __dirname,
  "..",
  "defaults",
  "sort-state",
  "team.eagle-sort-state.json"
), "utf8"));
const legacyLocks = teamState.storage["eagle.photoTakenSort.folderLocks.v1"];
const sourceLibrary = Object.keys(legacyLocks.libraries)[0];
const legacyArtProfile = legacyLocks.libraries[sourceLibrary]
  .folders.MKPBIEGNPKQR9;
const baseResult = runtime.buildSortResult(artItems, {
  timestamps: artTimestamps,
  rules: legacyArtProfile.rules,
  collectionId: "MKPBIEGNPKQR9"
});

// Eagle's own pinned/manual position is part of its native view state. It is
// not an explicit plugin manual relation and therefore must never outrank an
// enabled plugin automatic rule (R73).
const nativePinnedItems = [
  { id: "native-2", name: "2-网球1.jpg", ext: "jpg", pinned: { "folder-r73": 999 } },
  { id: "native-1", name: "1-网球1.jpg", ext: "jpg", pinned: { "folder-r73": 1 } }
];
assert.deepStrictEqual(
  runtime.sortDesired(nativePinnedItems, {
    collectionId: "folder-r73",
    rules: [
      { field: "NAME", direction: "asc", options: { groupPrefix: true, prefixOnly: true } },
      { field: "TAKEN_AT", direction: "asc" }
    ],
    timestamps: { "native-1": 20, "native-2": 10 }
  }).map((item) => item.id),
  ["native-1", "native-2"],
  "R73: native pinned positions must not override the plugin multi-level base order"
);
const baseRank = new Map(
  baseResult.baseItems.map((item, index) => [item.id, index])
);
function adjacentViolations(items) {
  let count = 0;
  for (let index = 1; index < items.length; index += 1) {
    if (baseRank.get(items[index - 1].id) > baseRank.get(items[index].id)) {
      count += 1;
    }
  }
  return count;
}
function splitGroupViolations(items) {
  let seenGroupTwo = false;
  let count = 0;
  for (const item of items) {
    if (item.name.startsWith("2-")) seenGroupTwo = true;
    if (seenGroupTwo && item.name.startsWith("1-")) count += 1;
  }
  return count > 0 ? 1 : 0;
}
function visibleViolations(items) {
  return adjacentViolations(items) + splitGroupViolations(items);
}
const screenshotOrder = [
  ...artIds.slice(0, 8),
  ...artIds.slice(11),
  ...artIds.slice(8, 11)
];
const legacyVisible = runtime.applyManualOrder(
  baseResult.baseItems,
  screenshotOrder
);
assert.deepStrictEqual(
  legacyVisible.slice(-5).map((item) => item.name),
  ["2-艺术展36", "2-艺术展37", "1-艺术展9", "1-艺术展10", "1-艺术展11"]
);
assert.strictEqual(visibleViolations(legacyVisible), 7);
assert.strictEqual(visibleViolations(baseResult.baseItems), 0);
assert.strictEqual(visibleViolations(baseResult.finalItems), 0);
assert.strictEqual(baseResult.manualApplied, false);
assert.deepStrictEqual(
  baseResult.finalItems.slice(0, 11).map((item) => item.name),
  [
    "1-艺术展4", "1-艺术展10", "1-艺术展8", "1-艺术展11",
    "1-艺术展1", "1-艺术展7", "1-艺术展2", "1-艺术展6",
    "1-艺术展3", "1-艺术展5", "1-艺术展9"
  ]
);
assert.ok(
  baseResult.finalItems.findIndex((item) => item.name.startsWith("2-")) >
    baseResult.finalItems.findIndex((item) => item.name === "1-艺术展11")
);

// Refresh and auto-numbering must never recapture the legacy visible order.
const refreshed = runtime.buildSortResult(artItems.slice().reverse(), {
  timestamps: artTimestamps,
  rules: legacyArtProfile.rules,
  collectionId: "MKPBIEGNPKQR9"
});
assert.strictEqual(visibleViolations(refreshed.finalItems), 0);
assert.deepStrictEqual(
  refreshed.finalItems.map((item) => item.id),
  baseResult.finalItems.map((item) => item.id)
);
const counters = { "1": 0, "2": 0 };
const renumbered = baseResult.finalItems.map((item) => {
  const group = item.name[0];
  counters[group] += 1;
  return { ...item, name: group + "-艺术展" + counters[group] };
});
const afterNumbering = runtime.buildSortResult(renumbered, {
  timestamps: artTimestamps,
  rules: legacyArtProfile.rules,
  collectionId: "MKPBIEGNPKQR9"
});
assert.strictEqual(visibleViolations(afterNumbering.finalItems), 0);

const manualResult = runtime.buildSortResult(artItems, {
  timestamps: artTimestamps,
  rules: legacyArtProfile.rules,
  collectionId: "MKPBIEGNPKQR9",
  manualOrder: screenshotOrder
});
assert.strictEqual(manualResult.manualApplied, true);
assert.strictEqual(visibleViolations(manualResult.finalItems), 7);
assert.strictEqual(visibleViolations(baseResult.finalItems), 0);

const numbered = Array.from({ length: 100 }, (_, index) => ({
  id: String(index + 1),
  name: String(index + 1).padStart(3, "0"),
  ext: "jpg"
}));
assert.deepStrictEqual(
  runtime.moveItems(numbered, ["51"], "50", false)
    .slice(48, 52).map((item) => item.id),
  ["49", "51", "50", "52"]
);

// Twenty consecutive drops must each build on the order saved by the prior
// drop. This covers repeated movement of the same item and alternating items.
let repeatedManual = numbered.slice(0, 12);
const repeatedFingerprints = new Set();
for (let step = 0; step < 20; step += 1) {
  const sourceId = step % 3 === 0
    ? "12"
    : repeatedManual[(step * 5 + 2) % repeatedManual.length].id;
  const sourceIndex = repeatedManual.findIndex((item) => item.id === sourceId);
  const moveToEnd = sourceIndex < repeatedManual.length / 2;
  const targetId = moveToEnd
    ? repeatedManual.at(-1).id
    : repeatedManual[0].id;
  const before = repeatedManual.map((item) => item.id).join(",");
  repeatedManual = runtime.moveItems(
    repeatedManual,
    [sourceId],
    targetId,
    moveToEnd
  );
  const after = repeatedManual.map((item) => item.id).join(",");
  assert.notStrictEqual(after, before, "drop " + (step + 1) + " must move");
  assert.strictEqual(new Set(repeatedManual.map((item) => item.id)).size, 12);
  repeatedFingerprints.add(after);
}
assert.strictEqual(repeatedFingerprints.size, 20);

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

console.log("sort core tests passed");
