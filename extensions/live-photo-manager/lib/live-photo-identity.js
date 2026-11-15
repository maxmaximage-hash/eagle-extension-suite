"use strict";

const crypto = require("crypto");
const path = require("path");

function normalizedStem(value) {
  return String(value || "").trim().toLowerCase();
}

function componentFingerprint(component) {
  if (!component) return null;
  if (component.sha256) return `sha256:${String(component.sha256).toLowerCase()}`;
  if (Number.isFinite(component.bytes) && component.filename) {
    return `file:${String(component.filename).toLowerCase()}:${component.bytes}`;
  }
  return component.filename ? `name:${String(component.filename).toLowerCase()}` : null;
}

function createLivePhotoIdentity(input = {}) {
  const stem = input.stem || path.basename(input.imagePath || input.moviePath || "live-photo", path.extname(input.imagePath || input.moviePath || ""));
  const imageIdentifier = input.imageMetadata?.assetIdentifier || null;
  const movieIdentifier = input.movieMetadata?.assetIdentifier || null;
  const assetIdentifier = imageIdentifier && imageIdentifier === movieIdentifier ? imageIdentifier : null;
  const mismatchedIdentifiers = Boolean(imageIdentifier && movieIdentifier && imageIdentifier !== movieIdentifier);
  const imageFingerprint = componentFingerprint(input.image);
  const movieFingerprint = componentFingerprint(input.movie);
  const hasContentEvidence = Boolean(imageFingerprint && movieFingerprint && imageFingerprint.startsWith("sha256:") && movieFingerprint.startsWith("sha256:"));
  const idSeed = assetIdentifier
    ? `asset:${assetIdentifier}`
    : hasContentEvidence
      ? `content:${imageFingerprint}:${movieFingerprint}`
      : `basename:${normalizedStem(stem)}`;
  const groupId = `live:${crypto.createHash("sha256").update(idSeed).digest("hex").slice(0, 24)}`;
  return {
    schemaVersion: 1,
    groupId,
    stem: String(stem).toUpperCase(),
    assetIdentifier,
    pairing: {
      method: mismatchedIdentifiers ? "mismatched-asset-identifier" : assetIdentifier ? "asset-identifier" : hasContentEvidence ? "content-hash" : "basename",
      confidence: mismatchedIdentifiers ? "invalid" : assetIdentifier || hasContentEvidence ? "verified" : "provisional",
    },
    components: {
      image: { filename: input.image?.filename || (input.imagePath ? path.basename(input.imagePath) : null), fingerprint: imageFingerprint },
      movie: { filename: input.movie?.filename || (input.moviePath ? path.basename(input.moviePath) : null), fingerprint: movieFingerprint },
    },
  };
}

function validateLivePhotoIdentity(identity) {
  const issues = [];
  if (!identity || identity.schemaVersion !== 1) issues.push("unsupported identity schema");
  if (!identity?.components?.image?.filename) issues.push("image component missing");
  if (!identity?.components?.movie?.filename) issues.push("movie component missing");
  if (identity?.pairing?.method === "mismatched-asset-identifier") {
    issues.push("image and movie asset identifiers do not match");
  }
  return { valid: issues.length === 0, issues };
}

module.exports = {
  createLivePhotoIdentity,
  validateLivePhotoIdentity,
};
