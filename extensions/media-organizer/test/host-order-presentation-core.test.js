"use strict";
const assert = require("assert");
const { presentOrderTransaction } = require("../lib/host-order-presentation-core");
const { verifySmartVisibleWindow } = require("../lib/smart-visible-window-proof-core");
const original = [{ id: "a" }, { id: "b" }, { id: "c" }];
const desired = [original[1], original[2], original[0]];
for (const failure of [() => false, () => { throw new Error("grid failed"); }]) {
  const allData = original.slice();
  const filtereds = original.slice();
  const result = presentOrderTransaction({ nextItems: desired, arrays: [allData, filtereds], moveVisible: failure });
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(allData.map((item) => item.id), ["a", "b", "c"]);
  assert.deepStrictEqual(filtereds.map((item) => item.id), ["a", "b", "c"]);
}
const pageOne = ["b", "c"];
const allData = original.slice();
const committed = presentOrderTransaction({ nextItems: desired, arrays: [allData], moveVisible: () => true, readVisibleIds: () => pageOne, expectedVisibleIds: pageOne });
assert.strictEqual(committed.ok, true);
assert.deepStrictEqual(allData.map((item) => item.id), ["b", "c", "a"], "full host order must survive pagination/virtualization rebuilds");
assert.strictEqual(typeof committed.rollback, "function", "a successful presentation must expose an atomic rollback handle");

const largePlan = Array.from({ length: 1177 }, (_, index) => ({ id: `item-${index}` }));
const virtualizedTarget = largePlan.slice().reverse();
const virtualized = presentOrderTransaction({
  nextItems: largePlan,
  arrays: [{ target: virtualizedTarget, items: largePlan }],
  moveVisible: () => true,
  readVisibleIds: () => largePlan.slice(180, 360).map((item) => item.id),
  expectedVisibleIds: largePlan.slice(0, 360).map((item) => item.id),
  verifyVisible: ({ desiredIds, visibleIds }) =>
    verifySmartVisibleWindow({ desiredIds, visibleIds }).ok
});
assert.strictEqual(
  virtualized.ok,
  true,
  "R89: a large normal folder must accept Eagle recycling 360 mounted cards into another contiguous 180-card virtual window"
);
assert.strictEqual(committed.rollback().ok, true);
assert.deepStrictEqual(allData.map((item) => item.id), ["a", "b", "c"], "late persistence failure must be able to restore host arrays immediately");

const mismatchData = original.slice();
let visible = ["b", "c", "a"];
const mismatch = presentOrderTransaction({
  nextItems: desired,
  arrays: [mismatchData],
  moveVisible: () => true,
  rollbackVisible: () => { visible = ["a", "b", "c"]; return true; },
  readVisibleIds: () => ["wrong"],
  expectedVisibleIds: ["b", "c", "a"]
});
assert.strictEqual(mismatch.ok, false);
assert.strictEqual(mismatch.dataRolledBack, true);
assert.strictEqual(mismatch.visibleRolledBack, true);
assert.deepStrictEqual(mismatchData.map((item) => item.id), ["a", "b", "c"]);
assert.deepStrictEqual(visible, ["a", "b", "c"]);

const visibleRollbackFailed = presentOrderTransaction({
  nextItems: desired,
  arrays: [original.slice()],
  moveVisible: () => true,
  rollbackVisible: () => false,
  readVisibleIds: () => ["wrong"],
  expectedVisibleIds: ["b", "c", "a"]
});
assert.strictEqual(visibleRollbackFailed.reason, "visible-rollback-failed");
assert.strictEqual(visibleRollbackFailed.failOpen, true);

const rollbackTarget = original.slice();
const dataRollbackFailed = presentOrderTransaction({
  nextItems: desired,
  arrays: [rollbackTarget],
  moveVisible: () => true,
  rollbackVisible: () => true,
  readVisibleIds() {
    rollbackTarget.splice = () => { throw new Error("rollback unavailable"); };
    return ["wrong"];
  },
  expectedVisibleIds: ["b", "c", "a"]
});
assert.strictEqual(dataRollbackFailed.reason, "data-rollback-failed");
assert.strictEqual(dataRollbackFailed.dataCommitted, true);
console.log("host order presentation core tests passed");
