"use strict";

const assert = require("assert");
const { presentOrderTransaction } = require("../lib/host-order-presentation-core");
const {
  commitPresentedManualStateTransaction
} = require("../lib/manual-drop-transaction-core");

const original = [{ id: "a" }, { id: "b" }, { id: "c" }];
const desired = [original[1], original[2], original[0]];

function presentationFixture() {
  const allData = original.slice();
  const filtereds = original.slice();
  let visibleIds = ["a", "b", "c"];
  const presentation = presentOrderTransaction({
    nextItems: desired,
    arrays: [allData, filtereds],
    moveVisible() {
      visibleIds = ["b", "c", "a"];
      return true;
    },
    rollbackVisible() {
      visibleIds = ["a", "b", "c"];
      return true;
    },
    readVisibleIds: () => visibleIds.slice(),
    expectedVisibleIds: ["b", "c", "a"]
  });
  return { allData, filtereds, readVisible: () => visibleIds.slice(), presentation };
}

const failureView = presentationFixture();
const manualState = { relations: [], revision: 1 };
const manualStore = { profile: { relations: [], revision: 1 } };
let persisted = JSON.stringify(manualStore);
const previousState = JSON.parse(JSON.stringify(manualState));
const previousStore = JSON.parse(JSON.stringify(manualStore));
const previousPersisted = persisted;
const failed = commitPresentedManualStateTransaction({
  presentation: failureView.presentation,
  applyState() {
    manualState.relations = [{ itemId: "a", relation: "after", anchorId: "c" }];
    manualState.revision = 2;
    manualStore.profile = JSON.parse(JSON.stringify(manualState));
  },
  persistState() {
    persisted = JSON.stringify(manualStore);
    throw new Error("write-then-fail");
  },
  rollbackState() {
    Object.assign(manualState, previousState);
    manualStore.profile = JSON.parse(JSON.stringify(previousStore.profile));
    persisted = previousPersisted;
    return true;
  }
});
assert.strictEqual(failed.ok, false);
assert.strictEqual(failed.reason, "persist-failed");
assert.deepStrictEqual(failureView.readVisible(), ["a", "b", "c"]);
assert.deepStrictEqual(failureView.allData.map((item) => item.id), ["a", "b", "c"]);
assert.deepStrictEqual(failureView.filtereds.map((item) => item.id), ["a", "b", "c"]);
assert.deepStrictEqual(manualState, previousState);
assert.deepStrictEqual(manualStore, previousStore);
assert.strictEqual(persisted, previousPersisted, "DOM, host arrays and manual persistence must all remain old on failure");

const successView = presentationFixture();
let successState = "old";
let successPersisted = "old";
const succeeded = commitPresentedManualStateTransaction({
  presentation: successView.presentation,
  applyState() { successState = "new"; },
  persistState() { successPersisted = "new"; return true; },
  rollbackState() { successState = "old"; successPersisted = "old"; return true; }
});
assert.strictEqual(succeeded.ok, true);
assert.deepStrictEqual(successView.readVisible(), ["b", "c", "a"]);
assert.deepStrictEqual(successView.allData.map((item) => item.id), ["b", "c", "a"]);
assert.deepStrictEqual(successView.filtereds.map((item) => item.id), ["b", "c", "a"]);
assert.strictEqual(successState, "new");
assert.strictEqual(successPersisted, "new", "DOM, host arrays and manual persistence must all commit together");

console.log("manual drop transaction core tests passed");
