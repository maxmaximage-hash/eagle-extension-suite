"use strict";

const fs = require("fs");
const path = require("path");

const LEDGER_SCHEMA_VERSION = 1;

const ITEM_STATUSES = new Set([
  "pending",
  "downloading",
  "success",
  "failed",
  "skipped",
  "pending_verification",
  "imported_to_eagle",
]);

function isoNow() {
  return new Date().toISOString();
}

function emptyLedger() {
  const createdAt = isoNow();
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    createdAt,
    updatedAt: createdAt,
    config: {
      icloudPhotosUrl: "https://www.icloud.com.cn/photos",
      targetIntakeRoot: null,
      eagleLibraryPath: null,
    },
    batches: {},
    items: {},
    anchors: {},
    selection: {
      latestAnchorId: null,
    },
    events: [],
  };
}

function loadLedger(filePath) {
  if (!fs.existsSync(filePath)) {
    return emptyLedger();
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (parsed.schemaVersion !== LEDGER_SCHEMA_VERSION) {
    throw new Error(`Unsupported ledger schema version: ${parsed.schemaVersion}`);
  }
  return parsed;
}

function saveLedger(filePath, ledger) {
  ledger.updatedAt = isoNow();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, filePath);
}

function addEvent(ledger, type, payload = {}) {
  ledger.events.push({
    at: isoNow(),
    type,
    ...payload,
  });
  if (ledger.events.length > 1000) {
    ledger.events = ledger.events.slice(-1000);
  }
}

function requireBatch(ledger, batchId) {
  const batch = ledger.batches[batchId];
  if (!batch) {
    throw new Error(`Batch not found: ${batchId}`);
  }
  return batch;
}

function createBatch(ledger, input) {
  if (!input || !input.id) {
    throw new Error("Batch id is required");
  }
  if (ledger.batches[input.id]) {
    return ledger.batches[input.id];
  }

  const createdAt = isoNow();
  const batch = {
    id: input.id,
    title: input.title || input.id,
    sourceAlbumName: input.sourceAlbumName || null,
    sourceAlbumUrl: input.sourceAlbumUrl || null,
    targetDirectory: input.targetDirectory || null,
    status: input.status || "planning",
    createdAt,
    updatedAt: createdAt,
    lastAnchorId: null,
    notes: input.notes || "",
  };

  ledger.batches[batch.id] = batch;
  addEvent(ledger, "batch.created", { batchId: batch.id });
  return batch;
}

function normalizeIdentityValue(value) {
  return String(value || "").trim();
}

function assetKeyFrom(input) {
  if (input.assetKey) {
    return normalizeIdentityValue(input.assetKey);
  }
  if (input.icloudId) {
    return `icloud:${normalizeIdentityValue(input.icloudId)}`;
  }
  if (input.photosLocalIdentifier) {
    return `photos:${normalizeIdentityValue(input.photosLocalIdentifier)}`;
  }
  if (input.contentSha256) {
    return `sha256:${normalizeIdentityValue(input.contentSha256)}`;
  }

  const filename = normalizeIdentityValue(input.filename);
  const shotAt = normalizeIdentityValue(input.shotAt);
  const mediaType = normalizeIdentityValue(input.mediaType);
  const originalSize = normalizeIdentityValue(input.originalSizeBytes || "unknown");
  if (!filename || !shotAt || !mediaType) {
    throw new Error(
      "Cannot derive reliable asset key without assetKey, iCloud id, Photos local identifier, content hash, or filename+shotAt+mediaType",
    );
  }

  return `compound:${mediaType}:${shotAt}:${filename}:${originalSize}`;
}

