const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("browser importer is user-triggered, supports direct web media and never edits Eagle internals", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const background = read("background.js");
  const content = read("content.js");
  const popup = read("popup.js");
  const popupHtml = read("popup.html");
  const source = `${background}\n${content}`;

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "2.2.0");
  assert.match(manifest.description, /网页图片/);
  assert.deepEqual(Object.keys(manifest.icons).sort(), ["16", "32", "48", "128"].sort());
  assert.equal(manifest.action.default_icon["32"], "icons/icon-32.png");
  assert.ok(manifest.permissions.includes("contextMenus"));
  assert.ok(manifest.permissions.includes("downloads"));
  assert.ok(manifest.host_permissions.includes("<all_urls>"));
  assert.ok(manifest.host_permissions.includes("http://127.0.0.1:41595/*"));
  assert.match(background, /item\/addFromPath/);
  assert.match(background, /folder\/list/);
  assert.match(background, /Eagle-Web-Media-Cache/);
  assert.match(background, /chrome\.alarms/);
  assert.match(background, /retry-web-media-batch/);
  assert.match(background, /open-web-media-collector/);
  assert.match(background, /CLEANUP_DELAY_MINUTES\s*=\s*24\s*\*\s*60/);
  assert.match(background, /scheduleCleanup\(queue\.id, entry\.id, entry\.downloadId\)/);
  assert.match(background, /type:\s*"accepted"/);
  assert.match(background, /assertOrdinaryFolder/);
  assert.match(background, /isSelectableFolder/);
  assert.match(popup, /open-web-media-collector/);
  assert.doesNotMatch(popup, /chrome\.tabs\.sendMessage/);
  assert.match(`${popupHtml}\n${popup}`, /网页图片，右键就能保存/);
  assert.match(`${popupHtml}\n${popup}`, /扫描当前帖子\/页面/);
  assert.match(`${popupHtml}\n${popup}`, /为什么有些内容不能保存/);
  assert.match(`${popupHtml}\n${popup}`, /当前视频只保存封面/);
  assert.match(`${popupHtml}\n${popup}`, /需要你确认后才会导入/);
  assert.match(popup, /重试失败项/);
  assert.match(source, /保存当前帖子\/内容至 Eagle/);
  assert.match(source, /保存当前媒体至 Eagle/);
  assert.match(background, /selectedKind:\s*String\(info\.mediaType/);
  assert.match(background, /sourcePageUrl:\s*String\(tab\.url/);
  assert.match(content, /request\.selectedKind/);
  assert.match(content, /searchParams\.get\("modal_id"\)/);
  assert.match(content, /attachShadow/);
  assert.match(content, /aria-live/);
  assert.match(background, /item\?\.state === "interrupted"/);
  assert.ok(background.indexOf("scheduleCleanup(queue.id") > background.indexOf('type: "confirmed"'));
  assert.doesNotMatch(source, /app\.asar|\.library/);
});

test("release package excludes tests, project records and generated state", () => {
  const packageScript = read("scripts/package-stable.sh");
  assert.match(packageScript, /manifest\.json/);
  assert.match(packageScript, /core\.js/);
  assert.match(packageScript, /provider-adapters\.js/);
  assert.match(packageScript, /background\.js/);
  assert.match(packageScript, /content\.js/);
  assert.match(packageScript, /popup\.html/);
  assert.match(packageScript, /popup\.js/);
  assert.match(packageScript, /popup\.css/);
  assert.match(packageScript, /icons/);
  assert.match(packageScript, /zip\s+-q\s+-X\s+-r/);
  assert.match(packageScript, /touch\s+-t\s+202608090000/);
  assert.doesNotMatch(packageScript, /tests\//);
  assert.doesNotMatch(packageScript, /PROJECT\.md|TASKS\.md|DECISIONS\.md/);
});

test("right-clicking one media item cannot widen into every image in its article or main container", () => {
  const content = read("content.js");
  const selectedGate = content.indexOf('if (request.mode === "selected" && selectedUrl)');
  const containerScan = content.indexOf("const selectors = provider");
  assert.ok(selectedGate > 0, "selected-media mode needs an explicit early gate");
  assert.ok(selectedGate < containerScan, "selected-media gate must run before article/main enumeration");
  const selectedBranch = content.slice(selectedGate, containerScan);
  assert.match(selectedBranch, /candidateForSelected\(request, selectedElement\)/);
  assert.match(selectedBranch, /structured:\s*\{\}/);
});
