const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../core.js");

test("extracts note id from supported detail URLs", () => {
  assert.equal(core.extractNoteId("https://www.xiaohongshu.com/explore/abc123?x=1"), "abc123");
  assert.equal(core.extractNoteId("https://www.xiaohongshu.com/discovery/item/xyz789"), "xyz789");
});

test("normalizes a live photo into one static image", () => {
  const note = core.normalizeNote({
    noteId: "live-note",
    title: "夏日",
    desc: "完整正文",
    user: { nickname: "Max" },
    imageList: [{
      livePhoto: true,
      urlDefault: "https://sns-img-qc.xhscdn.com/photo.jpg"
    }]
  }, "https://www.xiaohongshu.com/explore/live-note");

  assert.equal(note.media.length, 1);
  assert.deepEqual(note.media.map(({ type, role, liveGroup }) => ({ type, role, liveGroup })), [
    { type: "image", role: "live-still", liveGroup: 1 }
  ]);
});

test("does not falsely mark an ordinary image as live", () => {
  const note = core.normalizeNote({ imageList: [{ urlPre: "https://sns-img.xhscdn.com/ordinary.webp" }] }, "https://www.xiaohongshu.com/explore/n1");
  assert.equal(note.media.length, 1);
  assert.equal(note.media[0].role, "image");
  assert.equal(note.media[0].liveGroup, null);
});

test("builds static Eagle items with body, source and live tag", () => {
  const note = {
    id: "n1", url: "https://www.xiaohongshu.com/explore/n1", title: "标题", description: "正文", author: "作者",
    media: [
      { url: "https://a/photo.jpg", type: "image", role: "live-still", liveGroup: 1 }
    ]
  };
  const items = core.buildEagleItems(note);
  assert.equal(items.length, 1);
  assert.ok(items.every((item) => item.tags.includes("Live:n1:1")));
  assert.ok(items.every((item) => item.annotation.includes("正文") && item.annotation.includes(note.url)));
  assert.match(items[0].name, /live01_photo/);
});

test("builds path-based Eagle items for converted JPEG files", () => {
  const item = core.buildEagleItem(
    { id: "n1", url: "https://www.xiaohongshu.com/explore/n1", title: "标题" },
    { url: "https://a/photo.heic", type: "image", role: "image", liveGroup: null },
    1,
    { path: "/tmp/photo.jpg" }
  );
  assert.equal(item.path, "/tmp/photo.jpg");
  assert.equal("url" in item, false);
  assert.equal("headers" in item, false);
});

test("deduplicates signed variants of the same media path", () => {
  const media = core.uniqueMedia([
    { type: "image", url: "https://a.xhscdn.com/a.jpg?token=one" },
    { type: "image", url: "https://a.xhscdn.com/a.jpg?token=two" }
  ]);
  assert.equal(media.length, 1);
});

test("counts live static images as one content item", () => {
  const summary = core.summarizeMedia([
    ...Array.from({ length: 9 }, (_, index) => ({ type: "image", liveGroup: null, url: `https://a/${index}.jpg` })),
    ...Array.from({ length: 8 }, (_, index) => ({ type: "image", role: "live-still", liveGroup: index + 1 }))
  ]);
  assert.deepEqual(summary, { contentCount: 17, fileCount: 17, liveCount: 8 });
});

test("builds a static-only import plan for live photos", () => {
  const note = { media: [
    { type: "image", role: "image", liveGroup: null },
    { type: "image", role: "live-still", liveGroup: 1 },
    { type: "video", role: "video", liveGroup: null }
  ] };
  const plan = core.buildImportPlan(note);
  assert.equal(plan.length, 2);
  assert.equal(plan[0].kind, "url");
  assert.equal(plan[1].kind, "url");
  assert.equal(plan[1].media.role, "live-still");
  assert.equal(plan.every((entry) => entry.media?.type === "image"), true);
});
