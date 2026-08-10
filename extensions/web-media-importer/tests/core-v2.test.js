const assert = require("node:assert/strict");
const test = require("node:test");
const core = require("../core.js");

function mp4Box(type, ...payloads) {
  const payload = Buffer.concat(payloads.map((value) => Buffer.from(value)));
  const box = Buffer.alloc(8 + payload.length);
  box.writeUInt32BE(box.length, 0);
  box.write(type, 4, 4, "ascii");
  payload.copy(box, 8);
  return box;
}

function mp4Handler(type) {
  return mp4Box("hdlr", Buffer.alloc(8), Buffer.from(type, "ascii"));
}

test("candidate kind cannot disguise a login HTML URL as a video", () => {
  const classified = core.classifyCandidate({
    url: "https://example.com/login",
    kind: "video"
  });
  assert.equal(classified.ok, false);
  assert.equal(classified.reason, "UNVERIFIED_MEDIA_URL");
});

test("trusted structured image with a transformed suffix is provisional until MIME validation", () => {
  const result = core.classifyCandidate({
    url: "https://i0.hdslb.com/bfs/archive/cover.jpg@1280w_720h",
    kind: "image",
    sourceEvidence: "structured-metadata"
  });
  assert.equal(result.ok, true);
  assert.equal(result.type, "image");
  assert.equal(result.extension, "jpg");
});

test("explicit stream and split-track evidence is blocked before download", () => {
  for (const candidate of [
    { url: "blob:https://www.bilibili.com/1", kind: "video" },
    { url: "https://cdn.example/master.m3u8", kind: "video" },
    { url: "https://cdn.example/manifest.mpd", kind: "video" },
    { url: "https://cdn.example/video.mp4", kind: "video", mediaCompleteness: "dash-split" },
    { url: "https://cdn.example/video.mp4", kind: "video", audioStatus: "unknown" }
  ]) {
    assert.equal(core.classifyCandidate(candidate).ok, false);
  }
});

test("active SVG and disguised executable media are blocked", () => {
  for (const candidate of [
    { url: "https://cdn.example/payload.svg", kind: "image" },
    { url: "https://cdn.example/asset", kind: "image", mimeHint: "image/svg+xml", sourceEvidence: "structured-metadata" }
  ]) {
    assert.deepEqual(core.classifyCandidate(candidate), { ok: false, reason: "ACTIVE_MEDIA_BLOCKED" });
  }
  assert.equal(core.validateDownloadItem(
    { type: "image", extension: "" },
    { state: "complete", mime: "image/svg+xml", fileSize: 32, danger: "safe", filename: "/tmp/a.bin" }
  ).reason, "ACTIVE_MEDIA_BLOCKED");
});

test("transformed and query-formatted CDN URLs get a safe filename extension before download", () => {
  assert.equal(core.extensionForUrl("https://i0.hdslb.com/cover.jpg@1280w_720h"), "jpg");
  assert.equal(core.extensionForUrl("https://images.example/render?id=1&format=webp"), "webp");
  assert.equal(core.extensionForUrl("https://images.example/render?id=1&format=html"), "");
});

test("MP4 video is accepted only when the container proves both video and audio tracks", () => {
  const videoTrack = mp4Box("trak", mp4Box("mdia", mp4Handler("vide")));
  const audioTrack = mp4Box("trak", mp4Box("mdia", mp4Handler("soun")));
  const complete = mp4Box("moov", videoTrack, audioTrack);
  assert.deepEqual(core.inspectIsoBmffTracks(complete), {
    ok: true, hasMoov: true, hasVideo: true, hasAudio: true, reason: ""
  });
  const silent = core.inspectIsoBmffTracks(mp4Box("moov", videoTrack));
  assert.equal(silent.ok, false);
  assert.equal(silent.reason, "AUDIO_TRACK_NOT_FOUND");
  assert.equal(core.inspectIsoBmffTracks(Buffer.from("not-an-mp4")).reason, "MP4_MOOV_NOT_FOUND");
});

