"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createDurableStateLayout, migrateLegacyState } = require("../lib/durable-state-core");
(async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "eagle-durable-state-"));
  const legacy = path.join(root, "plugin-code");
  await fs.promises.mkdir(legacy);
  await fs.promises.writeFile(path.join(legacy, "photo-taken-cache.json"), JSON.stringify({ version: 2, items: { hit: { takenAt: 123 } } }));
  await fs.promises.mkdir(path.join(legacy, "team-state-backups"));
  await fs.promises.writeFile(path.join(legacy, "team-state-backups", "sort-state.json.legacy.bak"), "legacy-team-state");
  const layout = createDurableStateLayout({ applicationSupportRoot: root, pluginId: "com.max.eagle-photo-taken-sort" });
  assert.ok(!layout.root.startsWith(legacy), "mutable state must not live inside immutable plugin code");
  assert.ok(layout.teamBackupRoot.startsWith(layout.root));
  const first = await migrateLegacyState({ fs, path, legacyRoot: legacy, layout });
  assert.deepStrictEqual(first.migrated, ["photo-taken-cache.json"]);
  assert.strictEqual(JSON.parse(await fs.promises.readFile(layout.cachePath)).items.hit.takenAt, 123);
  assert.strictEqual(
    await fs.promises.readFile(path.join(layout.teamBackupRoot, "sort-state.json.legacy.bak"), "utf8"),
    "legacy-team-state",
    "team sorting sidecar backups must survive immutable plugin replacement"
  );
  await fs.promises.writeFile(
    path.join(layout.teamBackupRoot, "sort-state.json.legacy.bak"),
    "durable-team-state"
  );
  const teamUpgrade = await migrateLegacyState({ fs, path, legacyRoot: legacy, layout });
  assert.ok(teamUpgrade.preservedDirectories.includes("team-state-backups/sort-state.json.legacy.bak"));
  assert.strictEqual(
    await fs.promises.readFile(path.join(layout.teamBackupRoot, "sort-state.json.legacy.bak"), "utf8"),
    "durable-team-state",
    "legacy team backups must never overwrite an existing durable backup"
  );
  await fs.promises.writeFile(layout.cachePath, JSON.stringify({ version: 2, items: { durable: { takenAt: 456 } } }));
  const upgrade = await migrateLegacyState({ fs, path, legacyRoot: legacy, layout });
  assert.ok(upgrade.preserved.includes("photo-taken-cache.json"));
  assert.strictEqual(JSON.parse(await fs.promises.readFile(layout.cachePath)).items.durable.takenAt, 456, "an upgrade must retain the durable cache instead of forcing a NAS rescan");
  await fs.promises.unlink(layout.cachePath);
  const concurrent = await Promise.all([
    migrateLegacyState({ fs, path, legacyRoot: legacy, layout }),
    migrateLegacyState({ fs, path, legacyRoot: legacy, layout })
  ]);
  assert.strictEqual(concurrent.flatMap((result) => result.migrated).filter((name) => name === "photo-taken-cache.json").length, 1, "concurrent installer/runtime migration must create the durable cache exactly once");
  assert.deepStrictEqual(
    (await fs.promises.readdir(layout.root)).filter((name) => name.includes(".migrate-")),
    [],
    "failed/racing migration temporaries must be cleaned"
  );
  await fs.promises.rm(root, { recursive: true, force: true });
  console.log("durable state core tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
