"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { readStaticPhotoMetadata, createStaticPhotoProjection } = require("../photo-metadata");

test("reads static photo dimensions, EXIF time and GPS through the macOS metadata boundary", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-inspector-meta-"));
  const image = path.join(root, "IMG_4154.HEIC");
  fs.writeFileSync(image, "fixture");
  const values = {
    "kMDItemContentCreationDate": "2026-10-05 11:49:46 +0000",
    "kMDItemAcquisitionMake": "Apple",
    "kMDItemAcquisitionModel": "iPhone 18 Pro",
    "kMDItemAltitude": "-2.9133",
    "kMDItemLatitude": "22.1485721667",
    "kMDItemLongitude": "113.57132",
    "kMDItemFocalLength": "6.93",
    "kMDItemAperture": "1.48",
    "kMDItemExposureTimeSeconds": "0.02",
    "kMDItemISOSpeed": "400",
    "kMDItemOrientation": "1",
    "kMDItemProfileName": "Display P3",
    "kMDItemPixelWidth": "4284",
    "kMDItemPixelHeight": "5712",
    "kMDItemFSSize": "2425915",
  };
  const run = (command, args) => {
    if (command === "sips") return "pixelWidth: 4284\npixelHeight: 5712\nformat: heic\nprofile: Display P3\nmake: Apple\nmodel: iPhone 18 Pro\n";
    const field = args[args.indexOf("-name") + 1];
    return values[field] || "(null)";
  };
  const metadata = readStaticPhotoMetadata(image, { run });
  assert.equal(metadata.format, "HEIC");
  assert.equal(metadata.width, 4284);
  assert.equal(metadata.height, 5712);
  assert.equal(metadata.exif.make, "Apple");
  assert.equal(metadata.exif.model, "iPhone 18 Pro");
  assert.equal(metadata.gps.latitude, 22.1485721667);
  assert.equal(metadata.gps.longitude, 113.57132);
  assert.equal(metadata.takenAt, "2026-10-05T11:49:46.000Z");
  assert.equal(metadata.rawMetadata.kMDItemLatitude, "22.1485721667");
  assert.equal(metadata.rawMetadata.kMDItemContentCreationDate, "2026-10-05 11:49:46 +0000");
  const projection = createStaticPhotoProjection({ metadata, packagePath: "/tmp/IMG_4154.livp", imageEntry: "image.heic" });
  assert.equal(projection.sourceType, "static-photo");
  assert.equal(projection.source.containerRole, "internal-only");
});
