"use strict";

function idsOf(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value?.id || value || ""))
    .filter(Boolean);
}

// A virtualized Eagle grid is allowed to change how many cards it mounts after
// an Angular refresh. Its size is not part of ordering truth: the mounted
// cards must be one contiguous, duplicate-free window of the authoritative
// full sequence.
function verifySmartVisibleWindow({ desiredIds, visibleIds } = {}) {
  const normalize = (values) => (Array.isArray(values) ? values : [])
    .map((value) => String(value?.id || value || ""))
    .filter(Boolean);
  const desired = normalize(desiredIds);
  const visible = normalize(visibleIds);
  if (!desired.length || !visible.length) {
    return Object.freeze({ ok: false, reason: "visible-window-empty" });
  }
  if (new Set(visible).size !== visible.length) {
    return Object.freeze({ ok: false, reason: "visible-window-duplicate" });
  }
  const offset = desired.indexOf(visible[0]);
  if (offset < 0 || offset + visible.length > desired.length) {
    return Object.freeze({ ok: false, reason: "visible-window-outside-plan" });
  }
  for (let index = 0; index < visible.length; index += 1) {
    if (desired[offset + index] !== visible[index]) {
      return Object.freeze({ ok: false, reason: "visible-window-noncontiguous" });
    }
  }
  return Object.freeze({ ok: true, offset, count: visible.length });
}

// Keep diagnosis structural.  It deliberately exposes no media name, path,
// thumbnail, or Eagle item ID: callers only need to know whether the
// renderer is stale, mixed, or a permutation of the authoritative plan.
function describeSmartVisibleWindowMismatch({ desiredIds, visibleIds } = {}) {
  const normalize = (values) => (Array.isArray(values) ? values : [])
    .map((value) => String(value?.id || value || ""))
    .filter(Boolean);
  const desired = normalize(desiredIds);
  const visible = normalize(visibleIds);
  const proof = verifySmartVisibleWindow({ desiredIds: desired, visibleIds: visible });
  const desiredSet = new Set(desired);
  const membershipCount = visible.filter((id) => desiredSet.has(id)).length;
  const firstOffset = visible.length ? desired.indexOf(visible[0]) : -1;
  let adjacentPairs = 0;
  for (let index = 1; index < visible.length; index += 1) {
    const previous = desired.indexOf(visible[index - 1]);
    const current = desired.indexOf(visible[index]);
    if (previous >= 0 && current === previous + 1) adjacentPairs += 1;
  }
  return Object.freeze({
    ok: proof.ok === true,
    reason: String(proof.reason || ""),
    visibleCount: visible.length,
    desiredCount: desired.length,
    membershipCount,
    firstOffset,
    adjacentPairs
  });
}

module.exports = { idsOf, verifySmartVisibleWindow, describeSmartVisibleWindowMismatch };