test("Bilibili progressive FLV requires a container header that declares both streams", () => {
  const complete = Buffer.from([0x46, 0x4c, 0x56, 0x01, 0x05, 0x00, 0x00, 0x00, 0x09]);
  assert.deepEqual(core.inspectFlvStreams(complete), {
    ok: true, hasVideo: true, hasAudio: true, reason: ""
  });
  assert.equal(core.inspectFlvStreams(Buffer.from([0x46, 0x4c, 0x56, 0x01, 0x01, 0, 0, 0, 9])).reason, "AUDIO_TRACK_NOT_FOUND");
  assert.equal(core.inspectFlvStreams(Buffer.from("not-flv")).reason, "FLV_HEADER_NOT_FOUND");
});

test("download validation rejects HTML, JSON, zero byte, dangerous and type mismatch", () => {
  const entry = { type: "video", extension: "mp4", maxBytes: 1024 };
  const cases = [
    [{ state: "complete", mime: "text/html", fileSize: 10, danger: "safe", filename: "/tmp/a.mp4" }, "DOWNLOAD_HTML"],
    [{ state: "complete", mime: "application/json", fileSize: 10, danger: "safe", filename: "/tmp/a.mp4" }, "DOWNLOAD_JSON"],
    [{ state: "complete", mime: "video/mp4", fileSize: 0, danger: "safe", filename: "/tmp/a.mp4" }, "DOWNLOAD_EMPTY"],
    [{ state: "complete", mime: "video/mp4", fileSize: 10, danger: "dangerous", filename: "/tmp/a.mp4" }, "DOWNLOAD_DANGEROUS"],
    [{ state: "complete", mime: "video/mp4", fileSize: 10, danger: "accepted", filename: "/tmp/a.mp4" }, "DOWNLOAD_DANGEROUS"],
    [{ state: "complete", mime: "image/jpeg", fileSize: 10, danger: "safe", filename: "/tmp/a.mp4" }, "DOWNLOAD_TYPE_MISMATCH"],
    [{ state: "complete", mime: "video/mp4", fileSize: 2048, danger: "safe", filename: "/tmp/a.mp4" }, "ITEM_SIZE_LIMIT"]
  ];
  for (const [item, reason] of cases) {
    const result = core.validateDownloadItem(entry, item);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
  }
});

test("network policy uses Chrome-managed context and flags registered cross-site CDNs for real validation", () => {
  assert.deepEqual(core.classifyNetworkAccess({
    provider: "bilibili",
    pageUrl: "https://www.bilibili.com/video/BV1?token=SECRET"
  }, "https://upos-sz-mirror08c.bilivideo.com/a.m4s?deadline=1"), {
    ok: true,
    mode: "browser-managed",
    requiresBrowserValidation: true,
    pageOrigin: "https://www.bilibili.com"
  });
  assert.deepEqual(core.classifyNetworkAccess({
    provider: "generic",
    pageUrl: "https://example.com/post/1"
  }, "https://evil.example.net/file.jpg"), { ok: false, reason: "NETWORK_ORIGIN_NOT_ALLOWED" });
  assert.equal(core.classifyNetworkAccess({
    provider: "youtube",
    pageUrl: "https://www.youtube.com/watch?v=abc"
  }, "https://i.ytimg.com/vi/abc/maxresdefault.jpg").ok, true);
  assert.doesNotMatch(JSON.stringify(core.classifyNetworkAccess({
    provider: "douyin",
    pageUrl: "https://www.douyin.com/video/1?token=SECRET"
  }, "https://v3.douyinvod.com/a.mp4")), /SECRET|Cookie|Authorization|Referer/);
});

