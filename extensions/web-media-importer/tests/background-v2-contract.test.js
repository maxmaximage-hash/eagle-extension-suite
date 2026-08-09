const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("MV3 background uses durable per-item processing and restart recovery", () => {
  const source = read("background.js");
  assert.match(source, /chrome\.runtime\.onStartup/);
  assert.match(source, /chrome\.downloads\.onChanged/);
  assert.match(source, /recoverQueues/);
  assert.match(source, /processNextEntry/);
  assert.doesNotMatch(source, /for \(const original of ready\)/);
  assert.match(source, /chrome\.storage\.session/);
  assert.match(source, /cancel-web-media-batch/);
  assert.match(source, /chrome\.downloads\.cancel/);
  assert.match(source, /chrome\.downloads\.resume/);
  assert.match(source, /classifyNetworkAccess/);
  assert.match(source, /requires-browser-validation/);
  assert.doesNotMatch(source, /chrome\.downloads\.download\([\s\S]*?headers\s*:/);
  assert.doesNotMatch(source, /Cookie|Authorization|Referer/i);
  assert.ok((source.match(/assertOrdinaryFolder\(/g) || []).length >= 3, "folder must be checked at creation, retry and acceptance");
  assert.match(source, /recheck-web-media-batch/);
  assert.match(source, /scheduleConfirmation/);
  assert.match(source, /confirmUnconfirmedEntry/);
  assert.match(source, /accepted_unconfirmed/);
  const recheckStart = source.indexOf("async function confirmUnconfirmedEntry");
  const recheckEnd = source.indexOf("async function recheckUnconfirmedBatch", recheckStart);
  assert.ok(recheckStart >= 0 && recheckEnd > recheckStart);
  assert.doesNotMatch(source.slice(recheckStart, recheckEnd), /addFromPath/);
});

test("download is validated before Eagle acceptance and cleanup only follows confirmation", () => {
  const source = read("background.js");
  assert.match(source, /validateDownloadItem/);
  assert.match(source, /type: "validated"/);
  assert.match(source, /type: "accepted_unconfirmed"/);
  assert.match(source, /type: "confirmed"/);
  assert.match(source, /item\/info/);
  assert.match(source, /String\(item\?\.id/);
  assert.match(source, /item\?\.isDeleted !== true/);
  assert.ok(source.indexOf("validateDownloadItem") < source.indexOf("/item/addFromPath"));
  assert.ok(source.indexOf('type: "confirmed"') < source.indexOf("scheduleCleanup"));
  assert.doesNotMatch(source, /scheduleCleanup\(download\.id\)/);
});

test("runtime package includes provider adapters and version 2 candidate", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const packageJson = JSON.parse(read("package.json"));
  const packageScript = read("scripts/package-stable.sh");
  assert.equal(manifest.version, "2.1.0");
  assert.equal(packageJson.version, "2.1.0");
  assert.match(JSON.stringify(manifest.content_scripts), /structured-media\.js/);
  assert.match(JSON.stringify(manifest.content_scripts), /provider-adapters\.js/);
  assert.match(packageScript, /provider-adapters\.js/);
  assert.match(packageScript, /structured-media\.js/);
});

test("content model uses provider registry and requires explicit batch confirmation", () => {
  const source = read("content.js");
  assert.match(source, /EagleWebMediaProviders\.collect/);
  assert.match(source, /CURRENT_CONTENT_AMBIGUOUS/);
  assert.match(source, /data-confirm/);
  assert.match(source, /estimated/);
});
