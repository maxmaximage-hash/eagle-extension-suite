"use strict";

const assert = require("assert");
const { createRenameRuntime } = require("../lib/rename-core");
const { createMediaSortRuntime } = require("../lib/sort-core");

const runtime = createRenameRuntime({
  isMedia: (item) => ["jpg", "heic", "mov"].includes(item.ext)
});
const sortRuntime = createMediaSortRuntime({
  imageExtensions: ["jpg", "heic"],
  videoExtensions: ["mov"],
  language: "zh_CN"
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

const beforeMinimalDrop = Array.from({ length: 8 }, (_, index) => ({
  id: "minimal-" + String(index + 1),
  name: "1-海上甬定" + String(index + 1),
  ext: "jpg"
}));
const afterMinimalDrop = sortRuntime.moveItems(
  beforeMinimalDrop,
  ["minimal-2"],
  "minimal-5",
  true
);
const minimalDropPlan = runtime.limitPlanToOrdinalChanges(
  runtime.buildPlan(afterMinimalDrop, { folderName: "22-海上甬定" }),
  beforeMinimalDrop,
  afterMinimalDrop
);
assert.deepStrictEqual(
  minimalDropPlan.changes.map((entry) => entry.id),
  ["minimal-3", "minimal-4", "minimal-5", "minimal-2"],
  "one drag must rename only items whose group ordinal actually changed"
);
assert.deepStrictEqual(
  minimalDropPlan.affectedRange,
  { start: 1, end: 4, count: 4 }
);

const cyclePhases = runtime.buildExecutionPhases(reordered.changes, "cycle");
assert.strictEqual(new Set(
  cyclePhases.temporary.map((entry) => entry.newName)
).size, reordered.changes.length);
assert.deepStrictEqual(
  cyclePhases.final.map((entry) => [entry.id, entry.oldName, entry.newName]),
  [
    ["p3", "__eagle_number_cycle_1", "1-海上甬定2"],
    ["p2", "__eagle_number_cycle_2", "1-海上甬定3"]
  ]
);
assert.ok(
  cyclePhases.temporary.every((entry) =>
    !reordered.changes.some((change) => change.oldName === entry.newName)
  )
);

// Current-folder numbering must consume the final multi-level order instead of
// the raw Eagle input order. This mirrors the reported 1,3,5,4,9... sequence.
const shuffledNames = [1, 3, 5, 4, 9, 13, 11, 8];
const shuffledItems = shuffledNames.map((number, index) => ({
  id: "shot-" + String(number),
  name: "1-普鲁士海峡巡游" + String(number),
  ext: "jpg",
  takenAt: (index + 1) * 100
}));
const finalMultiLevelOrder = sortRuntime.sortDesired(shuffledItems, {
  rules: [
    {
      field: "NAME",
      direction: "asc",
      options: { groupPrefix: true, prefixOnly: true }
    },
    { field: "TAKEN_AT", direction: "asc" }
  ]
});
const numberedFromFinalOrder = runtime.buildPlan(finalMultiLevelOrder, {
  folderName: "4-普鲁士海峡巡游"
});
assert.deepStrictEqual(
  numberedFromFinalOrder.entries.map((entry) => entry.newName),
  Array.from({ length: 8 }, (_, index) =>
    "1-普鲁士海峡巡游" + String(index + 1)
  )
);

// Numbering consumes the supplied visible order. Taken-time metadata is not
// an eligibility requirement and may be absent from every item.
const visibleWithoutTakenTime = runtime.buildPlan([
  { id: "third", name: "1-旧名字3", ext: "jpg" },
  { id: "first", name: "1-旧名字1", ext: "jpg" },
  { id: "second", name: "1-旧名字2", ext: "jpg" }
], { folderName: "4-harrat餐厅" });
assert.deepStrictEqual(
  visibleWithoutTakenTime.entries.map((entry) => [entry.id, entry.newName]),
  [
    ["third", "1-harrat餐厅1"],
    ["first", "1-harrat餐厅2"],
    ["second", "1-harrat餐厅3"]
  ]
);

// Every preview in a twenty-drop session must consume the latest manual order,
// including when no item has taken-time metadata.
let twentyDropVisible = Array.from({ length: 12 }, (_, index) => ({
  id: "manual-" + String(index + 1),
  name: "1-旧名" + String(index + 1),
  ext: "jpg"
}));
for (let step = 0; step < 20; step += 1) {
  const sourceIndex = (step * 5 + 2) % twentyDropVisible.length;
  const sourceId = twentyDropVisible[sourceIndex].id;
  const moveToEnd = sourceIndex < twentyDropVisible.length / 2;
  const targetId = moveToEnd
    ? twentyDropVisible.at(-1).id
    : twentyDropVisible[0].id;
  twentyDropVisible = sortRuntime.moveItems(
    twentyDropVisible,
    [sourceId],
    targetId,
    moveToEnd
  );
  const preview = runtime.buildPlan(twentyDropVisible, {
    folderName: "4-harrat餐厅"
  });
  assert.deepStrictEqual(
    preview.entries.map((entry) => entry.id),
    twentyDropVisible.map((item) => item.id),
    "numbering preview must follow manual drop " + String(step + 1)
  );
  assert.deepStrictEqual(
    preview.entries.map((entry) => entry.newName),
    Array.from({ length: 12 }, (_, index) =>
      "1-harrat餐厅" + String(index + 1)
    )
  );
}

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