test("an explicitly right-clicked HTTPS image may use an unrelated public CDN without widening page scans", () => {
  assert.deepEqual(core.classifyNetworkAccess({
    provider: "generic",
    pageUrl: "https://news.example.com/article/1",
    sourceEvidence: "user-selected-media"
  }, "https://images.other-cdn.net/photo.webp?width=1600"), {
    ok: true,
    mode: "browser-managed",
    requiresBrowserValidation: true,
    pageOrigin: "https://news.example.com"
  });

  assert.deepEqual(core.classifyNetworkAccess({
    provider: "generic",
    pageUrl: "https://news.example.com/article/1",
    sourceEvidence: "dom-media-element"
  }, "https://images.other-cdn.net/photo.webp"), {
    ok: false,
    reason: "NETWORK_ORIGIN_NOT_ALLOWED"
  });

  for (const privateUrl of [
    "https://localhost/photo.jpg",
    "https://127.0.0.1/photo.jpg",
    "https://192.168.1.8/photo.jpg",
    "https://100.64.0.1/photo.jpg",
    "https://198.18.0.1/photo.jpg",
    "https://203.0.113.5/photo.jpg",
    "https://[::1]/photo.jpg",
    "https://[::ffff:127.0.0.1]/photo.jpg",
    "https://[fd00::1]/photo.jpg",
    "https://[fe80::1]/photo.jpg",
    "http://images.other-cdn.net/photo.jpg"
  ]) {
    assert.equal(core.classifyNetworkAccess({
      provider: "generic",
      pageUrl: "https://news.example.com/article/1",
      sourceEvidence: "user-selected-media"
    }, privateUrl).ok, false);
  }
  assert.equal(core.classifyNetworkAccess({
    provider: "generic", pageUrl: "http://192.168.1.8/gallery", sourceEvidence: "dom-media-element"
  }, "http://192.168.1.8/photo.jpg").ok, false);

  assert.equal(core.classifyNetworkAccess({
    provider: "generic",
    pageUrl: "https://news.example.com/article/1",
    sourceEvidence: "user-selected-media",
    type: "video"
  }, "https://video.other-cdn.net/file.mp4").ok, false);

  for (const ordinaryPublicHostname of ["https://fcdn.example/photo.jpg", "https://feed80.example/photo.jpg"]) {
    assert.equal(core.classifyNetworkAccess({
      provider: "generic",
      pageUrl: "https://news.example.com/article/1",
      sourceEvidence: "user-selected-media"
    }, ordinaryPublicHostname).ok, true);
  }

  assert.equal(core.classifyNetworkAccess({
    provider: "generic", pageUrl: "http://legacy.example/article", sourceEvidence: "dom-media-element"
  }, "http://legacy.example/photo.jpg").ok, true);
  assert.equal(core.classifyNetworkAccess({
    provider: "generic", pageUrl: "https://secure.example/article", sourceEvidence: "dom-media-element"
  }, "http://secure.example/photo.jpg").ok, false);
});

test("real MIME safely names extensionless files and rejects conflicting known extensions", () => {
  const extensionless = core.validateDownloadItem(
    { type: "image", extension: "" },
    { state: "complete", mime: "image/webp", fileSize: 32, danger: "safe", filename: "/tmp/no-extension" }
  );
  assert.equal(extensionless.ok, true);
  assert.equal(extensionless.extension, "webp");

  const mismatch = core.validateDownloadItem(
    { type: "image", extension: "jpg" },
    { state: "complete", mime: "image/png", fileSize: 32, danger: "safe", filename: "/tmp/a.jpg" }
  );
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.reason, "DOWNLOAD_EXTENSION_MISMATCH");
});

