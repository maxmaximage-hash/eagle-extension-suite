#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  loadLedger,
  saveLedger,
  createBatch,
  addItem,
  setItemStatus,
  recordSelectionAnchor,
  getProgress,
  getContinueContext,
  targetPathPlan,
} = require("./lib/ledger");

const DEFAULT_LEDGER_PATH = path.join(os.homedir(), ".eagle-icloud-intake", "demo-ledger.json");
const DEFAULT_TARGET_ROOT = "/Volumes/团队文件-MAX线上协作中台/icloud 待分类素材";
const DEFAULT_BATCH_ID = "demo-2024-03-work-001";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function sampleItems() {
  return [
    ["icloud:demo-0001", "IMG_4021.HEIC", "photo", "2024-03-18T09:31:00Z", 3421831, "success"],
    ["icloud:demo-0002", "IMG_4022.MOV", "video", "2024-03-18T09:32:00Z", 48821630, "success"],
    ["icloud:demo-live-0003-still", "IMG_4023.HEIC", "photo", "2024-03-18T09:35:00Z", 2973310, "success", "live-4023", "still"],
    ["icloud:demo-live-0003-motion", "IMG_4023.MOV", "video", "2024-03-18T09:35:00Z", 6210081, "success", "live-4023", "motion"],
    ["icloud:demo-0004", "DSC_1188.ARW", "photo", "2024-03-18T10:12:00Z", 45322110, "pending_verification"],
    ["icloud:demo-0005", "IMG_4024.HEIC", "photo", "2024-03-18T10:19:00Z", 3198108, "downloading"],
    ["icloud:demo-0006", "IMG_4025.HEIC", "photo", "2024-03-18T10:22:00Z", 3300218, "pending"],
    ["icloud:demo-0007", "IMG_4025.HEIC", "photo", "2024-04-02T16:42:00Z", 3309001, "pending"],
    ["icloud:demo-0008", "VID_1120.MP4", "video", "2024-04-02T17:05:00Z", 128331028, "failed"],
    ["icloud:demo-0009", "IMG_4090.JPG", "photo", "2024-04-03T08:12:00Z", 2418819, "pending"],
    ["icloud:demo-0010", "IMG_4091.HEIC", "photo", "2024-04-03T08:13:00Z", 3228821, "pending"],
    ["icloud:demo-0011", "IMG_4092.HEIC", "photo", "2024-04-03T08:14:00Z", 3231001, "pending"],
  ];
}

function photoTargetFilename(filename) {
  const parsed = path.parse(filename);
  return `${parsed.name}.jpg`;
}

function outputFilenameFor(filename, mediaType, livePhotoRole) {
  if (mediaType === "photo" || livePhotoRole === "still") {
    return photoTargetFilename(filename);
  }
  return filename;
}

function applyDemoDefaults(ledger) {
  ledger.config.targetIntakeRoot = DEFAULT_TARGET_ROOT;
  ledger.config.eagleLibraryPath = "/Volumes/团队文件-MAX线上协作中台/引力环球.library";
  ledger.config.photoOutputFormat = "jpg";
  ledger.config.videoOutputFormat = "original";
  ledger.config.livePhotoPolicy = "preserve-live-master-plus-jpg-preview";
  ledger.config.liveCoverWorkflow = "edit-jpg-cover-then-rebuild-live-photo";

  const batch = ledger.batches[DEFAULT_BATCH_ID];
  if (batch) {
    batch.targetDirectory = path.join(DEFAULT_TARGET_ROOT, DEFAULT_BATCH_ID);
  }

  const usedTargetPaths = [];
  for (const item of Object.values(ledger.items).sort((left, right) => String(left.shotAt).localeCompare(String(right.shotAt)))) {
    if (!item.batchIds.includes(DEFAULT_BATCH_ID)) continue;
    const outputFilename = outputFilenameFor(item.filename, item.mediaType, item.livePhotoRole);
    const targetPlan = targetPathPlan(path.join(DEFAULT_TARGET_ROOT, DEFAULT_BATCH_ID), outputFilename, usedTargetPaths);
    usedTargetPaths.push(targetPlan.targetPath);
    item.outputFilename = outputFilename;
    item.outputFormat = item.mediaType === "photo" || item.livePhotoRole === "still" ? "jpg" : "original";
    item.masterPreservation = item.companionGroupId ? "Live master + editable JPG cover + publish rebuild" : item.mediaType === "photo" ? "editable JPG; original retention decision pending" : "original video";
    item.plannedTargetPath = targetPlan.targetPath;
    item.targetConflictPath = targetPlan.conflictPath;
    if (targetPlan.hasConflict && !item.lastError) {
      item.lastError = `Demo: 目标同名冲突，已规划为 ${path.basename(targetPlan.targetPath)}`;
    }
  }
}

