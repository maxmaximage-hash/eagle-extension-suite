"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs").promises;
const os = require("os");
const path = require("path");
const test = require("node:test");
const { createAvatarSourceExporter } = require("../lib/avatar-source-exporter");
const { verifyManifestIntegrity } = require("../lib/avatar-source-contract");
const { readBoundedAvatarLibrary } = require("../lib/bounded-library-source-reader");

async function fixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avatar-source-"));
  const libraryPath = path.join(root, "引力环球.library");
  await fs.mkdir(libraryPath);
  const female = path.join(root, "female.webp");
  const male = path.join(root, "male.webp");
  const tall = path.join(root, "tall.webp");
  await fs.writeFile(female, "female-avatar");
  await fs.writeFile(male, "male-avatar");
  await fs.writeFile(tall, "not-an-avatar");
  return { root, libraryPath, female, male, tall };
}

function item(id, folderId, filePath, overrides = {}) {
  return {
    id,
    name: `${id} - 小红书`,
    folders: [folderId],
    ext: "webp",
    width: 540,
    height: 540,
    url: `https://www.xiaohongshu.com/user/profile/${id}`,
    filePath,
    ...overrides
  };
}

test("publishes a full authoritative snapshot outside the Eagle Library", async (t) => {
  const fixture = await fixtureRoot();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  let snapshot = {
    MR6L4NLN5G4Y0: [item("female-1", "MR6L4NLN5G4Y0", fixture.female)],
    MR6L4IMOVX6XL: [
      item("male-1", "MR6L4IMOVX6XL", fixture.male),
      item("MRNR1FQR0ZRF9", "MR6L4IMOVX6XL", fixture.tall, {
        name: "锐评男生朋友圈从夯到拉 干货分享 直男必看 恋爱技巧 - 抖音",
        width: 1152,
        height: 2520,
        url: "https://www.douyin.com/video/7653073326386023722"
      })
    ]
  };
  const exporter = createAvatarSourceExporter({ now: () => Date.UTC(2026, 7, 5), random: () => crypto.randomUUID() });
  const first = await exporter.refresh({
    libraryPath: fixture.libraryPath,
    readSourceSnapshot: async () => snapshot
  });
  assert.strictEqual(first.changed, true);
  assert.ok(first.outputRoot.startsWith(fixture.root));
  assert.ok(!first.outputRoot.startsWith(fixture.libraryPath + path.sep));
  assert.strictEqual(first.manifest.counts.active, 2);
  assert.strictEqual(first.manifest.counts.invalid, 1);
  assert.strictEqual(verifyManifestIntegrity(first.manifest), true);
  const invalid = first.manifest.records.find((record) => record.eagleItemId === "MRNR1FQR0ZRF9");
  assert.strictEqual(invalid.status, "invalid");
  assert.strictEqual(invalid.resourceRef, null);
  assert.ok(invalid.validationIssues.includes("NON_AVATAR_ASPECT"));
  const active = first.manifest.records.find((record) => record.eagleItemId === "female-1");
  assert.ok(active.resourceRef.relativePath.startsWith("assets/sha256/"));
  assert.ok(!active.resourceRef.relativePath.includes(".."));
  const assetPath = path.join(first.outputRoot, ...active.resourceRef.relativePath.split("/"));
  assert.strictEqual(await fs.readFile(assetPath, "utf8"), "female-avatar");
  const stages = await fs.readdir(path.join(first.outputRoot, "staging"));
  assert.strictEqual(stages.length, 1);
  const stageReport = JSON.parse(await fs.readFile(path.join(first.outputRoot, "staging", stages[0], "publish.json"), "utf8"));
  assert.strictEqual(stageReport.status, "published");

  const unchanged = await exporter.refresh({
    libraryPath: fixture.libraryPath,
    readSourceSnapshot: async () => snapshot
  });
  assert.strictEqual(unchanged.changed, false);
  assert.strictEqual(unchanged.manifest.manifestVersion, 1);
  assert.strictEqual((await fs.readdir(path.join(first.outputRoot, "staging"))).length, 1);

  snapshot = {
    MR6L4NLN5G4Y0: [item("female-1", "MR6L4NLN5G4Y0", fixture.female)],
    MR6L4IMOVX6XL: []
  };
  const removed = await exporter.refresh({
    libraryPath: fixture.libraryPath,
    readSourceSnapshot: async () => snapshot
  });
  assert.strictEqual(removed.changed, true);
  assert.strictEqual(removed.manifest.manifestVersion, 2);
  assert.deepStrictEqual(removed.manifest.tombstones.map((entry) => entry.eagleItemId), ["male-1", "MRNR1FQR0ZRF9"]);
});

