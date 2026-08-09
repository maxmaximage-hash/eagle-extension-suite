"use strict";

const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

test("vendored pairing core matches the iCloud workbench source of truth", () => {
  const extensionRoot = path.resolve(__dirname, "..");
  const vendored = path.join(extensionRoot, "lib", "vendor", "live-package.js");
  const source = path.resolve(extensionRoot, "..", "..", "tools", "icloud-intake-workbench", "lib", "live-package.js");
  assert.equal(fs.readFileSync(vendored, "utf8"), fs.readFileSync(source, "utf8"));
});
