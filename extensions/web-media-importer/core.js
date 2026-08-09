(function attachWebMediaImporterCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.EagleWebMediaCore = api;
})(typeof globalThis === "object" ? globalThis : this, function createWebMediaImporterCore() {
  "use strict";

  const IMAGE_EXTENSIONS = new Set([
    "avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"
  ]);
  const VIDEO_EXTENSIONS = new Set([
    "3gp", "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "webm", "wmv"
  ]);
  const STREAM_EXTENSIONS = new Set(["m3u8", "mpd"]);

  function cleanText(value, fallback = "") {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text || fallback;
  }

  function canonicalUrl(value) {
    const source = String(value || "").trim();
    if (!source) return "";
    try {
      const parsed = new URL(source);
      parsed.hash = "";
      return parsed.toString();
    } catch {
      return source.replace(/#.*/, "");
    }
  }

  function redactUrl(value) {
    try {
      const parsed = new URL(String(value || ""));
      parsed.username = "";
      parsed.password = "";
      for (const key of [...parsed.searchParams.keys()]) {
        if (/^(?:utm_.+|x-amz-.+|x-goog-.+|access_token|token|auth|authorization|credential|expires?|key|password|policy|secret|session|signature|sig)$/i.test(key)) {
          parsed.searchParams.delete(key);
        }
      }
      parsed.hash = "";
      return parsed.toString();
    } catch {
      return "";
    }
  }

  function extensionForUrl(value) {
    try {
      const parsed = new URL(String(value || ""));
      const match = parsed.pathname.toLowerCase().match(/\.([a-z0-9]{2,8})$/);
      return match ? match[1] : "";
    } catch {
      const match = String(value || "").toLowerCase().replace(/[?#].*$/, "").match(/\.([a-z0-9]{2,8})$/);
      return match ? match[1] : "";
    }
  }

  function classifyCandidate(candidate = {}) {
    const url = String(candidate.url || "").trim();
    if (!url) return { ok: false, reason: "EMPTY_URL" };
    if (/^blob:/i.test(url)) return { ok: false, reason: "BROWSER_BLOB" };
    if (/^data:/i.test(url)) return { ok: false, reason: "DATA_URL" };
    if (!/^https?:/i.test(url)) return { ok: false, reason: "UNSUPPORTED_SCHEME" };
    const extension = extensionForUrl(url);
    if (STREAM_EXTENSIONS.has(extension)) return { ok: false, reason: "STREAM_MANIFEST" };
    const suppliedType = String(candidate.kind || "").toLowerCase();
    const type = IMAGE_EXTENSIONS.has(extension)
      ? "image"
      : VIDEO_EXTENSIONS.has(extension)
        ? "video"
        : suppliedType === "image" || suppliedType === "video"
          ? suppliedType
          : "";
    if (!type) return { ok: false, reason: "UNKNOWN_MEDIA_TYPE" };
    return {
      ok: true,
      url,
      canonicalUrl: canonicalUrl(url),
      type,
      extension: extension || (type === "video" ? "mp4" : "jpg")
    };
  }

  function normalizeLimit(value) {
    const limit = Number(value);
    return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 80;
  }

  function slug(value, fallback) {
    const result = cleanText(value, fallback)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);
    return result || fallback;
  }

  function buildBatchPlan(candidates = [], options = {}) {
    const pageUrl = canonicalUrl(options.pageUrl || "");
    const pageTitle = cleanText(options.pageTitle, "网页素材");
    const provider = slug(options.provider || "web", "web");
    const limit = normalizeLimit(options.maxItems);
    const ready = [];
    const skipped = [];
    const seen = new Set();
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
      const classified = classifyCandidate(candidate);
      if (!classified.ok) {
        skipped.push({ ...candidate, reason: classified.reason });
        continue;
      }
      const identity = `${classified.type}:${classified.canonicalUrl}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      if (ready.length >= limit) {
        skipped.push({ ...candidate, reason: "BATCH_LIMIT" });
        continue;
      }
      ready.push({
        id: `${provider}-${ready.length + 1}-${slug(classified.canonicalUrl, "media")}`,
        sequence: ready.length + 1,
        url: classified.url,
        canonicalUrl: classified.canonicalUrl,
        type: classified.type,
        extension: classified.extension,
        label: cleanText(candidate.label, `${pageTitle}-${ready.length + 1}`),
        pageUrl,
        pageTitle,
        provider
      });
    }
    return { ready, skipped, limit, pageUrl, pageTitle, provider };
  }

  function buildCacheFilename(entry = {}) {
    const sequence = String(Math.max(1, Number(entry.sequence) || 1)).padStart(4, "0");
    return `${sequence}-${slug(entry.label, "media")}.${String(entry.extension || "bin").toLowerCase()}`;
  }

  function toEagleItem(entry = {}, filePath) {
    const source = redactUrl(entry.pageUrl || entry.url || "");
    const mediaSource = redactUrl(entry.url || "");
    return {
      path: String(filePath || ""),
      name: cleanText(entry.label, `网页素材-${entry.sequence || 1}`),
      url: source,
      tags: ["网页导入", `来源:${slug(entry.provider, "web")}`, entry.type === "video" ? "网页视频" : "网页图片"],
      annotation: `来源：${source}\n原始媒体：${mediaSource}\n导入方式：浏览器网页媒体导入器`
    };
  }

  function isSelectableFolder(folder = {}) {
    if (!String(folder.id || "")) return false;
    if (folder.isSmartFolder === true || folder.isSmart === true) return false;
    const type = String(folder.type || folder.kind || "").toLowerCase();
    return type !== "smart" && type !== "smart-folder" && type !== "smartfolder";
  }

  function summarize(entries = []) {
    const summary = { pending: 0, downloading: 0, downloaded: 0, accepted: 0, failed: 0, skipped: 0 };
    for (const entry of entries) {
      const key = String(entry.state || "pending");
      if (Object.hasOwn(summary, key)) summary[key] += 1;
    }
    return summary;
  }

  function createQueue({ id, entries = [], folderId = "", createdAt = Date.now() } = {}) {
    return {
      id: String(id || `batch-${createdAt}`),
      folderId: String(folderId || ""),
      createdAt,
      entries: entries.map((entry) => ({ ...entry, state: entry.state || "pending", error: null })),
      summary: summarize(entries)
    };
  }

  function applyQueueEvent(queue, event = {}) {
    const eventType = String(event.type || "");
    const entryId = String(event.entryId || "");
    const entries = (queue?.entries || []).map((entry) => {
      if (String(entry.id || "") !== entryId) return entry;
      if (entry.state === "accepted" && eventType === "accepted") return entry;
      if (eventType === "downloading") return { ...entry, state: "downloading", error: null };
      if (eventType === "downloaded") return { ...entry, state: "downloaded", path: String(event.path || ""), error: null };
      if (eventType === "accepted") return { ...entry, state: "accepted", eagleItemIds: Array.isArray(event.eagleItemIds) ? event.eagleItemIds : [], error: null };
      if (eventType === "failed") return { ...entry, state: "failed", error: { code: String(event.code || "FAILED"), message: cleanText(event.message, "导入失败") } };
      if (eventType === "skipped") return { ...entry, state: "skipped", error: { code: String(event.code || "SKIPPED"), message: cleanText(event.message, "已跳过") } };
      return entry;
    });
    return { ...queue, entries, summary: summarize(entries), updatedAt: Date.now() };
  }

  return {
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    applyQueueEvent,
    buildBatchPlan,
    buildCacheFilename,
    canonicalUrl,
    classifyCandidate,
    createQueue,
    extensionForUrl,
    isSelectableFolder,
    redactUrl,
    toEagleItem
  };
});
