const assert = require("node:assert/strict");
const test = require("node:test");
const adapters = require("../provider-adapters.js");

function model(provider, overrides = {}) {
  return {
    provider,
    pageUrl: `https://${provider}.example/post/1`,
    pageTitle: "Current post",
    meta: {},
    containers: [],
    ...overrides
  };
}

test("Weibo keeps only the proven current post image container and removes page chrome", () => {
  const result = adapters.collect(model("weibo", {
    pageUrl: "https://weibo.com/123/abc",
    containers: [
      { id: "current", owned: true, candidates: [
        { url: "https://wx1.sinaimg.cn/large/a.jpg", kind: "image", role: "post-image" },
        { url: "https://weibo.com/avatar.png", kind: "image", role: "avatar" }
      ] },
      { id: "recommend", owned: false, candidates: [
        { url: "https://wx1.sinaimg.cn/large/recommend.jpg", kind: "image", role: "post-image" }
      ] }
    ]
  }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.candidates.map((entry) => entry.url), ["https://wx1.sinaimg.cn/large/a.jpg"]);
});

test("ambiguous post ownership fails open instead of scanning the whole page", () => {
  const result = adapters.collect(model("weibo", {
    pageUrl: "https://weibo.com/123/abc",
    containers: [
      { id: "a", owned: true, candidates: [] },
      { id: "b", owned: true, candidates: [] }
    ]
  }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "CURRENT_CONTENT_AMBIGUOUS");
});

test("Bilibili exports the current cover and blocks an unproven split video", () => {
  const result = adapters.collect(model("bilibili", {
    pageUrl: "https://www.bilibili.com/video/BV1x",
    meta: {
      image: "https://i0.hdslb.com/bfs/archive/cover.jpg",
      video: "https://upos-sz-mirror.example/video.m4s"
    }
  }));
  assert.equal(result.ok, true);
  assert.equal(result.candidates[0].role, "video-cover");
  assert.equal(result.blocked[0].reason, "DASH_OR_AUDIO_UNVERIFIED");
});

test("Bilibili accepts page-exposed progressive durl but still reports DASH", () => {
  const result = adapters.collect(model("bilibili", {
    pageUrl: "https://www.bilibili.com/video/BV1x",
    meta: { image: "https://i0.hdslb.com/bfs/archive/cover.jpg@1280w_720h" },
    structured: {
      progressiveVideos: [{ url: "https://upos.example/video.flv", estimatedBytes: 123 }],
      hasDash: true
    }
  }));
  assert.equal(result.candidates.filter((entry) => entry.kind === "video").length, 1);
  assert.equal(result.candidates.find((entry) => entry.kind === "video").audioStatus, "requires-probe");
  assert.equal(result.blocked[0].reason, "DASH_OR_AUDIO_UNVERIFIED");
});

test("Bilibili blocks multi-segment durl instead of importing partial clips", () => {
  const result = adapters.collect(model("bilibili", {
    pageUrl: "https://www.bilibili.com/video/BV1x",
    structured: { progressiveVideos: [], hasSegmentedDurl: true }
  }));
  assert.equal(result.ok, false);
  assert.equal(result.blocked[0].reason, "DASH_OR_AUDIO_UNVERIFIED");
});

test("Douyin accepts only the current aweme progressive play address exposed in page data", () => {
  const result = adapters.collect(model("douyin", {
    pageUrl: "https://www.douyin.com/video/123",
    structured: {
      images: [{ url: "https://p3.douyinpic.com/current.webp" }],
      progressiveVideos: [{ url: "https://v3.douyinvod.com/current.mp4" }]
    }
  }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.candidates.map((entry) => entry.kind), ["image", "video"]);
  assert.equal(result.candidates[1].sourceEvidence, "provider-structured-data");
  assert.equal(result.candidates[1].audioStatus, "requires-probe");
});

test("Douyin search modal is a proven current work only when modal_id is numeric", () => {
  assert.equal(adapters.isDouyinDetailUrl("https://www.douyin.com/search/travel?modal_id=7654888554639756585"), true);
  assert.equal(adapters.isDouyinDetailUrl("https://www.douyin.com/search/travel?modal_id=not-an-id"), false);
  const accepted = adapters.collect(model("douyin", {
    pageUrl: "https://www.douyin.com/search/travel?modal_id=7654888554639756585",
    structured: { images: [{ url: "https://p3.douyinpic.com/current-modal.webp" }] }
  }));
  const rejected = adapters.collect(model("douyin", {
    pageUrl: "https://www.douyin.com/search/travel?modal_id=not-an-id",
    containers: [{ id: "centered-card", owned: true, candidates: [
      { url: "https://p3.douyinpic.com/search-result.webp", kind: "image", role: "post-image" }
    ] }]
  }));
  assert.equal(accepted.ok, true);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "CURRENT_CONTENT_NOT_PROVEN");
});

test("Douyin search and feed pages fail closed even when one card is visually centered", () => {
  for (const pageUrl of [
    "https://www.douyin.com/search/%E6%97%85%E8%A1%8C",
    "https://www.douyin.com/",
    "https://www.douyin.com/jingxuan"
  ]) {
    const result = adapters.collect(model("douyin", {
      pageUrl,
      containers: [{ id: "centered-card", owned: true, candidates: [
        { url: "https://p3.douyinpic.com/search-result.webp", kind: "image", role: "post-image" }
      ] }]
    }));
    assert.equal(result.ok, false, pageUrl);
    assert.equal(result.reason, "CURRENT_CONTENT_NOT_PROVEN", pageUrl);
  }
});

test("Weibo search and timeline pages fail closed instead of treating the centered card as the current post", () => {
  for (const pageUrl of [
    "https://s.weibo.com/weibo?q=travel",
    "https://weibo.com/u/123456",
    "https://weibo.com/"
  ]) {
    const result = adapters.collect(model("weibo", {
      pageUrl,
      containers: [{ id: "centered-card", owned: true, candidates: [
        { url: "https://wx1.sinaimg.cn/large/search-result.jpg", kind: "image", role: "post-image" }
      ] }]
    }));
    assert.equal(result.ok, false, pageUrl);
    assert.equal(result.reason, "CURRENT_CONTENT_NOT_PROVEN", pageUrl);
  }
});

test("YouTube only exports the current video thumbnail and blocks video download", () => {
  const result = adapters.collect(model("youtube", {
    pageUrl: "https://www.youtube.com/watch?v=abc",
    meta: {
      image: "https://i.ytimg.com/vi/abc/maxresdefault.jpg",
      video: "https://youtube.example/videoplayback"
    }
  }));
  assert.deepEqual(result.candidates.map((entry) => entry.role), ["video-cover"]);
  assert.equal(result.blocked[0].reason, "YOUTUBE_OFFICIAL_DOWNLOAD_ONLY");
});

test("YouTube home page metadata is not misreported as the current video cover", () => {
  const result = adapters.collect(model("youtube", {
    pageUrl: "https://www.youtube.com/",
    meta: { image: "https://www.youtube.com/logo.png" }
  }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "CURRENT_CONTENT_NOT_PROVEN");
});

test("Douyin collects only current post images and blocks blob/direct video without audio proof", () => {
  const result = adapters.collect(model("douyin", {
    pageUrl: "https://www.douyin.com/video/1",
    containers: [{ id: "current", owned: true, candidates: [
      { url: "https://p3-sign.douyinpic.com/a.webp", kind: "image", role: "post-image" },
      { url: "blob:https://www.douyin.com/1", kind: "video", role: "post-video" },
      { url: "https://v3.douyinvod.com/a.mp4", kind: "video", role: "post-video", audioStatus: "unknown" }
    ] }]
  }));
  assert.deepEqual(result.candidates.map((entry) => entry.kind), ["image"]);
  assert.deepEqual(result.blocked.map((entry) => entry.reason), ["BROWSER_BLOB", "DASH_OR_AUDIO_UNVERIFIED"]);
});

test("generic page mode requires a single proven content container", () => {
  const result = adapters.collect(model("generic", { containers: [] }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "CURRENT_CONTENT_NOT_PROVEN");
});

test("a direct video from one proven container proceeds to later container probing", () => {
  const result = adapters.collect(model("generic", {
    containers: [{ id: "current", owned: true, candidates: [{
      url: "https://media.example/download?id=42",
      kind: "video",
      role: "content-video",
      mediaCompleteness: "requires-probe",
      audioStatus: "requires-probe"
    }] }]
  }));
  assert.equal(result.ok, true);
  assert.equal(result.candidates[0].audioStatus, "requires-probe");
});
