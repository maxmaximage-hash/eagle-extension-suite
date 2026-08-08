(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.XhsEagleCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const URL_KEYS = ["masterUrl", "master_url", "backupUrl", "backup_url", "urlDefault", "urlPre", "url", "src"];

  function isHttpUrl(value) {
    return typeof value === "string" && /^https?:\/\//i.test(value);
  }

  function collectUrls(value, path = "", result = [], seen = new Set()) {
    if (value == null || result.length >= 300) return result;
    if (isHttpUrl(value)) {
      result.push({ url: value.replace(/\\u002F/g, "/"), path });
      return result;
    }
    if (typeof value !== "object" || seen.has(value)) return result;
    seen.add(value);
    if (Array.isArray(value)) {
      value.slice(0, 100).forEach((item, index) => collectUrls(item, `${path}[${index}]`, result, seen));
    } else {
      Object.entries(value).slice(0, 200).forEach(([key, child]) => collectUrls(child, path ? `${path}.${key}` : key, result, seen));
    }
    return result;
  }

  function mediaType(url, path = "") {
    const text = `${path} ${url}`.toLowerCase();
    if (/\.(?:jpe?g|png|webp|heic|avif)(?:\?|$)|image|image_list|urlpre|urldefault/.test(text)) return "image";
    return "unknown";
  }

  function canonicalKey(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}${decodeURIComponent(parsed.pathname)}`;
    } catch { return url; }
  }

  function uniqueMedia(entries) {
    const seen = new Set();
    return entries.filter((entry) => {
      if (!entry || !isHttpUrl(entry.url)) return false;
      const key = `${entry.type || mediaType(entry.url, entry.path)}:${canonicalKey(entry.url)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function bestUrl(object, wantedType) {
    const entries = collectUrls(object).filter((entry) => mediaType(entry.url, entry.path) === wantedType);
    const score = (entry) => {
      const text = `${entry.path} ${entry.url}`.toLowerCase();
      let value = 0;
      if (/master|origin|original|default/.test(text)) value += 20;
      if (/preview|thumbnail|cover|trace/.test(text)) value -= 15;
      URL_KEYS.forEach((key, index) => { if (entry.path.toLowerCase().endsWith(key.toLowerCase())) value += 8 - index; });
      return value;
    };
    return entries.sort((a, b) => score(b) - score(a))[0]?.url || null;
  }

  function normalizeNote(note, fallbackUrl = "") {
    const imageList = note?.imageList || note?.image_list || note?.images || [];
    const items = [];
    imageList.forEach((image, index) => {
      const stillUrl = bestUrl(image, "image");
      const liveFlag = Boolean(image?.livePhoto || image?.live_photo || image?.isLivePhoto || image?.is_live_photo);
      if (stillUrl) items.push({ url: stillUrl, type: "image", role: liveFlag ? "live-still" : "image", liveGroup: liveFlag ? index + 1 : null, order: index + 1 });
    });

    if (!items.length) {
      const all = collectUrls(note).map((entry) => ({ ...entry, type: mediaType(entry.url, entry.path) }))
        .filter((entry) => entry.type === "image");
      all.forEach((entry, index) => items.push({ url: entry.url, type: entry.type, role: entry.type, liveGroup: null, order: index + 1 }));
    }

    return {
      id: String(note?.noteId || note?.note_id || note?.id || extractNoteId(fallbackUrl) || `note_${Date.now()}`),
      url: fallbackUrl,
      title: String(note?.title || "").trim(),
      description: String(note?.desc || note?.description || note?.content || "").trim(),
      author: String(note?.user?.nickname || note?.user?.nickName || note?.author?.name || "").trim(),
      media: uniqueMedia(items)
    };
  }

  function extractNoteId(url) {
    return String(url || "").match(/\/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/)?.[1] || "";
  }

  function buildEagleItems(note) {
    return buildImportPlan(note).map((entry) => buildEagleItem(note, entry.media, entry.sequence));
  }

  function buildEagleItem(note, media, sequenceNumber, overrides = {}) {
    const base = sanitizeName(note.title || note.id || "xiaohongshu_note");
    const sequence = String(sequenceNumber).padStart(2, "0");
    const liveSuffix = media.liveGroup ? `_live${String(media.liveGroup).padStart(2, "0")}` : "";
    const roleSuffix = media.liveGroup ? "_photo" : "";
    const tags = ["小红书", "整帖导入"];
    if (media.liveGroup) tags.push("Live图", `Live:${note.id}:${media.liveGroup}`);
    const liveAnnotation = media.liveGroup ? `Live 图第 ${media.liveGroup} 组（静态图片）` : "";
    const annotation = [note.title, note.author && `作者：${note.author}`, note.description, `来源：${note.url}`, liveAnnotation].filter(Boolean).join("\n\n");
    return {
      ...(overrides.path ? { path: overrides.path } : { url: media.url }),
      name: `${base}_${sequence}${liveSuffix}` + roleSuffix,
      website: note.url,
      tags,
      annotation,
      ...(overrides.path ? {} : { headers: { referer: "https://www.xiaohongshu.com/" } })
    };
  }

  function buildImportPlan(note) {
    const media = Array.isArray(note.media) ? note.media : [];
    return media
      .filter((item) => item.type === "image")
      .map((item, index) => ({ kind: "url", sequence: index + 1, media: item }));
  }

  function summarizeMedia(media) {
    const list = Array.isArray(media) ? media : [];
    const liveGroups = new Set(list.filter((item) => item.liveGroup != null).map((item) => String(item.liveGroup)));
    const standaloneCount = list.filter((item) => item.liveGroup == null).length;
    return {
      contentCount: standaloneCount + liveGroups.size,
      fileCount: list.length,
      liveCount: liveGroups.size
    };
  }

  function sanitizeName(value) {
    return String(value).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").replace(/\s+/g, " ").trim().slice(0, 70) || "xiaohongshu_note";
  }

  return { collectUrls, mediaType, canonicalKey, uniqueMedia, bestUrl, normalizeNote, extractNoteId, buildEagleItems, buildEagleItem, buildImportPlan, summarizeMedia, sanitizeName };
});
