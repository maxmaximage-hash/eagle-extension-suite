"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.join(__dirname, "..");

test("inspector targets LIVP and exposes the right-side inspector", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  assert.equal(manifest.main, undefined);
  assert.equal(manifest.preview.livp.inspector.path, "index.html");
  assert.equal(manifest.preview.livp.inspector.multiSelect, false);
});

test("inspector renders static-photo fields and reads selected Eagle items", () => {
  const source = fs.readFileSync(path.join(ROOT, "renderer.js"), "utf8");
  for (const token of ["eagle.item.getSelected", "eagle.drag.startDrag", "拖出静态照片", "静态照片原始信息", "拍摄时间", "拍摄地点", "相机", "镜头"]) {
    assert.match(source, new RegExp(token));
  }
});

test("drag instruction explains the immediate move and release gesture", () => {
  const source = fs.readFileSync(path.join(ROOT, "renderer.js"), "utf8");
  assert.match(source, /点击按钮后立即移动鼠标到 Finder、Photoshop 或桌面并松开/);
  assert.match(source, /网格卡片直接拖出仍按 Eagle 原生方式处理/);
});

test("inspector exposes a one-click static export to Downloads", () => {
  const source = fs.readFileSync(path.join(ROOT, "renderer.js"), "utf8");
  for (const token of ["导出静态照片到下载", "MAX Live Photo Exports", "copyFileSync", "open", "避免覆盖"]) {
    assert.match(source, new RegExp(token));
  }
});
