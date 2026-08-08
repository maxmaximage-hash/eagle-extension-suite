"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const pluginRoot = path.join(__dirname, "..");
const repositoryRoot = path.join(pluginRoot, "..", "..");
const read = (root, relativePath) => fs.readFileSync(
  path.join(root, relativePath),
  "utf8"
);

const boundaries = read(repositoryRoot, "docs/EAGLE-EXTENSION-MODULE-BOUNDARIES.md");
const architecture = read(pluginRoot, "docs/SORTING-TARGET-ARCHITECTURE.md");
const ledger = read(pluginRoot, "docs/SORTING-BUG-LEDGER.md");
const matrix = read(pluginRoot, "docs/SORTING-BEHAVIOR-TEST-MATRIX.md");
const migration = read(pluginRoot, "docs/SORTING-MIGRATION-PLAN.md");
const moduleBoundaries = read(pluginRoot, "docs/SORTING-MODULE-BOUNDARIES.md");
const baseline = read(pluginRoot, "docs/FROZEN-BASELINE-2026-07-23.md");
const rootAgents = read(repositoryRoot, "AGENTS.md");
const pluginAgents = read(pluginRoot, "AGENTS.md");

for (const marker of [
  "L0：Eagle 原生主权",
  "A：排序与重命名",
  "B：媒体处理与线上发布",
  "C：GPS/元数据标签",
  "网格外拖放归 Eagle",
  "真实 Eagle 测试必须经用户再次批准"
]) {
  assert.ok(boundaries.includes(marker), "module boundary must retain: " + marker);
}

for (let level = 0; level <= 8; level += 1) {
  assert.ok(architecture.includes("L" + level), "architecture must retain L" + level);
}
for (const marker of [
  "唯一业务数据流",
  "唯一事实源",
  "FinalVisibleOrder",
  "Protection 是纯 guard",
  "dragstart",
  "停止 A 后 listener、observer、timer、"
]) {
  assert.ok(architecture.includes(marker), "architecture must retain: " + marker);
}

for (let index = 1; index <= 34; index += 1) {
  const id = "R" + String(index).padStart(2, "0");
  assert.match(ledger, new RegExp("\\| " + id + " \\|"), id + " must remain in bug ledger");
}
assert.ok(ledger.includes("当前 2.5.21/API 77 不得打包为新发布"));

for (const marker of [
  "连续拖动 20 次",
  "锁开关各 10 次",
  "网格外拖放",
  "全部/未知上下文",
  "不扫描整库",
  "真实 Eagle 最终验收",
  "R34 在本次发布口径下关闭",
  "接受残余风险"
]) {
  assert.ok(matrix.includes(marker), "behavior matrix must retain: " + marker);
}

for (const marker of [
  "本阶段不直接删除",
  "批次 1：A 生命周期与事件 ownership",
  "批次 4：唯一编号与改名事务",
  "不触碰真实 Library",
  "下一次批准只处理批次 1"
]) {
  assert.ok(migration.includes(marker), "migration plan must retain: " + marker);
}

for (const marker of [
  "HostPort（显式回调）",
  "dragstart",
  "ControlledUnavailableError",
  "R34 原生拖出仍是红灯",
  "R21 自动编号执行链尚未迁移"
]) {
  assert.ok(moduleBoundaries.includes(marker), "module boundary doc must retain: " + marker);
}

for (const marker of [
  "2.5.21",
  "API 77",
  "media-organizer-before-api77-native-drag-20260723-175140",
  "R34 的真实 UI 验收结论是",
  "未通过"
]) {
  assert.ok(baseline.includes(marker), "frozen baseline must retain: " + marker);
}

for (const source of [rootAgents, pluginAgents]) {
  for (const marker of [
    "SORTING-BUG-LEDGER.md",
    "先写失败测试",
    "真实 Eagle",
    "不得安装",
    "不得操作真实 Library"
  ]) {
    assert.ok(source.includes(marker), "AGENTS gate must retain: " + marker);
  }
}

const packageJson = JSON.parse(read(pluginRoot, "package.json"));
assert.ok(
  packageJson.scripts.test.includes("test/governance-contract.test.js"),
  "npm test must execute governance contract gate"
);

console.log("governance contract tests passed");
