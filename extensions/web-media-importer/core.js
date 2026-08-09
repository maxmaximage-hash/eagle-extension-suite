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
    "3gp", "avi", "flv", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "webm", "wmv"
  ]);
  const STREAM_EXTENSIONS = new Set(["m3u8", "mpd", "m4s"]);
  // accepted_unconfirmed stays non-terminal so it cannot be evicted before a
  // delayed NAS/Eagle read-back succeeds or the user reviews it.
  const TERMINAL_STATES = new Set(["confirmed", "failed", "blocked", "cancelled", "skipped"]);
  const SUMMARY_STATES = [
    "pending", "downloading", "downloaded", "validated", "accepted", "accepted_unconfirmed",
    "confirmed", "failed", "blocked", "cancelled", "skipped"
  ];
  const MIME_EXTENSIONS = {
    "image/avif": "avif", "image/bmp": "bmp", "image/gif": "gif", "image/heic": "heic",
    "image/heif": "heif", "image/jpeg": "jpg", "image/png": "png", "image/svg+xml": "svg",
    "image/tiff": "tiff", "image/webp": "webp", "video/3gpp": "3gp", "video/mp4": "mp4",
    "video/mpeg": "mpeg", "video/quicktime": "mov", "video/webm": "webm", "video/x-flv": "flv",
    "video/x-msvideo": "avi"
  };
  const TRUSTED_EVIDENCE = new Set([
    "dom-media-element", "provider-structured-data", "structured-metadata", "user-selected-media"
  ]);
  const PROVIDER_CDN_SUFFIXES = {
    weibo: ["sinaimg.cn", "weibo.com"],
    bilibili: ["hdslb.com", "bilivideo.com", "bilibili.com"],
    douyin: ["douyinvod.com", "douyinpic.com", "byteimg.com", "douyin.com"],
    youtube: ["ytimg.com", "youtube.com"]
  };

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

  function isSensitiveParam(key) {
    return /(?:^|[-_])(?:access[-_]?token|auth|authorization|credential|expires?|key|password|policy|secret|session|signature|sig|token)(?:$|[-_])/i.test(key)
      || /^(?:x-amz-.+|x-goog-.+|utm_.+)$/i.test(key);
  }

  function redactUrl(value) {
    try {
      const parsed = new URL(String(value || ""));
      parsed.username = "";
      parsed.password = "";
      for (const key of [...parsed.searchParams.keys()]) {
        if (isSensitiveParam(key)) parsed.searchParams.delete(key);
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
    if (candidate.blockedReason) return { ok: false, reason: String(candidate.blockedReason) };
    const url = String(candidate.url || "").trim();
    if (!url) return { ok: false, reason: "EMPTY_URL" };
    if (/^blob:/i.test(url)) return { ok: false, reason: "BROWSER_BLOB" };
    if (/^data:/i.test(url)) return { ok: false, reason: "DATA_URL" };
    if (!/^https?:/i.test(url)) return { ok: false, reason: "UNSUPPORTED_SCHEME" };
    const extension = extensionForUrl(url);
    if (STREAM_EXTENSIONS.has(extension)) return { ok: false, reason: "STREAM_MANIFEST" };
    if (/^(?:dash|dash-split|hls|segmented)$/i.test(String(candidate.mediaCompleteness || ""))) {
      return { ok: false, reason: "DASH_OR_AUDIO_UNVERIFIED" };
    }
    const suppliedType = String(candidate.kind || candidate.type || "").toLowerCase();
    const mimeHint = String(candidate.mimeHint || "").toLowerCase().split(";")[0];
    const evidence = String(candidate.sourceEvidence || "");
    const extensionType = IMAGE_EXTENSIONS.has(extension) ? "image" : VIDEO_EXTENSIONS.has(extension) ? "video" : "";
    const mimeType = mimeHint.startsWith("image/") ? "image" : mimeHint.startsWith("video/") ? "video" : "";
    const provisionalType = TRUSTED_EVIDENCE.has(evidence) && ["image", "video"].includes(suppliedType)
      ? suppliedType
      : "";
    const type = extensionType || mimeType || provisionalType;
    if (!type || (suppliedType && suppliedType !== "unknown" && suppliedType !== type)) {
      return { ok: false, reason: "UNVERIFIED_MEDIA_URL" };
    }
    if (!extensionType && !mimeType && !TRUSTED_EVIDENCE.has(evidence)) {
      return { ok: false, reason: "UNVERIFIED_MEDIA_URL" };
    }
    if (type === "video") {
      if (candidate.mediaCompleteness !== "single-file-complete" || candidate.audioStatus !== "present") {
        return { ok: false, reason: "DASH_OR_AUDIO_UNVERIFIED" };
      }
    }
    return {
      ok: true,
      url,
      canonicalUrl: canonicalUrl(url),
      type,
      extension: extensionType ? extension : (MIME_EXTENSIONS[mimeHint] || ""),
      mimeHint,
      sourceEvidence: evidence
    };
  }

  function normalizePositiveInteger(value, fallback, cap) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, cap) : fallback;
  }

  function normalizePositiveBytes(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  function normalizeSettings(value = {}) {
    return {
      maxItems: normalizePositiveInteger(value.maxItems, 25, 200),
      maxItemBytes: normalizePositiveBytes(value.maxItemBytes, 1024 * 1024 * 1024),
      maxBatchBytes: normalizePositiveBytes(value.maxBatchBytes, 2 * 1024 * 1024 * 1024)
    };
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
    const settings = normalizeSettings(options);
    const pageUrl = canonicalUrl(options.pageUrl || "");
    const pageTitle = cleanText(options.pageTitle, "网页素材");
    const provider = slug(options.provider || "generic", "generic");
    const ready = [];
    const skipped = [];
    const seen = new Set();
    let estimatedBytes = 0;
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
      const classified = classifyCandidate(candidate);
      if (!classified.ok) {
        skipped.push({ ...toPublicCandidate(candidate), reason: classified.reason });
        continue;
      }
      const identity = `${classified.type}:${classified.canonicalUrl}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      if (ready.length >= settings.maxItems) {
        skipped.push({ ...toPublicCandidate(candidate), reason: "BATCH_LIMIT" });
        continue;
      }
      const candidateBytes = Math.max(0, Number(candidate.estimatedBytes) || 0);
      if (candidateBytes > settings.maxItemBytes) {
        skipped.push({ ...toPublicCandidate(candidate), reason: "ITEM_SIZE_LIMIT" });
        continue;
      }
      if (candidateBytes && estimatedBytes + candidateBytes > settings.maxBatchBytes) {
        skipped.push({ ...toPublicCandidate(candidate), reason: "BATCH_SIZE_LIMIT" });
        continue;
      }
      estimatedBytes += candidateBytes;
      ready.push({
        id: `${provider}-${ready.length + 1}-${slug(classified.canonicalUrl, "media")}`,
        sequence: ready.length + 1,
        url: classified.url,
        canonicalUrl: classified.canonicalUrl,
        type: classified.type,
        extension: classified.extension,
        mimeHint: classified.mimeHint,
        sourceEvidence: classified.sourceEvidence,
        mediaCompleteness: candidate.mediaCompleteness || "",
        audioStatus: candidate.audioStatus || "",
        estimatedBytes: candidateBytes,
        maxBytes: settings.maxItemBytes,
        label: cleanText(candidate.label, `${pageTitle}-${ready.length + 1}`),
        pageUrl,
        pageTitle,
        provider,
        role: cleanText(candidate.role)
      });
    }
    return {
      ready, skipped, pageUrl, pageTitle, provider, estimatedBytes,
      limits: settings,
      incompleteCount: Math.max(0, Number(options.incompleteCount) || 0)
    };
  }

  function toPublicCandidate(candidate = {}) {
    return {
      redactedUrl: redactUrl(candidate.url || ""),
      kind: cleanText(candidate.kind || candidate.type),
      label: cleanText(candidate.label),
      role: cleanText(candidate.role)
    };
  }

  function buildCacheFilename(entry = {}) {
    const sequence = String(Math.max(1, Number(entry.sequence) || 1)).padStart(4, "0");
    const extension = String(entry.validatedExtension || entry.extension || "bin").toLowerCase();
    return `${sequence}-${slug(entry.label, "media")}.${extension}`;
  }

  function toEagleItem(entry = {}, filePath) {
    const source = redactUrl(entry.pageUrl || "");
    return {
      path: String(filePath || ""),
      name: cleanText(entry.label, `网页素材-${entry.sequence || 1}`),
      url: source,
      tags: ["网页导入", `来源:${slug(entry.provider, "generic")}`, entry.type === "video" ? "网页视频" : "网页图片"],
      annotation: `来源：${source}\n导入方式：浏览器网页媒体导入器`
    };
  }

  function isSelectableFolder(folder = {}) {
    if (!String(folder.id || "")) return false;
    if (folder.isSmartFolder === true || folder.isSmart === true) return false;
    const type = String(folder.type || folder.kind || "").toLowerCase();
    return type !== "smart" && type !== "smart-folder" && type !== "smartfolder";
  }

  function summarize(entries = []) {
    const summary = Object.fromEntries(SUMMARY_STATES.map((state) => [state, 0]));
    for (const entry of entries) {
      const key = String(entry.state || "pending");
      if (Object.hasOwn(summary, key)) summary[key] += 1;
    }
    return summary;
  }

  function createQueue({ id, entries = [], folderId = "", createdAt = Date.now(), limits = {} } = {}) {
    const normalized = entries.map((entry) => ({ ...entry, state: entry.state || "pending", error: null }));
    return {
      id: String(id || `batch-${createdAt}`), folderId: String(folderId || ""), createdAt,
      cancelled: false, limits: normalizeSettings(limits), entries: normalized, summary: summarize(normalized)
    };
  }

  const ALLOWED_TRANSITIONS = {
    pending: new Set(["downloading", "validated", "blocked", "failed", "cancelled"]),
    downloading: new Set(["downloaded", "failed", "blocked", "cancelled"]),
    downloaded: new Set(["validated", "failed", "blocked", "cancelled"]),
    validated: new Set(["accepted", "accepted_unconfirmed", "failed", "cancelled"]),
    accepted: new Set(["confirmed", "accepted_unconfirmed", "failed"]),
    accepted_unconfirmed: new Set(["confirmed"]),
    failed: new Set(["pending", "validated", "cancelled"]),
    blocked: new Set(["pending", "cancelled"]),
    cancelled: new Set(), confirmed: new Set(), skipped: new Set()
  };

  function applyQueueEvent(queue, event = {}) {
    const eventType = String(event.type || "");
    const entryId = String(event.entryId || "");
    const entries = (queue?.entries || []).map((entry) => {
      if (String(entry.id || "") !== entryId) return entry;
      if (entry.state === eventType) {
        const same = { ...entry };
        if (event.downloadId !== undefined) same.downloadId = Number(event.downloadId);
        if (event.path !== undefined) same.path = String(event.path || "");
        if (event.validatedExtension) same.validatedExtension = String(event.validatedExtension);
        if (event.actualBytes !== undefined) same.actualBytes = Math.max(0, Number(event.actualBytes) || 0);
        if (event.networkStatus) same.networkStatus = String(event.networkStatus);
        if (event.confirmationAttempts !== undefined) same.confirmationAttempts = Math.max(0, Number(event.confirmationAttempts) || 0);
        if (event.eagleItemIds) same.eagleItemIds = [...new Set(event.eagleItemIds.map(String).filter(Boolean))];
        return same;
      }
      const allowed = ALLOWED_TRANSITIONS[entry.state || "pending"] || new Set();
      if (!allowed.has(eventType)) return entry;
      const next = { ...entry, state: eventType, error: null };
      if (event.downloadId !== undefined) next.downloadId = Number(event.downloadId);
      if (event.path !== undefined) next.path = String(event.path || "");
      if (event.validatedExtension) next.validatedExtension = String(event.validatedExtension);
      if (event.actualBytes !== undefined) next.actualBytes = Math.max(0, Number(event.actualBytes) || 0);
      if (event.networkStatus) next.networkStatus = String(event.networkStatus);
      if (event.confirmationAttempts !== undefined) next.confirmationAttempts = Math.max(0, Number(event.confirmationAttempts) || 0);
      if (eventType === "validated") next.validatedAt = Date.now();
      if (event.eagleItemIds) next.eagleItemIds = [...new Set(event.eagleItemIds.map(String).filter(Boolean))];
      if (["failed", "blocked", "skipped"].includes(eventType)) {
        next.error = { code: String(event.code || eventType.toUpperCase()), message: cleanText(event.message, eventType) };
      }
      return next;
    });
    return { ...queue, entries, summary: summarize(entries), updatedAt: Date.now() };
  }

  function validateDownloadItem(entry = {}, item = {}) {
    if (item.state !== "complete") return { ok: false, reason: "DOWNLOAD_INCOMPLETE" };
    if (item.danger && item.danger !== "safe") {
      return { ok: false, reason: "DOWNLOAD_DANGEROUS" };
    }
    const size = Number(item.fileSize || item.totalBytes || 0);
    if (!Number.isFinite(size) || size <= 0) return { ok: false, reason: "DOWNLOAD_EMPTY" };
    if (entry.maxBytes && size > Number(entry.maxBytes)) return { ok: false, reason: "ITEM_SIZE_LIMIT" };
    const mime = String(item.mime || "").toLowerCase().split(";")[0].trim();
    if (mime === "text/html" || mime === "application/xhtml+xml") return { ok: false, reason: "DOWNLOAD_HTML" };
    if (mime === "application/json" || mime.endsWith("+json")) return { ok: false, reason: "DOWNLOAD_JSON" };
    const mimeType = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "";
    if (!mimeType || mimeType !== entry.type) return { ok: false, reason: "DOWNLOAD_TYPE_MISMATCH" };
    const mimeExtension = MIME_EXTENSIONS[mime] || "";
    const requestedExtension = String(entry.extension || "").toLowerCase();
    if (requestedExtension && mimeExtension) {
      const jpegPair = new Set(["jpg", "jpeg"]);
      if (requestedExtension !== mimeExtension && !(jpegPair.has(requestedExtension) && jpegPair.has(mimeExtension))) {
        return { ok: false, reason: "DOWNLOAD_EXTENSION_MISMATCH" };
      }
    }
    if (!/^https?:/i.test(String(item.finalUrl || item.url || "https://local.invalid"))) {
      return { ok: false, reason: "DOWNLOAD_FINAL_URL_INVALID" };
    }
    if (!String(item.filename || "")) return { ok: false, reason: "DOWNLOAD_PATH_MISSING" };
    return { ok: true, mime, size, extension: mimeExtension || requestedExtension, filename: item.filename };
  }

  function hostnameMatchesSuffix(hostname, suffix) {
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }

  function isPrivateNetworkHost(hostname) {
    const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
    if (!host) return true;
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
    if (host.includes(":")) {
      if (host === "::" || host === "::1") return true;
      if (/^f[cd][0-9a-f]{0,2}:/i.test(host) || /^fe[89ab][0-9a-f]?:/i.test(host)) return true;
      if (host.startsWith("::ffff:")) return true;
      return false;
    }
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4) return false;
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((value) => value > 255)) return true;
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168);
  }

  function classifyNetworkAccess(entry = {}, rawUrl = "") {
    try {
      const page = new URL(redactUrl(entry.pageUrl || ""));
      const media = new URL(String(rawUrl || ""));
      if (page.protocol !== "https:" || !["https:", "http:"].includes(media.protocol)) {
        return { ok: false, reason: "NETWORK_ORIGIN_NOT_ALLOWED" };
      }
      const sameSite = page.hostname === media.hostname
        || page.hostname.endsWith(`.${media.hostname}`)
        || media.hostname.endsWith(`.${page.hostname}`);
      const allowed = PROVIDER_CDN_SUFFIXES[String(entry.provider || "")] || [];
      const registeredCdn = allowed.some((suffix) => hostnameMatchesSuffix(media.hostname, suffix));
      const explicitlySelectedPublicImage = entry.sourceEvidence === "user-selected-media"
        && entry.type !== "video"
        && media.protocol === "https:"
        && !isPrivateNetworkHost(media.hostname);
      if (!sameSite && !registeredCdn && !explicitlySelectedPublicImage) {
        return { ok: false, reason: "NETWORK_ORIGIN_NOT_ALLOWED" };
      }
      return {
        ok: true,
        mode: "browser-managed",
        requiresBrowserValidation: !sameSite,
        pageOrigin: page.origin
      };
    } catch {
      return { ok: false, reason: "NETWORK_ORIGIN_NOT_ALLOWED" };
    }
  }

  function recoveryAction(entry = {}, item) {
    if (entry.state !== "downloading") return { action: "continue" };
    if (!item) return { action: "fail", reason: "DOWNLOAD_RECORD_MISSING" };
    if (item.state === "complete") return { action: "validate" };
    if (item.state === "interrupted" && item.canResume) return { action: "resume" };
    if (item.state === "interrupted") return { action: "fail", reason: "DOWNLOAD_INTERRUPTED" };
    if (item.state === "in_progress") return { action: "wait" };
    return { action: "fail", reason: "DOWNLOAD_STATE_UNKNOWN" };
  }

  function cancelQueue(queue = {}) {
    const entries = (queue.entries || []).map((entry) => {
      if (["pending", "downloading", "downloaded", "validated"].includes(entry.state)) {
        return { ...entry, state: "cancelled", error: null };
      }
      return entry;
    });
    return { ...queue, cancelled: true, entries, summary: summarize(entries), updatedAt: Date.now() };
  }

  function migrateLegacyQueue(queue = {}) {
    const entries = (queue.entries || []).map((legacy) => {
      const safe = toPersistentEntry(legacy);
      if (legacy.state === "accepted") return { ...safe, state: "accepted_unconfirmed", error: null };
      if (["pending", "downloading", "downloaded"].includes(legacy.state)) {
        return {
          ...safe,
          state: "blocked",
          error: { code: "LEGACY_TASK_REQUIRES_RESCAN", message: "1.x 任务缺少可恢复凭据，请回原页面重新选择" }
        };
      }
      return { ...safe, state: legacy.state || "failed" };
    });
    return {
      ...queue,
      schemaVersion: 2,
      entries,
      summary: summarize(entries),
      migratedAt: Date.now()
    };
  }

  function toPersistentEntry(entry = {}) {
    const { url, canonicalUrl: rawCanonicalUrl, ...safe } = entry;
    return {
      ...safe,
      redactedUrl: redactUrl(url || rawCanonicalUrl || ""),
      pageUrl: redactUrl(entry.pageUrl || "")
    };
  }

  return {
    IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, STREAM_EXTENSIONS, TERMINAL_STATES,
    applyQueueEvent, buildBatchPlan, buildCacheFilename, cancelQueue, canonicalUrl, classifyCandidate,
    classifyNetworkAccess,
    createQueue, extensionForUrl, isSelectableFolder, migrateLegacyQueue, normalizeSettings, recoveryAction,
    redactUrl, summarize, toEagleItem, toPersistentEntry, validateDownloadItem
  };
});
