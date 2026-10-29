"use strict";

function idsOf(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value?.id || value || ""))
    .filter(Boolean);
}

function sameIds(left, right) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function normalizeArrayPlans(arrays, desired) {
  return (Array.isArray(arrays) ? arrays : [])
    .map((entry) => Array.isArray(entry)
      ? { target: entry, items: desired }
      : { target: entry?.target, items: Array.isArray(entry?.items) ? entry.items.slice() : desired })
    .filter((entry) => Array.isArray(entry.target));
}

function commitHostOrder({ nextItems, arrays = [] } = {}) {
  const desired = Array.isArray(nextItems) ? nextItems.slice() : null;
  if (!desired) return Object.freeze({ ok: false, reason: "next-items-required" });
  const plans = normalizeArrayPlans(arrays, desired);
  const transaction = {
    plans,
    backups: plans.map((entry) => entry.target.slice()),
    committed: false
  };
  try {
    for (const entry of plans) {
      entry.target.splice(0, entry.target.length, ...entry.items);
    }
    transaction.committed = true;
    return Object.freeze({ ok: true, transaction });
  } catch {
    rollbackHostOrder(transaction);
    return Object.freeze({ ok: false, reason: "data-commit-failed", transaction });
  }
}

function verifyHostOrder(transaction) {
  if (!transaction?.committed) return false;
  return transaction.plans.every((entry) =>
    sameIds(idsOf(entry.target), idsOf(entry.items))
  );
}

function rollbackHostOrder(transaction) {
  if (!transaction?.plans || !transaction?.backups) return false;
  let rolledBack = true;
  for (let index = 0; index < transaction.plans.length; index += 1) {
    try {
      const target = transaction.plans[index].target;
      target.splice(0, target.length, ...transaction.backups[index]);
    } catch {
      rolledBack = false;
    }
  }
  if (rolledBack) transaction.committed = false;
  return rolledBack;
}

// The visible host operation is attempted before any host collection array is
// committed. A thrown/rejected DOM move therefore cannot corrupt allData or
// filtereds. Array commit is rollback-safe if either splice fails.
function presentOrderTransaction({
  nextItems,
  arrays = [],
  moveVisible = () => true,
  rollbackVisible = () => true,
  readVisibleIds = () => [],
  expectedVisibleIds = [],
  verifyVisible = null
} = {}) {
  const desired = Array.isArray(nextItems) ? nextItems.slice() : null;
  if (!desired) return Object.freeze({ ok: false, reason: "next-items-required" });
  let moved = false;
  try {
    moved = moveVisible() !== false;
  } catch {
    moved = false;
  }
  if (!moved) {
    return Object.freeze({ ok: false, reason: "visible-move-failed", dataCommitted: false });
  }
  const commit = commitHostOrder({ nextItems: desired, arrays });
  if (!commit.ok) {
    let visibleRolledBack = false;
    try { visibleRolledBack = rollbackVisible() !== false; } catch {}
    return Object.freeze({
      ok: false,
      reason: visibleRolledBack ? "data-commit-failed" : "visible-rollback-failed",
      dataCommitted: false,
      visibleRolledBack,
      failOpen: true
    });
  }
  const expected = idsOf(expectedVisibleIds);
  const actual = idsOf(readVisibleIds());
  const desiredIds = idsOf(desired);
  let visibleVerified = sameIds(actual, expected);
  if (typeof verifyVisible === "function") {
    try {
      visibleVerified = verifyVisible({
        desiredIds,
        expectedVisibleIds: expected,
        visibleIds: actual
      }) === true;
    } catch {
      visibleVerified = false;
    }
  }
  const dataVerified = verifyHostOrder(commit.transaction);
  if (!visibleVerified || !dataVerified) {
    const dataRolledBack = rollbackHostOrder(commit.transaction);
    let visibleRolledBack = false;
    try { visibleRolledBack = rollbackVisible() !== false; } catch {}
    const rollbackFailed = !dataRolledBack || !visibleRolledBack;
    return Object.freeze({
      ok: false,
      reason: rollbackFailed
        ? !dataRolledBack ? "data-rollback-failed" : "visible-rollback-failed"
        : visibleVerified ? "data-order-mismatch" : "visible-order-mismatch",
      dataCommitted: !dataRolledBack,
      dataVerified,
      visibleVerified,
      dataRolledBack,
      visibleRolledBack,
      failOpen: true
    });
  }
  let rolledBack = false;
  const rollback = () => {
    if (rolledBack) {
      return Object.freeze({
        ok: true,
        dataRolledBack: true,
        visibleRolledBack: true,
        alreadyRolledBack: true
      });
    }
    const dataRolledBack = rollbackHostOrder(commit.transaction);
    let visibleRolledBack = false;
    try { visibleRolledBack = rollbackVisible() !== false; } catch {}
    rolledBack = dataRolledBack && visibleRolledBack;
    return Object.freeze({
      ok: rolledBack,
      reason: !dataRolledBack
        ? "data-rollback-failed"
        : !visibleRolledBack ? "visible-rollback-failed" : "",
      dataRolledBack,
      visibleRolledBack,
      failOpen: !rolledBack
    });
  };
  return Object.freeze({
    ok: visibleVerified && dataVerified,
    reason: visibleVerified ? (dataVerified ? "" : "data-order-mismatch") : "visible-order-mismatch",
    dataCommitted: true,
    dataVerified,
    visibleVerified,
    transaction: commit.transaction,
    rollback
  });
}

module.exports = {
  idsOf,
  sameIds,
  normalizeArrayPlans,
  commitHostOrder,
  verifyHostOrder,
  rollbackHostOrder,
  presentOrderTransaction
};
