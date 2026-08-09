"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { scanDirectory } = require("../lib/live-photo-service");

function withFixture(worker) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-scan-test-"));
  try {
    return worker(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function digest(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

test("pairs uppercase JPG and MOV as one read-only Live item", () => {
  withFixture((directory) => {
    const image = path.join(directory, "IMG_0001.JPG");
    const movie = path.join(directory, "IMG_0001.MOV");
    fs.writeFileSync(image, "still");
    fs.writeFileSync(movie, "motion");
    const before = [digest(image), digest(movie)];

    const items = scanDirectory(directory);

    assert.equal(items.length, 1);
    assert.equal(items[0].status, "ready");
    assert.equal(items[0].imageName, "IMG_0001.JPG");
    assert.equal(items[0].movieName, "IMG_0001.MOV");
    assert.deepEqual([digest(image), digest(movie)], before);
  });
});

test("does not silently pair duplicate still images", () => {
  withFixture((directory) => {
    fs.writeFileSync(path.join(directory, "IMG_0002.JPG"), "jpg");
    fs.writeFileSync(path.join(directory, "IMG_0002.HEIC"), "heic");
    fs.writeFileSync(path.join(directory, "IMG_0002.MOV"), "mov");

    const [item] = scanDirectory(directory);
    assert.equal(item.status, "conflict");
    assert.match(item.issues.join(" "), /multiple images/i);
  });
});

test("reports a missing companion instead of inventing a Live item", () => {
  withFixture((directory) => {
    fs.writeFileSync(path.join(directory, "IMG_0003.JPG"), "jpg");
    const [item] = scanDirectory(directory);
    assert.equal(item.status, "incomplete");
    assert.match(item.issues.join(" "), /mov missing/i);
  });
});

test("54-pair user fixture resolves to exactly 54 Live items when available", (context) => {
  const fixture = "/Users/max/Downloads/iCloud 照片 2";
  if (!fs.existsSync(fixture)) {
    context.skip("User fixture is not present on this Mac");
    return;
  }
  const items = scanDirectory(fixture);
  assert.equal(items.length, 54);
  assert.equal(items.every((item) => item.status === "ready"), true);
  assert.equal(new Set(items.map((item) => item.id)).size, 54);
});
