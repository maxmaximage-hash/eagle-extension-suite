"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { packageLivePair } = require("./vendor/live-package");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".heic"]);

function required(value, label) {
  if (!value || typeof value !== "string") throw new Error(`${label} is required`);
  return value;
}

function assertOutsideLibrary(filePath, label) {
  const normalized = path.resolve(filePath);
  if (/\.library(?:[\\/]|$)/i.test(normalized)) {
    throw new Error(`${label} must be staged outside Eagle Library`);
  }
}

function safeStem(value) {
  return path.basename(String(value || "live-photo"))
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim() || "live-photo";
}

function copyAtomic(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    throw new Error(`Static cover is unavailable: ${sourcePath}`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.copyFileSync(sourcePath, temporaryPath);
    fs.renameSync(temporaryPath, targetPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
  return targetPath;
}

function createCoverEditSession({
  groupId,
  nativeItemId,
  stem,
  sourceImagePath,
  sourceMoviePath,
  workspaceRoot,
} = {}) {
  required(groupId, "groupId");
  required(nativeItemId, "nativeItemId");
  required(stem, "stem");
  required(sourceImagePath, "sourceImagePath");
  required(sourceMoviePath, "sourceMoviePath");
  required(workspaceRoot, "workspaceRoot");
  assertOutsideLibrary(workspaceRoot, "workspaceRoot");
  if (path.resolve(sourceImagePath) === path.resolve(sourceMoviePath)) {
    throw new Error("Static cover and MOV source paths must be different");
  }
  const extension = path.extname(sourceImagePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error("sourceImagePath must be JPG, JPEG or HEIC");
  }
  if (!fs.existsSync(sourceMoviePath) || !fs.statSync(sourceMoviePath).isFile()) {
    throw new Error(`Paired MOV is unavailable: ${sourceMoviePath}`);
  }

  const sessionId = `cover-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const sessionRoot = path.join(path.resolve(workspaceRoot), sessionId);
  const editedCoverPath = path.join(sessionRoot, `${safeStem(stem)}${extension}`);
  fs.mkdirSync(sessionRoot, { recursive: true });
  copyAtomic(sourceImagePath, editedCoverPath);

  return {
    schemaVersion: 1,
    id: sessionId,
    type: "static-cover-edit-session",
    status: "planned",
    groupId: String(groupId),
    nativeItemId: String(nativeItemId),
    stem: safeStem(stem),
    source: {
      imagePath: sourceImagePath,
      moviePath: sourceMoviePath,
    },
    workspaceRoot: path.resolve(workspaceRoot),
    sessionRoot,
    editedCoverPath,
    stagingPackagePath: null,
    preserved: {
      movie: true,
      pairingIdentity: "unchanged",
      originalSource: true,
    },
    createdAt: new Date().toISOString(),
  };
}

async function waitForStableCover(filePath, {
  intervalMs = 250,
  stableSamples = 3,
  timeoutMs = 30_000,
} = {}) {
  required(filePath, "filePath");
  const startedAt = Date.now();
  let previous = null;
  let stableCount = 0;
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size <= 0) throw new Error("not-ready");
      const current = `${stat.size}:${stat.mtimeMs}`;
      if (current === previous) stableCount += 1;
      else stableCount = 1;
      if (stableCount >= stableSamples) return true;
      previous = current;
    } catch {
      stableCount = 0;
      previous = null;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Edited cover did not become stable before timeout: ${filePath}`);
}

function stageEditedLivePhoto(session, { overwrite = true } = {}) {
  if (!session || session.type !== "static-cover-edit-session") {
    throw new Error("A cover edit session is required");
  }
  if (!fs.existsSync(session.editedCoverPath)) {
    throw new Error(`Edited cover is unavailable: ${session.editedCoverPath}`);
  }
  if (!fs.existsSync(session.source.moviePath)) {
    throw new Error(`Paired MOV is unavailable: ${session.source.moviePath}`);
  }
  assertOutsideLibrary(session.sessionRoot, "sessionRoot");
  const stagingDirectory = path.join(session.sessionRoot, "staged");
  const packagePath = packageLivePair({
    stem: session.stem,
    image: session.editedCoverPath,
    movie: session.source.moviePath,
  }, stagingDirectory, {
    name: session.stem,
    overwrite,
  });
  session.status = "staged";
  session.stagingPackagePath = packagePath;
  session.stagedAt = new Date().toISOString();
  return packagePath;
}

async function replaceNativeLivePhoto({ eagle, nativeItemId, packagePath, item = null } = {}) {
  required(nativeItemId, "nativeItemId");
  required(packagePath, "packagePath");
  if (!fs.existsSync(packagePath) || !fs.statSync(packagePath).isFile()) {
    throw new Error(`Staged Live Photo package is unavailable: ${packagePath}`);
  }
  const target = item || await eagle?.item?.getById?.(nativeItemId);
  if (!target || typeof target.replaceFile !== "function") {
    throw new Error("Eagle item.replaceFile is unavailable");
  }
  const replaced = await target.replaceFile(packagePath);
  if (replaced === false) throw new Error(`Eagle item.replaceFile failed: ${nativeItemId}`);
  return true;
}

module.exports = {
  createCoverEditSession,
  waitForStableCover,
  stageEditedLivePhoto,
  replaceNativeLivePhoto,
};
