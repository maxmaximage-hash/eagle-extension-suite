"use strict";

const assert = require("assert");
const {
  verifySmartVisibleWindow,
  describeSmartVisibleWindowMismatch
} = require("../lib/smart-visible-window-proof-core");

const plan = ["a", "b", "c", "d", "e", "f"];
assert.deepStrictEqual(
  verifySmartVisibleWindow({ desiredIds: plan, visibleIds: ["c", "d"] }),
  { ok: true, offset: 2, count: 2 },
  "R86: a non-zero virtual window is valid when it is contiguous in the final plan"
);
assert.deepStrictEqual(
  verifySmartVisibleWindow({ desiredIds: plan, visibleIds: ["a", "b", "c", "d"] }),
  { ok: true, offset: 0, count: 4 },
  "R86: a host may shrink a 120-card mount to a 100-card prefix without invalidating sorted output"
);
assert.deepStrictEqual(
  verifySmartVisibleWindow({ desiredIds: plan, visibleIds: ["c", "e"] }),
  { ok: false, reason: "visible-window-noncontiguous" },
  "R86: a mixed virtual window must remain a red light"
);
assert.deepStrictEqual(
  verifySmartVisibleWindow({ desiredIds: plan, visibleIds: ["c", "c"] }),
  { ok: false, reason: "visible-window-duplicate" },
  "R86: duplicate rendered cards must never be accepted"
);
assert.deepStrictEqual(
  verifySmartVisibleWindow({ desiredIds: plan, visibleIds: ["x", "y"] }),
  { ok: false, reason: "visible-window-outside-plan" },
  "R87: a stale host window must be identified precisely and never accepted as a sorted window"
);
assert.deepStrictEqual(
  describeSmartVisibleWindowMismatch({ desiredIds: plan, visibleIds: ["c", "e", "d"] }),
  {
    ok: false,
    reason: "visible-window-noncontiguous",
    visibleCount: 3,
    desiredCount: 6,
    membershipCount: 3,
    firstOffset: 2,
    adjacentPairs: 0
  },
  "R87: mismatch diagnosis distinguishes a host permutation from a stale collection without exposing item IDs"
);

console.log("smart visible window proof core tests passed");
