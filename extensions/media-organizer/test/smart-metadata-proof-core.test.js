"use strict";
const assert = require("assert");
const { createSmartMetadataProof, metadataProofMatches } = require("../lib/smart-metadata-proof-core");
const proof = createSmartMetadataProof({
  libraryId: "library", collectionId: "smart", snapshotGeneration: 7,
  snapshotFingerprint: "571:members", totalCount: 571,
  resolvedCount: 550, missingSentinelCount: 21, complete: true
});
assert.strictEqual(metadataProofMatches(proof, {
  libraryId: "library", collectionId: "smart", snapshotGeneration: 7,
  snapshotFingerprint: "571:members"
}), true);
for (const changed of [
  { libraryId: "old-library" },
  { collectionId: "old-smart" },
  { snapshotGeneration: 6 },
  { snapshotFingerprint: "538:old" }
]) {
  assert.strictEqual(metadataProofMatches(proof, {
    libraryId: "library", collectionId: "smart", snapshotGeneration: 7,
    snapshotFingerprint: "571:members", ...changed
  }), false, "stale metadata must never authorize a new smart snapshot");
}
const incomplete = createSmartMetadataProof({
  libraryId: "library", collectionId: "smart", snapshotGeneration: 7,
  snapshotFingerprint: "571:members", totalCount: 571,
  resolvedCount: 550, missingSentinelCount: 0, complete: true
});
assert.strictEqual(incomplete.complete, false);
console.log("smart metadata proof core tests passed");
