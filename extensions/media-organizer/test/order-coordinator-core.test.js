"use strict";

const assert = require("assert");
const vm = require("vm");
const { createMediaSortRuntime } = require("../lib/sort-core");
const {
  idOf,
  uniqueIds,
  sameMembers,
  applyManualOrder,
  applyManualOverlay,
  normalizeManualOverlay,
  overlayFromMove,
  memberFingerprint,
  normalizeMode,
  createOrderCoordinator
} = require("../lib/order-coordinator-core");

const sortRuntime = createMediaSortRuntime({
  imageExtensions: ["jpg"],
  videoExtensions: ["mov"],
  language: "zh_CN"
});
const coordinator = createOrderCoordinator({ sortRuntime });
const items = [
  { id: "a", name: "a.jpg", ext: "jpg", folders: ["folder-a"] },
  { id: "b", name: "b.jpg", ext: "jpg", folders: ["folder-a"] },
  { id: "c", name: "c.jpg", ext: "jpg", folders: ["folder-a"] }
];

{
  const result = coordinator.resolve({
    mode: "automatic",
    items,
    collectionId: "folder-a",
    rules: [
      { field: "TAKEN_AT", direction: "asc" }
    ],
    timestamps: { a: 300, b: 100, c: 200 },
    manualOrder: ["c", "a", "b"]
  });
  assert.strictEqual(result.authority, "automatic-rule");
  assert.deepStrictEqual(result.finalIds, ["b", "c", "a"]);
  assert.strictEqual(result.manualAvailable, true);
}

// R53: the sparse topological overlay must not repeatedly sort a ready list
// for a whole-library provisional buffer. Count heap comparisons rather than
// using a timing assertion that would be noisy across machines.
{
  const large = Array.from({ length: 24319 }, (_, index) => ({ id: `large-${index}` }));
  const metrics = { comparisons: 0 };
  const ordered = applyManualOverlay(large, [
    { itemId: "large-24318", relation: "before", anchorId: "large-0" }
  ], metrics);
  assert.strictEqual(ordered.length, large.length);
  assert.ok(
    ordered.findIndex((item) => item.id === "large-24318") <
      ordered.findIndex((item) => item.id === "large-0")
  );
  assert.ok(
    metrics.comparisons < 1000000,
    `heap operation gate exceeded: ${metrics.comparisons}`
  );
}

{
  const overlay = [{ itemId: "b", relation: "after", anchorId: "c" }];
  const ascending = coordinator.resolve({
    mode: "automatic",
    items,
    collectionId: "folder-a",
    rules: [{ field: "TAKEN_AT", direction: "asc" }],
    timestamps: { a: 300, b: 100, c: 200 },
    manualOverlay: overlay
  });
  assert.strictEqual(ascending.authority, "automatic-rule+manual-overlay");
  assert.deepStrictEqual(ascending.finalIds, ["c", "b", "a"]);
  assert.strictEqual(ascending.overlayApplied, true);

  const descending = coordinator.resolve({
    mode: "automatic",
    items,
    collectionId: "folder-a",
    rules: [{ field: "TAKEN_AT", direction: "desc" }],
    timestamps: { a: 300, b: 100, c: 200 },
    manualOverlay: overlay
  });
  assert.deepStrictEqual(descending.baseIds, ["a", "c", "b"]);
  assert.deepStrictEqual(descending.finalIds, ["a", "c", "b"]);
}

{
  const moved = coordinator.overlayForMove(
    items,
    ["b"],
    "c",
    true
  );
  assert.deepStrictEqual(moved, [
    { itemId: "b", relation: "after", anchorId: "c" }
  ]);
  const multi = coordinator.overlayForMove(items, ["b", "c"], "a", false);
  assert.deepStrictEqual(multi, [
    { itemId: "b", relation: "before", anchorId: "a" },
    { itemId: "c", relation: "before", anchorId: "b" }
  ]);
  assert.deepStrictEqual(
    coordinator.applyManualOverlay(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      multi
    ).map((item) => item.id),
    ["c", "b", "a"]
  );
}

{
  const result = coordinator.resolve({
    mode: "automatic",
    items,
    collectionId: "folder-a",
    rules: [{ field: "TAKEN_AT", direction: "asc" }],
    timestamps: { a: 300, b: 100, c: 200 },
    manualOverlay: [
      { itemId: "b", relation: "after", anchorId: "missing" }
    ]
  });
  assert.deepStrictEqual(result.finalIds, ["b", "c", "a"]);
  assert.strictEqual(result.overlayApplied, false);
  assert.strictEqual(result.staleRelationCount, 1);
}

{
  const result = coordinator.resolve({
    mode: "manual",
    items,
    collectionId: "folder-a",
    rules: [
      { field: "TAKEN_AT", direction: "asc" }
    ],
    timestamps: { a: 300, b: 100, c: 200 },
    manualOrder: ["c", "a", "b"]
  });
  assert.strictEqual(result.authority, "manual");
  assert.deepStrictEqual(result.finalIds, ["c", "a", "b"]);
}

{
  const result = coordinator.resolve({
    mode: "automatic",
    items,
    collectionId: "folder-a",
    manualOrder: ["c", "a"]
  });
  assert.strictEqual(result.authority, "automatic-rule");
  assert.strictEqual(result.manualAvailable, false);
}

assert.deepStrictEqual(
  coordinator.guard("manual-drag", {
    collectionId: "folder-a",
    targetCount: 3,
    locked: true
  }),
  { allowed: false, reason: "sorting-protected" }
);
assert.deepStrictEqual(
  coordinator.guard("manual-drag", {
    collectionId: "folder-a",
    targetCount: 3,
    locked: false
  }),
  { allowed: true, reason: "" }
);

{
  const injectedFactory = vm.runInNewContext(
    `(() => {
      const SORT_MODES = new Set(["native", "automatic", "manual"]);
      ${idOf.toString()}
      ${uniqueIds.toString()}
      ${memberFingerprint.toString()}
      ${normalizeMode.toString()}
      ${sameMembers.toString()}
      ${applyManualOrder.toString()}
      ${normalizeManualOverlay.toString()}
      ${applyManualOverlay.toString()}
      ${overlayFromMove.toString()}
      return ${createOrderCoordinator.toString()};
    })()`
  );
  const injected = injectedFactory({ sortRuntime });
  assert.deepStrictEqual(
    Array.from(injected.resolve({
      mode: "automatic",
      items,
      collectionId: "folder-a",
      rules: [{ field: "TAKEN_AT", direction: "asc" }],
      timestamps: { a: 300, b: 100, c: 200 }
    }).finalIds),
    ["b", "c", "a"]
  );
}

{
  const source = require("fs").readFileSync(
    require("path").join(__dirname, "..", "lib", "order-coordinator-core.js"),
    "utf8"
  );
  assert.strictEqual(
    (source.match(/function memberFingerprint\(/g) || []).length,
    1,
    "member fingerprint must have one owner"
  );
  assert.strictEqual(
    (source.match(/function applyManualOverlay\(/g) || []).length,
    1,
    "manual overlay must have one owner"
  );
}

console.log("order coordinator core tests passed");
