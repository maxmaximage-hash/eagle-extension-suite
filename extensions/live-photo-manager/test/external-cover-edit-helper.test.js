"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { packageLivePair } = require("../lib/vendor/live-package");
const {
  createExternalEditSession,
  launchEditor,
  waitForExternalEdit,
  stageExternalEdit,
  sessionFile,
} = require("../lib/external-cover-edit-helper");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-external-edit-"));
  const source = path.join(root, "source");
  const workspace = path.join(root, "sessions");
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, "IMG_4154.HEIC"), "cover-v1");
  fs.writeFileSync(path.join(source, "IMG_4154.MOV"), "movie-v1");
  const packageDir = path.join(root, "packages");
  const packagePath = packageLivePair({
    stem: "IMG_4154",
    image: path.join(source, "IMG_4154.HEIC"),
    movie: path.join(source, "IMG_4154.MOV"),
  }, packageDir, { name: "IMG_4154" });
  return { root, source, workspace, packagePath };
}

function copyCoverForTest(sourcePath, destinationPath) {
  fs.copyFileSync(sourcePath, destinationPath);
  return destinationPath;
}

test("creates an external edit session outside Eagle Library and chooses Photoshop", () => {
  const { workspace, packagePath } = fixture();
  const session = createExternalEditSession({
    packagePath,
    nativeItemId: "native-4154",
    groupId: "live:img-4154",
    workspaceRoot: workspace,
    appExists: (name) => name === "Adobe Photoshop",
    convertCover: copyCoverForTest,
  });
  assert.equal(session.status, "editing");
  assert.equal(session.editor, "Adobe Photoshop");
  assert.ok(fs.existsSync(session.editedCoverPath));
  assert.ok(fs.existsSync(session.moviePath));
  assert.equal(fs.readFileSync(session.editedCoverPath, "utf8"), "cover-v1");
  assert.ok(fs.existsSync(sessionFile(session)));
  assert.doesNotMatch(session.sessionRoot, /\.library(?:[\\/]|$)/i);
});

test("launches the selected editor without requiring a host patch", () => {
  const { workspace, packagePath } = fixture();
  const session = createExternalEditSession({
    packagePath,
    nativeItemId: "native-4154",
    groupId: "live:img-4154",
    workspaceRoot: workspace,
    editor: "Adobe Photoshop",
    convertCover: copyCoverForTest,
  });
  const calls = [];
  launchEditor(session, {
    spawn(command, args, options) {
      calls.push({ command, args, options });
      return { unref() {} };
    },
  });
  assert.deepEqual(calls[0].args.slice(0, 2), ["-a", "Adobe Photoshop"]);
  assert.equal(calls[0].args[2], session.editedCoverPath);
  assert.equal(calls[0].options.detached, true);
});

test("waits for a changed stable cover then stages a new LIVP", async () => {
  const { workspace, packagePath } = fixture();
  const session = createExternalEditSession({
    packagePath,
    nativeItemId: "native-4154",
    groupId: "live:img-4154",
    workspaceRoot: workspace,
    editor: "Adobe Photoshop",
    convertCover: copyCoverForTest,
  });
  const initial = fs.statSync(session.editedCoverPath);
  setTimeout(() => fs.writeFileSync(session.editedCoverPath, "cover-v2"), 15);
  await waitForExternalEdit(session, {
    initialMtime: initial.mtimeMs,
    initialSize: initial.size,
    intervalMs: 5,
    stableSamples: 2,
    timeoutMs: 500,
  });
  const ready = stageExternalEdit(session);
  assert.equal(ready.status, "ready-for-eagle");
  assert.ok(fs.existsSync(ready.stagedPackagePath));
  const entries = require("node:child_process").execFileSync("unzip", ["-Z1", ready.stagedPackagePath], { encoding: "utf8" });
  assert.match(entries, /image\.jpeg/);
  assert.match(entries, /motion\.mov/);
  assert.ok(!ready.stagedPackagePath.includes(`${path.sep}.library${path.sep}`));
});

test("rejects a Library workspace before opening an editor", () => {
  const { packagePath } = fixture();
  assert.throws(() => createExternalEditSession({
    packagePath,
    nativeItemId: "native-4154",
    groupId: "live:img-4154",
    workspaceRoot: "/Volumes/demo.library/images/edit-sessions",
    editor: "Adobe Photoshop",
    convertCover: copyCoverForTest,
  }), /Library|outside/i);
});

test("converts an HEIC cover to an external editable JPG before staging", () => {
  const { workspace, packagePath } = fixture();
  const session = createExternalEditSession({
    packagePath,
    nativeItemId: "native-4154",
    groupId: "live:img-4154",
    workspaceRoot: workspace,
    editor: "Adobe Photoshop",
    convertCover: copyCoverForTest,
  });
  assert.match(session.editedCoverPath, /\.jpg$/i);
  fs.writeFileSync(session.editedCoverPath, "cover-jpeg-v2");
  session.status = "edited";
  const ready = stageExternalEdit(session);
  const entries = require("node:child_process").execFileSync("unzip", ["-Z1", ready.stagedPackagePath], { encoding: "utf8" });
  assert.match(entries, /image\.jpeg/);
  assert.match(entries, /motion\.mov/);
});

