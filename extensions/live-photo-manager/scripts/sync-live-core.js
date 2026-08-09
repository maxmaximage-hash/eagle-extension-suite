#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const extensionRoot = path.resolve(__dirname, "..");
const source = path.resolve(extensionRoot, "..", "..", "tools", "icloud-intake-workbench", "lib", "live-package.js");
const target = path.join(extensionRoot, "lib", "vendor", "live-package.js");

if (!fs.existsSync(source)) throw new Error(`Shared Live Photo core is missing: ${source}`);
fs.copyFileSync(source, target);
process.stdout.write(`Synced ${path.relative(extensionRoot, target)}\n`);
