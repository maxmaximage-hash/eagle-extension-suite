"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const registry = require(path.join(root, "registry.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.equal(manifest.id, "com.max.eagle-workbench");
assert.equal(manifest.version, "1.4");
assert.equal(packageJson.version, "1.4");
assert.equal(manifest.version, registry.WORKBENCH_VERSION);
assert.equal(registry.WORKBENCH_DISPLAY_VERSION, "1.4");
assert.match(manifest.version, /^\d+\.\d+$/);
assert.doesNotMatch(manifest.version, /^\d+\.\d+\.\d+/);
assert.equal(manifest.name, "Eagle 工作台");
assert.equal(manifest.main.url, "index.html");
assert.equal(registry.MODULES.length, 9);
const sortingModule = registry.MODULES.find((module) => module.name === "排序与自动编号");
const renameModule = registry.MODULES.find((module) => module.name === "人物与环境图重命名");
const deliveryCopyModule = registry.MODULES.find((module) => module.name === "交付文案生成");
assert.equal(sortingModule.displayVersion, "2.6");
assert.equal(renameModule.displayVersion, "1.0");
assert.match(renameModule.description, /人物图/);
assert.match(renameModule.description, /环境图/);
assert.ok(renameModule.changelog.some((entry) => entry.includes("人物图")));
assert.ok(renameModule.changelog.some((entry) => entry.includes("环境图")));
assert.equal(deliveryCopyModule.displayVersion, "1.0");
assert.ok(sortingModule.changelog.some((entry) => entry.startsWith("2.6 版本")));
const ids = new Set(registry.MODULES.map((module) => module.id));
assert.equal(ids.size, registry.MODULES.length, "module ids must be unique");
for (const module of registry.MODULES) {
  assert.ok(module.name && module.version && module.category && module.description);
  assert.ok(module.typeLabel);
  assert.ok(Array.isArray(module.changelog) && module.changelog.length > 0);
  assert.match(module.displayVersion, /^\d+\.\d+$/);
  if (!module.id.startsWith("chrome:") && !module.sourceVersion) {
    const sourceManifest = JSON.parse(fs.readFileSync(path.resolve(root, module.manifestPath), "utf8"));
    assert.equal(module.version, sourceManifest.version, `${module.name} version must match manifest`);
  }
  if (module.sourceVersion) {
    const sourceManifest = JSON.parse(fs.readFileSync(path.resolve(root, module.manifestPath), "utf8"));
    assert.equal(module.sourceVersion, sourceManifest.version, `${module.name} source version must match manifest`);
  }
}
for (const module of registry.MODULES.filter((item) => item.id.startsWith("chrome:"))) {
  const sourceManifest = JSON.parse(fs.readFileSync(path.resolve(root, module.manifestPath), "utf8"));
  assert.equal(module.version, sourceManifest.version, `${module.name} version must match manifest`);
}
assert.equal(registry.MODULES.find((module) => module.name === "Live Photo 管家").typeLabel, "后台服务");
assert.equal(registry.MODULES.find((module) => module.name === "头像共享源").category, "后台服务");
assert.match(html, /扩展版本总览/);
assert.match(html, />1\.4</);
assert.doesNotMatch(html, /\d+\.\d+\.\d+/);
assert.doesNotMatch(appSource, /eagle\.plugin\.run/);
assert.doesNotMatch(appSource, /入口|已安装登记/);
assert.doesNotMatch(appSource, /<button|addEventListener/);
assert.match(appSource, /基本功能/);
assert.match(appSource, /版本日志/);
assert.doesNotMatch(appSource, /eagle\.item\.(add|update|move|remove)/);
assert.doesNotMatch(appSource, /sort|rename|watermark/i, "workbench must not embed business rules");

console.log("eagle workbench tests passed");
