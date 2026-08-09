"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findLivePairs,
  packageLivePair,
  exportLivePackageComponents,
} = require("../lib/live-package");

function withTempDirectory(worker) {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "live-package-test-"));
  try {
    return worker(tempDirectory);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

test("pairs uppercase iCloud JPG and MOV files by basename", () => {
  withTempDirectory((directory) => {
    fs.writeFileSync(path.join(directory, "IMG_9264.JPG"), "fake-jpg");
    fs.writeFileSync(path.join(directory, "IMG_9264.MOV"), "fake-mov");

    const pairs = findLivePairs(directory);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].status, "ready");
    assert.equal(path.basename(pairs[0].image), "IMG_9264.JPG");
    assert.equal(path.basename(pairs[0].movie), "IMG_9264.MOV");
  });
});

test("packages a pair into an Eagle-compatible livp zip", () => {
  withTempDirectory((directory) => {
    const outputDirectory = path.join(directory, "out");
    fs.writeFileSync(path.join(directory, "IMG_9264.JPG"), "fake-jpg");
    fs.writeFileSync(path.join(directory, "IMG_9264.MOV"), "fake-mov");

    const [pair] = findLivePairs(directory);
    const outputPath = packageLivePair(pair, outputDirectory);

    assert.equal(path.extname(outputPath), ".livp");
    assert.equal(fs.existsSync(outputPath), true);

    const listing = childProcess.execFileSync("unzip", ["-Z", "-1", outputPath], { encoding: "utf8" });
    assert.match(listing, /^image\.jpeg$/m);
    assert.match(listing, /^motion\.mov$/m);
    assert.match(listing, /^manifest\.json$/m);

    const manifest = JSON.parse(childProcess.execFileSync("unzip", ["-p", outputPath, "manifest.json"], { encoding: "utf8" }));
    assert.equal(manifest.eagleCompatibility.extension, "livp");
    assert.equal(manifest.source.image, "IMG_9264.JPG");
    assert.equal(manifest.source.movie, "IMG_9264.MOV");
  });
});

test("exports image and movie components from a livp package", () => {
  withTempDirectory((directory) => {
    const packageDirectory = path.join(directory, "packages");
    const exportDirectory = path.join(directory, "exports");
    fs.writeFileSync(path.join(directory, "IMG_9264.JPG"), "fake-jpg");
    fs.writeFileSync(path.join(directory, "IMG_9264.MOV"), "fake-mov");

    const [pair] = findLivePairs(directory);
    const packagePath = packageLivePair(pair, packageDirectory);
    const result = exportLivePackageComponents(packagePath, exportDirectory);

    assert.equal(path.basename(result.image), "IMG_9264.JPG");
    assert.equal(path.basename(result.movie), "IMG_9264.MOV");
    assert.equal(fs.readFileSync(result.image, "utf8"), "fake-jpg");
    assert.equal(fs.readFileSync(result.movie, "utf8"), "fake-mov");
  });
});

test("refuses to overwrite exported components unless explicitly allowed", () => {
  withTempDirectory((directory) => {
    const packageDirectory = path.join(directory, "packages");
    const exportDirectory = path.join(directory, "exports");
    fs.writeFileSync(path.join(directory, "IMG_9264.JPG"), "fake-jpg");
    fs.writeFileSync(path.join(directory, "IMG_9264.MOV"), "fake-mov");

    const [pair] = findLivePairs(directory);
    const packagePath = packageLivePair(pair, packageDirectory);
    exportLivePackageComponents(packagePath, exportDirectory);

    assert.throws(
      () => exportLivePackageComponents(packagePath, exportDirectory),
      /Output already exists/,
    );
  });
});
