"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { importPairAsNativeItem } = require("../lib/native-eagle-importer");

test("imports one Live pair as one Eagle item and confirms it by reading the item back", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-native-import-"));
  const source = path.join(root, "source");
  const stage = path.join(root, "stage");
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, "IMG_0001.JPG"), "still");
  fs.writeFileSync(path.join(source, "IMG_0001.MOV"), "motion");
  const calls = [];
  const eagle = {
    item: {
      async addFromPath(packagePath, options) {
        calls.push({ packagePath, options });
        return "native-item-1";
      },
      async getById(id) {
        assert.equal(id, "native-item-1");
        return { id, ext: "livp", width: 4284, height: 5712, noPreview: false };
      },
    },
  };
  try {
    const result = await importPairAsNativeItem({
      eagle,
      pair: {
        id: "group-0001",
        stem: "IMG_0001",
        imagePath: path.join(source, "IMG_0001.JPG"),
        moviePath: path.join(source, "IMG_0001.MOV"),
      },
      folderId: "folder-qa",
      stageDirectory: stage,
      confirmTimeoutMs: 50,
      pollIntervalMs: 1,
    });
    assert.equal(result.status, "confirmed");
    assert.equal(result.itemId, "native-item-1");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].options.folders, ["folder-qa"]);
    assert.equal(fs.existsSync(result.packagePath), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("keeps accepted and confirmed separate when Eagle never exposes a usable preview", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-native-import-fail-"));
  const source = path.join(root, "source");
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, "IMG_0002.JPG"), "still");
  fs.writeFileSync(path.join(source, "IMG_0002.MOV"), "motion");
  const eagle = {
    item: {
      async addFromPath() { return "native-item-2"; },
      async getById() { return { id: "native-item-2", ext: "livp", width: 0, height: 0, noPreview: true }; },
    },
  };
  try {
    await assert.rejects(
      importPairAsNativeItem({
        eagle,
        pair: {
          id: "group-0002",
          stem: "IMG_0002",
          imagePath: path.join(source, "IMG_0002.JPG"),
          moviePath: path.join(source, "IMG_0002.MOV"),
        },
        folderId: "folder-qa",
        stageDirectory: path.join(root, "stage"),
        confirmTimeoutMs: 5,
        pollIntervalMs: 1,
      }),
      /accepted but not confirmed/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
