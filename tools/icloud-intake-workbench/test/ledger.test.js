"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  emptyLedger,
  createBatch,
  addItem,
  setItemStatus,
  recordSelectionAnchor,
  getProgress,
  getContinueContext,
  targetPathPlan,
  renderDashboard,
} = require("../lib/ledger");

test("deduplicates the same iCloud asset across batches", () => {
  const ledger = emptyLedger();
  createBatch(ledger, { id: "pilot-001" });
  createBatch(ledger, { id: "pilot-002" });

  const first = addItem(ledger, "pilot-001", {
    icloudId: "asset-123",
    filename: "IMG_0001.HEIC",
    mediaType: "photo",
    shotAt: "2024-01-05T10:00:00Z",
  });
  const second = addItem(ledger, "pilot-002", {
    icloudId: "asset-123",
    filename: "IMG_0001.HEIC",
    mediaType: "photo",
    shotAt: "2024-01-05T10:00:00Z",
  });

  assert.equal(first, second);
  assert.deepEqual(second.batchIds, ["pilot-001", "pilot-002"]);
  assert.equal(Object.keys(ledger.items).length, 1);
});

test("tracks Live Photo companions as one group without merging files", () => {
  const ledger = emptyLedger();
  createBatch(ledger, { id: "pilot-001" });

  const still = addItem(ledger, "pilot-001", {
    icloudId: "live-still-1",
    filename: "IMG_0002.HEIC",
    mediaType: "photo",
    shotAt: "2024-01-05T10:01:00Z",
    companionGroupId: "live-0002",
    livePhotoRole: "still",
  });
  const motion = addItem(ledger, "pilot-001", {
    icloudId: "live-video-1",
    filename: "IMG_0002.MOV",
    mediaType: "video",
    shotAt: "2024-01-05T10:01:00Z",
    companionGroupId: "live-0002",
    livePhotoRole: "motion",
  });

  assert.notEqual(still.assetKey, motion.assetKey);
  assert.equal(still.companionGroupId, motion.companionGroupId);
});

test("keeps selection anchor separate from download status", () => {
  const ledger = emptyLedger();
  createBatch(ledger, { id: "pilot-001", sourceAlbumUrl: "https://www.icloud.com.cn/photos" });
  const item = addItem(ledger, "pilot-001", {
    icloudId: "asset-123",
    filename: "IMG_0001.HEIC",
    mediaType: "photo",
    shotAt: "2024-01-05T10:00:00Z",
  });
  setItemStatus(ledger, item.assetKey, "success");

  assert.equal(getContinueContext(ledger), null);

  const anchor = recordSelectionAnchor(ledger, {
    batchId: "pilot-001",
    assetKey: item.assetKey,
    filename: "IMG_0001.HEIC",
    shotAt: "2024-01-05",
  });

  const context = getContinueContext(ledger);
  assert.equal(context.anchor.id, anchor.id);
  assert.equal(context.anchor.assetKey, item.assetKey);
});

test("progress reports counts, current file, and recent error", () => {
  const ledger = emptyLedger();
  createBatch(ledger, { id: "pilot-001" });
  const pending = addItem(ledger, "pilot-001", {
    icloudId: "asset-1",
    filename: "IMG_0001.HEIC",
    mediaType: "photo",
    shotAt: "2024-01-05T10:00:00Z",
  });
  const failed = addItem(ledger, "pilot-001", {
    icloudId: "asset-2",
    filename: "IMG_0002.MOV",
    mediaType: "video",
    shotAt: "2024-01-05T10:02:00Z",
  });
  setItemStatus(ledger, failed.assetKey, "failed", { lastError: "SMB mount missing" });

  const progress = getProgress(ledger, "pilot-001");
  assert.equal(progress.counts.total, 2);
  assert.equal(progress.counts.pending, 1);
  assert.equal(progress.counts.failed, 1);
  assert.equal(progress.counts.remaining, 2);
  assert.equal(progress.current.assetKey, pending.assetKey);
  assert.equal(progress.recentError.message, "SMB mount missing");
});

test("target path planning never silently overwrites an existing file", () => {
  const plan = targetPathPlan("/Volumes/NAS/Intake", "IMG_0001.HEIC", [
    "/Volumes/NAS/Intake/IMG_0001.HEIC",
  ]);

  assert.equal(plan.hasConflict, true);
  assert.match(plan.targetPath, /IMG_0001\.conflict-1\.HEIC$/);
  assert.match(plan.conflictPath, /IMG_0001\.HEIC$/);
});

test("dashboard contains the continue action and anchor text", () => {
  const ledger = emptyLedger();
  createBatch(ledger, { id: "pilot-001", sourceAlbumUrl: "https://www.icloud.com.cn/photos" });
  recordSelectionAnchor(ledger, {
    batchId: "pilot-001",
    filename: "IMG_0001.HEIC",
    shotAt: "2024-01-05",
  });

  const html = renderDashboard(ledger);
  assert.match(html, /继续上次/);
  assert.match(html, /IMG_0001\.HEIC/);
});
