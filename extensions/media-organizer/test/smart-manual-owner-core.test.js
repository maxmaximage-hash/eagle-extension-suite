"use strict";

const assert = require("assert");
const {
  canSkipLifecycleRestore,
  canPreserveManualOwnerOnContextEnter
} = require("../lib/smart-manual-owner-core");

const owner = {
  libraryId: "library",
  collectionId: "smart",
  overlayRevision: 9,
  memberFingerprint: "554:abc",
  visibleProof: true
};

assert.strictEqual(
  canSkipLifecycleRestore({
    owner,
    libraryId: "library",
    collectionId: "smart",
    overlayRevision: 9,
    memberFingerprint: "554:abc"
  }),
  true,
  "R106: a proven manual overlay fences a duplicate lifecycle restore across host array remounts"
);
assert.strictEqual(
  canSkipLifecycleRestore({
    owner,
    libraryId: "library",
    collectionId: "smart",
    overlayRevision: 9,
    memberFingerprint: "555:changed"
  }),
  false,
  "R106: a changed smart membership must reopen lifecycle presentation"
);
assert.strictEqual(
  canSkipLifecycleRestore({
    owner: { ...owner, visibleProof: false },
    libraryId: "library",
    collectionId: "smart",
    overlayRevision: 9,
    memberFingerprint: "554:abc"
  }),
  false,
  "R106: an unproved manual owner cannot suppress lifecycle verification"
);
assert.strictEqual(
  canPreserveManualOwnerOnContextEnter({
    owner,
    libraryId: "library",
    collectionId: "smart"
  }),
  true,
  "R107: lifecycle re-entry for the same smart context must retain a proven manual owner fence"
);
assert.strictEqual(
  canPreserveManualOwnerOnContextEnter({
    owner,
    libraryId: "library",
    collectionId: "other-smart"
  }),
  false,
  "R107: switching smart contexts must clear the previous manual owner fence"
);

console.log("smart manual owner core tests passed");
