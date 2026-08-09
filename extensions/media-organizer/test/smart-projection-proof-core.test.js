"use strict";

const assert = require("assert");
const { verifySmartProjection } = require("../lib/smart-projection-proof-core");

const plan = ["a", "b", "c", "d", "e", "f"];
assert.deepStrictEqual(
  verifySmartProjection({
    desiredIds: plan,
    projectedIds: ["a", "b", "c", "d"],
    renderedIds: ["f", "a", "b", "c"]
  }),
  { ok: true, projectedCount: 4, renderedCount: 4 },
  "R88: recycled virtual cards may wrap geometrically while the host projection remains authoritative"
);
assert.deepStrictEqual(
  verifySmartProjection({
    desiredIds: plan,
    projectedIds: ["a", "c"],
    renderedIds: ["a", "c"]
  }),
  { ok: false, reason: "smart-projection-order-mismatch" },
  "R88: a projection that skips the authoritative order remains a red light"
);
assert.deepStrictEqual(
  verifySmartProjection({
    desiredIds: plan,
    projectedIds: ["a", "b", "c"],
    renderedIds: ["a", "x"]
  }),
  { ok: false, reason: "smart-rendered-member-mismatch" },
  "R88: a stale card from another collection must never be accepted"
);

console.log("smart projection proof core tests passed");
