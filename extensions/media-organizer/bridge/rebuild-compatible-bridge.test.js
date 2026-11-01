"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { applyBridgePatch, verifyPatchedTree } = require("./rebuild-compatible-bridge.js");

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
  assert.doesNotMatch(index, /\n\+/);
  console.log("compatible bridge rebuild contract passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
