"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const destination = path.join(root, "releases", "MAX头像共享源-v1.0.0.eagleplugin");
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.rmSync(destination, { force: true });
childProcess.execFileSync("zip", ["-qr", destination, "manifest.json", "index.html", "plugin.js", "lib", "contracts"], {
  cwd: root,
  stdio: "inherit"
});
console.log(destination);
