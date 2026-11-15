(function attachProviderAdapters(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.EagleWebMediaProviders = api;
})(typeof globalThis === "object" ? globalThis : this, function createProviderAdapters() {
  "use strict";

  function providerFor(value) {
    let host = "";
    try { host = new URL(String(value || "")).hostname.toLowerCase(); } catch { host = String(value || "").toLowerCase(); }
    if (/(^|\.)weibo\.com$|(^|\.)weibo\.cn$/.test(host)) return "weibo";
    if (/(^|\.)bilibili\.com$/.test(host)) return "bilibili";
    if (/(^|\.)douyin\.com$/.test(host)) return "douyin";
    if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
    if (/(^|\.)xiaohongshu\.com$/.test(host)) return "xiaohongshu";
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return "youtube";
    return "generic";
  }

  const wholeSaveLabels = {
    instagram: "保存当前 Instagram 整帖",
    xiaohongshu: "保存当前小红书整帖",
    weibo: "保存当前微博整帖",
    douyin: "保存当前抖音作品",
    bilibili: "保存当前哔哩哔哩视频",
    youtube: "保存当前 YouTube 视频",
    generic: "保存当前媒体整体"
  };

  const pageStateLabels = {
    instagram: "识别当前 Instagram 帖子",
    xiaohongshu: "识别当前小红书笔记",
    weibo: "识别当前微博帖子",
    douyin: "识别当前抖音作品",
    bilibili: "识别当前哔哩哔哩视频",
    youtube: "识别当前 YouTube 视频",
    generic: "当前页面可识别"
  };

  function resolvedProvider(value) {
    const candidate = String(value || "").toLowerCase();
    return Object.hasOwn(wholeSaveLabels, candidate) ? candidate : providerFor(value);
  }

  function wholeSaveLabel(value) {
    return wholeSaveLabels[resolvedProvider(value)] || wholeSaveLabels.generic;
  }

  function wholeSaveMenuTitle(value) {
    return `${wholeSaveLabel(value)}至 Eagle…`;
  }

  function pageStateLabel(value) {
    return pageStateLabels[resolvedProvider(value)] || pageStateLabels.generic;
  }

  function supportsPostMode(value) {
    return ["instagram", "xiaohongshu", "weibo", "douyin"].includes(resolvedProvider(value));
  }

  function blocked(candidate, reason) {
    return { ...candidate, reason };
  }

  function isDouyinDetailUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return /(^|\.)douyin\.com$/i.test(url.hostname)
        && (/^\/(?:video|note)\/\d+(?:\/|$)/i.test(url.pathname)
          || /^\d+$/.test(String(url.searchParams.get("modal_id") || "")));
    } catch {
      return false;
    }
  }

  function isWeiboDetailUrl(value) {
    try {
      const url = new URL(String(value || ""));
      if (!/(^|\.)weibo\.(?:com|cn)$/i.test(url.hostname)) return false;
      return /^\/\d+\/[A-Za-z0-9]+(?:\/|$)/.test(url.pathname)
        || /^\/detail\/[A-Za-z0-9]+(?:\/|$)/.test(url.pathname)
        || /^\/tv\/show\/[A-Za-z0-9:]+(?:\/|$)/.test(url.pathname)
        || (url.pathname === "/ttarticle/p/show" && Boolean(url.searchParams.get("id")));
    } catch {
      return false;
    }
  }

  function isXiaohongshuDetailUrl(value) {
    try {
      const url = new URL(String(value || ""));
      if (!/(^|\.)xiaohongshu\.com$/i.test(url.hostname)) return false;
      return /^\/(?:explore|discovery\/item)\/[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname);
    } catch {
      return false;
    }
  }

  function isInstagramPostUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return /(^|\.)instagram\.com$/i.test(url.hostname)
        && /^\/(?:p|reel)\/[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname);
    } catch {
      return false;
    }
  }

  function pageActionFor(value) {
    const provider = providerFor(value);
    if (provider === "xiaohongshu" && !isXiaohongshuDetailUrl(value)) {
      return {
        provider,
        mode: "context-selected",
        collectible: false,
        contextCollectible: true,
        label: "在封面上保存单张图片或视频",
        menuTitle: "保存右键处的小红书封面至 Eagle…",
        state: "当前是小红书推荐流",
        note: "推荐流不能作为整帖范围；在封面上右键可保存这一张图片或视频，打开具体笔记后可保存整帖。"
      };
    }
    if (provider === "instagram" && !isInstagramPostUrl(value)) {
      return {
        provider,
        mode: "context-selected",
        collectible: false,
        contextCollectible: true,
        label: "在封面上保存单张图片或视频",
        menuTitle: "保存右键处的 Instagram 媒体至 Eagle…",
        state: "当前是 Instagram 信息流",
        note: "信息流不能作为整帖范围；在封面上右键可保存这一张图片或视频，打开具体帖子后可保存整帖。"
      };
    }
    return {
      provider,
      mode: supportsPostMode(provider) ? "post" : "page",
      collectible: true,
      label: wholeSaveLabel(provider),
      menuTitle: wholeSaveMenuTitle(provider),
      state: pageStateLabel(provider),
      note: provider === "instagram"
        ? "Instagram 整帖会在读取轮播后回到原位置；随后再选择 Eagle 文件夹并确认导入。"
        : provider === "xiaohongshu"
          ? "小红书整帖只读取当前笔记中已加载、归属唯一的媒体；不会混入推荐流。"
          : "只读取归属明确、当前已加载且可直接取得的媒体；无法确认范围时会停止，不会扫入推荐内容。"
    };
  }

  function chooseOwnedContainer(model = {}) {
    const owned = (model.containers || []).filter((container) => container?.owned === true);
    if (owned.length > 1) return { ok: false, reason: "CURRENT_CONTENT_AMBIGUOUS" };
    if (!owned.length) return { ok: false, reason: "CURRENT_CONTENT_NOT_PROVEN" };
    return { ok: true, container: owned[0] };
  }

  function collectContainer(model, allowedRoles) {
    const ownership = chooseOwnedContainer(model);
    if (!ownership.ok) return { ...ownership, provider: model.provider || "generic", candidates: [], blocked: [] };
    const candidates = [];
    const rejected = [];
    for (const candidate of ownership.container.candidates || []) {
      if (!allowedRoles.has(String(candidate.role || ""))) continue;
      if (/^blob:/i.test(String(candidate.url || ""))) {
        rejected.push(blocked(candidate, "BROWSER_BLOB"));
      } else if (candidate.kind === "video" && (
        !["single-file-complete", "requires-probe"].includes(String(candidate.mediaCompleteness || ""))
        || !["present", "requires-probe"].includes(String(candidate.audioStatus || ""))
      )) {
        rejected.push(blocked(candidate, "DASH_OR_AUDIO_UNVERIFIED"));
      } else {
        candidates.push(candidate);
      }
    }
    return {
      ok: candidates.length > 0,
      reason: candidates.length ? "" : (rejected[0]?.reason || "CURRENT_CONTENT_HAS_NO_DIRECT_MEDIA"),
      provider: model.provider || "generic",
      candidates,
      blocked: rejected,
      incompleteCount: Math.max(0, Number(ownership.container.incompleteCount) || 0)
    };
  }

  function hasSingleExplicitMediaSelection(model = {}) {
    const owned = (model.containers || []).filter((container) => container?.owned === true);
    const candidates = owned.flatMap((container) => container?.candidates || []);
    return model.explicitSelection === true
      && owned.length === 1
      && candidates.length === 1
      && String(candidates[0]?.sourceEvidence || "") === "user-selected-media";
  }

  const registry = {
    weibo(model) {
      if (!isWeiboDetailUrl(model.pageUrl)) {
        return { ok: false, reason: "CURRENT_CONTENT_NOT_PROVEN", provider: "weibo", candidates: [], blocked: [] };
      }
      return collectContainer(model, new Set(["post-image", "post-video"]));
    },
    douyin(model) {
      if (!isDouyinDetailUrl(model.pageUrl)) {
        return { ok: false, reason: "CURRENT_CONTENT_NOT_PROVEN", provider: "douyin", candidates: [], blocked: [] };
      }
      return collectContainer(model, new Set(["post-image", "post-video"]));
    },
    instagram(model) {
      const selected = hasSingleExplicitMediaSelection(model);
      if (!isInstagramPostUrl(model.pageUrl) && !selected) {
        return { ok: false, reason: "CURRENT_CONTENT_NOT_PROVEN", provider: "instagram", candidates: [], blocked: [] };
      }
      return collectContainer(model, selected
        ? new Set(["content-image", "content-video"])
        : new Set(["post-image", "post-video"]));
    },
    xiaohongshu(model) {
      const selected = hasSingleExplicitMediaSelection(model);
      if (!isXiaohongshuDetailUrl(model.pageUrl) && !selected) {
        return { ok: false, reason: "XIAOHONGSHU_NOTE_REQUIRED", provider: "xiaohongshu", candidates: [], blocked: [] };
      }
      return collectContainer(model, selected
        ? new Set(["content-image", "content-video"])
        : new Set(["post-image", "post-video"]));
    },
    bilibili(model) {
      if (!/^https?:\/\/(?:www\.)?bilibili\.com\/video\//i.test(String(model.pageUrl || ""))) {
        return { ok: false, reason: "CURRENT_CONTENT_NOT_PROVEN", provider: "bilibili", candidates: [], blocked: [] };
      }
      const candidates = [];
      const rejected = [];
      if (model.meta?.image) candidates.push({
        url: model.meta.image,
        kind: "image",
        role: "video-cover",
        label: model.pageTitle,
        sourceEvidence: "structured-metadata",
        mimeHint: model.meta.imageMime || ""
      });
      for (const video of model.structured?.progressiveVideos || []) {
        candidates.push({
          ...video,
          kind: "video",
          role: "post-video",
          label: model.pageTitle,
          sourceEvidence: "provider-structured-data",
          mediaCompleteness: "single-file-complete",
          audioStatus: "requires-probe"
        });
      }
      if (model.structured?.hasSegmentedDurl) {
        rejected.push(blocked({ url: "", kind: "video", role: "post-video" }, "DASH_OR_AUDIO_UNVERIFIED"));
      }
      if (model.structured?.hasDash || (model.meta?.video && !(model.structured?.progressiveVideos || []).length)) {
        rejected.push(blocked({ url: model.meta?.video || "", kind: "video", role: "post-video" }, "DASH_OR_AUDIO_UNVERIFIED"));
      }
      return {
        ok: candidates.length > 0,
        reason: candidates.length ? "" : "CURRENT_COVER_NOT_FOUND",
        provider: "bilibili", candidates, blocked: rejected, incompleteCount: 0
      };
    },
    youtube(model) {
      if (!/^https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:watch\?|shorts\/)/i.test(String(model.pageUrl || ""))
        && !/^https?:\/\/youtu\.be\//i.test(String(model.pageUrl || ""))) {
        return { ok: false, reason: "CURRENT_CONTENT_NOT_PROVEN", provider: "youtube", candidates: [], blocked: [] };
      }
      const candidates = [];
      if (model.meta?.image) candidates.push({
        url: model.meta.image,
        kind: "image",
        role: "video-cover",
        label: model.pageTitle,
        sourceEvidence: "structured-metadata",
        mimeHint: model.meta.imageMime || ""
      });
      return {
        ok: candidates.length > 0,
        reason: candidates.length ? "" : "CURRENT_COVER_NOT_FOUND",
        provider: "youtube",
        candidates,
        blocked: [blocked({ url: model.meta?.video || "", kind: "video", role: "post-video" }, "YOUTUBE_OFFICIAL_DOWNLOAD_ONLY")],
        incompleteCount: 0
      };
    },
    generic(model) {
      return collectContainer(model, new Set(["content-image", "content-video", "post-image", "post-video"]));
    }
  };

  const originalDouyin = registry.douyin;
  registry.douyin = function douyin(model) {
    if (!isDouyinDetailUrl(model.pageUrl)) {
      return { ok: false, reason: "CURRENT_CONTENT_NOT_PROVEN", provider: "douyin", candidates: [], blocked: [] };
    }
    const containerResult = originalDouyin(model);
    const structuredCandidates = [
      ...(model.structured?.images || []).map((image) => ({
        ...image,
        kind: "image",
        role: "post-image",
        label: model.pageTitle,
        sourceEvidence: "provider-structured-data"
      })),
      ...(model.structured?.progressiveVideos || []).map((video) => ({
        ...video,
        kind: "video",
        role: "post-video",
        label: model.pageTitle,
        sourceEvidence: "provider-structured-data",
        mediaCompleteness: "single-file-complete",
        audioStatus: "requires-probe"
      }))
    ];
    if (!structuredCandidates.length) return containerResult;
    return {
      ok: true,
      reason: "",
      provider: "douyin",
      candidates: [...(containerResult.candidates || []), ...structuredCandidates],
      blocked: containerResult.blocked || [],
      incompleteCount: containerResult.incompleteCount || 0
    };
  };

  function collect(model = {}) {
    const provider = registry[model.provider] ? model.provider : providerFor(model.pageUrl);
    return registry[provider]({ ...model, provider });
  }

  return {
    collect,
    isDouyinDetailUrl,
    isWeiboDetailUrl,
    isXiaohongshuDetailUrl,
    isInstagramPostUrl,
    providerFor,
    wholeSaveLabel,
    wholeSaveMenuTitle,
    pageStateLabel,
    supportsPostMode,
    pageActionFor,
    registry
  };
});
