const assert = require("node:assert/strict");
const test = require("node:test");
const structured = require("../structured-media.js");

test("extracts only Bilibili progressive durl and reports DASH without executing script", () => {
  const script = `window.__playinfo__={"data":{"durl":[{"url":"https://upos.example/video.flv","size":99}],"dash":{"video":[]}}};window.after=true`;
  const result = structured.extractBilibili(["unrelated", script]);
  assert.deepEqual(result.progressiveVideos, [{ url: "https://upos.example/video.flv", estimatedBytes: 99 }]);
  assert.equal(result.hasDash, true);
  assert.equal(global.window, undefined);
});

test("a malformed playinfo marker does not hide a later valid Bilibili payload", () => {
  const result = structured.extractBilibili([
    "const note = '__playinfo__={not-json}';",
    'window.__playinfo__={"data":{"durl":[{"url":"https://upos.example/video.mp4","size":12}]}};'
  ]);
  assert.deepEqual(result.progressiveVideos, [{ url: "https://upos.example/video.mp4", estimatedBytes: 12 }]);
});

test("an empty earlier playinfo object does not hide a later Bilibili media payload", () => {
  const result = structured.extractBilibili([
    'window.__playinfo__={"data":{}};',
    'window.__playinfo__={"data":{"durl":[{"url":"https://upos.example/video.mp4","size":21}]}};'
  ]);
  assert.deepEqual(result.progressiveVideos, [{ url: "https://upos.example/video.mp4", estimatedBytes: 21 }]);
});

test("Bilibili multi-segment durl is never represented as several complete videos", () => {
  const result = structured.extractBilibili([
    'window.__playinfo__={"data":{"durl":[{"url":"https://upos.example/part-1.flv","size":10},{"url":"https://upos.example/part-2.flv","size":20}]}};'
  ]);
  assert.deepEqual(result.progressiveVideos, []);
  assert.equal(result.hasSegmentedDurl, true);
});

test("extracts only the Douyin aweme matching the current URL id", () => {
  const render = encodeURIComponent(JSON.stringify({ app: {
    feed: [
      { aweme_id: "other", images: [{ url_list: ["https://p3.douyinpic.com/other.webp"] }] },
      {
        aweme_id: "123",
        images: [{ display_image: { url_list: ["https://p3.douyinpic.com/current.webp"], data_size: 10 } }],
        video: { play_addr: { url_list: ["https://v3.douyinvod.com/current.mp4"], data_size: 20 } }
      }
    ]
  } }));
  const result = structured.extractDouyin(render, "123");
  assert.deepEqual(result.images, [{ url: "https://p3.douyinpic.com/current.webp", estimatedBytes: 10 }]);
  assert.deepEqual(result.progressiveVideos, [{ url: "https://v3.douyinvod.com/current.mp4", estimatedBytes: 20 }]);
});

test("malformed or oversized structured data fails open", () => {
  assert.deepEqual(structured.extractBilibili(["window.__playinfo__={bad}"]), {});
  assert.deepEqual(structured.extractDouyin("not-json", "123"), {});
  assert.deepEqual(structured.extractDouyin("x".repeat(8_000_001), "123"), {});
});
