"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { groupLiveDropFiles } = require("../lib/native-drop-adapter");

function fixtureDirectory() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-drop-adapter-test-"));
  for (const name of ["IMG_4154.HEIC", "IMG_4154.MOV", "other.jpg", "other.MOV"]) {
    fs.writeFileSync(path.join(root, name), name);
  }
  return root;
}

test("groups one same-stem HEIC+MOV drop into one native livp file", () => {
  const root = fixtureDirectory();
  const result = groupLiveDropFiles([
    { path: path.join(root, "IMG_4154.HEIC"), folders: ["folder"] },
    { path: path.join(root, "IMG_4154.MOV"), tags: ["live"] },
  ], { stageDirectory: path.join(root, "stage") });
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].ext, "livp");
  assert.deepEqual(result.files[0].folders, ["folder"]);
  assert.deepEqual(result.files[0].tags, ["live"]);
  assert.equal(result.pairs.length, 1);
  assert.ok(fs.existsSync(result.files[0].path));
});

test("does not guess when a stem has duplicate stills", () => {
  const root = fixtureDirectory();
  fs.writeFileSync(path.join(root, "IMG_4154.jpg"), "duplicate");
  const result = groupLiveDropFiles([
    { path: path.join(root, "IMG_4154.HEIC") },
    { path: path.join(root, "IMG_4154.jpg") },
    { path: path.join(root, "IMG_4154.MOV") },
  ], { stageDirectory: path.join(root, "stage") });
  assert.equal(result.pairs.length, 0);
  assert.equal(result.files.length, 3);
});
