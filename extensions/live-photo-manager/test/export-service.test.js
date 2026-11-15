"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  exportLivePairComponent,
  exportLivePairComponents,
  exportLivePairPackage,
} = require("../lib/export-service");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-export-test-"));
  const source = path.join(root, "source");
  const output = path.join(root, "output");
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, "IMG_0001.JPG"), "still");
  fs.writeFileSync(path.join(source, "IMG_0001.MOV"), "motion");
  return {
    root,
    output,
    pair: {
      id: "group-0001",
      stem: "IMG_0001",
      imagePath: path.join(source, "IMG_0001.JPG"),
      moviePath: path.join(source, "IMG_0001.MOV"),
    },
  };
}

test("exports components with a manifest and never overwrites by default", () => {
  const { root, output, pair } = fixture();
  try {
    const result = exportLivePairComponents(pair, output);
    assert.equal(fs.readFileSync(result.imagePath, "utf8"), "still");
    assert.equal(fs.readFileSync(result.moviePath, "utf8"), "motion");
    assert.equal(result.manifest.groupId, "group-0001");
    assert.equal(result.manifest.components.image.sha256.length, 64);
    assert.throws(() => exportLivePairComponents(pair, output), /already exists/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("exports an Eagle preview package through the shared package core", () => {
  const { root, output, pair } = fixture();
  try {
    const result = exportLivePairPackage(pair, output);
    assert.equal(path.extname(result.packagePath), ".livp");
    assert.equal(fs.existsSync(result.packagePath), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("exports one selected component without changing its companion", () => {
  const { root, output, pair } = fixture();
  try {
    const result = exportLivePairComponent(pair, output, "image");
    assert.equal(fs.readFileSync(result.path, "utf8"), "still");
    assert.equal(fs.existsSync(path.join(output, "IMG_0001.MOV")), false);
    assert.match(result.manifestPath, /\.image\.live-photo\.json$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
