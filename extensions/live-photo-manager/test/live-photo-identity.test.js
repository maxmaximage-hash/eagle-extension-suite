"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createLivePhotoIdentity,
  validateLivePhotoIdentity,
} = require("../lib/live-photo-identity");

test("basename pairing is explicitly provisional until metadata or content evidence exists", () => {
  const identity = createLivePhotoIdentity({
    stem: "IMG_0001",
    imagePath: "/source/IMG_0001.JPG",
    moviePath: "/source/IMG_0001.MOV",
  });
  assert.equal(identity.schemaVersion, 1);
  assert.equal(identity.pairing.method, "basename");
  assert.equal(identity.pairing.confidence, "provisional");
  assert.equal(identity.assetIdentifier, null);
});

test("matching Apple asset identifiers upgrade a pair to verified", () => {
  const identity = createLivePhotoIdentity({
    stem: "IMG_0002",
    imagePath: "/source/IMG_0002.HEIC",
    moviePath: "/source/IMG_0002.MOV",
    imageMetadata: { assetIdentifier: "asset-02" },
    movieMetadata: { assetIdentifier: "asset-02" },
  });
  assert.equal(identity.assetIdentifier, "asset-02");
  assert.equal(identity.pairing.method, "asset-identifier");
  assert.equal(identity.pairing.confidence, "verified");
  assert.deepEqual(validateLivePhotoIdentity(identity), { valid: true, issues: [] });
});

test("mismatched asset identifiers are rejected before export", () => {
  const identity = createLivePhotoIdentity({
    stem: "IMG_0003",
    imagePath: "/source/IMG_0003.JPG",
    moviePath: "/source/IMG_0003.MOV",
    imageMetadata: { assetIdentifier: "asset-image" },
    movieMetadata: { assetIdentifier: "asset-movie" },
  });
  const result = validateLivePhotoIdentity(identity);
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" "), /asset identifier/i);
});