function addItem(ledger, batchId, input) {
  const batch = requireBatch(ledger, batchId);
  const assetKey = assetKeyFrom(input);
  const existing = ledger.items[assetKey];
  const createdAt = isoNow();

  if (existing) {
    if (!existing.batchIds.includes(batchId)) {
      existing.batchIds.push(batchId);
      existing.updatedAt = createdAt;
      addEvent(ledger, "item.duplicate-linked", { batchId, assetKey });
    }
    return existing;
  }

  const status = input.status || "pending";
  if (!ITEM_STATUSES.has(status)) {
    throw new Error(`Unsupported item status: ${status}`);
  }

  const item = {
    assetKey,
    batchIds: [batchId],
    filename: input.filename || null,
    mediaType: input.mediaType || null,
    shotAt: input.shotAt || null,
    originalSizeBytes: input.originalSizeBytes || null,
    plannedTargetPath: input.plannedTargetPath || null,
    status,
    downloadedBytes: input.downloadedBytes || 0,
    retryCount: input.retryCount || 0,
    lastError: input.lastError || null,
    companionGroupId: input.companionGroupId || null,
    livePhotoRole: input.livePhotoRole || null,
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    eagleItemId: null,
  };

  ledger.items[assetKey] = item;
  batch.updatedAt = createdAt;
  addEvent(ledger, "item.added", { batchId, assetKey });
  return item;
}

function setItemStatus(ledger, assetKey, status, patch = {}) {
  if (!ITEM_STATUSES.has(status)) {
    throw new Error(`Unsupported item status: ${status}`);
  }
  const item = ledger.items[assetKey];
  if (!item) {
    throw new Error(`Item not found: ${assetKey}`);
  }

  Object.assign(item, patch, {
    status,
    updatedAt: isoNow(),
  });
  if (status === "success" || status === "imported_to_eagle" || status === "skipped") {
    item.completedAt = item.completedAt || item.updatedAt;
  }
  addEvent(ledger, "item.status", { assetKey, status });
  return item;
}

function recordSelectionAnchor(ledger, input) {
  const batch = requireBatch(ledger, input.batchId);
  const selectedAt = input.selectedAt || isoNow();
  const id = input.id || `anchor:${input.batchId}:${selectedAt}`;
  let assetKey = input.assetKey || null;
  if (!assetKey && (input.icloudId || input.photosLocalIdentifier || input.contentSha256 || (input.filename && input.shotAt && input.mediaType))) {
    assetKey = assetKeyFrom(input);
  }

  const anchor = {
    id,
    batchId: input.batchId,
    sourceAlbumName: input.sourceAlbumName || batch.sourceAlbumName || null,
    sourceAlbumUrl: input.sourceAlbumUrl || batch.sourceAlbumUrl || null,
    assetKey,
    filename: input.filename || null,
    shotAt: input.shotAt || null,
    thumbnailPath: input.thumbnailPath || null,
    selectedAt,
    rangeBefore: input.rangeBefore || [],
    rangeAfter: input.rangeAfter || [],
    precision: input.precision || "album-or-month",
    note: input.note || "",
  };

  ledger.anchors[id] = anchor;
  ledger.selection.latestAnchorId = id;
  batch.lastAnchorId = id;
  batch.updatedAt = isoNow();
  addEvent(ledger, "selection.anchor-recorded", { batchId: input.batchId, anchorId: id });
  return anchor;
}

function getProgress(ledger, batchId) {
  requireBatch(ledger, batchId);
  const items = Object.values(ledger.items).filter((item) => item.batchIds.includes(batchId));
  const counts = {
    total: items.length,
    pending: 0,
    downloading: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    pending_verification: 0,
    imported_to_eagle: 0,
    remaining: 0,
  };

  for (const item of items) {
    counts[item.status] += 1;
  }
  counts.remaining = counts.pending + counts.downloading + counts.failed + counts.pending_verification;

  const current = items.find((item) => item.status === "downloading") || items.find((item) => item.status === "pending") || null;
  const recentError = [...items].reverse().find((item) => item.lastError);

  return {
    batch: ledger.batches[batchId],
    counts,
    current,
    recentError: recentError ? { assetKey: recentError.assetKey, message: recentError.lastError } : null,
  };
}

function getContinueContext(ledger) {
  const anchorId = ledger.selection.latestAnchorId;
  if (!anchorId) {
    return null;
  }
  const anchor = ledger.anchors[anchorId];
  if (!anchor) {
    return null;
  }
  const batch = ledger.batches[anchor.batchId] || null;
  return {
    anchor,
    batch,
    url: anchor.sourceAlbumUrl || (batch && batch.sourceAlbumUrl) || ledger.config.icloudPhotosUrl,
  };
}

