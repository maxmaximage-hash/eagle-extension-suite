"use strict";

const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

test("exposes exactly the three user-facing output destinations", () => {
  const root = path.resolve(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const exportActions = [...html.matchAll(/data-export="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(exportActions, ["photos", "image", "movie"]);
  assert.match(html, /导入苹果照片（Live）/);
  assert.match(html, /导出静态 JPG/);
  assert.match(html, /导出 MOV/);
  assert.doesNotMatch(html, /发布包|批量同步|导出 Eagle LIVP/);
});
