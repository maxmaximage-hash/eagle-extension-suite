"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createCoverEditSession,
  waitForStableCover,
  stageEditedLivePhoto,
  replaceNativeLivePhoto,
} = require("../lib/cover-edit-session");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-cover-edit-"));
  const source = path.join(root, "source");
  const workspace = path.join(root, "workspace");
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, "IMG_4154.HEIC"), "cover-v1");
  fs.writeFileSync(path.join(source, "IMG_4154.MOV"), "movie-v1");
  return { root, source, workspace };
}

test("creates an external cover edit session without touching the Eagle Library", () => {
  const { root, source, workspace } = fixture();
  const session = createCoverEditSession({
    groupId: "live:img-4154",
    nativeItemId: "native-4154",
    stem: "IMG_4154",
    sourceImagePath: path.join(source, "IMG_4154.HEIC"),
    sourceMoviePath: path.join(source, "IMG_4154.MOV"),
    workspaceRoot: workspace,
  });

  assert.equal(session.status, "planned");
  assert.equal(session.source.moviePath, path.join(source, "IMG_4154.MOV"));
  assert.match(session.editedCoverPath, /workspace/);
  assert.ok(fs.existsSync(session.editedCoverPath));
  assert.equal(fs.readFileSync(session.editedCoverPath, "utf8"), "cover-v1");
  assert.ok(!session.editedCoverPath.includes(`${path.sep}.library${path.sep}`));
  assert.ok(fs.existsSync(root));
});

test("waits for a saved cover to become stable before repackaging", async () => {
  const { source, workspace } = fixture();
  const session = createCoverEditSession({
    groupId: "live:img-4154",
    nativeItemId: "native-4154",
    stem: "IMG_4154",
    sourceImagePath: path.join(source, "IMG_4154.HEIC"),
    sourceMoviePath: path.join(source, "IMG_4154.MOV"),
    workspaceRoot: workspace,
  });
  fs.writeFileSync(session.editedCoverPath, "cover-v2");
  const stable = await waitForStableCover(session.editedCoverPath, {
    intervalMs: 5,
    stableSamples: 2,
    timeoutMs: 500,
  });
  assert.equal(stable, true);
  const packagePath = stageEditedLivePhoto(session);
  assert.ok(fs.existsSync(packagePath));
  const entries = require("node:child_process").execFileSync("unzip", ["-Z1", packagePath], { encoding: "utf8" });
  assert.match(entries, /image\.heic/);
  assert.match(entries, /motion\.mov/);
  assert.match(entries, /manifest\.json/);
});

test("writes back only through Eagle item.replaceFile after staging", async () => {
  const { source, workspace } = fixture();
  const session = createCoverEditSession({
    groupId: "live:img-4154",
    nativeItemId: "native-4154",
    stem: "IMG_4154",
    sourceImagePath: path.join(source, "IMG_4154.HEIC"),
    sourceMoviePath: path.join(source, "IMG_4154.MOV"),
    workspaceRoot: workspace,
  });
  fs.writeFileSync(session.editedCoverPath, "cover-v3");
  const packagePath = stageEditedLivePhoto(session);
  const calls = [];
  const eagle = {
    item: {
      async getById(id) { return { id, ext: "livp" }; },
    },
  };
  const item = {
    async replaceFile(filePath) {
      calls.push(filePath);
      return true;
    },
  };
  const result = await replaceNativeLivePhoto({ eagle, nativeItemId: session.nativeItemId, packagePath, item });
  assert.equal(result, true);
  assert.deepEqual(calls, [packagePath]);
  assert.equal(calls[0].includes(`${path.sep}.library${path.sep}`), false);
});

test("rejects a staging package inside Eagle Library", () => {
  const { source } = fixture();
  assert.throws(() => createCoverEditSession({
    groupId: "live:img-4154",
    nativeItemId: "native-4154",
    stem: "IMG_4154",
    sourceImagePath: path.join(source, "IMG_4154.HEIC"),
    sourceMoviePath: path.join(source, "IMG_4154.MOV"),
    workspaceRoot: "/Volumes/demo.library/images/.cover-edit",
  }), /Library|outside/i);
});
