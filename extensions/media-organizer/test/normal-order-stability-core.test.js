"use strict";

const assert = require("assert");
const { createNormalOrderStabilityGate } = require("../lib/normal-order-stability-core");

const gate = createNormalOrderStabilityGate();
const planA = { key: "plan-a", expectedVisibleIds: ["a", "b"], observedVisibleIds: ["b", "a"] };

assert.deepStrictEqual(gate.request(planA), { action: "present", reason: "initial" },
  "R85: an unpresented complete plan must get exactly one initial transaction");
assert.deepStrictEqual(gate.request(planA), { action: "skip", reason: "presentation-pending" },
  "R85: synchronous host re-entry must not start a second transaction");
assert.deepStrictEqual(gate.complete({ key: "plan-a", expectedVisibleIds: ["a", "b"], ok: true }),
  { ok: true, reconciled: false });
assert.deepStrictEqual(gate.request({ ...planA, observedVisibleIds: ["a", "b"] }),
  { action: "skip", reason: "stable" });
assert.deepStrictEqual(gate.request(planA), { action: "present", reason: "late-reversion" },
  "R85: one late native overwrite must be reconciled from the observed grid");
assert.deepStrictEqual(gate.complete({ key: "plan-a", expectedVisibleIds: ["a", "b"], ok: true }),
  { ok: true, reconciled: true });
assert.deepStrictEqual(gate.request(planA), { action: "fail-open", reason: "late-reversion-exhausted" },
  "R85: repeated host rewrites must fail open rather than loop forever");
assert.deepStrictEqual(gate.request({ key: "plan-b", expectedVisibleIds: ["c", "d"], observedVisibleIds: ["d", "c"] }),
  { action: "present", reason: "initial" },
  "R85: a new sorting plan resets the single reconciliation allowance");
assert.deepStrictEqual(gate.request({ key: "plan-c", expectedVisibleIds: ["x"], observedVisibleIds: [] }),
  { action: "fail-open", reason: "visible-window-unprovable" },
  "R85: partial or unprovable windows must never be written");

console.log("normal order stability core tests passed");
