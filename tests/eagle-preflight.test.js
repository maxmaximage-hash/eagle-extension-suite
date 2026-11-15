"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "eagle-preflight.sh");

function runPreflight(directory, extra = []) {
  const asarHash = "2cc26ff90634d612833e00647c6df9a3c00c5ed09cbfa9e46ac75fae95fcb4fb";
  const hostsHash = "081ef9d5367595d16e30b4b4549d9f43537320508b4ce0788963e10e4f808857";
  return childProcess.spawnSync(
    "zsh",
    [SCRIPT, "--eagle-app", path.join(directory, "Eagle.app"), "--plugins-root", path.join(directory, "Plugins"), "--hosts-file", path.join(directory, "hosts"), "--clash-config", path.join(directory, "config.json"), "--expected-asar-sha256", asarHash, "--expected-hosts-sha256", hostsHash, "--skip-dns", ...extra],
    { encoding: "utf8" },
  );
}

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "eagle-preflight-"));
  fs.mkdirSync(path.join(directory, "Eagle.app", "Contents", "Resources"), { recursive: true });
  fs.writeFileSync(path.join(directory, "Eagle.app", "Contents", "Resources", "app.asar"), "official-fixture");
  fs.mkdirSync(path.join(directory, "Plugins", "com.example.good"), { recursive: true });
  fs.writeFileSync(path.join(directory, "Plugins", "com.example.good", "manifest.json"), JSON.stringify({ id: "com.example.good" }));
  fs.writeFileSync(path.join(directory, "hosts"), "127.0.0.1 localhost\n");
  fs.writeFileSync(path.join(directory, "config.json"), JSON.stringify({ dns: { "fake-ip-filter": ["eagle.cool", "*.eagle.cool"] } }));
  return directory;
}

test("preflight passes a clean fixture without mutating it", () => {
  const directory = fixture();
  const before = fs.readFileSync(path.join(directory, "hosts"), "utf8");
  const result = runPreflight(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS/);
  assert.equal(fs.readFileSync(path.join(directory, "hosts"), "utf8"), before);
});

test("preflight blocks an unexcluded Eagle Fake-IP config", () => {
  const directory = fixture();
  fs.writeFileSync(path.join(directory, "config.json"), JSON.stringify({ dns: { "fake-ip-filter": ["*.lan"] } }));
  const result = runPreflight(directory);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Fake-IP|eagle\.cool/i);
});

test("preflight blocks a plugin symlink that escapes the plugin root", () => {
  const directory = fixture();
  fs.symlinkSync(os.tmpdir(), path.join(directory, "Plugins", "escape"));
  const result = runPreflight(directory);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /plugin|插件|outside|越界/i);
});

test("preflight blocks an app.asar mismatch when a baseline is supplied", () => {
  const directory = fixture();
  const result = runPreflight(directory, ["--expected-asar-sha256", "0000000000000000000000000000000000000000000000000000000000000000"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /app\.asar|指纹|hash/i);
});

test("preflight blocks when the official app.asar and hosts baselines are omitted", () => {
  const directory = fixture();
  const result = childProcess.spawnSync(
    "zsh",
    [SCRIPT, "--eagle-app", path.join(directory, "Eagle.app"), "--plugins-root", path.join(directory, "Plugins"), "--hosts-file", path.join(directory, "hosts"), "--clash-config", path.join(directory, "config.json"), "--skip-dns"],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /基线|baseline|指纹|fingerprint/i);
});
