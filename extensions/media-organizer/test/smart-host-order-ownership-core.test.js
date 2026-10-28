"use strict";

const assert = require("assert");
const {
  createSmartHostOrderPlans,
  canUseReadOnlyManualOverlay
} = require("../lib/smart-host-order-ownership-core");

const smartItems = Array.from({ length: 3 }, (_, index) => ({ id: `smart-${index}` }));
const reordered = [smartItems[2], smartItems[0], smartItems[1]];
const fullSmart = smartItems.slice();
const smartPage = smartItems.slice(0, 2);
const fullLibrary = Array.from({ length: 8 }, (_, index) => ({ id: `library-${index}` }));

// R104: Eagle can be in a transient host-snapshot phase immediately after a
// native smart drag, while the exact smart member set remains readable. The
// manual overlay owns that transaction and visible proof must settle it;
// lifecycle restores must not use the same read-only escape hatch.
assert.strictEqual(
  canUseReadOnlyManualOverlay({
    owner: "manual",
    sourceItems: smartItems,
    nextItems: reordered
  }),
  true,
  "R104: a manual exact-member move may await visible proof during host repaint"
);
assert.strictEqual(
  canUseReadOnlyManualOverlay({
    owner: "lifecycle",
    sourceItems: smartItems,
    nextItems: reordered
  }),
  false,
  "R104: lifecycle restore must not commit a transient host snapshot"
);
assert.strictEqual(
  canUseReadOnlyManualOverlay({
    owner: "manual",
    sourceItems: smartItems,
    nextItems: [...reordered, { id: "outside-smart-query" }]
  }),
  false,
  "R104: read-only manual overlay rejects a changed-size member page"
);
assert.strictEqual(
  canUseReadOnlyManualOverlay({
    owner: "manual",
    sourceItems: smartItems,
    nextItems: [{ id: "replacement-2" }, { id: "replacement-0" }, { id: "replacement-1" }]
  }),
  true,
  "R104: an equal-size readable replacement page may use overlay-only proof without mutating host arrays"
);

assert.deepStrictEqual(
  createSmartHostOrderPlans({
    sourceReference: smartPage,
    sourceItems: smartPage,
    allData: fullLibrary,
    filtereds: smartPage,
    nextItems: smartPage.slice().reverse()
  }),
  [{ target: smartPage, items: smartPage.slice().reverse() }],
  "R91: a filtereds-owned smart query must never replace the full-library allData"
);

assert.deepStrictEqual(
  createSmartHostOrderPlans({
    sourceReference: fullSmart,
    sourceItems: fullSmart,
    allData: fullSmart,
    filtereds: smartPage,
    nextItems: reordered
  }).map((plan) => plan.items.map((item) => item.id)),
  [
    ["smart-2", "smart-0", "smart-1"],
    ["smart-2", "smart-0"]
  ],
  "R92: an allData-owned smart query may update only its derived prefix"
);

// R100: Eagle may replace the smart-query array while a native drag is in
// flight. The adapter's previous source reference can then be stale (or
// reduced to a paged prefix), even though the current allData array still
// owns the exact smart member set. A valid current owner must be selected by
// exact member identity; never fall back to a full-library array with extra
// members.
const staleSource = smartItems.slice(0, 2);
const currentSmartSource = smartItems.slice();
const stalePlans = createSmartHostOrderPlans({
  sourceReference: staleSource,
  sourceItems: smartItems,
  allData: currentSmartSource,
  filtereds: smartItems.slice(0, 2),
  nextItems: reordered
});
assert.strictEqual(
  stalePlans[0]?.target,
  currentSmartSource,
  "R100: stale smart source references must reconcile to the current exact-member owner"
);

// R101: the host can revoke an old proxy-backed array during query
// replacement. Reading Array.isArray/length on that stale reference must not
// abort the transaction or turn a valid current owner into a commit failure.
const revoked = Proxy.revocable(smartItems.slice(), {});
revoked.revoke();
const revokedPlans = createSmartHostOrderPlans({
  sourceReference: revoked.proxy,
  sourceItems: smartItems,
  allData: currentSmartSource,
  filtereds: smartItems.slice(0, 2),
  nextItems: reordered
});
assert.strictEqual(
  revokedPlans[0]?.target,
  currentSmartSource,
  "R101: revoked stale references must fail over to the current smart owner"
);

// R102: item proxies can be revoked even when the containing array is still
// readable. ID extraction must remain fail-open instead of throwing while
// selecting the current owner.
const revokedItem = Proxy.revocable({ id: "smart-0" }, {});
revokedItem.revoke();
const readableItems = [revokedItem.proxy, smartItems[1], smartItems[2]];
const readableSource = readableItems.slice();
assert.deepStrictEqual(
  createSmartHostOrderPlans({
    sourceReference: readableSource,
    sourceItems: readableItems,
    allData: currentSmartSource,
    filtereds: null,
    nextItems: reordered
  }),
  [],
  "R102: unreadable item identity must fail open rather than commit a partial source"
);

console.log("smart host order ownership core tests passed");
