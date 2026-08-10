(function attachStructuredMedia(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.EagleWebStructuredMedia = api;
})(typeof globalThis === "object" ? globalThis : this, function createStructuredMedia() {
  "use strict";

  const MAX_JSON_LENGTH = 8_000_000;
  const MAX_VISITED_NODES = 20_000;

  function parseAssignedObject(text, marker) {
    const source = String(text || "");
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) return null;
    const start = source.indexOf("{", markerIndex + marker.length);
    if (start < 0) return null;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = start; index < source.length && index - start < MAX_JSON_LENGTH; index += 1) {
      const char = source[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') quoted = true;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          try { return JSON.parse(source.slice(start, index + 1)); } catch { return null; }
        }
      }
    }
    return null;
  }

  function extractBilibili(scriptTexts = []) {
    for (const text of scriptTexts) {
      if (!String(text || "").includes("__playinfo__")) continue;
      const playInfo = parseAssignedObject(text, "__playinfo__");
      if (!playInfo) continue;
      const data = playInfo?.data || playInfo?.result || {};
      const durl = Array.isArray(data.durl) ? data.durl : [];
      // A Bilibili durl array is one progressively delivered work.  More than
      // one entry means the work is split into sequential segments, not that
      // it contains several independently importable videos.  Importing the
      // entries individually would create corrupt partial clips in Eagle.
      const hasSegmentedDurl = durl.length > 1;
      const progressiveVideos = hasSegmentedDurl ? [] : durl.flatMap((item) => {
        const urls = [item?.url, ...(Array.isArray(item?.backup_url) ? item.backup_url : [])];
        const url = urls.find((value) => /^https?:/i.test(String(value || "")));
        return url ? [{ url, estimatedBytes: Math.max(0, Number(item?.size) || 0) }] : [];
      });
      const hasDash = Boolean(data.dash);
      // Pages can contain an earlier bootstrap/stale assignment as well as the
      // actual payload. Empty objects are not media evidence, so keep looking.
      if (!progressiveVideos.length && !hasDash && !hasSegmentedDurl) continue;
      return { progressiveVideos, hasDash, hasSegmentedDurl };
    }
    return {};
  }

  function extractDouyin(renderText, currentId) {
    const text = String(renderText || "");
    if (!currentId || !text || text.length > MAX_JSON_LENGTH) return {};
    let parsed;
    try {
      const decoded = text.includes("%") ? decodeURIComponent(text) : text;
      parsed = JSON.parse(decoded);
    } catch {
      return {};
    }
    const aweme = findObjectById(parsed, String(currentId));
    if (!aweme) return {};
    const records = Array.isArray(aweme.images)
      ? aweme.images
      : Array.isArray(aweme.image_post_info?.images) ? aweme.image_post_info.images : [];
    const images = records.flatMap((image) => {
      const source = image?.display_image || image?.download_url || image?.owner_watermark_image || image;
      const url = firstPublicUrl(source);
      return url ? [{ url, estimatedBytes: Math.max(0, Number(source?.data_size) || 0) }] : [];
    });
    const play = aweme.video?.play_addr || aweme.video?.play_addr_h264 || aweme.video?.download_addr;
    const videoUrl = firstPublicUrl(play);
    return {
      images,
      progressiveVideos: videoUrl ? [{
        url: videoUrl,
        estimatedBytes: Math.max(0, Number(play?.data_size) || 0)
      }] : []
    };
  }

  function findObjectById(root, expectedId) {
    const queue = [root];
    const seen = new Set();
    for (let head = 0, visited = 0; head < queue.length && visited < MAX_VISITED_NODES; head += 1, visited += 1) {
      const value = queue[head];
      if (!value || typeof value !== "object" || seen.has(value)) continue;
      seen.add(value);
      const id = String(value.aweme_id || value.awemeId || value.id_str || "");
      if (id === expectedId && (value.video || value.images || value.image_post_info)) return value;
      let inspected = 0;
      for (const key in value) {
        if (!Object.hasOwn(value, key) || inspected >= MAX_VISITED_NODES) continue;
        inspected += 1;
        const child = value[key];
        if (child && typeof child === "object") queue.push(child);
      }
    }
    return null;
  }

  function firstPublicUrl(value) {
    const candidates = [
      ...(Array.isArray(value?.url_list) ? value.url_list : []),
      ...(Array.isArray(value?.urlList) ? value.urlList : []),
      value?.url,
      typeof value === "string" ? value : ""
    ];
    return candidates.find((candidate) => /^https?:/i.test(String(candidate || ""))) || "";
  }

  return { extractBilibili, extractDouyin, parseAssignedObject };
});
