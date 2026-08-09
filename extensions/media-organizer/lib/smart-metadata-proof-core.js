"use strict";

function createSmartMetadataProof(input = {}) {
  const totalCount = Math.max(0, Number(input.totalCount) || 0);
  const resolvedCount = Math.max(0, Number(input.resolvedCount) || 0);
  const missingSentinelCount = Math.max(0, Number(input.missingSentinelCount) || 0);
  const complete = input.complete === true &&
    resolvedCount + missingSentinelCount === totalCount;
  return Object.freeze({
    libraryId: String(input.libraryId || ""),
    collectionId: String(input.collectionId || ""),
    snapshotGeneration: Math.max(0, Number(input.snapshotGeneration) || 0),
    snapshotFingerprint: String(input.snapshotFingerprint || ""),
    totalCount,
    resolvedCount,
    missingSentinelCount,
    complete
  });
}

function metadataProofMatches(proof = {}, expected = {}) {
  return proof.complete === true &&
    String(proof.libraryId || "") === String(expected.libraryId || "") &&
    String(proof.collectionId || "") === String(expected.collectionId || "") &&
    Number(proof.snapshotGeneration) === Number(expected.snapshotGeneration) &&
    String(proof.snapshotFingerprint || "") === String(expected.snapshotFingerprint || "") &&
    Number(proof.resolvedCount || 0) + Number(proof.missingSentinelCount || 0) ===
      Number(proof.totalCount || 0);
}

module.exports = { createSmartMetadataProof, metadataProofMatches };
