"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.join(__dirname, "..", "macos", "用 Photoshop 打开 Live Photo 封面.app");

test("macOS helper declares LIVP document ownership and an executable handler", () => {
  const plist = fs.readFileSync(path.join(ROOT, "Contents", "Info.plist"), "utf8");
  assert.match(plist, /com\.max\.eagle-live-photo/);
  assert.match(plist, /<string>livp<\/string>/);
  assert.ok(fs.statSync(path.join(ROOT, "Contents", "MacOS", "live-photo-photoshop")).isFile());
  assert.ok(fs.statSync(path.join(ROOT, "Contents", "Resources", "open-handler.js")).isFile());
});

