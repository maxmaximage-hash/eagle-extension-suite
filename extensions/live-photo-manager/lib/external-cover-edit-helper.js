"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");
const {
  exportLivePackageComponents,
} = require("./vendor/live-package");
const {
  waitForStableCover,
  stageEditedLivePhoto,
} = require("./cover-edit-session");

const SESSION_SCHEMA_VERSION = 1;
const DEFAULT_SESSIONS_ROOT = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Eagle",
  "LivePhotoManager",
  "EditSessions",
);

function required(value, label) {
  if (!value || typeof value !== "string") throw new Error(`${label} is required`);
  return value;
}

function assertOutsideLibrary(filePath, label) {
  const normalized = path.resolve(filePath);
  if (/\.library(?:[\\/]|$)/i.test(normalized)) {
    throw new Error(`${label} must be outside Eagle Library`);
  }
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, filePath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sessionFile(session) {
  return path.join(session.sessionRoot, "session.json");
}

function chooseEditor({ preferred = null, appExists = null } = {}) {
  const candidates = preferred
    ? [preferred]
    : ["Adobe Photoshop 2026", "Adobe Photoshop 2025", "Adobe Photoshop", "Preview"];
  if (preferred) return preferred;
  const check = typeof appExists === "function"
    ? appExists
    : (candidate) => {
      if (process.platform !== "darwin") return false;
      try {
        return childProcess.spawnSync("open", ["-Ra", candidate], { stdio: "ignore" }).status === 0;
      } catch {
        return false;
      }
    };
  return candidates.find((candidate) => check(candidate)) || null;
}

function convertHeicToJpeg(sourcePath, destinationPath, {
  execFileSync = childProcess.execFileSync,
} = {}) {
  if (path.extname(sourcePath).toLowerCase() !== ".heic") return sourcePath;
  try {
    execFileSync("sips", [
      "-s", "format", "jpeg",
      "-s", "formatOptions", "100",
      sourcePath,
      "--out", destinationPath,
    ], { stdio: "ignore" });
  } catch (error) {
    throw new Error(`HEIC cover conversion to editable JPG failed: ${error.message || error}`);
  }
  if (!fs.existsSync(destinationPath) || !fs.statSync(destinationPath).isFile()) {
    throw new Error(`HEIC cover conversion did not create a JPG: ${destinationPath}`);
  }
  return destinationPath;
}

function createExternalEditSession({
  packagePath,
  nativeItemId,
  groupId,
  workspaceRoot = DEFAULT_SESSIONS_ROOT,
  editor = null,
  appExists = null,
  convertCover = convertHeicToJpeg,
} = {}) {
  required(packagePath, "packagePath");
  required(nativeItemId, "nativeItemId");
  required(groupId, "groupId");
  required(workspaceRoot, "workspaceRoot");
  assertOutsideLibrary(workspaceRoot, "workspaceRoot");
  if (path.extname(packagePath).toLowerCase() !== ".livp") {
    throw new Error("packagePath must be a .livp file");
  }
  if (!fs.existsSync(packagePath) || !fs.statSync(packagePath).isFile()) {
    throw new Error(`Live Photo package is unavailable: ${packagePath}`);
  }
  const selectedEditor = chooseEditor({ preferred: editor, appExists });
  if (!selectedEditor) throw new Error("No supported image editor is installed");

  const id = `external-cover-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const sessionRoot = path.join(path.resolve(workspaceRoot), id);
  fs.mkdirSync(sessionRoot, { recursive: true });
  const extracted = exportLivePackageComponents(packagePath, sessionRoot, { mode: "all" });
  const sourceExtension = path.extname(extracted.image).toLowerCase();
  const editedCoverPath = sourceExtension === ".heic"
    ? convertCover(extracted.image, path.join(sessionRoot, `${path.basename(extracted.image, path.extname(extracted.image))}.jpg`))
    : extracted.image;
  const session = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id,
    type: "external-static-cover-edit",
    status: "editing",
    packagePath: path.resolve(packagePath),
    groupId: String(groupId),
    nativeItemId: String(nativeItemId),
    editor: selectedEditor,
    sessionRoot,
    editedCoverPath,
    moviePath: extracted.movie,
    stagedPackagePath: null,
    source: {
      imagePath: extracted.image,
      moviePath: extracted.movie,
    },
    createdAt: new Date().toISOString(),
  };
  atomicWriteJson(sessionFile(session), session);
  return session;
}

function launchEditor(session, {
  spawn = childProcess.spawn,
  command = "open",
} = {}) {
  if (!session || session.type !== "external-static-cover-edit") {
    throw new Error("An external static cover edit session is required");
  }
  const child = spawn(command, ["-a", session.editor, session.editedCoverPath], {
    detached: true,
    stdio: "ignore",
  });
  if (child && typeof child.unref === "function") child.unref();
  return child;
}

async function waitForExternalEdit(session, options = {}) {
  if (!session || session.type !== "external-static-cover-edit") {
    throw new Error("An external static cover edit session is required");
  }
  const initialMtime = Number(options.initialMtime ?? fs.statSync(session.editedCoverPath).mtimeMs);
  const initialSize = Number(options.initialSize ?? fs.statSync(session.editedCoverPath).size);
  const timeoutMs = Number(options.timeoutMs ?? 15 * 60 * 1000);
  const intervalMs = Number(options.intervalMs ?? 500);
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const stat = fs.statSync(session.editedCoverPath);
      if (stat.mtimeMs > initialMtime || stat.size !== initialSize) {
        await waitForStableCover(session.editedCoverPath, {
          intervalMs,
          stableSamples: Number(options.stableSamples ?? 4),
          timeoutMs: Math.max(intervalMs * 8, timeoutMs - (Date.now() - startedAt)),
        });
        session.status = "edited";
        session.editedAt = new Date().toISOString();
        atomicWriteJson(sessionFile(session), session);
        return session;
      }
    } catch {
      // The editor may replace the file while saving; keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`External cover edit timed out: ${session.editedCoverPath}`);
}

function stageExternalEdit(session, { overwrite = true } = {}) {
  if (!session || session.type !== "external-static-cover-edit") {
    throw new Error("An external static cover edit session is required");
  }
  if (session.status !== "edited") throw new Error(`External edit is not ready: ${session.status}`);
  const packagePath = stageEditedLivePhoto({
    id: session.id,
    type: "static-cover-edit-session",
    stem: path.basename(session.packagePath, path.extname(session.packagePath)),
    editedCoverPath: session.editedCoverPath,
    sessionRoot: session.sessionRoot,
    source: { moviePath: session.moviePath },
  }, { overwrite });
  session.status = "ready-for-eagle";
  session.stagedPackagePath = packagePath;
  session.readyAt = new Date().toISOString();
  atomicWriteJson(sessionFile(session), session);
  return session;
}

module.exports = {
  SESSION_SCHEMA_VERSION,
  DEFAULT_SESSIONS_ROOT,
  sessionFile,
  readJson,
  atomicWriteJson,
  chooseEditor,
  convertHeicToJpeg,
  createExternalEditSession,
  launchEditor,
  waitForExternalEdit,
  stageExternalEdit,
};

