"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createLedger, ensureGroup } = require("../lib/live-photo-ledger");
const {
  registerNativeItem,
  findGroupByNativeItemId,
  exportNativeItem,
} = require("../lib/native-live-registry");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-native-registry-"));
  const imagePath = path.join(root, "IMG_0001.JPG");
  const moviePath = path.join(root, "IMG_0001.MOV");
  fs.writeFileSync(imagePath, "still");
  fs.writeFileSync(moviePath, "motion");
  const ledger = createLedger({ sourceDirectory: root });
  const group = ensureGroup(ledger, {
    id: "group-0001",
    stem: "IMG_0001",
    status: "ready",
    imagePath,
    moviePath,
  });
  return { root, imagePath, moviePath, ledger, group };
}

test("registers and resolves a native Eagle item without changing the grid record", () => {
  const { root, ledger, group } = fixture();
  try {
    registerNativeItem(ledger, {
      group,
      itemId: "native-item-1",
      packagePath: path.join(root, "IMG_0001.livp"),
    });
    assert.equal(findGroupByNativeItemId(ledger, "native-item-1"), group);
    assert.equal(group.nativeItemId, "native-item-1");
    assert.match(ledger.events.at(-1).type, /native-item\.registered/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("exports a native item through the service boundary and records confirmation", () => {
  const { root, ledger, group } = fixture();
  const outputDirectory = path.join(root, "exports");
  try {
    registerNativeItem(ledger, { group, itemId: "native-item-2" });
    const operation = exportNativeItem(ledger, {
      itemId: "native-item-2",
      mode: "components",
      outputDirectory,
    });
    assert.equal(operation.status, "completed");
    assert.equal(operation.metadata.nativeItemId, "native-item-2");
    assert.equal(operation.results[0].status, "confirmed");
    assert.equal(fs.existsSync(path.join(outputDirectory, "IMG_0001.JPG")), true);
    assert.equal(fs.existsSync(path.join(outputDirectory, "IMG_0001.MOV")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

