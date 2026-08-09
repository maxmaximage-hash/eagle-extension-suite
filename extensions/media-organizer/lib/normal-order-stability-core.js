"use strict";

function sameIds(left, right) {
  return Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((id, index) => String(id) === String(right[index]));
}

// Coordinates one normal-folder presentation for a concrete ordering plan.
// Eagle may apply its own late grid rebuild after a successful transaction.
// That rebuild is allowed one explicit reconciliation; repeated rewrites fail
// open instead of creating a presentation loop.
function createNormalOrderStabilityGate() {
  let settledKey = "";
  let expectedIds = [];
  let pendingKey = "";
  let reconciledKey = "";

  function request({ key, expectedVisibleIds, observedVisibleIds } = {}) {
    const normalizedKey = String(key || "");
    const expected = (Array.isArray(expectedVisibleIds) ? expectedVisibleIds : [])
      .map((id) => String(id || ""))
      .filter(Boolean);
    const observed = (Array.isArray(observedVisibleIds) ? observedVisibleIds : [])
      .map((id) => String(id || ""))
      .filter(Boolean);
    if (!normalizedKey || !expected.length || expected.length !== observed.length) {
      return Object.freeze({ action: "fail-open", reason: "visible-window-unprovable" });
    }
    if (pendingKey === normalizedKey) {
      return Object.freeze({ action: "skip", reason: "presentation-pending" });
    }
    if (settledKey !== normalizedKey || !sameIds(expectedIds, expected)) {
      pendingKey = normalizedKey;
      return Object.freeze({ action: "present", reason: "initial" });
    }
    if (sameIds(expected, observed)) {
      return Object.freeze({ action: "skip", reason: "stable" });
    }
    if (reconciledKey === normalizedKey) {
      return Object.freeze({ action: "fail-open", reason: "late-reversion-exhausted" });
    }
    pendingKey = normalizedKey;
    return Object.freeze({ action: "present", reason: "late-reversion" });
  }

  function complete({ key, expectedVisibleIds, ok, reason } = {}) {
    const normalizedKey = String(key || "");
    const expected = (Array.isArray(expectedVisibleIds) ? expectedVisibleIds : [])
      .map((id) => String(id || ""))
      .filter(Boolean);
    const wasReconciliation = settledKey === normalizedKey && !sameIds(expectedIds, []);
    if (pendingKey === normalizedKey) pendingKey = "";
    if (!ok || !normalizedKey || !expected.length) {
      return Object.freeze({ ok: false, reason: String(reason || "presentation-failed") });
    }
    if (wasReconciliation) reconciledKey = normalizedKey;
    if (settledKey !== normalizedKey) reconciledKey = "";
    settledKey = normalizedKey;
    expectedIds = expected;
    return Object.freeze({ ok: true, reconciled: wasReconciliation });
  }

  function reset() {
    settledKey = "";
    expectedIds = [];
    pendingKey = "";
    reconciledKey = "";
  }

  return Object.freeze({ request, complete, reset });
}

module.exports = { createNormalOrderStabilityGate };