test("durable queue has explicit validated, confirmed and accepted_unconfirmed states", () => {
  let queue = core.createQueue({ id: "q", entries: [{ id: "a" }, { id: "b" }] });
  for (const type of ["download_starting", "downloading", "downloaded", "validated", "submitting", "accepted", "confirmed"]) {
    queue = core.applyQueueEvent(queue, { type, entryId: "a", downloadId: 7, path: "/tmp/a.jpg", eagleItemIds: ["E1"] });
  }
  for (const type of ["download_starting", "downloading", "downloaded", "validated", "submitting", "accepted", "accepted_unconfirmed"]) {
    queue = core.applyQueueEvent(queue, { type, entryId: "b", downloadId: 8, path: "/tmp/b.jpg" });
  }
  const repeated = core.applyQueueEvent(queue, { type: "confirmed", entryId: "a", eagleItemIds: ["E1"] });
  assert.equal(repeated.entries[0].state, "confirmed");
  assert.equal(repeated.entries[1].state, "accepted_unconfirmed");
  assert.equal(repeated.summary.confirmed, 1);
  assert.equal(repeated.summary.accepted_unconfirmed, 1);
});

test("worker death at Chrome or Eagle handoff becomes non-retryable uncertainty instead of duplicate work", () => {
  assert.deepEqual(core.recoveryAction({ state: "download_starting" }), {
    action: "uncertain", reason: "DOWNLOAD_HANDOFF_UNKNOWN"
  });
  assert.deepEqual(core.recoveryAction({ state: "submitting" }), {
    action: "uncertain", reason: "EAGLE_SUBMISSION_UNKNOWN"
  });
  let queue = core.createQueue({ entries: [{ id: "a" }, { id: "b", state: "validated" }] });
  queue = core.applyQueueEvent(queue, { entryId: "a", type: "download_starting" });
  queue = core.applyQueueEvent(queue, {
    entryId: "a", type: "download_unknown", code: "DOWNLOAD_HANDOFF_UNKNOWN", message: "需要核对"
  });
  queue = core.applyQueueEvent(queue, { entryId: "a", type: "pending" });
  queue = core.applyQueueEvent(queue, { entryId: "b", type: "submitting" });
  queue = core.applyQueueEvent(queue, {
    entryId: "b", type: "submission_unknown", code: "EAGLE_SUBMISSION_UNKNOWN", message: "需要核对"
  });
  queue = core.applyQueueEvent(queue, { entryId: "b", type: "validated" });
  assert.deepEqual(queue.entries.map((entry) => entry.state), ["download_unknown", "submission_unknown"]);
  assert.equal(queue.summary.download_unknown, 1);
  assert.equal(queue.summary.submission_unknown, 1);
});

test("cancellation covers the Chrome handoff state before a download ID exists", () => {
  const queue = core.createQueue({ entries: [{ id: "a", state: "download_starting" }] });
  const cancelled = core.cancelQueue(queue);
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.entries[0].state, "cancelled");
  assert.equal(cancelled.summary.cancelled, 1);
});

test("slow Eagle confirmation retries the same accepted item without changing its identity", () => {
  assert.equal(core.TERMINAL_STATES.has("accepted_unconfirmed"), false);
  let queue = core.createQueue({ entries: [{
    id: "a", state: "accepted_unconfirmed", eagleItemIds: ["E1"], downloadId: 7
  }] });
  queue = core.applyQueueEvent(queue, {
    type: "accepted_unconfirmed", entryId: "a", confirmationAttempts: 4
  });
  assert.equal(queue.entries[0].confirmationAttempts, 4);
  assert.deepEqual(queue.entries[0].eagleItemIds, ["E1"]);
  queue = core.applyQueueEvent(queue, { type: "confirmed", entryId: "a", eagleItemIds: ["E1"] });
  assert.equal(queue.entries[0].state, "confirmed");
  assert.deepEqual(queue.entries[0].eagleItemIds, ["E1"]);
});

