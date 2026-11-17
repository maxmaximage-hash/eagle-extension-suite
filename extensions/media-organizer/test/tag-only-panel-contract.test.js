"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const source = fs.readFileSync(path.join(root, "plugin.js"), "utf8");

// The tag window has one product owner. Removing its unrelated controls must
// not remove the separate native-layout implementation from the service.
for (const forbidden of [
  /id="copy-folder-current"/,
  /id="folder-copy-target"/,
  /id="public-rename-[^"]*"/,
  /id="public-delivery-[^"]*"/,
  /id="public-sort-[^"]*"/,
  /id="(?:publish|export|import)-team-state"/,
  /人物图与环境图重命名|交付文案|多级排序预览|团队排序与展示状态|复制文件夹（含内容）/
]) {
  assert.doesNotMatch(html, forbidden, "the tag window must not expose another product's controls");
}

for (const id of [
  "geo-enabled", "scan-current", "confirm-auto-locations", "apply-review-tag",
  "folder-tag-input", "apply-folder-tag", "scan-existing", "retry-exceptions"
]) {
  assert.ok(html.includes(`id="${id}"`), `tag control ${id} must remain available`);
}

assert.match(source, /function openDeliveryCopyModal\(/, "native layout delivery modal must remain");
assert.match(source, /selectedPeopleRename: "人物图重命名"/, "native layout people rename must remain");
assert.match(source, /selectedEnvironmentRename: "环境图重命名"/, "native layout environment rename must remain");
console.log("tag-only panel contract tests passed");