function ensureDemoLedger(ledgerPath) {
  const ledger = loadLedger(ledgerPath);
  if (Object.keys(ledger.batches).length > 0) {
    applyDemoDefaults(ledger);
    saveLedger(ledgerPath, ledger);
    return ledger;
  }

  applyDemoDefaults(ledger);

  createBatch(ledger, {
    id: DEFAULT_BATCH_ID,
    title: "Demo: 2024-03 工作素材试点",
    sourceAlbumName: "待下载-2024-03-工作素材-001",
    sourceAlbumUrl: "https://www.icloud.com.cn/photos",
    targetDirectory: path.join(DEFAULT_TARGET_ROOT, DEFAULT_BATCH_ID),
    status: "active",
    notes: "本批为本地 demo 数据，不会连接 iCloud 或 NAS。",
  });

  const usedTargetPaths = [];
  for (const [assetKey, filename, mediaType, shotAt, size, status, group, role] of sampleItems()) {
    const outputFilename = outputFilenameFor(filename, mediaType, role);
    const targetPlan = targetPathPlan(path.join(DEFAULT_TARGET_ROOT, DEFAULT_BATCH_ID), outputFilename, usedTargetPaths);
    usedTargetPaths.push(targetPlan.targetPath);
    const item = addItem(ledger, "demo-2024-03-work-001", {
      assetKey,
      filename,
      mediaType,
      shotAt,
      originalSizeBytes: size,
      plannedTargetPath: targetPlan.targetPath,
      status,
      companionGroupId: group || null,
      livePhotoRole: role || null,
      downloadedBytes: status === "success" ? size : status === "downloading" ? Math.round(size * 0.42) : 0,
      lastError: targetPlan.hasConflict ? `Demo: 目标同名冲突，已规划为 ${path.basename(targetPlan.targetPath)}` : status === "failed" ? "Demo: NAS/SMB 短暂掉线，未标记成功" : null,
      retryCount: status === "failed" ? 2 : 0,
    });
    item.outputFilename = outputFilename;
    item.outputFormat = mediaType === "photo" || role === "still" ? "jpg" : "original";
    item.masterPreservation = group ? "Live master + editable JPG cover + publish rebuild" : mediaType === "photo" ? "editable JPG; original retention decision pending" : "original video";
    item.targetConflictPath = targetPlan.conflictPath;
    if (item.status === "success") {
      item.completedAt = item.updatedAt;
    }
  }

  recordSelectionAnchor(ledger, {
    batchId: "demo-2024-03-work-001",
    assetKey: "icloud:demo-0007",
    filename: "IMG_4025.HEIC",
    shotAt: "2024-04-02",
    sourceAlbumName: "待下载-2024-03-工作素材-001",
    sourceAlbumUrl: "https://www.icloud.com.cn/photos",
    precision: "album-or-month",
    rangeBefore: ["IMG_4024.HEIC", "IMG_4025.HEIC"],
    rangeAfter: ["VID_1120.MP4", "IMG_4090.JPG"],
    note: "网页无法稳定承诺单张深链接，先恢复到相簿和锚点附近。",
  });

  saveLedger(ledgerPath, ledger);
  return ledger;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res, html) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

function activeBatchId(ledger) {
  const context = getContinueContext(ledger);
  if (context && context.batch) return context.batch.id;
  return Object.keys(ledger.batches)[0] || null;
}

function visibleItems(ledger, batchId) {
  return Object.values(ledger.items)
    .filter((item) => item.batchIds.includes(batchId))
    .sort((left, right) => String(left.shotAt).localeCompare(String(right.shotAt)));
}

