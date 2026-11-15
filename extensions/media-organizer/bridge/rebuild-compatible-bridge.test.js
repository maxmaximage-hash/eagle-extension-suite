"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  applyBridgePatch,
  verifyPatchedTree,
  codesignVerify,
  helperRunning,
  startupEvidence,
  waitForStartup,
  installCandidateWithSignature,
  acceptsAuditedBridgeHash,
  BRIDGED_SHA256
} = require("./rebuild-compatible-bridge.js");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "eagle-bridge-fixture-"));
const pluginRoot = path.join(root, "app/js/plugin");
fs.mkdirSync(pluginRoot, { recursive: true });
fs.writeFileSync(
  path.join(pluginRoot, "api.js"),
  "global.eagle = {\n\tonLibraryChanged: (callback) => { pluginIPC.addCallback('library-changed', callback); },\n\tapp: {\n\t\ttheme: 'light'\n\t}\n};\n",
  "utf8"
);
fs.writeFileSync(
  path.join(pluginRoot, "index.js"),
  "function initIPC () {\n\n\tipcRenderer.on('enable-plugin', (e, pluginId) => {});\n}\n",
  "utf8"
);

try {
  applyBridgePatch(root);
  verifyPatchedTree(root);
  const api = fs.readFileSync(path.join(pluginRoot, "api.js"), "utf8");
  const index = fs.readFileSync(path.join(pluginRoot, "index.js"), "utf8");
  assert.match(api, /photoTakenSort/);
  assert.match(index, /photo-taken-sort\.execute/);
  assert.doesNotMatch(api, /onFolderCopyAction/);
  assert.doesNotMatch(api, /__eagleFolderCopyAction/);
  assert.doesNotMatch(index, /\n\+/);
  assert.equal(codesignVerify("/Applications/Eagle.app", () => {}), true);
  assert.equal(codesignVerify("/Applications/Eagle.app", () => { throw new Error("invalid"); }), false);
  assert.equal(acceptsAuditedBridgeHash(BRIDGED_SHA256), true);
  assert.equal(acceptsAuditedBridgeHash("unknown"), false);
  assert.equal(helperRunning(() => ({ status: 0 })), true);
  assert.equal(helperRunning(() => ({ status: 1 })), false);
  const logPath = path.join(root, "eagle.log");
  fs.writeFileSync(logPath, "[app] Library loaded\n[main] mainWindow is ready\n", "utf8");
  assert.equal(startupEvidence(logPath), true);
  assert.equal(startupEvidence(logPath, 0), true);
  assert.equal(typeof waitForStartup, "function");
  const target = path.join(root, "target.asar");
  const candidate = path.join(root, "candidate.asar");
  fs.writeFileSync(target, "original", "utf8");
  fs.writeFileSync(candidate, "candidate", "utf8");
  assert.equal(
    installCandidateWithSignature(target, "/Applications/Eagle.app", candidate, () => false),
    false
  );
  assert.equal(fs.readFileSync(target, "utf8"), "original");
  assert.equal(fs.existsSync(candidate), false);
  console.log("compatible bridge rebuild contract passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
