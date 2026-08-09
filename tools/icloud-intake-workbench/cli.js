#!/usr/bin/env node
"use strict";

const fs = require("fs");
const {
  loadLedger,
  saveLedger,
  createBatch,
  addItem,
  setItemStatus,
  recordSelectionAnchor,
  getProgress,
  getContinueContext,
  renderDashboard,
} = require("./lib/ledger");
const {
  findLivePairs,
  packageLivePair,
  exportLivePackageComponents,
} = require("./lib/live-package");

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value.startsWith("--")) {
      const key = value.slice(2);
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        index += 1;
      }
    } else {
      args._.push(value);
    }
  }
  return args;
}

function usage() {
  console.log(`iCloud intake workbench

Usage:
  node tools/icloud-intake-workbench/cli.js init <ledger.json>
  node tools/icloud-intake-workbench/cli.js batch <ledger.json> <batch-id> --title <title> --album <name> --album-url <url> --target <dir>
  node tools/icloud-intake-workbench/cli.js add-item <ledger.json> <batch-id> --icloud-id <id> --filename <name> --media-type <photo|video> --shot-at <iso-date> --target-path <path>
  node tools/icloud-intake-workbench/cli.js status <ledger.json> <batch-id>
  node tools/icloud-intake-workbench/cli.js mark <ledger.json> <asset-key> --status <status> [--error <message>]
  node tools/icloud-intake-workbench/cli.js anchor <ledger.json> <batch-id> --asset-key <key> --filename <name> --shot-at <date> --album <name> --album-url <url>
  node tools/icloud-intake-workbench/cli.js continue <ledger.json>
  node tools/icloud-intake-workbench/cli.js dashboard <ledger.json> <dashboard.html>
  node tools/icloud-intake-workbench/cli.js live-scan <ledger.json> <source-dir>
  node tools/icloud-intake-workbench/cli.js live-package <ledger.json> <source-dir> --output <output-dir> [--overwrite]
  node tools/icloud-intake-workbench/cli.js live-export <ledger.json> <package.livp> --output <output-dir> [--mode <all|image|movie>] [--overwrite]

This tool only records a ledger and renders a local dashboard. It does not log in to iCloud,
install download tools, create NAS folders, or download files.`);
}

function main() {
  const [command, ledgerPath, positional] = process.argv.slice(2);
  const args = parseArgs(process.argv.slice(2));

  if (!command || command === "help" || command === "--help") {
    usage();
    return;
  }
  if (!ledgerPath) {
    throw new Error("ledger.json path is required");
  }

  const ledger = loadLedger(ledgerPath);

  if (command === "init") {
    saveLedger(ledgerPath, ledger);
    console.log(`Initialized ledger: ${ledgerPath}`);
    return;
  }

  if (command === "batch") {
    createBatch(ledger, {
      id: positional,
      title: args.title,
      sourceAlbumName: args.album,
      sourceAlbumUrl: args["album-url"],
      targetDirectory: args.target,
    });
    saveLedger(ledgerPath, ledger);
    console.log(`Recorded batch: ${positional}`);
    return;
  }

  if (command === "add-item") {
    const item = addItem(ledger, positional, {
      assetKey: args["asset-key"],
      icloudId: args["icloud-id"],
      photosLocalIdentifier: args["photos-local-id"],
      contentSha256: args.sha256,
      filename: args.filename,
      mediaType: args["media-type"],
      shotAt: args["shot-at"],
      originalSizeBytes: args.size ? Number(args.size) : null,
      plannedTargetPath: args["target-path"],
      companionGroupId: args["companion-group"],
      livePhotoRole: args["live-photo-role"],
    });
    saveLedger(ledgerPath, ledger);
    console.log(`Recorded item: ${item.assetKey}`);
    return;
  }

  if (command === "mark") {
    const patch = {};
    if (args.error) patch.lastError = args.error;
    if (args.bytes) patch.downloadedBytes = Number(args.bytes);
    if (args.retries) patch.retryCount = Number(args.retries);
    const item = setItemStatus(ledger, positional, args.status, patch);
    saveLedger(ledgerPath, ledger);
    console.log(`Marked ${item.assetKey}: ${item.status}`);
    return;
  }

  if (command === "anchor") {
    const anchor = recordSelectionAnchor(ledger, {
      batchId: positional,
      assetKey: args["asset-key"],
      filename: args.filename,
      shotAt: args["shot-at"],
      sourceAlbumName: args.album,
      sourceAlbumUrl: args["album-url"],
      thumbnailPath: args.thumbnail,
      selectedAt: args["selected-at"],
      precision: args.precision,
      note: args.note,
    });
    saveLedger(ledgerPath, ledger);
    console.log(`Recorded selection anchor: ${anchor.id}`);
    return;
  }

  if (command === "status") {
    console.log(JSON.stringify(getProgress(ledger, positional), null, 2));
    return;
  }

  if (command === "continue") {
    console.log(JSON.stringify(getContinueContext(ledger), null, 2));
    return;
  }

  if (command === "dashboard") {
    const outputPath = positional;
    if (!outputPath) {
      throw new Error("dashboard output path is required");
    }
    fs.writeFileSync(outputPath, renderDashboard(ledger), "utf8");
    console.log(`Rendered dashboard: ${outputPath}`);
    return;
  }

  if (command === "live-scan") {
    console.log(JSON.stringify(findLivePairs(positional), null, 2));
    return;
  }

  if (command === "live-package") {
    const outputDirectory = args.output;
    if (!outputDirectory) {
      throw new Error("--output is required");
    }
    const pairs = findLivePairs(positional).filter((pair) => pair.status === "ready");
    const outputs = pairs.map((pair) => packageLivePair(pair, outputDirectory, {
      overwrite: Boolean(args.overwrite),
    }));
    console.log(JSON.stringify(outputs, null, 2));
    return;
  }

  if (command === "live-export") {
    const outputDirectory = args.output;
    if (!outputDirectory) {
      throw new Error("--output is required");
    }
    const mode = args.mode || "all";
    if (!["all", "image", "movie"].includes(mode)) {
      throw new Error("--mode must be all, image, or movie");
    }
    const outputs = exportLivePackageComponents(positional, outputDirectory, {
      mode,
      overwrite: Boolean(args.overwrite),
    });
    console.log(JSON.stringify(outputs, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