function statePayload(ledger) {
  const batchId = activeBatchId(ledger);
  const progress = batchId ? getProgress(ledger, batchId) : null;
  const context = getContinueContext(ledger);
  return {
    ledgerUpdatedAt: ledger.updatedAt,
    config: ledger.config,
    batchId,
    progress,
    continueContext: context,
    items: batchId ? visibleItems(ledger, batchId) : [],
    events: ledger.events.slice(-12).reverse(),
  };
}

function markBatchStatus(ledger, batchId, status) {
  const batch = ledger.batches[batchId];
  if (!batch) throw new Error(`Batch not found: ${batchId}`);
  batch.status = status;
  batch.updatedAt = new Date().toISOString();
}

function simulateTick(ledger, batchId) {
  const items = visibleItems(ledger, batchId);
  const downloading = items.find((item) => item.status === "downloading");
  if (downloading) {
    setItemStatus(ledger, downloading.assetKey, "success", {
      downloadedBytes: downloading.originalSizeBytes || downloading.downloadedBytes,
      lastError: null,
    });
  }

  const next = items.find((item) => item.status === "pending");
  if (next) {
    setItemStatus(ledger, next.assetKey, "downloading", {
      downloadedBytes: Math.max(1, Math.round((next.originalSizeBytes || 100) * 0.18)),
      lastError: null,
    });
  }
}

function retryFailed(ledger, batchId) {
  for (const item of visibleItems(ledger, batchId)) {
    if (item.status === "failed") {
      setItemStatus(ledger, item.assetKey, "pending", {
        retryCount: item.retryCount + 1,
        lastError: null,
      });
    }
  }
}

function recordDemoAnchor(ledger, batchId, assetKey) {
  const item = ledger.items[assetKey];
  if (!item) throw new Error(`Item not found: ${assetKey}`);
  const items = visibleItems(ledger, batchId);
  const index = items.findIndex((candidate) => candidate.assetKey === assetKey);
  const before = items.slice(Math.max(0, index - 2), index).map((candidate) => candidate.filename);
  const after = items.slice(index + 1, index + 3).map((candidate) => candidate.filename);
  return recordSelectionAnchor(ledger, {
    batchId,
    assetKey,
    filename: item.filename,
    shotAt: String(item.shotAt || "").slice(0, 10),
    rangeBefore: before,
    rangeAfter: after,
    precision: "album-or-month",
  });
}

function resetDemoLedger(ledgerPath) {
  fs.rmSync(ledgerPath, { force: true });
  return ensureDemoLedger(ledgerPath);
}

function appHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>iCloud 搬运台 Demo</title>
  <style>
    :root {
      --bg: #f5f7fa;
      --panel: #ffffff;
      --ink: #16202a;
      --muted: #657285;
      --line: #d9e0ea;
      --blue: #135cc8;
      --blue-2: #0d4494;
      --green: #16784b;
      --red: #b42318;
      --amber: #a15c00;
      --teal: #0f6f78;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--ink);
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      border-bottom: 1px solid var(--line);
      background: var(--panel);
    }
    .shell { max-width: 1180px; margin: 0 auto; padding: 18px 20px; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
    h1 { margin: 0; font-size: 22px; }
    h2 { margin: 0 0 12px; font-size: 16px; }
    button, a.button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--ink);
      cursor: pointer;
      text-decoration: none;
      font-weight: 650;
      white-space: nowrap;
    }
    button.primary, a.primary { background: var(--blue); border-color: var(--blue); color: #fff; }
    button.primary:hover, a.primary:hover { background: var(--blue-2); }
    button:disabled { cursor: not-allowed; opacity: .55; }
    main.shell {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 16px;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    .stack { display: grid; gap: 16px; min-width: 0; align-content: start; }
    main.shell > * { min-width: 0; }
    main.shell section { min-width: 0; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .muted { color: var(--muted); }
    .path {
      overflow-wrap: anywhere;
      padding: 8px 10px;
      border: 1px solid #e5eaf2;
      border-radius: 6px;
      background: #f8fafc;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }
    .policy {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-top: 10px;
    }
    .policy div {
      border: 1px solid #d7e7e9;
      border-radius: 6px;
      padding: 8px;
      background: #f2fbfc;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
    }
    .metric {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
      background: #fbfcfe;
    }
    .metric strong { display: block; font-size: 22px; line-height: 1.15; }
    .ok strong { color: var(--green); }
    .bad strong { color: var(--red); }
    .warn strong { color: var(--amber); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { border-bottom: 1px solid #e6ebf2; padding: 9px 8px; text-align: left; vertical-align: middle; }
    th { color: #536174; font-size: 12px; font-weight: 700; background: #fbfcfe; position: sticky; top: 0; }
    tr.anchor { background: #fff8e8; }
    .status {
      display: inline-flex;
      min-width: 92px;
      justify-content: center;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid #dce3ed;
      background: #f7f9fc;
    }
    .success, .imported_to_eagle { color: var(--green); border-color: #b9decf; background: #eef8f3; }
    .failed { color: var(--red); border-color: #f0b8b2; background: #fff0ee; }
    .downloading { color: var(--blue); border-color: #bdd2f2; background: #eef5ff; }
    .pending_verification { color: var(--amber); border-color: #efd2a9; background: #fff7e8; }
    .side-list { display: grid; gap: 10px; }
    .event { border-bottom: 1px solid #e6ebf2; padding-bottom: 8px; }
    .event:last-child { border-bottom: 0; }
    .anchor-block {
      display: grid;
      gap: 10px;
      border: 1px solid #d7e7e9;
      background: #f2fbfc;
      border-radius: 8px;
      padding: 12px;
    }
    .thumb {
      width: 88px;
      height: 64px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      background:
        linear-gradient(135deg, #d9f0f2, #f9e2b5),
        repeating-linear-gradient(45deg, rgba(255,255,255,.45), rgba(255,255,255,.45) 8px, transparent 8px, transparent 16px);
    }
    .row { display: flex; gap: 12px; align-items: center; min-width: 0; }
    .grow { min-width: 0; flex: 1; }
    .live-workspace {
      display: grid;
      grid-template-columns: minmax(240px, 360px) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    .live-card {
      position: relative;
      aspect-ratio: 4 / 3;
      overflow: hidden;
      border: 1px solid #c8d2df;
      border-radius: 8px;
      background:
        linear-gradient(150deg, rgba(20, 87, 102, .12), rgba(245, 177, 81, .18)),
        #dce9ec;
      cursor: context-menu;
      user-select: none;
    }
    .live-card::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(15deg, transparent 0 43%, rgba(20, 87, 102, .38) 44% 61%, transparent 62%),
        linear-gradient(165deg, transparent 0 51%, rgba(229, 146, 47, .34) 52% 66%, transparent 67%);
      transform: scale(1.08) translateX(-1.5%);
      transition: transform 2.2s ease, filter .3s ease;
    }
    .live-card:hover::before,
    .live-card.previewing::before {
      transform: scale(1.16) translateX(3%);
      filter: saturate(1.15);
    }
    .live-card-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(18, 31, 43, .8);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
    }
    .live-dot { width: 7px; height: 7px; border-radius: 50%; background: #79e0a9; }
    .live-card-footer {
      position: absolute;
      inset: auto 0 0;
      padding: 28px 12px 10px;
      background: linear-gradient(transparent, rgba(18, 31, 43, .82));
      color: #fff;
    }
    .live-details { display: grid; gap: 10px; }
    .side-preview {
      position: relative;
      aspect-ratio: 16 / 10;
      overflow: hidden;
      margin-bottom: 12px;
      border: 1px solid #c8d2df;
      border-radius: 8px;
      background:
        linear-gradient(150deg, rgba(20, 87, 102, .12), rgba(245, 177, 81, .18)),
        #dce9ec;
    }
    .side-preview::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(15deg, transparent 0 43%, rgba(20, 87, 102, .38) 44% 61%, transparent 62%),
        linear-gradient(165deg, transparent 0 51%, rgba(229, 146, 47, .34) 52% 66%, transparent 67%);
      transform: scale(1.08) translateX(-1.5%);
      transition: transform 2.2s ease, filter .3s ease;
    }
    .side-preview.previewing::before {
      transform: scale(1.16) translateX(3%);
      filter: saturate(1.15);
    }
    .side-preview .live-card-footer { font-size: 12px; }
    .preview-meta { display: grid; gap: 6px; }
    .preview-meta .row { justify-content: space-between; gap: 8px; }
    .preview-panel {
      position: sticky;
      top: 16px;
      z-index: 2;
    }
    .format-map { display: grid; gap: 8px; }
    .format-row {
      display: grid;
      grid-template-columns: 118px minmax(0, 1fr);
      gap: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e6ebf2;
    }
    .format-row:last-child { border-bottom: 0; }
    .support-note {
      border-left: 3px solid var(--amber);
      padding: 8px 10px;
      background: #fff8e8;
      color: #62420d;
    }
    .context-menu {
      position: fixed;
      z-index: 50;
      display: none;
      min-width: 230px;
      padding: 6px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 14px 40px rgba(15, 23, 42, .2);
    }
    .context-menu.open { display: grid; }
    .context-menu button {
      justify-content: flex-start;
      width: 100%;
      min-height: 34px;
      border: 0;
      background: transparent;
      font-weight: 550;
    }
    .context-menu button:hover { background: #eef5ff; }
    .context-menu hr { width: 100%; margin: 5px 0; border: 0; border-top: 1px solid #e2e8f0; }
    .toast {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 60;
      display: none;
      max-width: 420px;
      padding: 12px 14px;
      border-radius: 8px;
      background: #172331;
      color: #fff;
      box-shadow: 0 14px 40px rgba(15, 23, 42, .26);
    }
    .toast.show { display: block; }
    @media (max-width: 920px) {
      main.shell { grid-template-columns: 1fr; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .live-workspace { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="shell topbar">
      <div>
        <h1>iCloud 搬运台 Demo</h1>
        <div class="muted">本地应用形态：先管台账和恢复点，后续接 iCloud 已登录页面、下载器、NAS 和 Eagle。</div>
      </div>
      <div class="actions">
        <button id="reset">重置 demo</button>
        <button id="refresh">刷新</button>
      </div>
    </div>
  </header>
  <main class="shell">
    <div class="stack">
      <section>
        <h2>继续上次</h2>
        <div id="anchor" class="anchor-block"></div>
      </section>
      <section>
        <h2>本批进度</h2>
        <div id="metrics" class="metrics"></div>
        <div class="actions" style="margin-top: 12px">
          <button id="pause">暂停</button>
          <button id="resume">继续</button>
          <button id="tick" class="primary">模拟搬运一步</button>
          <button id="retry">重试失败</button>
        </div>
      </section>
      <section>
        <h2>Live 资源工作台</h2>
        <div class="live-workspace">
          <div id="live-card" class="live-card" tabindex="0" aria-label="IMG_4023 Live Photo，右键打开操作菜单">
            <div class="live-card-badge"><span class="live-dot"></span><span id="live-state">悬停预览 Live</span></div>
            <div class="live-card-footer">
              <strong>IMG_4023</strong><br>
              <span>编辑封面 JPG + 原动态 MOV</span>
            </div>
          </div>
          <div class="live-details">
            <div class="format-map">
              <div class="format-row"><strong>工作封面</strong><span>JPG，可接水印编辑器与马赛克工具</span></div>
              <div class="format-row"><strong>动态组件</strong><span>MOV，单独进入视频编辑流程</span></div>
              <div class="format-row"><strong>Eagle 预览</strong><span>.livp，只作为 Eagle 的单素材封装</span></div>
              <div class="format-row"><strong>手机发布</strong><span>JPG/HEIC + MOV 配对资源，经 Apple Photos / PhotoKit 导入</span></div>
            </div>
            <div class="support-note">.livp 是 Eagle 预览包，不是照片 App 的通用实况导入格式。可靠路径是“导入照片 App / iPhone 实况”成功后，再从手机相册发布。</div>
            <div class="actions">
              <button id="open-live-menu" class="primary">打开 Live 操作</button>
              <button data-live-action="export-iphone">导入照片 App / iPhone 实况</button>
            </div>
          </div>
        </div>
      </section>
      <section>
        <h2>素材队列</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>文件</th>
                <th>输出</th>
                <th>类型</th>
                <th>拍摄时间</th>
                <th>状态</th>
                <th>已下载</th>
                <th>Live Photo</th>
                <th>发布保留</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="items"></tbody>
          </table>
        </div>
      </section>
    </div>
    <aside class="stack">
      <section class="preview-panel">
        <h2>当前素材预览</h2>
        <div id="side-live-preview" class="side-preview" aria-label="当前 Live Photo 预览">
          <div class="live-card-badge"><span class="live-dot"></span><span id="side-live-state">等待悬停</span></div>
          <div class="live-card-footer"><strong>IMG_4023</strong><br><span>Live Photo · JPG + MOV</span></div>
        </div>
        <div class="preview-meta">
          <div class="row"><strong>封面</strong><span>IMG_4023.jpg</span></div>
          <div class="row"><strong>动态</strong><span>IMG_4023.MOV</span></div>
          <div class="row"><strong>Eagle</strong><span>IMG_4023.livp</span></div>
        </div>
      </section>
      <section>
        <h2>目标位置</h2>
        <div class="muted">NAS 待筛选区</div>
        <div id="target" class="path"></div>
        <div class="muted" style="margin-top:10px">Eagle 正式库</div>
        <div id="library" class="path"></div>
        <div id="policy" class="policy"></div>
      </section>
      <section>
        <h2>最近错误</h2>
        <div id="error" class="muted"></div>
      </section>
      <section>
        <h2>事件</h2>
        <div id="events" class="side-list"></div>
      </section>
    </aside>
  </main>
  <div id="live-menu" class="context-menu" role="menu" aria-label="Live Photo 操作">
    <button data-live-action="edit-cover" role="menuitem">编辑封面（JPG）</button>
    <button data-live-action="edit-motion" role="menuitem">编辑动态（MOV）</button>
    <hr>
    <button data-live-action="export-jpg" role="menuitem">导出 JPG → 水印 / 马赛克</button>
    <button data-live-action="export-livp" role="menuitem">导出 Eagle .livp</button>
    <button data-live-action="export-iphone" role="menuitem">导入照片 App / iPhone 实况</button>
    <button data-live-action="export-video" role="menuitem">导出发布短视频</button>
  </div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <script>
    let state = null;
    let toastTimer = null;

    const statusLabel = {
      pending: "待处理",
      downloading: "下载中",
      success: "成功",
      failed: "失败",
      skipped: "跳过",
      pending_verification: "待校验",
      imported_to_eagle: "已导入 Eagle"
    };

    function fmtBytes(value) {
      if (!value) return "0 B";
      const units = ["B", "KB", "MB", "GB", "TB"];
      let size = Number(value);
      let unit = 0;
      while (size >= 1024 && unit < units.length - 1) {
        size = size / 1024;
        unit += 1;
      }
      return size.toFixed(size >= 10 || unit === 0 ? 0 : 1) + " " + units[unit];
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    async function api(path, body) {
      const options = body ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      } : {};
      const res = await fetch(path, options);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }

    async function load() {
      state = await api("/api/state");
      render();
    }

    function render() {
      const progress = state.progress;
      const counts = progress ? progress.counts : {};
      document.getElementById("target").textContent = progress?.batch?.targetDirectory || state.config.targetIntakeRoot || "未确认";
      document.getElementById("library").textContent = state.config.eagleLibraryPath || "未确认";
      document.getElementById("policy").innerHTML = [
        ["照片", state.config.photoOutputFormat || "jpg"],
        ["视频", state.config.videoOutputFormat || "original"],
        ["Live Photo", state.config.liveCoverWorkflow || state.config.livePhotoPolicy || "preserve-live-master-plus-jpg-preview"]
      ].map(([label, value]) => '<div><strong>' + escapeHtml(label) + '</strong><br><span class="muted">' + escapeHtml(value) + '</span></div>').join("");
      document.getElementById("error").textContent = progress?.recentError?.message || "无";
      document.getElementById("metrics").innerHTML = [
        ["总数", counts.total || 0, ""],
        ["成功", counts.success || 0, "ok"],
        ["失败", counts.failed || 0, "bad"],
        ["剩余", counts.remaining || 0, "warn"],
        ["待校验", counts.pending_verification || 0, "warn"]
      ].map(([label, value, cls]) => '<div class="metric ' + cls + '"><strong>' + value + '</strong>' + label + '</div>').join("");

      renderAnchor();
      renderItems();
      renderEvents();
    }

    function renderAnchor() {
      const context = state.continueContext;
      const anchor = context?.anchor;
      const batch = context?.batch;
      const url = context?.url || "https://www.icloud.com.cn/photos";
      document.getElementById("anchor").innerHTML = anchor ? \`
        <div class="row">
          <div class="thumb" aria-hidden="true"></div>
          <div class="grow">
            <div><strong>\${escapeHtml(anchor.shotAt || "未知日期")} / \${escapeHtml(anchor.filename || "未知素材")}</strong></div>
            <div class="muted">相簿：\${escapeHtml(anchor.sourceAlbumName || batch?.sourceAlbumName || "未记录")}</div>
            <div class="muted">恢复精度：\${escapeHtml(anchor.precision)}</div>
          </div>
        </div>
        <div class="muted">前后范围：\${escapeHtml([...(anchor.rangeBefore || []), anchor.filename, ...(anchor.rangeAfter || [])].filter(Boolean).join(" / "))}</div>
        <div class="actions">
          <a class="button primary" href="\${escapeHtml(url)}" target="_blank" rel="noreferrer">继续上次</a>
          <button onclick="recordAnchor('\${escapeHtml(anchor.assetKey || "")}')" \${anchor.assetKey ? "" : "disabled"}>把当前行设为锚点</button>
        </div>
      \` : \`
        <div class="muted">还没有选择锚点。</div>
        <a class="button primary" href="\${escapeHtml(url)}" target="_blank" rel="noreferrer">打开 iCloud Photos</a>
      \`;
    }

    function renderItems() {
      const anchorKey = state.continueContext?.anchor?.assetKey;
      document.getElementById("items").innerHTML = state.items.map((item) => {
        const percent = item.originalSizeBytes ? Math.min(100, Math.round((item.downloadedBytes || 0) / item.originalSizeBytes * 100)) : 0;
        const live = item.companionGroupId ? item.companionGroupId + " / " + (item.livePhotoRole || "") : "";
        return \`
          <tr class="\${item.assetKey === anchorKey ? "anchor" : ""}">
            <td><strong>\${escapeHtml(item.filename)}</strong><br><span class="muted">\${escapeHtml(item.assetKey)}</span></td>
            <td><strong>\${escapeHtml(item.outputFilename || item.filename)}</strong><br><span class="muted">\${escapeHtml(item.plannedTargetPath || "")}</span></td>
            <td>\${escapeHtml(item.mediaType || "")}</td>
            <td>\${escapeHtml(String(item.shotAt || "").slice(0, 10))}</td>
            <td><span class="status \${escapeHtml(item.status)}">\${escapeHtml(statusLabel[item.status] || item.status)}</span></td>
            <td>\${fmtBytes(item.downloadedBytes)} / \${fmtBytes(item.originalSizeBytes)}<br><span class="muted">\${percent}%</span></td>
            <td>\${escapeHtml(live || "-")}</td>
            <td>\${escapeHtml(item.masterPreservation || "-")}</td>
            <td><button onclick="recordAnchor('\${escapeHtml(item.assetKey)}')">设为锚点</button></td>
          </tr>
        \`;
      }).join("");
    }

    function renderEvents() {
      document.getElementById("events").innerHTML = state.events.map((event) => \`
        <div class="event">
          <strong>\${escapeHtml(event.type)}</strong>
          <div class="muted">\${escapeHtml(event.at)}</div>
          <div class="muted">\${escapeHtml(event.assetKey || event.batchId || event.anchorId || "")}</div>
        </div>
      \`).join("");
    }

    async function postAndReload(url, body) {
      await api(url, body || {});
      await load();
    }

    async function recordAnchor(assetKey) {
      if (!assetKey) return;
      await postAndReload("/api/anchor", { assetKey });
    }

    function showToast(message) {
      const toast = document.getElementById("toast");
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
    }

    function openLiveMenu(x, y) {
      const menu = document.getElementById("live-menu");
      menu.classList.add("open");
      const width = 240;
      const height = 260;
      menu.style.left = Math.max(8, Math.min(x, window.innerWidth - width - 8)) + "px";
      menu.style.top = Math.max(8, Math.min(y, window.innerHeight - height - 8)) + "px";
    }

    function closeLiveMenu() {
      document.getElementById("live-menu").classList.remove("open");
    }

    function runLiveAction(action) {
      const messages = {
        "edit-cover": "Demo：打开 JPG 封面编辑，可在这里接入现有水印与马赛克编辑器。",
        "edit-motion": "Demo：打开原 MOV 动态组件的视频编辑流程。",
        "export-jpg": "Demo：导出 JPG 工作副本，并交给水印 / 马赛克编辑器。",
        "export-livp": "Demo：生成 Eagle 可预览的 .livp；它不是 iPhone 或小红书发布格式。",
        "export-iphone": "Demo：.livp 不直接进照片 App；这里会生成匹配的照片 + paired MOV，并通过 PhotoKit 写入照片库为 Live Photo。",
        "export-video": "Demo：生成 MP4/MOV 短视频，作为平台不支持实况时的稳定降级。"
      };
      showToast(messages[action] || "Demo 操作");
      closeLiveMenu();
    }

    const liveCard = document.getElementById("live-card");
    const sideLivePreview = document.getElementById("side-live-preview");
    function startLivePreview() {
      liveCard.classList.add("previewing");
      sideLivePreview.classList.add("previewing");
      document.getElementById("live-state").textContent = "正在预览动态";
      document.getElementById("side-live-state").textContent = "正在播放 Live";
    }
    function stopLivePreview() {
      liveCard.classList.remove("previewing");
      sideLivePreview.classList.remove("previewing");
      document.getElementById("live-state").textContent = "悬停预览 Live";
      document.getElementById("side-live-state").textContent = "等待悬停";
    }
    liveCard.addEventListener("mouseenter", startLivePreview);
    liveCard.addEventListener("mouseleave", stopLivePreview);
    liveCard.addEventListener("focus", startLivePreview);
    liveCard.addEventListener("blur", stopLivePreview);
    liveCard.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openLiveMenu(event.clientX, event.clientY);
    });
    document.getElementById("open-live-menu").addEventListener("click", (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      openLiveMenu(rect.left, rect.bottom + 6);
    });
    document.querySelectorAll("[data-live-action]").forEach((button) => {
      button.addEventListener("click", () => runLiveAction(button.dataset.liveAction));
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest("#live-menu") && !event.target.closest("#open-live-menu")) closeLiveMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeLiveMenu();
    });

    document.getElementById("refresh").addEventListener("click", load);
    document.getElementById("reset").addEventListener("click", () => postAndReload("/api/demo/reset"));
    document.getElementById("pause").addEventListener("click", () => postAndReload("/api/pause"));
    document.getElementById("resume").addEventListener("click", () => postAndReload("/api/resume"));
    document.getElementById("tick").addEventListener("click", () => postAndReload("/api/demo/tick"));
    document.getElementById("retry").addEventListener("click", () => postAndReload("/api/retry-failed"));

    load().catch((error) => {
      document.body.innerHTML = "<pre>" + escapeHtml(error.stack || error.message) + "</pre>";
    });
  </script>
</body>
</html>`;
}

function createServer(ledgerPath) {
  ensureDemoLedger(ledgerPath);
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let ledger = loadLedger(ledgerPath);
      const batchId = activeBatchId(ledger);

      if (req.method === "GET" && url.pathname === "/") {
        sendHtml(res, appHtml());
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/state") {
        sendJson(res, 200, statePayload(ledger));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/demo/reset") {
        ledger = resetDemoLedger(ledgerPath);
        sendJson(res, 200, statePayload(ledger));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/demo/tick") {
        simulateTick(ledger, batchId);
        saveLedger(ledgerPath, ledger);
        sendJson(res, 200, statePayload(ledger));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/pause") {
        markBatchStatus(ledger, batchId, "paused");
        saveLedger(ledgerPath, ledger);
        sendJson(res, 200, statePayload(ledger));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/resume") {
        markBatchStatus(ledger, batchId, "active");
        saveLedger(ledgerPath, ledger);
        sendJson(res, 200, statePayload(ledger));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/retry-failed") {
        retryFailed(ledger, batchId);
        saveLedger(ledgerPath, ledger);
        sendJson(res, 200, statePayload(ledger));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/anchor") {
        const body = await readJson(req);
        recordDemoAnchor(ledger, batchId, body.assetKey);
        saveLedger(ledgerPath, ledger);
        sendJson(res, 200, statePayload(ledger));
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = Number(args.port || 4177);
  const ledgerPath = args.ledger || DEFAULT_LEDGER_PATH;
  const server = createServer(ledgerPath);

  server.listen(port, "127.0.0.1", () => {
    console.log(`iCloud intake workbench demo: http://127.0.0.1:${port}`);
    console.log(`Ledger: ${ledgerPath}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  createServer,
  ensureDemoLedger,
};
