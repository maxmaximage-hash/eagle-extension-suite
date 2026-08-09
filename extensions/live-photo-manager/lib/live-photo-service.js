"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { findLivePairs } = require("./vendor/live-package");
const { SerialPreviewQueue } = require("./preview-queue");

const DEFAULT_SAMPLE_DIRECTORY = "/Users/max/Downloads/iCloud 照片 2";

function pairId(pair) {
  return crypto.createHash("sha256")
    .update([pair.stem, pair.image || "", pair.movie || ""].join("\n"))
    .digest("hex")
    .slice(0, 16);
}

function describePair(pair) {
  const issues = [...pair.issues];
  const hasConflict = issues.some((issue) => issue.startsWith("multiple "));
  const imageStat = pair.image && fs.existsSync(pair.image) ? fs.statSync(pair.image) : null;
  const movieStat = pair.movie && fs.existsSync(pair.movie) ? fs.statSync(pair.movie) : null;
  return {
    id: pairId(pair),
    stem: pair.stem.toUpperCase(),
    imagePath: pair.image,
    moviePath: pair.movie,
    imageName: pair.image ? path.basename(pair.image) : null,
    movieName: pair.movie ? path.basename(pair.movie) : null,
    imageBytes: imageStat ? imageStat.size : null,
    movieBytes: movieStat ? movieStat.size : null,
    modifiedAt: new Date(Math.max(imageStat?.mtimeMs || 0, movieStat?.mtimeMs || 0)).toISOString(),
    status: hasConflict ? "conflict" : pair.status,
    issues,
  };
}

function scanDirectory(directory) {
  if (!directory || !fs.existsSync(directory)) {
    throw new Error(`Source folder does not exist: ${directory || "(empty)"}`);
  }
  if (!fs.statSync(directory).isDirectory()) {
    throw new Error(`Source path is not a folder: ${directory}`);
  }
  return findLivePairs(directory)
    .map(describePair)
    .sort((left, right) => left.stem.localeCompare(right.stem, undefined, { numeric: true }));
}

function inspectPair(record, { signal }) {
  if (signal.aborted) throw new Error("Preview cancelled");
  for (const filePath of [record.imagePath, record.moviePath]) {
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new Error(`Live component is unavailable: ${filePath || "missing path"}`);
    }
  }
  return {
    imageUrl: pathToFileURL(record.imagePath).href,
    movieUrl: pathToFileURL(record.moviePath).href,
    checkedAt: new Date().toISOString(),
  };
}

function createPreviewQueue(options = {}) {
  return new SerialPreviewQueue(options.processor || inspectPair, options);
}

function progressFromSnapshot(snapshot) {
  const counts = {
    total: snapshot.items.length,
    ready: 0,
    processing: 0,
    failed: 0,
    remaining: 0,
    conflicts: 0,
  };
  for (const item of snapshot.items) {
    if (item.status === "preview_ready") counts.ready += 1;
    if (item.status === "previewing") counts.processing += 1;
    if (item.status === "failed" || item.status === "cancelled") counts.failed += 1;
    if (item.status === "conflict" || item.status === "incomplete") counts.conflicts += 1;
    if (item.status === "paired" || item.status === "previewing") counts.remaining += 1;
  }
  return counts;
}

function snapshotPayload(sourceDirectory, snapshot, mode = "local") {
  return {
    product: "MAX Live Photo 管家",
    mode,
    sourceDirectory,
    readOnly: true,
    generatedAt: new Date().toISOString(),
    queue: {
      running: snapshot.running,
      paused: snapshot.paused,
      circuitOpen: snapshot.circuitOpen,
    },
    counts: progressFromSnapshot(snapshot),
    items: snapshot.items,
  };
}

module.exports = {
  DEFAULT_SAMPLE_DIRECTORY,
  createPreviewQueue,
  describePair,
  inspectPair,
  pairId,
  progressFromSnapshot,
  scanDirectory,
  snapshotPayload,
};
