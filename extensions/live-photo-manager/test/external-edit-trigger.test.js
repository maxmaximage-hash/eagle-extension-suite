"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

test("background plugin run uses the selected native LIVP as the external edit trigger", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "plugin.js"), "utf8");
  assert.match(source, /eagle\.item\.getSelected\(\)/);
  assert.match(source, /startExternalCoverEdit\(liveItem\.id\)/);
  assert.match(source, /exportLivePackageComponents\(item\.filePath/);
  assert.match(source, /registerNativeItem\(ledger/);
  assert.match(source, /no-live-photo/);
  assert.match(source, /diagnostic-opened/);
  assert.match(source, /function startEditPolling\(\)/);
  assert.match(source, /startEditPolling\(\);\n    \/\/ The native service/);
  assert.match(source, /function stopEditPolling\(\)/);
});