function targetPathPlan(targetDirectory, filename, existingPaths = []) {
  const targetPath = path.resolve(targetDirectory, filename);
  const existingSet = new Set(existingPaths.map((item) => path.resolve(item)));
  if (!existingSet.has(targetPath)) {
    return { targetPath, hasConflict: false, conflictPath: null };
  }

  const parsed = path.parse(filename);
  let index = 1;
  while (true) {
    const candidate = path.resolve(targetDirectory, `${parsed.name}.conflict-${index}${parsed.ext}`);
    if (!existingSet.has(candidate)) {
      return { targetPath: candidate, hasConflict: true, conflictPath: targetPath };
    }
    index += 1;
  }
}

function htmlEscape(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderDashboard(ledger) {
  const context = getContinueContext(ledger);
  const batchIds = Object.keys(ledger.batches);
  const latestBatchId = context && context.batch ? context.batch.id : batchIds[batchIds.length - 1];
  const progress = latestBatchId ? getProgress(ledger, latestBatchId) : null;
  const continueUrl = context ? context.url : ledger.config.icloudPhotosUrl;
  const anchor = context ? context.anchor : null;
  const current = progress && progress.current ? progress.current : null;
  const recentError = progress && progress.recentError ? progress.recentError.message : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>iCloud 搬运台</title>
  <style>
    body { margin: 0; font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17202a; background: #f7f8fa; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 20px; }
    h1 { font-size: 28px; margin: 0 0 18px; }
    section { background: #fff; border: 1px solid #d8dde6; border-radius: 8px; padding: 18px; margin: 14px 0; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin: 16px 0; }
    a.button { background: #105bd8; color: white; text-decoration: none; border-radius: 6px; padding: 10px 14px; font-weight: 650; }
    .muted { color: #5f6b7a; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
    .metric { border: 1px solid #e2e6ee; border-radius: 6px; padding: 10px; background: #fbfcfe; }
    .metric strong { display: block; font-size: 22px; }
    code { background: #eef1f6; border-radius: 4px; padding: 1px 4px; }
  </style>
</head>
<body>
<main>
  <h1>iCloud 搬运台</h1>
  <section>
    <h2>继续上次</h2>
    <div class="actions">
      <a class="button" href="${htmlEscape(continueUrl)}" target="_blank" rel="noreferrer">继续上次</a>
    </div>
    <p>恢复精度：${htmlEscape(anchor ? anchor.precision : "none")}</p>
    <p>上次停在：${htmlEscape(anchor ? `${anchor.shotAt || "未知日期"} / ${anchor.filename || anchor.assetKey || "未知素材"}` : "还没有记录选择锚点")}</p>
    <p class="muted">iCloud 网页目前不承诺稳定单张深链接。本页会打开对应相簿或 Photos，并显示锚点素材、日期和前后范围。</p>
  </section>
  <section>
    <h2>本批进度</h2>
    <p>批次：<code>${htmlEscape(latestBatchId || "未建立")}</code></p>
    <div class="grid">
      <div class="metric"><strong>${progress ? progress.counts.total : 0}</strong>总数</div>
      <div class="metric"><strong>${progress ? progress.counts.success : 0}</strong>成功</div>
      <div class="metric"><strong>${progress ? progress.counts.failed : 0}</strong>失败</div>
      <div class="metric"><strong>${progress ? progress.counts.remaining : 0}</strong>剩余</div>
    </div>
    <p>当前文件：${htmlEscape(current ? current.filename || current.assetKey : "无")}</p>
    <p>目标目录：${htmlEscape(progress && progress.batch ? progress.batch.targetDirectory || "未确认" : "未确认")}</p>
    <p>最近错误：${htmlEscape(recentError || "无")}</p>
  </section>
</main>
</body>
</html>
`;
}

module.exports = {
  LEDGER_SCHEMA_VERSION,
  ITEM_STATUSES,
  emptyLedger,
  loadLedger,
  saveLedger,
  createBatch,
  addItem,
  setItemStatus,
  recordSelectionAnchor,
  getProgress,
  getContinueContext,
  targetPathPlan,
  renderDashboard,
};