test("refuses to publish a partial folder snapshot", async (t) => {
  const fixture = await fixtureRoot();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  const exporter = createAvatarSourceExporter();
  await assert.rejects(
    exporter.refresh({
      libraryPath: fixture.libraryPath,
      readSourceSnapshot: async () => ({ MR6L4NLN5G4Y0: [] })
    }),
    /avatar-source-folder-unavailable:MR6L4IMOVX6XL/
  );
});

test("keeps current.json valid if the final atomic pointer replacement fails", async (t) => {
  const fixture = await fixtureRoot();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  let snapshot = {
    MR6L4NLN5G4Y0: [item("female-1", "MR6L4NLN5G4Y0", fixture.female)],
    MR6L4IMOVX6XL: [item("male-1", "MR6L4IMOVX6XL", fixture.male)]
  };
  const first = await createAvatarSourceExporter().refresh({
    libraryPath: fixture.libraryPath,
    readSourceSnapshot: async () => snapshot
  });
  const originalCurrent = await fs.readFile(first.currentPath, "utf8");
  snapshot = { MR6L4NLN5G4Y0: [], MR6L4IMOVX6XL: [] };
  const failingFs = {
    ...fs,
    rename: async (from, to) => {
      if (to === first.currentPath) throw new Error("simulated-final-pointer-failure");
      return fs.rename(from, to);
    }
  };
  await assert.rejects(
    createAvatarSourceExporter({ fs: failingFs }).refresh({
      libraryPath: fixture.libraryPath,
      readSourceSnapshot: async () => snapshot
    }),
    /simulated-final-pointer-failure/
  );
  assert.strictEqual(await fs.readFile(first.currentPath, "utf8"), originalCurrent);
  assert.strictEqual(verifyManifestIntegrity(JSON.parse(originalCurrent)), true);
  const failedStages = await fs.readdir(path.join(first.outputRoot, "staging"));
  const failed = await Promise.all(failedStages.map(async (runId) => JSON.parse(await fs.readFile(path.join(first.outputRoot, "staging", runId, "publish.json"), "utf8"))));
  assert.ok(failed.some((report) => report.status === "failed"));
});

test("rolls back payload through a newer monotonic manifest version", async (t) => {
  const fixture = await fixtureRoot();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  let snapshot = {
    MR6L4NLN5G4Y0: [item("female-1", "MR6L4NLN5G4Y0", fixture.female)],
    MR6L4IMOVX6XL: [item("male-1", "MR6L4IMOVX6XL", fixture.male)]
  };
  const exporter = createAvatarSourceExporter();
  const first = await exporter.refresh({ libraryPath: fixture.libraryPath, readSourceSnapshot: async () => snapshot });
  snapshot = { MR6L4NLN5G4Y0: [], MR6L4IMOVX6XL: [] };
  const second = await exporter.refresh({ libraryPath: fixture.libraryPath, readSourceSnapshot: async () => snapshot });
  const rollback = await exporter.rollbackToVersion({ libraryPath: fixture.libraryPath, manifestVersion: first.manifest.manifestVersion });
  assert.strictEqual(second.manifest.manifestVersion, 2);
  assert.strictEqual(rollback.manifest.manifestVersion, 3);
  assert.strictEqual(rollback.manifest.rollbackOf, 1);
  assert.strictEqual(rollback.manifest.counts.active, 2);
  assert.strictEqual(verifyManifestIntegrity(rollback.manifest), true);
});

test("bounded bootstrap reads only cache-selected item directories", async (t) => {
  const fixture = await fixtureRoot();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  const imageRoot = path.join(fixture.libraryPath, "images");
  const itemId = "female-1";
  const infoDirectory = path.join(imageRoot, `${itemId}.info`);
  await fs.mkdir(infoDirectory, { recursive: true });
  await fs.copyFile(fixture.female, path.join(infoDirectory, "female-1 - 小红书.webp"));
  await fs.writeFile(path.join(infoDirectory, "metadata.json"), JSON.stringify({
    id: itemId,
    name: "female-1 - 小红书",
    folders: ["MR6L4NLN5G4Y0"],
    ext: "webp",
    width: 540,
    height: 540,
    url: "https://www.xiaohongshu.com/user/profile/female-1"
  }));
  const cachePath = path.join(fixture.root, "cache.ndjson");
  await fs.writeFile(cachePath, [
    JSON.stringify({ id: itemId, folders: ["MR6L4NLN5G4Y0"] }),
    JSON.stringify({ id: "not-in-source", folders: ["other-folder"] })
  ].join("\n"));
  const snapshot = await readBoundedAvatarLibrary({ libraryPath: fixture.libraryPath, cachePath });
  assert.strictEqual(snapshot.MR6L4NLN5G4Y0.length, 1);
  assert.strictEqual(snapshot.MR6L4NLN5G4Y0[0].filePath, path.join(infoDirectory, "female-1 - 小红书.webp"));
  assert.deepStrictEqual(snapshot.MR6L4IMOVX6XL, []);
});
