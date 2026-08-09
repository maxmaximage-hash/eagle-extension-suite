"use strict";

function idsOf(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value?.id || value || ""))
    .filter(Boolean);
}

function sameIds(left, right) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

// Eagle's adaptive grid recycles DOM cards. Their screen co-ordinates can be
// circular/masonry-shaped even when the backing list is correct, so geometry
// is deliberately not ordering proof. Ordering truth is the authoritative
// result plus the host's current projection; rendered cards only prove that
// the current view has not leaked a different collection or stale duplicate.
function verifySmartProjection({ desiredIds, projectedIds, renderedIds } = {}) {
  // Kept local because this function is also injected into Eagle's renderer.
  const normalize = (values) => (Array.isArray(values) ? values : [])
    .map((value) => String(value?.id || value || ""))
    .filter(Boolean);
  const equal = (left, right) => left.length === right.length &&
    left.every((id, index) => id === right[index]);
  const desired = normalize(desiredIds);
  const projected = normalize(projectedIds);
  const rendered = normalize(renderedIds);
  if (!desired.length || !projected.length || !rendered.length) {
    return Object.freeze({ ok: false, reason: "smart-projection-empty" });
  }
  if (new Set(desired).size !== desired.length || new Set(projected).size !== projected.length) {
    return Object.freeze({ ok: false, reason: "smart-projection-duplicate" });
  }
  const expectedProjection = desired.slice(0, projected.length);
  if (!equal(projected, expectedProjection)) {
    return Object.freeze({ ok: false, reason: "smart-projection-order-mismatch" });
  }
  if (new Set(rendered).size !== rendered.length) {
    return Object.freeze({ ok: false, reason: "smart-rendered-duplicate" });
  }
  const desiredSet = new Set(desired);
  if (!rendered.every((id) => desiredSet.has(id))) {
    return Object.freeze({ ok: false, reason: "smart-rendered-member-mismatch" });
  }
  return Object.freeze({
    ok: true,
    projectedCount: projected.length,
    renderedCount: rendered.length
  });
}

module.exports = { idsOf, sameIds, verifySmartProjection };
