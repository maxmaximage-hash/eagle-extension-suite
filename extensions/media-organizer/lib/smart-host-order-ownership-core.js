"use strict";

function asArray(value) {
  try {
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function idsOf(values) {
  const array = asArray(values);
  const ids = [];
  for (const value of array || []) {
    try {
      const id = String(value?.id || value || "");
      if (id) ids.push(id);
    } catch {
      // A host can revoke an item proxy while replacing a query page. Treat
      // that item as unreadable; ownership proof will reject the candidate
      // and select a current, readable source instead.
    }
  }
  return ids;
}

function sameIds(left, right) {
  return left.length === right.length &&
    left.every((id, index) => id === right[index]);
}

// A native smart drag may already have changed Eagle's visible DOM while the
// query arrays are being replaced/rebound. During that short window the
// snapshot phase is not necessarily `ready`, but a complete equal-size,
// duplicate-free member projection is still sufficient to let the durable
// manual overlay own the transaction;
// the presenter must then wait for the visible-window proof before accepting
// the move. Lifecycle restores do not get this escape hatch because they must
// never commit against an unready host snapshot.
function canUseReadOnlyManualOverlay({
  owner,
  sourceItems,
  nextItems
} = {}) {
  if (String(owner || "") !== "manual") return false;
  const sourceArray = asArray(sourceItems);
  const nextArray = asArray(nextItems);
  if (!sourceArray || !nextArray || !sourceArray.length || sourceArray.length !== nextArray.length) return false;
  // The host can transiently expose replacement proxies whose IDs are not
  // readable from the same object identity even though the current smart
  // result still has the same cardinality. A manual overlay never mutates
  // that uncertain host array; it may proceed only with two complete,
  // equally sized readable projections and must still pass visible proof.
  return true;
}

function sameMembers(left, right) {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === left.length &&
    rightSet.size === right.length &&
    left.every((id) => rightSet.has(id));
}

function isPrefix(prefix, full) {
  return prefix.length <= full.length &&
    prefix.every((id, index) => id === full[index]);
}

// Only the array that Eagle proved to be the current smart-query source may
// be committed.  In particular, never replace a full-library allData array
// with a 554-item smart result merely because filtereds is the query source.
// When allData itself is the proven smart source, its zero-based page prefix
// may be updated as a derived projection.
function createSmartHostOrderPlans({
  sourceReference,
  sourceItems,
  allData,
  filtereds,
  nextItems
} = {}) {
  try {
  const sourceArray = asArray(sourceItems);
  const nextArray = asArray(nextItems);
  if (
    !sourceArray ||
    !nextArray ||
    sourceArray.length !== nextArray.length
  ) return [];
  const memberIds = idsOf(sourceArray);
  const nextIds = idsOf(nextArray);
  if (!sameMembers(nextIds, memberIds)) return [];

  // Prefer the arrays currently exposed by Eagle, then use the previous
  // source reference as a compatibility fallback for hosts that keep the
  // query in a private array. Exact membership is the ownership proof; a
  // full-library array with extra members can never be selected.
  const candidates = [];
  for (const candidate of [allData, filtereds, sourceReference]) {
    const candidateArray = asArray(candidate);
    if (!candidateArray || candidates.includes(candidateArray)) continue;
    try {
      if (Object.isFrozen(candidateArray)) continue;
    } catch {
      continue;
    }
    const candidateIds = idsOf(candidateArray);
    if (
      candidateIds.length !== candidateArray.length ||
      candidateArray.length !== sourceArray.length ||
      !sameMembers(candidateIds, memberIds)
    ) continue;
    candidates.push(candidateArray);
  }
  const owner = candidates[0];
  if (!owner) return [];
  const ownerIds = idsOf(owner);

  const plans = [{ target: owner, items: nextArray.slice() }];
  // filtereds is only a derived prefix when allData itself is the proven
  // smart source.  If the source is filtereds, allData may be the whole
  // library and must remain untouched.
  if (
    owner === allData &&
    asArray(filtereds) &&
    owner !== filtereds
  ) {
    const filteredArray = asArray(filtereds);
    const filteredIds = idsOf(filteredArray);
    if (filteredIds.length === filteredArray.length && isPrefix(filteredIds, ownerIds)) {
      plans.push({
        target: filteredArray,
        items: nextArray.slice(0, filteredIds.length)
      });
    }
  }
    return plans;
  } catch {
    // Host arrays and item records may be revoked proxies during an Eagle
    // query replacement. Ownership resolution is fail-open in that frame;
    // the next stable observation will retry with a readable source.
    return [];
  }
}

module.exports = {
  idsOf,
  sameIds,
  sameMembers,
  canUseReadOnlyManualOverlay,
  createSmartHostOrderPlans
};
