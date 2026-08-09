const assert = require("node:assert/strict");
const test = require("node:test");
const core = require("../core.js");

test("deduplicates direct page media while preserving the first visible order", () => {
  const result = core.buildBatchPlan([
    { url: "https://cdn.example.com/a.jpg?token=1#preview", kind: "image", label: "A" },
    { url: "https://cdn.example.com/a.jpg?token=1", kind: "image", label: "A duplicate" },
    {
      url: "https://cdn.example.com/b.mp4", kind: "video", label: "B",
      mediaCompleteness: "single-file-complete", audioStatus: "present"
    }
  ], { pageUrl: "https://example.com/post/1", pageTitle: "A post" });

  assert.equal(result.ready.length, 2);
  assert.equal(result.skipped.length, 0);
  assert.deepEqual(result.ready.map((item) => item.sequence), [1, 2]);
  assert.equal(result.ready[1].type, "video");
});

test("refuses streams, browser blobs and unknown sources instead of reporting a fake success", () => {
  const result = core.buildBatchPlan([
    { url: "blob:https://www.example.com/123", kind: "video" },
    { url: "https://cdn.example.com/master.m3u8", kind: "video" },
    { url: "https://cdn.example.com/manifest.mpd", kind: "video" },
    { url: "data:image/png;base64,abc", kind: "image" },
    { url: "https://cdn.example.com/no-extension", kind: "unknown" }
  ]);

  assert.equal(result.ready.length, 0);
  assert.deepEqual(
    result.skipped.map((item) => item.reason),
    ["BROWSER_BLOB", "STREAM_MANIFEST", "STREAM_MANIFEST", "DATA_URL", "UNVERIFIED_MEDIA_URL"]
  );
});

test("caps an accidental whole-page batch and leaves the remainder explicitly unstarted", () => {
  const entries = Array.from({ length: 4 }, (_, index) => ({
    url: `https://cdn.example.com/${index}.jpg`,
    kind: "image"
  }));
  const result = core.buildBatchPlan(entries, { maxItems: 2 });

  assert.equal(result.ready.length, 2);
  assert.deepEqual(result.skipped.map((item) => item.reason), ["BATCH_LIMIT", "BATCH_LIMIT"]);
});

test("allows only ordinary Eagle folders as an import destination", () => {
  assert.equal(core.isSelectableFolder({ id: "normal", name: "素材" }), true);
  assert.equal(core.isSelectableFolder({ id: "smart", name: "未标记", isSmartFolder: true }), false);
  assert.equal(core.isSelectableFolder({ id: "smart-type", type: "smart" }), false);
  assert.equal(core.isSelectableFolder({ id: "", name: "无效" }), false);
});

test("builds an Eagle item with provenance and a stable cache filename", () => {
  const entry = core.buildBatchPlan([
    {
      url: "https://cdn.example.com/path/film.mp4?expires=1", kind: "video", label: "Film",
      mediaCompleteness: "single-file-complete", audioStatus: "present"
    }
  ], { pageUrl: "https://example.com/p/7", pageTitle: "My page", provider: "instagram" }).ready[0];
  const item = core.toEagleItem(entry, "/Users/test/Downloads/Eagle-Web-Media-Cache/0001-film.mp4");

  assert.equal(item.path, "/Users/test/Downloads/Eagle-Web-Media-Cache/0001-film.mp4");
  assert.equal(item.url, "https://example.com/p/7");
  assert.match(item.annotation, /来源：https:\/\/example\.com\/p\/7/);
  assert.ok(item.tags.includes("网页导入"));
  assert.ok(item.tags.includes("来源:instagram"));
  assert.equal(core.buildCacheFilename(entry), "0001-film.mp4");
});

test("redacts signed credentials before provenance is written into a shared Eagle item", () => {
  const entry = core.buildBatchPlan([
    { url: "https://cdn.example.com/file.jpg?width=1600&token=secret&expires=999&X-Amz-Signature=AWSSECRET", kind: "image" }
  ], {
    pageUrl: "https://example.com/post/7?utm_source=feed&access_token=private",
    pageTitle: "Shared item"
  }).ready[0];
  const item = core.toEagleItem(entry, "/tmp/file.jpg");

  assert.doesNotMatch(item.annotation, /secret|private/i);
  assert.doesNotMatch(item.url, /access_token/);
  assert.match(item.annotation, /来源：https:\/\/example\.com\/post\/7/);
  assert.doesNotMatch(item.annotation, /原始媒体/);
});

test("legacy acceptance migrates to explicit unconfirmed state and retains failures for retry", () => {
  const initial = core.createQueue({ id: "batch-1", entries: [{ id: "a" }, { id: "b" }] });
  const downloaded = core.applyQueueEvent(initial, { type: "downloaded", entryId: "a", path: "/tmp/a.jpg" });
  const validated = core.applyQueueEvent(downloaded, { type: "validated", entryId: "a", path: "/tmp/a.jpg" });
  const accepted = core.applyQueueEvent(validated, { type: "accepted", entryId: "a", eagleItemIds: [] });
  const unconfirmed = core.applyQueueEvent(accepted, { type: "accepted_unconfirmed", entryId: "a" });
  const failed = core.applyQueueEvent(unconfirmed, { type: "failed", entryId: "b", code: "NETWORK", message: "offline" });
  const repeated = core.applyQueueEvent(failed, { type: "accepted_unconfirmed", entryId: "a" });

  assert.equal(repeated.entries[0].state, "accepted_unconfirmed");
  assert.equal(repeated.entries[1].state, "failed");
  assert.equal(repeated.entries[1].error.code, "NETWORK");
  assert.equal(repeated.summary.accepted_unconfirmed, 1);
  assert.equal(repeated.summary.imported, undefined);
  assert.equal(repeated.summary.failed, 1);
});
