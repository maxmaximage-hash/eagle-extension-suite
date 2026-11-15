#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN_ROOT = process.env.MAX_LIVE_PLUGIN_ROOT || path.join(os.homedir(), "Library", "Application Support", "Eagle", "Plugins", "com.max.eagle-live-photo-manager");
const EDIT_ROOT = path.join(os.homedir(), "Library", "Application Support", "Eagle", "LivePhotoManager", "EditSessions");

function fail(message) { process.stderr.write(`${message}\n`); process.exitCode = 1; }
function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, filePath);
}
function pickEditor() {
  for (const name of ["Adobe Photoshop 2026", "Adobe Photoshop 2025", "Adobe Photoshop", "Preview"]) {
    try {
      if (childProcess.spawnSync("open", ["-Ra", name], { stdio: "ignore" }).status === 0) return name;
    } catch {}
  }
  return null;
}
function extractEntry(packagePath, entry, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const data = childProcess.execFileSync("unzip", ["-p", packagePath, entry], { maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(destination, data);
}
function convertHeicToJpeg(sourcePath, destinationPath) {
  try {
    childProcess.execFileSync("sips", [
      "-s", "format", "jpeg",
      "-s", "formatOptions", "100",
      sourcePath,
      "--out", destinationPath,
    ], { stdio: "ignore" });
  } catch (error) {
    throw new Error(`HEIC cover conversion to editable JPG failed: ${error.message || error}`);
  }
  if (!fs.existsSync(destinationPath)) throw new Error(`HEIC conversion did not create JPG: ${destinationPath}`);
  return destinationPath;
}
function packageEntries(packagePath) {
  return childProcess.execFileSync("unzip", ["-Z1", packagePath], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
}
function main() {
  const packagePath = path.resolve(process.argv[2] || "");
  if (!packagePath || path.extname(packagePath).toLowerCase() !== ".livp") return fail("A .livp path is required");
  if (!fs.existsSync(packagePath)) return fail(`Package does not exist: ${packagePath}`);
  const editor = pickEditor();
  if (!editor) return fail("No supported image editor is installed");
  const entries = packageEntries(packagePath);
  const imageEntry = entries.find((entry) => /\.(heic|jpe?g)$/i.test(entry));
  const movieEntry = entries.find((entry) => /\.mov$/i.test(entry));
  if (!imageEntry || !movieEntry) return fail("The .livp package does not contain a static image and MOV");
  const idMatch = packagePath.match(/[\\/]([^\\/]+)\.info[\\/][^\\/]+\.livp$/i);
  const nativeItemId = idMatch ? idMatch[1] : null;
  const id = `handler-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const sessionRoot = path.join(EDIT_ROOT, id);
  const imageName = path.basename(imageEntry);
  const movieName = path.basename(movieEntry);
  const extractedImagePath = path.join(sessionRoot, imageName);
  const editedCoverPath = /\.heic$/i.test(imageName)
    ? path.join(sessionRoot, `${path.basename(imageName, path.extname(imageName))}.jpg`)
    : extractedImagePath;
  const moviePath = path.join(sessionRoot, movieName);
  extractEntry(packagePath, imageEntry, extractedImagePath);
  if (editedCoverPath !== extractedImagePath) convertHeicToJpeg(extractedImagePath, editedCoverPath);
  extractEntry(packagePath, movieEntry, moviePath);
  const session = {
    schemaVersion: 1,
    id,
    type: "external-static-cover-edit",
    status: "editing",
    packagePath,
    groupId: nativeItemId ? `native:${nativeItemId}` : `handler:${id}`,
    nativeItemId,
    editor,
    sessionRoot,
    editedCoverPath,
    moviePath,
    stagedPackagePath: null,
    source: { imagePath: extractedImagePath, moviePath },
    createdAt: new Date().toISOString(),
  };
  const sessionPath = path.join(sessionRoot, "session.json");
  atomicWrite(sessionPath, session);
  const helper = path.join(PLUGIN_ROOT, "scripts", "max-live-photo-edit.js");
  const node = process.execPath;
  if (fs.existsSync(helper)) {
    const child = childProcess.spawn(node, [helper, "--session", sessionPath], { detached: true, stdio: "ignore", env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } });
    child.unref();
  } else {
    const child = childProcess.spawn("open", ["-a", editor, editedCoverPath], { detached: true, stdio: "ignore" });
    child.unref();
  }
  process.stdout.write(`${JSON.stringify({ status: "editing", sessionPath, nativeItemId, editor })}\n`);
}
try { main(); } catch (error) { fail(error.stack || String(error)); }

