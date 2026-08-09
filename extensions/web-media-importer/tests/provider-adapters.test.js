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
  assert.equal(result.candidates.find((entry) => entry.kind === "video").audioStatus, "present");
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
