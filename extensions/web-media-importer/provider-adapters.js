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
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return "youtube";
    return "generic";
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
        candidate.mediaCompleteness !== "single-file-complete" || candidate.audioStatus !== "present"
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

  return { collect, isDouyinDetailUrl, isWeiboDetailUrl, providerFor, registry };
});
