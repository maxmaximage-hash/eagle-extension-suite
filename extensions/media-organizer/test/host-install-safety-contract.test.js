"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const bridgeInstaller = path.join(root, "bridge", "install-compatible-bridge.sh");
const currentInstaller = path.join(root, "scripts", "install-github-release.sh");
const releaseInstallers = fs.readdirSync(path.join(root, "releases"))
  .filter((name) => name.startsWith("install-") && name.endsWith(".sh"))
  .map((name) => path.join(root, "releases", name));

const bridgeSource = fs.readFileSync(bridgeInstaller, "utf8");
const currentSource = fs.readFileSync(currentInstaller, "utf8");

assert.match(
  bridgeSource,
  /历史 bridge 安装器已永久禁用/,
  "legacy bridge installer must fail closed"
);
assert.doesNotMatch(bridgeSource, /\b(cp|mv|ditto)\b.*app\.asar/i);
assert.doesNotMatch(bridgeSource, /TARGET=.*app\.asar/i);

for (const file of releaseInstallers) {
  const source = fs.readFileSync(file, "utf8");
  if (/qa\.9[89]/.test(file)) {
    assert.match(source, /--install-plugin-only/);
    assert.match(source, /original-unbridged-plugin-only/);
    assert.doesNotMatch(source, /\b(cp|mv|ditto)\b.*app\.asar/i);
    assert.doesNotMatch(source, /TARGET=.*app\.asar/i);
    continue;
  }
  assert.match(source, /历史发行包安装器已永久禁用/);
  assert.doesNotMatch(source, /\b(cp|mv|ditto)\b.*app\.asar/i);
  assert.doesNotMatch(source, /TARGET=.*app\.asar/i);
}

assert.match(currentSource, /--install-plugin-only/);
assert.match(currentSource, /当前是原始未桥接宿主；只允许 --install-plugin-only/);
assert.match(currentSource, /original-unbridged-plugin-only/);
assert.doesNotMatch(currentSource, /--install-bridge/);
assert.doesNotMatch(currentSource, /\b(cp|mv|ditto)\b.*app\.asar/i);
assert.doesNotMatch(currentSource, /Contents\/Resources\/app\.asar[^\n]*(?:>|>>)/i);

console.log("host install safety contract tests passed");
