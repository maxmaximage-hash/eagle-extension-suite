"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createLedger,
  loadLedger,
  saveLedger,
  ensureGroup,
  createOperation,
  transitionOperation,
  recordOperationResult,
} = require("../lib/live-photo-ledger");

function tempLedgerPath() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-ledger-test-"));
  return { root, filePath: path.join(root, "ledger.json") };
}

test("persists Live groups and operation state atomically across reload", () => {
  const { root, filePath } = tempLedgerPath();
  try {
    const ledger = createLedger({ sourceDirectory: "/tmp/live-source" });
    const group = ensureGroup(ledger, {
      id: "group-0001",
      stem: "IMG_0001",
      imagePath: "/tmp/live-source/IMG_0001.JPG",
      moviePath: "/tmp/live-source/IMG_0001.MOV",
      status: "ready",
    });
    const operation = createOperation(ledger, {
      type: "export-components",
      groupIds: [group.id],
      outputDirectory: "/tmp/live-output",
    });
    transitionOperation(ledger, operation.id, "running");
    recordOperationResult(ledger, operation.id, group.id, {
      status: "confirmed",
      imagePath: "/tmp/live-output/IMG_0001.JPG",
    });
    transitionOperation(ledger, operation.id, "completed");
    saveLedger(filePath, ledger);

    const reloaded = loadLedger(filePath);
    assert.equal(reloaded.schemaVersion, 1);
    assert.equal(reloaded.groups[group.id].stem, "IMG_0001");
    assert.equal(reloaded.operations[operation.id].status, "completed");
    assert.equal(reloaded.operations[operation.id].results[0].status, "confirmed");
    assert.equal(fs.existsSync(`${filePath}.tmp`), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects invalid operation transitions and duplicate result writes", () => {
  const ledger = createLedger({ sourceDirectory: "/tmp/live-source" });
  ensureGroup(ledger, { id: "group-0002", stem: "IMG_0002", status: "ready" });
  const operation = createOperation(ledger, {
    type: "export-components",
    groupIds: ["group-0002"],
    outputDirectory: "/tmp/live-output",
  });

  assert.throws(() => transitionOperation(ledger, operation.id, "completed"), /Invalid operation transition/);
  transitionOperation(ledger, operation.id, "running");
  recordOperationResult(ledger, operation.id, "group-0002", { status: "confirmed" });
  assert.throws(
    () => recordOperationResult(ledger, operation.id, "group-0002", { status: "confirmed" }),
    /already has a result/,
  );
});
