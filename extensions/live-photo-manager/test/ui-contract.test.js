"use strict";

const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

test("exposes exactly the three user-facing Live Photo export destinations", () => {
  const root = path.resolve(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const exportActions = [...html.matchAll(/data-export="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(exportActions, ["image", "movie", "livp"]);
  assert.match(html, /导出静态照片（HEIC\/JPG）/);
  assert.match(html, /导出 MOV/);
  assert.match(html, /导出完整 Live Photo（LIVP）/);
  assert.match(html, /选择源目录/);
  assert.doesNotMatch(html, /导入苹果照片|发布包|批量同步/);
});
