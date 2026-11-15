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
    "pending", "download_starting", "download_unknown", "downloading", "downloaded", "validated",
    "submitting", "submission_unknown", "accepted", "accepted_unconfirmed", "confirmed", "failed",
    "blocked", "cancelled", "skipped"
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
    instagram: ["cdninstagram.com", "fbcdn.net", "instagram.com"],
    xiaohongshu: ["xhscdn.com", "xiaohongshu.com"],
    youtube: ["ytimg.com", "youtube.com"]
  };

  function cleanText(value, fallback = "") {
    const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
    return text || String(fallback || "").slice(0, 500);
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
    return /(?:^|[-_])(?:access[-_]?token|auth|authorization|code|credential|expires?|jwt|key|nonce|password|policy|sso|state|ticket|secret|session|signature|sig|token)(?:$|[-_])/i.test(key)
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
      const match = parsed.pathname.toLowerCase().match(/\.([a-z0-9]{2,8})(?:@[^/]*)?$/);
      if (match && (IMAGE_EXTENSIONS.has(match[1]) || VIDEO_EXTENSIONS.has(match[1]) || STREAM_EXTENSIONS.has(match[1]))) {
        return match[1];
      }
      for (const key of ["format", "fm", "ext"]) {
        const hinted = String(parsed.searchParams.get(key) || "").toLowerCase().replace(/^\./, "");
        if (IMAGE_EXTENSIONS.has(hinted) || VIDEO_EXTENSIONS.has(hinted) || STREAM_EXTENSIONS.has(hinted)) return hinted;
      }
      return "";
    } catch {
      const match = String(value || "").toLowerCase().replace(/[?#].*$/, "").match(/\.([a-z0-9]{2,8})$/);
      return match ? match[1] : "";
    }
  }

  function extensionForMime(value) {
    const mime = String(value || "").toLowerCase().split(";")[0].trim();
    if (mime === "image/svg+xml") return "";
    return MIME_EXTENSIONS[mime] || "";
  }

  function classifyCandidate(candidate = {}) {
    if (candidate.blockedReason) return { ok: false, reason: String(candidate.blockedReason) };
    const url = String(candidate.url || "").trim();
    if (!url) return { ok: false, reason: "EMPTY_URL" };
    if (url.length > 8192) return { ok: false, reason: "URL_TOO_LONG" };
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
    if (extension === "svg" || mimeHint === "image/svg+xml") return { ok: false, reason: "ACTIVE_MEDIA_BLOCKED" };
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
      if (!["single-file-complete", "requires-probe"].includes(String(candidate.mediaCompleteness || ""))
        || !["present", "requires-probe"].includes(String(candidate.audioStatus || ""))) {
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

  const MAX_ITEM_BYTES = 4 * 1024 * 1024 * 1024;
  const MAX_BATCH_BYTES = 20 * 1024 * 1024 * 1024;

  function normalizePositiveBytes(value, fallback, cap) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), cap) : fallback;
  }

  function normalizeSettings(value = {}) {
    return {
      maxItems: normalizePositiveInteger(value.maxItems, 25, 200),
      maxItemBytes: normalizePositiveBytes(value.maxItemBytes, 1024 * 1024 * 1024, MAX_ITEM_BYTES),
      maxBatchBytes: normalizePositiveBytes(value.maxBatchBytes, 2 * 1024 * 1024 * 1024, MAX_BATCH_BYTES)
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
    pending: new Set(["download_starting", "validated", "blocked", "failed", "cancelled"]),
    download_starting: new Set(["downloading", "download_unknown", "blocked", "failed", "cancelled"]),
    download_unknown: new Set(),
    downloading: new Set(["downloaded", "failed", "blocked", "cancelled"]),
    downloaded: new Set(["validated", "failed", "blocked", "cancelled"]),
    validated: new Set(["submitting", "failed", "cancelled"]),
    submitting: new Set(["accepted", "accepted_unconfirmed", "submission_unknown", "failed"]),
    submission_unknown: new Set(),
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
        if (event.transcodedJpeg === true) same.transcodedJpeg = true;
        if (event.actualBytes !== undefined) same.actualBytes = Math.max(0, Number(event.actualBytes) || 0);
        if (event.networkStatus) same.networkStatus = String(event.networkStatus);
        if (event.audioStatus) same.audioStatus = String(event.audioStatus);
        if (event.mediaCompleteness) same.mediaCompleteness = String(event.mediaCompleteness);
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
      if (event.transcodedJpeg === true) next.transcodedJpeg = true;
      if (event.actualBytes !== undefined) next.actualBytes = Math.max(0, Number(event.actualBytes) || 0);
      if (event.networkStatus) next.networkStatus = String(event.networkStatus);
      if (event.audioStatus) next.audioStatus = String(event.audioStatus);
      if (event.mediaCompleteness) next.mediaCompleteness = String(event.mediaCompleteness);
      if (event.confirmationAttempts !== undefined) next.confirmationAttempts = Math.max(0, Number(event.confirmationAttempts) || 0);
      if (eventType === "validated") next.validatedAt = Date.now();
      if (event.eagleItemIds) next.eagleItemIds = [...new Set(event.eagleItemIds.map(String).filter(Boolean))];
      if (["failed", "blocked", "skipped", "download_unknown", "submission_unknown"].includes(eventType)) {
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
    if (entry.transcodedJpeg === true && mime !== "image/jpeg") return { ok: false, reason: "TRANSCODE_NOT_JPEG" };
    if (mime === "text/html" || mime === "application/xhtml+xml") return { ok: false, reason: "DOWNLOAD_HTML" };
    if (mime === "application/json" || mime.endsWith("+json")) return { ok: false, reason: "DOWNLOAD_JSON" };
    if (mime === "image/svg+xml") return { ok: false, reason: "ACTIVE_MEDIA_BLOCKED" };
    const mimeType = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "";
    if (!mimeType || mimeType !== entry.type) return { ok: false, reason: "DOWNLOAD_TYPE_MISMATCH" };
    const mimeExtension = MIME_EXTENSIONS[mime] || "";
    const requestedExtension = String(entry.validatedExtension || entry.extension || "").toLowerCase();
    if (requestedExtension && mimeExtension) {
      const jpegPair = new Set(["jpg", "jpeg"]);
      if (requestedExtension !== mimeExtension && !(jpegPair.has(requestedExtension) && jpegPair.has(mimeExtension))) {
        return { ok: false, reason: "DOWNLOAD_EXTENSION_MISMATCH" };
      }
    }
    const completedUrl = String(item.finalUrl || item.url || "");
    if (entry.transcodedJpeg === true && !/^data:image\/jpeg;base64,/i.test(completedUrl)) {
      return { ok: false, reason: "TRANSCODE_FINAL_URL_INVALID" };
    }
    if (entry.transcodedJpeg !== true && !/^https?:/i.test(completedUrl || "https://local.invalid")) {
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
    const [a, b, c] = octets;
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 169 && b === 254)
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0 && c === 2)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113);
  }

  function classifyNetworkAccess(entry = {}, rawUrl = "") {
    try {
      const page = new URL(redactUrl(entry.pageUrl || ""));
      const media = new URL(String(rawUrl || ""));
      if (!["https:", "http:"].includes(page.protocol) || !["https:", "http:"].includes(media.protocol)
        || (page.protocol === "https:" && media.protocol !== "https:")) {
        return { ok: false, reason: "NETWORK_ORIGIN_NOT_ALLOWED" };
      }
      if (isPrivateNetworkHost(media.hostname)) return { ok: false, reason: "NETWORK_ORIGIN_NOT_ALLOWED" };
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
    if (entry.state === "download_starting") return { action: "uncertain", reason: "DOWNLOAD_HANDOFF_UNKNOWN" };
    if (entry.state === "submitting") return { action: "uncertain", reason: "EAGLE_SUBMISSION_UNKNOWN" };
    if (entry.state !== "downloading") return { action: "continue" };
    if (!item) return { action: "fail", reason: "DOWNLOAD_RECORD_MISSING" };
    if (item.state === "complete") return { action: "validate" };
    if (item.state === "interrupted" && item.canResume) return { action: "resume" };
    if (item.state === "interrupted") return { action: "fail", reason: "DOWNLOAD_INTERRUPTED" };
    if (item.state === "in_progress") return { action: "wait" };
    return { action: "fail", reason: "DOWNLOAD_STATE_UNKNOWN" };
  }

  function inspectIsoBmffTracks(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
    const state = { hasMoov: false, hasVideo: false, hasAudio: false, boxes: 0 };
    const containers = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf"]);
    const readType = (offset) => String.fromCharCode(...bytes.slice(offset, offset + 4));
    const readUint32 = (offset) => new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const scan = (start, end, depth = 0) => {
      if (depth > 10) return;
      for (let offset = start; offset + 8 <= end && state.boxes < 10_000;) {
        state.boxes += 1;
        let size = readUint32(offset);
        const type = readType(offset + 4);
        let header = 8;
        if (size === 1) {
          if (offset + 16 > end) return;
          const high = readUint32(offset + 8);
          const low = readUint32(offset + 12);
          const extended = high * 2 ** 32 + low;
          if (!Number.isSafeInteger(extended)) return;
          size = extended;
          header = 16;
        } else if (size === 0) {
          size = end - offset;
        }
        if (size < header || offset + size > end) return;
        const payload = offset + header;
        if (type === "moov") state.hasMoov = true;
        if (type === "hdlr" && payload + 12 <= offset + size) {
          const handler = readType(payload + 8);
          if (handler === "vide") state.hasVideo = true;
          if (handler === "soun") state.hasAudio = true;
        }
        if (containers.has(type)) scan(payload, offset + size, depth + 1);
        offset += size;
      }
    };
    scan(0, bytes.length);
    if (!state.hasMoov) {
      for (let index = 4; index + 4 <= bytes.length; index += 1) {
        if (readType(index) !== "moov") continue;
        const candidateStart = index - 4;
        const size = readUint32(candidateStart);
        if (size >= 8 && candidateStart + size <= bytes.length) scan(candidateStart, candidateStart + size);
      }
    }
    return {
      ok: state.hasMoov && state.hasVideo && state.hasAudio,
      hasMoov: state.hasMoov,
      hasVideo: state.hasVideo,
      hasAudio: state.hasAudio,
      reason: !state.hasMoov ? "MP4_MOOV_NOT_FOUND"
        : !state.hasVideo ? "VIDEO_TRACK_NOT_FOUND"
          : !state.hasAudio ? "AUDIO_TRACK_NOT_FOUND" : ""
    };
  }

  // FLV declares the stream types in its fixed header. It is not a substitute
  // for a byte-for-byte decode, but it is the container-level proof available
  // before Chrome downloads the complete file. This keeps Bilibili progressive
  // FLV downloads eligible while still refusing audio-only or video-only files.
  function inspectFlvStreams(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
    if (bytes.length < 9
      || bytes[0] !== 0x46 || bytes[1] !== 0x4c || bytes[2] !== 0x56) {
      return { ok: false, hasVideo: false, hasAudio: false, reason: "FLV_HEADER_NOT_FOUND" };
    }
    const flags = bytes[4] || 0;
    const hasAudio = (flags & 0x04) !== 0;
    const hasVideo = (flags & 0x01) !== 0;
    return {
      ok: hasVideo && hasAudio,
      hasVideo,
      hasAudio,
      reason: !hasVideo ? "VIDEO_TRACK_NOT_FOUND" : !hasAudio ? "AUDIO_TRACK_NOT_FOUND" : ""
    };
  }

  function cancelQueue(queue = {}) {
    const entries = (queue.entries || []).map((entry) => {
      if (["pending", "download_starting", "downloading", "downloaded", "validated"].includes(entry.state)) {
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
    let mediaOrigin = "";
    try { mediaOrigin = new URL(String(url || rawCanonicalUrl || "")).origin; } catch { /* empty */ }
    return {
      ...safe,
      mediaOrigin,
      pageUrl: redactUrl(entry.pageUrl || "")
    };
  }

  return {
    IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, STREAM_EXTENSIONS, TERMINAL_STATES,
    applyQueueEvent, buildBatchPlan, buildCacheFilename, cancelQueue, canonicalUrl, classifyCandidate,
    classifyNetworkAccess,
    createQueue, extensionForMime, extensionForUrl, inspectFlvStreams, inspectIsoBmffTracks, isSelectableFolder, migrateLegacyQueue, normalizeSettings, recoveryAction,
    redactUrl, summarize, toEagleItem, toPersistentEntry, validateDownloadItem
  };
});