test("service worker recovery resolves interrupted, resumable and completed downloads", () => {
  assert.deepEqual(core.recoveryAction({ state: "downloading", downloadId: 1 }, null), { action: "fail", reason: "DOWNLOAD_RECORD_MISSING" });
  assert.deepEqual(core.recoveryAction(
    { state: "downloading", downloadId: 1 },
    { state: "interrupted", canResume: true }
  ), { action: "resume" });
  assert.deepEqual(core.recoveryAction(
    { state: "downloading", downloadId: 1 },
    { state: "interrupted", canResume: false }
  ), { action: "fail", reason: "DOWNLOAD_INTERRUPTED" });
  assert.deepEqual(core.recoveryAction(
    { state: "downloading", downloadId: 1 },
    { state: "complete" }
  ), { action: "validate" });
});

test("cancellation is idempotent and never rolls back accepted or confirmed entries", () => {
  let queue = core.createQueue({ entries: [
    { id: "pending", state: "pending" },
    { id: "active", state: "downloading" },
    { id: "accepted", state: "accepted" },
    { id: "confirmed", state: "confirmed" }
  ] });
  queue = core.cancelQueue(queue);
  const repeated = core.cancelQueue(queue);
  assert.deepEqual(repeated.entries.map((entry) => entry.state), ["cancelled", "cancelled", "accepted", "confirmed"]);
  assert.equal(repeated.summary.cancelled, 2);
});

test("persistent queue strips full media paths and signed URLs but preserves a session credential reference", () => {
  const entry = {
    id: "a",
    url: "https://cdn.example/a.jpg?token=SECRET&width=1200",
    canonicalUrl: "https://cdn.example/a.jpg?token=SECRET&width=1200",
    pageUrl: "https://weibo.com/1?access_token=PRIVATE",
    requestRef: "credential:q:a"
  };
  const stored = core.toPersistentEntry(entry);
  assert.equal(stored.requestRef, "credential:q:a");
  assert.doesNotMatch(JSON.stringify(stored), /SECRET|PRIVATE/);
  assert.equal(stored.url, undefined);
  assert.equal(stored.redactedUrl, undefined);
  assert.equal(stored.mediaOrigin, "https://cdn.example");
});

test("OAuth and SSO query credentials never enter Eagle provenance", () => {
  const redacted = core.redactUrl("https://example.com/callback?code=AUTHCODE&state=STATE&ticket=TICKET&id=42");
  assert.equal(redacted, "https://example.com/callback?id=42");
});

test("1.x accepted queues migrate to unconfirmed without retaining signed URLs", () => {
  const migrated = core.migrateLegacyQueue({ id: "old", entries: [{
    id: "a", state: "accepted", url: "https://cdn.example/a.jpg?token=SECRET",
    pageUrl: "https://example.com/post?access_token=PRIVATE"
  }] });
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.entries[0].state, "accepted_unconfirmed");
  assert.doesNotMatch(JSON.stringify(migrated), /SECRET|PRIVATE/);
});

test("batch limits enforce item count and estimated aggregate bytes", () => {
  const result = core.buildBatchPlan([
    { url: "https://cdn.example/a.jpg", kind: "image", estimatedBytes: 60 },
    { url: "https://cdn.example/b.jpg", kind: "image", estimatedBytes: 60 },
    { url: "https://cdn.example/c.jpg", kind: "image", estimatedBytes: 10 }
  ], { maxItems: 3, maxBatchBytes: 100 });
  assert.equal(result.ready.length, 2);
  assert.deepEqual(result.skipped.map((item) => item.reason), ["BATCH_SIZE_LIMIT"]);
});

test("hostile page text and URLs cannot inflate persistent queue records without bounds", () => {
  const tooLong = core.classifyCandidate({ url: `https://cdn.example/${"a".repeat(9000)}.jpg`, kind: "image" });
  assert.deepEqual(tooLong, { ok: false, reason: "URL_TOO_LONG" });
  const plan = core.buildBatchPlan([
    { url: "https://cdn.example/a.jpg", kind: "image", label: "x".repeat(5000) }
  ], { pageUrl: "https://example.com/post", pageTitle: "y".repeat(5000) });
  assert.equal(plan.ready[0].label.length, 500);
  assert.equal(plan.pageTitle.length, 500);
});
