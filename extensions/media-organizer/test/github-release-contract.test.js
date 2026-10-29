"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const installerPath = path.join(root, "scripts", "install-github-release.sh");
const builderPath = path.join(root, "scripts", "build-github-release.sh");

assert.ok(fs.existsSync(installerPath), "GitHub release must provide a host-safe installer");
assert.ok(fs.existsSync(builderPath), "GitHub release must provide a reproducible clean-package builder");

const installer = fs.readFileSync(installerPath, "utf8");
const builder = fs.readFileSync(builderPath, "utf8");
const packageVersion = JSON.parse(fs.readFileSync(
  path.join(root, "package.json"),
  "utf8"
)).version;

assert.match(installer, /MODE="check"/);
assert.match(installer, /--install-plugin/);
assert.match(installer, /通信桥不存在或未经审计/);
assert.match(installer, /BRIDGE_EVIDENCE=/);
assert.match(installer, /photo-taken-sort\.execute/);
assert.match(installer, /bridge\/rebuild-compatible-bridge\.js/);
assert.match(installer, /BRIDGED_SHA256=/);
assert.match(installer, /CHECKSUM_FILE=/);
assert.match(installer, /发现多个同 ID 插件来源/);
assert.match(installer, /同 ID 插件位于非规范目录/);
assert.doesNotMatch(installer, /--install-bridge/);
assert.doesNotMatch(installer, /(?:cp|mv|ditto)[^\n]*app\.asar/);
assert.doesNotMatch(installer, /Contents\/Resources\/app\.asar[^\n]*(?:>|>>)/);
assert.match(
  installer,
  new RegExp(`EXPECTED_PLUGIN_VERSION="${packageVersion.replaceAll(".", "\\.")}"`),
  "installer version must match the package candidate"
);
assert.match(
  installer,
  new RegExp(`ARCHIVE_NAME="媒体智能整理-v${packageVersion.replaceAll(".", "\\.")}-github\\.eagleplugin"`),
  "installer archive name must match the package candidate"
);
assert.match(
  installer,
  new RegExp(`CHECKSUM_NAME="媒体智能整理-v${packageVersion.replaceAll(".", "\\.")}-github\\.SHA256SUMS"`),
  "installer checksum name must match the package candidate"
);

for (const forbidden of [
  "backups",
  "bridge/payload",
  "defaults/sort-state",
  "geo-tag-state.json",
  "photo-taken-cache.json",
  "rename-batch-backup.json",
  "recovery",
  "team-state-backups",
  "qa-library",
  "diagnostic.log"
]) {
  assert.doesNotMatch(
    builder,
    new RegExp(`copy_(?:file|tree)\\s+[^\\n]*${forbidden.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`),
    `clean package builder must not copy ${forbidden}`
  );
}

assert.match(builder, /RUNTIME_FILES=/);
assert.match(builder, /lib\/\*\.js/);
assert.doesNotMatch(builder, /copy_tree lib/);
assert.doesNotMatch(builder, /copy_tree node_modules\/exifr/);
assert.match(builder, /plugin\.js/);
assert.match(builder, /manifest\.json/);
assert.match(builder, /node_modules\/exifr\/dist\/full\.umd\.js/);
assert.match(builder, /zip -X/);
assert.match(builder, /SHA256SUMS/);
assert.match(
  builder,
  /geo-tag-state\.json/,
  "the clean package contract must explicitly protect GPS/tag runtime state"
);
assert.match(installer, /legacy_team_backup_root="\$TARGET\/team-state-backups"/);
assert.match(installer, /durable_team_backup_root="\$STATE_ROOT\/team-state-backups"/);
assert.match(installer, /\[\[ -e "\$durable_team_backup" \]\] && continue/);

console.log("github release contract tests passed");
