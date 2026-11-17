"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const registry = require(path.join(root, "registry.js"));
const delivery = require(path.join(root, "delivery.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const packageSource = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.equal(manifest.id, "com.max.eagle-workbench");
assert.equal(manifest.version, "2.1");
assert.equal(packageJson.version, "2.1");
assert.equal(manifest.version, registry.WORKBENCH_VERSION);
assert.equal(registry.WORKBENCH_DISPLAY_VERSION, "2.1");
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
assert.equal(deliveryCopyModule.displayVersion, "1.6");
assert.ok(sortingModule.changelog.some((entry) => entry.startsWith("2.6 版本")));
assert.equal(sortingModule.entry, undefined);
assert.equal(renameModule.entry, undefined);
assert.equal(sortingModule.packageName, "Eagle 布局面板");
assert.equal(renameModule.packageName, "Eagle 布局面板");
assert.equal(deliveryCopyModule.entry.action, "delivery");
assert.equal(registry.MODULES.find((module) => module.name === "地点与元数据标签").entry.pluginId, "com.max.eagle-photo-taken-sort");
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
assert.match(html, /deliveryOverlay/);
assert.match(html, /deliveryTemplateBody/);
assert.match(html, />2\.1</);
assert.doesNotMatch(html, /\d+\.\d+\.\d+/);
assert.doesNotMatch(appSource, /eagle\.plugin\.run/);
assert.match(appSource, /openPlugin/);
assert.match(appSource, /open-module/);
assert.match(appSource, /open-delivery/);
assert.match(appSource, /scanDeliveryFolder/);
assert.match(appSource, /localStorage/);
assert.match(appSource, /deliveryText/);
assert.match(appSource, /open-delivery/);
assert.match(appSource, /scanDeliveryFolder/);
assert.match(appSource, /localStorage/);
assert.match(packageSource.scripts.package, /delivery\.js/);
assert.match(appSource, /sendTo\(parentId, "open-plugin"/);
assert.match(appSource, /workbench-entry-request\.json/);
assert.match(appSource, /getPath\("userData"\)/);
assert.match(appSource, /basename\(normalizedUserDataPath\)/);
assert.match(appSource, /userDataRoot/);
assert.match(appSource, /delivery-templates\.json/);
assert.match(appSource, /activeTemplateId/);
assert.match(appSource, /hydrateSharedDeliveryConfig/);
assert.match(appSource, /基本功能/);
assert.match(appSource, /版本日志/);
assert.doesNotMatch(appSource, /eagle\.item\.(add|update|move|remove)/);
assert.doesNotMatch(appSource, /watermark/i, "workbench must not embed watermark business rules");
assert.doesNotMatch(appSource, /apply.*rename/i, "workbench must not embed rename business rules");

const stats = delivery.calculateDeliveryStats([
  { id: "a", name: "第一组", items: [{ name: "1-场景1.jpg" }, { name: "2-场景1.jpg" }, { name: " 1_场景1-备用.jpg" }] },
  { id: "b", name: "第二组", items: [{ name: "2.场景2.jpg" }] }
]);
assert.equal(stats.actualGroups, 2);
assert.equal(stats.actualGroupsWithPeople, 1);
assert.equal(stats.actualGroupsWithoutPeople, 1);
assert.equal(stats.actualPeopleCount, 2);
assert.equal(stats.actualEnvironmentCount, 2);
const values = delivery.deliveryValues(delivery.DEFAULT_TEMPLATES[0], stats, "测试文件夹", "https://pan.quark.cn/s/test");
const rendered = delivery.renderTemplate("{folderName} {actualGroups} {actualPeopleCount} {extraGroups} {quarkLink}", values);
assert.equal(rendered, "测试文件夹 2 2 0 https://pan.quark.cn/s/test");
assert.equal(values.standardPublishGroups, 9);

console.log("eagle workbench tests passed");
