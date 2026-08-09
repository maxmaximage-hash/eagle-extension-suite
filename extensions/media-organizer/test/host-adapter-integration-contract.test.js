"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "plugin.js"),
  "utf8"
);

assert.match(
  source,
  /api\.getCollectionSnapshot/,
  "the injected host boundary must expose a collection snapshot"
);
assert.match(
  source,
  /api\.writeManualView/,
  "the injected host boundary must expose manual-view writes"
);
assert.match(
  source,
  /api\.requestHostConfirmation/,
  "the injected host boundary must expose host confirmations"
);
assert.match(
  source,
  /getCollectionSnapshot\?\.\(/,
  "outer host port must read the injected collection snapshot"
);
assert.doesNotMatch(
  source,
  /sorting host snapshot adapter is not available/,
  "the production facade cannot be wired to a permanent unavailable stub"
);

console.log("host adapter integration contract tests passed");
