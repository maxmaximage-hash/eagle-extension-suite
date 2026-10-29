"use strict";

// A successful manual smart-folder presentation already owns the latest
// overlay and has passed the rendered-window proof. Eagle may then recycle
// the query array reference while its lifecycle observer runs; membership
// fingerprint + overlay revision are the stable ownership keys.
function canSkipLifecycleRestore({
  owner,
  libraryId,
  collectionId,
  overlayRevision,
  memberFingerprint
} = {}) {
  if (!owner || owner.visibleProof !== true) return false;
  if (String(owner.libraryId || "") !== String(libraryId || "")) return false;
  if (String(owner.collectionId || "") !== String(collectionId || "")) return false;
  if (Number(owner.overlayRevision) !== Number(overlayRevision)) return false;
  if (
    owner.memberFingerprint &&
    memberFingerprint &&
    String(owner.memberFingerprint) !== String(memberFingerprint)
  ) return false;
  return true;
}

function canPreserveManualOwnerOnContextEnter({
  owner,
  libraryId,
  collectionId
} = {}) {
  return Boolean(
    owner?.visibleProof === true &&
    String(owner.libraryId || "") === String(libraryId || "") &&
    String(owner.collectionId || "") === String(collectionId || "")
  );
}

module.exports = {
  canSkipLifecycleRestore,
  canPreserveManualOwnerOnContextEnter
};
