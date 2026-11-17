"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const release = path.resolve(process.argv[2] || path.join(root, "releases/eagle-suite-v20261117-suite-sync-1"));
const registry = JSON.parse(fs.readFileSync(path.join(release, "PLUGIN-REGISTRY.json"), "utf8"));
const sources = ["eagle-workbench", "media-organizer", "live-photo-manager", "live-photo-inspector", "avatar-source-publisher", "online-publisher/eagle-plugin"];
assert.equal(registry.plugins.length, sources.length);
for (const source of sources) {
  const directory = path.join(root, "extensions", source);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  const entry = registry.plugins.find((item) => item.id === manifest.id);
  assert.ok(entry, `missing plugin: ${manifest.id}`);
  assert.equal(entry.version, manifest.version, `${manifest.id} version must match current source`);
  const archive = path.join(release, entry.asset);
  const packaged = JSON.parse(execFileSync("unzip", ["-p", archive, "manifest.json"], { encoding: "utf8" }));
  assert.equal(packaged.id, manifest.id);
  assert.equal(packaged.version, manifest.version);
  const entries = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" }).split("\n");
  const main = manifest.main?.url || manifest.preview?.livp?.inspector?.path;
  assert.ok(main && entries.includes(main.replace(/^\.\//, "")), `${manifest.id} main/preview entry missing`);
  for (const filename of entries) {
    assert.doesNotMatch(filename, /(^\/|(^|\/)\.\.\/|app\.asar|(^|\/)(?:PluginData|backups?|recovery|\.git|\.env)(?:\/|$)|(?:photo-taken-cache|geo-tag-state|rename-batch-backup|delivery-templates)\.json$|\.library(?:\/|$))/i);
  }
  if (source === "eagle-workbench") {
    for (const filename of ["delivery.js", "delivery-entry.js"]) {
      assert.ok(entries.includes(filename), `workbench missing runtime dependency ${filename}`);
    }
  }
  if (source === "media-organizer") {
    assert.ok(entries.includes("lib/delivery-template-core.js"));
  }
}
for (const directory of ["instagram-post-importer", "xiaohongshu-post-importer", "web-media-importer"]) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "extensions", directory, "manifest.json"), "utf8"));
  const entry = registry.browserExtensions.find((item) => item.name === manifest.name);
  assert.ok(entry, `missing browser extension ${directory}`);
  assert.equal(entry.version, manifest.version);
  const packaged = JSON.parse(execFileSync("unzip", ["-p", path.join(release, entry.asset), "manifest.json"], { encoding: "utf8" }));
  assert.equal(packaged.version, manifest.version);
}
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
for (const filename of walk(release)) assert.doesNotMatch(filename, /app\.asar(?:$|\.)|\.library(?:\/|$)/i);
execFileSync("shasum", ["-a", "256", "-c", "SHA256SUMS"], { cwd: release, stdio: "pipe" });
// Standard ZIP readers must resolve Chinese installer filenames exactly.
execFileSync("python3", ["-c", `
from pathlib import Path
import sys, zipfile
release = Path(sys.argv[1])
with zipfile.ZipFile(str(release) + ".zip") as archive:
    for filename in release.rglob("*"):
        if filename.is_file():
            name = str(filename.relative_to(release.parent))
            assert archive.read(name) == filename.read_bytes(), name
`, release], { stdio: "pipe" });
console.log(`Eagle suite release verified: ${registry.release}, ${registry.plugins.length} Eagle plugins, ${registry.browserExtensions.length} browser extensions`);
