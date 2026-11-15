(() => {
  if (globalThis.__eagleWebMediaImporterLoaded) return;
  globalThis.__eagleWebMediaImporterLoaded = true;
  const MAX_DOM_CANDIDATES = 500;
  const MAX_CONTENT_CONTAINERS = 100;
  const MAX_INSTAGRAM_CAROUSEL_STEPS = 20;
  const CONTEXT_MEDIA_TTL_MS = 15_000;
  let lastContextMedia = null;
  let quickSaveHost = null;
  let quickSaveTarget = null;
  let quickSaveHideTimer = 0;

  document.addEventListener("contextmenu", (event) => {
    lastContextMedia = captureContextMedia(event);
  }, true);
  document.addEventListener("pointerover", (event) => showQuickActionsFor(event.target), true);
  document.addEventListener("pointerout", (event) => hideQuickActionsAfterPointerOut(event), true);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "web-media-error") {
      showToast(String(message.error || "当前页面无法读取媒体"), "error");
      return;
    }
    if (message?.type !== "collect-web-media") return;
    openImportPicker(message).catch((error) => showToast(String(error?.message || "无法读取当前网页媒体"), "error"));
  });

  async function sendRuntimeMessage(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (/extension context invalidated/i.test(String(error?.message || error))) {
        const messageText = "扩展上下文已更新，请刷新当前页面后重试";
        showToast(messageText, "error");
        const contextError = new Error(messageText);
        contextError.code = "EXTENSION_CONTEXT_INVALIDATED";
        throw contextError;
      }
      throw error;
    }
  }

  async function openImportPicker(request) {
    removeUi();
    const requestedPage = EagleWebMediaCore.canonicalUrl(request?.sourcePageUrl || "");
    const currentPage = EagleWebMediaCore.canonicalUrl(location.href);
    // SPA sites (notably Xiaohongshu) can update the route between the native
    // context-menu event and delivery of the runtime message. A selected
    // media item is still safe to continue when it is present in the current
    // DOM; page/batch scans retain the strict URL identity gate.
    if (requestedPage !== currentPage) {
      const selectedUrl = String(request?.sourceUrl || "");
      const selectedElement = ["selected", "context-selected"].includes(request?.mode) && selectedUrl ? findMediaElement(selectedUrl) : null;
      if (!selectedElement) {
        throw new Error("网页已经切换，旧页面的媒体请求已取消；请在当前页面重新操作");
      }
    }
    const settingsResponse = await sendRuntimeMessage({ type: "get-web-media-settings" });
    const settings = settingsResponse?.settings || {};
    const model = await capturePageModel(request);
    const collected = EagleWebMediaProviders.collect(model);
    if (!collected.ok) throw new Error(reasonText(collected.reason));
    const plan = EagleWebMediaCore.buildBatchPlan(collected.candidates, {
      pageUrl: location.href,
      pageTitle: document.title,
      provider: collected.provider,
      incompleteCount: collected.incompleteCount,
      ...settings
    });
    plan.skipped.push(...(collected.blocked || []).map((entry) => ({ ...entry, reason: entry.reason })));
    if (!plan.ready.length) {
      const reasons = [...new Set(plan.skipped.map((item) => reasonText(item.reason)))].join("；");
      throw new Error(reasons || "当前内容没有可以安全下载的媒体");
    }
    const folderResponse = await sendRuntimeMessage({ type: "get-eagle-folders" });
    if (!folderResponse?.ok) throw new Error(folderResponse?.error || "无法读取 Eagle 文件夹");
    chooseFolder(folderResponse.folders || [], plan, folderResponse.recent || []);
  }

  async function capturePageModel(request = {}) {
    const provider = EagleWebMediaProviders.providerFor(location.href);
    const meta = {
      image: metaContent('meta[property="og:image"],meta[name="twitter:image"]'),
      imageMime: metaContent('meta[property="og:image:type"]'),
      video: metaContent('meta[property="og:video"],meta[property="og:video:url"],meta[name="twitter:player:stream"]')
    };
    const selectedContext = request.mode === "context-selected" ? recentContextMedia() : null;
    const selectedUrl = String(request.sourceUrl || selectedContext?.url || "");
    const selectedElement = selectedContext?.element || (selectedUrl ? findMediaElement(selectedUrl) : null);
    if (request.mode === "post" && provider === "instagram") {
      const root = findInstagramPostRoot(selectedElement) || findUniqueVisibleInstagramPost();
      if (!root) throw new Error("无法确认当前 Instagram 帖子；请在帖子的图片或视频上右键后重试");
      const carousel = await captureInstagramCarousel(root);
      return {
        provider,
        pageUrl: location.href,
        pageTitle: document.title,
        meta,
        containers: [{ id: "instagram-selected-post", owned: true, ...carousel }],
        structured: {}
      };
    }
    if (request.mode === "post" && provider === "xiaohongshu") {
      const root = findXiaohongshuNoteRoot(selectedElement) || findUniqueVisibleXiaohongshuNote();
      if (!root) throw new Error("无法确认当前小红书笔记的整帖范围；可先使用“保存当前图片”保存封面");
      return {
        provider,
        pageUrl: location.href,
        pageTitle: document.title,
        meta,
        containers: [{
          id: "xiaohongshu-current-note",
          owned: true,
          candidates: captureXiaohongshuPostMedia(root),
          incompleteCount: detectIncompleteCount(root)
        }],
        structured: {}
      };
    }
    if ((request.mode === "selected" || request.mode === "context-selected") && selectedUrl) {
      return {
        provider,
        pageUrl: location.href,
        pageTitle: document.title,
        meta,
        explicitSelection: true,
        containers: [{
          id: `${provider}-selected`,
          owned: true,
          candidates: [candidateForSelected({ ...request, sourceUrl: selectedUrl, selectedKind: request.selectedKind || selectedContext?.kind }, selectedElement)],
          incompleteCount: 0
        }],
        structured: {}
      };
    }
    if (request.mode === "context-selected") throw new Error("没有识别到右键处的图片或视频；请直接在封面上右键，或点击悬浮的保存按钮");
    const selectors = provider === "weibo"
      ? ["article", "[mid]", "[data-testid*='feed']"]
      : provider === "douyin"
        ? ["article", "[data-e2e*='feed']", "[data-e2e*='video']"]
        : ["article", "main"];
    const elements = uniqueElements(selectors.flatMap((selector) => [...document.querySelectorAll(selector)].slice(0, MAX_CONTENT_CONTAINERS)))
      .slice(0, MAX_CONTENT_CONTAINERS);
    const selectedContainer = selectedElement?.closest(selectors.join(","));
    const visible = elements.filter(isVisible);
    let ownedElement = selectedContainer || null;
    if (!ownedElement && request.mode !== "selected") {
      if (visible.length === 1) ownedElement = visible[0];
      else ownedElement = uniquelyCentered(visible);
    }
    const containers = elements.map((element, index) => ({
      id: `${provider}-${index + 1}`,
      owned: element === ownedElement,
      candidates: captureContainerMedia(element, provider),
      incompleteCount: detectIncompleteCount(element)
    }));

    return {
      provider,
      pageUrl: location.href,
      pageTitle: document.title,
      meta,
      containers,
      structured: captureStructuredMedia(provider)
    };
  }

  function captureStructuredMedia(provider) {
    if (provider === "bilibili") return captureBilibiliPlayInfo();
    if (provider === "douyin") return captureDouyinRenderData();
    return {};
  }

  function captureBilibiliPlayInfo() {
    return EagleWebStructuredMedia.extractBilibili([...document.scripts].map((script) => script.textContent || ""));
  }

  function captureDouyinRenderData() {
    const currentId = location.pathname.match(/\/(?:video|note)\/(\d+)/)?.[1]
      || new URL(location.href).searchParams.get("modal_id")
      || "";
    if (!currentId) return {};
    const render = document.getElementById("RENDER_DATA");
    return EagleWebStructuredMedia.extractDouyin(render?.textContent || "", currentId);
  }

  function captureContainerMedia(container, provider) {
    const entries = [];
    for (const image of container.querySelectorAll("img")) {
      if (entries.length >= MAX_DOM_CANDIDATES) break;
      if (provider === "instagram" && !isLargePostMedia(image)) continue;
      const url = bestImageUrl(image);
      if (!url) continue;
      const role = isPageChrome(image) ? "avatar" : (provider === "generic" ? "content-image" : "post-image");
      entries.push({
        url,
        kind: "image",
        role,
        label: image.alt || document.title,
        sourceEvidence: "dom-media-element",
        mimeHint: image.type || ""
      });
    }
    for (const video of container.querySelectorAll("video")) {
      if (entries.length >= MAX_DOM_CANDIDATES) break;
      if (provider === "instagram" && !isLargePostMedia(video)) continue;
      const urls = [video.currentSrc || video.src, ...[...video.querySelectorAll("source")].map((source) => source.src)];
      for (const url of urls.filter(Boolean)) {
        if (entries.length >= MAX_DOM_CANDIDATES) break;
        entries.push({
          url,
          kind: "video",
          role: provider === "generic" ? "content-video" : "post-video",
          label: video.getAttribute("aria-label") || document.title,
          sourceEvidence: "dom-media-element",
          mediaCompleteness: directVideoCompleteness(url),
          audioStatus: audioProof(video) === "present" ? "present" : "requires-probe"
        });
      }
      if (video.poster && entries.length < MAX_DOM_CANDIDATES) entries.push({
        url: video.poster,
        kind: "image",
        role: provider === "generic" ? "content-image" : "post-image",
        label: `${document.title}-封面`,
        sourceEvidence: "dom-media-element"
      });
    }
    return entries;
  }

  function captureXiaohongshuPostMedia(root) {
    const entries = [];
    const seen = new Set();
    for (const image of root.querySelectorAll("img")) {
      if (entries.length >= MAX_DOM_CANDIDATES || !isXiaohongshuBodyMedia(image, root)) continue;
      const url = bestImageUrl(image);
      const identity = EagleWebMediaCore.canonicalUrl(url);
      if (!url || seen.has(identity)) continue;
      seen.add(identity);
      entries.push({
        url, kind: "image", role: "post-image", label: image.alt || document.title,
        sourceEvidence: "dom-media-element", mimeHint: image.type || ""
      });
    }
    for (const video of root.querySelectorAll("video")) {
      if (entries.length >= MAX_DOM_CANDIDATES || !isXiaohongshuBodyMedia(video, root)) continue;
      const url = video.currentSrc || video.src || video.querySelector("source")?.src || "";
      const identity = EagleWebMediaCore.canonicalUrl(url);
      if (!url || seen.has(identity)) continue;
      seen.add(identity);
      entries.push({
        url, kind: "video", role: "post-video", label: video.getAttribute("aria-label") || document.title,
        sourceEvidence: "dom-media-element", mediaCompleteness: directVideoCompleteness(url),
        audioStatus: audioProof(video) === "present" ? "present" : "requires-probe"
      });
    }
    return entries;
  }

  function isXiaohongshuBodyMedia(element, root) {
    if (!(element instanceof Element) || !root.contains(element) || !isVisible(element) || !isLargePostMedia(element)) return false;
    if (isPageChrome(element)) return false;
    const scoped = element.closest('[class*="avatar" i],[class*="profile" i],[class*="user" i],[class*="comment" i],[class*="reply" i],[class*="emoji" i],[class*="sticker" i],[class*="icon" i],[aria-label*="头像"],[aria-label*="表情"]');
    if (scoped && scoped !== root) return false;
    const evidence = [element.className, element.getAttribute("alt"), element.getAttribute("aria-label"), bestImageUrl(element)]
      .filter((value) => typeof value === "string").join(" ");
    return !/(?:avatar|profile|comment|reply|emoji|sticker|icon|face|expression|头像|表情)/i.test(evidence);
  }

  function bestImageUrl(image) {
    const candidates = String(image.getAttribute("srcset") || "").split(",").map((part) => {
      const match = part.trim().match(/^(\S+)(?:\s+(\d+(?:\.\d+)?)(w|x))?$/);
      if (!match) return null;
      return { url: match[1], score: Number(match[2] || 0) * (match[3] === "x" ? 10_000 : 1) };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    return candidates[0]?.url || image.currentSrc || image.src || image.getAttribute("data-src") || "";
  }

  function isLargePostMedia(element) {
    const rect = element.getBoundingClientRect();
    return rect.width >= 180 && rect.height >= 180;
  }

  function findInstagramPostRoot(element) {
    if (!(element instanceof Element)) return null;
    const root = element.closest("article");
    return root && containsUsableInstagramMedia(root) ? root : null;
  }

  function findUniqueVisibleInstagramPost() {
    const posts = [...document.querySelectorAll("article")]
      .filter((article) => isVisible(article) && containsUsableInstagramMedia(article));
    return posts.length === 1 ? posts[0] : null;
  }

  function findXiaohongshuNoteRoot(element) {
    const selector = '[role="dialog"],[aria-modal="true"],[class*="note-detail" i],[class*="note-container" i],[class*="note-content" i]';
    if (element instanceof Element) {
      const selectedRoot = element.closest(selector);
      if (selectedRoot && isVisible(selectedRoot) && containsUsableXiaohongshuMedia(selectedRoot)) return selectedRoot;
    }
    return null;
  }

  function findUniqueVisibleXiaohongshuNote() {
    const selector = '[role="dialog"],[aria-modal="true"],[class*="note-detail" i],[class*="note-container" i],[class*="note-content" i]';
    const notes = uniqueElements([...document.querySelectorAll(selector)])
      .filter((root) => isVisible(root) && containsUsableXiaohongshuMedia(root));
    return notes.length === 1 ? notes[0] : null;
  }

  function containsUsableXiaohongshuMedia(root) {
    return [...root.querySelectorAll("img,video")].some((element) => isVisible(element) && isLargePostMedia(element));
  }

  function containsUsableInstagramMedia(root) {
    return [...root.querySelectorAll("img,video")].some((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width >= 180 && rect.height >= 180;
    });
  }

  async function captureInstagramCarousel(root) {
    const media = new Map();
    let movedBack = 0;
    let movedForward = 0;
    const addVisibleMedia = () => {
      for (const candidate of captureContainerMedia(root, "instagram")) {
        if (candidate.role !== "post-image" && candidate.role !== "post-video") continue;
        const identity = `${candidate.kind}:${EagleWebMediaCore.canonicalUrl(candidate.url)}`;
        if (!media.has(identity)) media.set(identity, candidate);
      }
    };
    try {
      addVisibleMedia();
      movedBack = await moveInstagramCarousel(root, "previous", addVisibleMedia);
      addVisibleMedia();
      movedForward = await moveInstagramCarousel(root, "next", addVisibleMedia);
      addVisibleMedia();
    } finally {
      await moveInstagramCarouselSteps(root, "previous", Math.max(0, movedForward - movedBack));
    }
    const declaredTotal = instagramCarouselTotal(root);
    return {
      candidates: [...media.values()],
      incompleteCount: Math.max(0, declaredTotal - media.size)
    };
  }

  async function moveInstagramCarousel(root, direction, onMedia) {
    let moves = 0;
    for (let attempt = 0; attempt < MAX_INSTAGRAM_CAROUSEL_STEPS; attempt += 1) {
      onMedia();
      const button = findInstagramCarouselButton(root, direction);
      if (!button) break;
      const before = instagramMediaSignature(root);
      button.click();
      if (!(await waitForInstagramMediaChange(root, before))) break;
      moves += 1;
    }
    return moves;
  }

  async function moveInstagramCarouselSteps(root, direction, steps) {
    for (let index = 0; index < steps; index += 1) {
      const button = findInstagramCarouselButton(root, direction);
      if (!button) break;
      const before = instagramMediaSignature(root);
      button.click();
      if (!(await waitForInstagramMediaChange(root, before))) break;
    }
  }

  function findInstagramCarouselButton(root, direction) {
    const media = largestVisibleMediaRect(root);
    if (!media) return null;
    const labels = direction === "next"
      ? ["next", "下一步", "下一张", "下一个", "suivant", "weiter", "avanti", "siguiente", "次へ", "다음"]
      : ["previous", "prev", "上一步", "上一张", "上一个", "précédent", "zurück", "indietro", "anterior", "前へ", "이전"];
    return [...root.querySelectorAll("button")].find((button) => {
      if (button.disabled) return false;
      const rect = button.getBoundingClientRect();
      if (rect.width < 16 || rect.height < 16 || rect.width > 96 || rect.height > 96) return false;
      const label = [button.getAttribute("aria-label"), button.title, button.querySelector("svg title")?.textContent]
        .filter(Boolean).join(" ").toLowerCase();
      if (labels.some((word) => label.includes(word))) return true;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return centerY >= media.top && centerY <= media.bottom
        && (direction === "next" ? centerX > media.left + media.width * .72 : centerX < media.left + media.width * .28);
    }) || null;
  }

  function largestVisibleMediaRect(root) {
    return [...root.querySelectorAll("img,video")].map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width >= 180 && rect.height >= 180)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0] || null;
  }

  function instagramMediaSignature(root) {
    const rootRect = root.getBoundingClientRect();
    const centerX = rootRect.left + rootRect.width / 2;
    return [...root.querySelectorAll("img,video")]
      .filter(isLargePostMedia)
      .map((element) => ({
        element,
        rect: element.getBoundingClientRect()
      }))
      .sort((a, b) => Math.abs((a.rect.left + a.rect.right) / 2 - centerX) - Math.abs((b.rect.left + b.rect.right) / 2 - centerX))
      .slice(0, 2)
      .map(({ element }) => bestImageUrl(element) || element.currentSrc || element.src || element.poster || "")
      .join("|");
  }

  function waitForInstagramMediaChange(root, previous) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (instagramMediaSignature(root) !== previous) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - startedAt >= 1_800) {
          clearInterval(timer);
          resolve(false);
        }
      }, 80);
    });
  }

  function instagramCarouselTotal(root) {
    const text = root.textContent || "";
    const match = text.match(/\b\d+\s*\/\s*(\d{1,2})\b/);
    return match ? Math.min(MAX_INSTAGRAM_CAROUSEL_STEPS + 1, Number(match[1])) : 0;
  }

  function candidateForSelected(request, element) {
    const kind = request.selectedKind === "image" || request.selectedKind === "video"
      ? request.selectedKind
      : selectedMediaKind(request.sourceUrl);
    return {
      url: String(request.sourceUrl || ""),
      kind,
      role: kind === "video" ? "content-video" : "content-image",
      label: document.title,
      sourceEvidence: "user-selected-media",
      mediaCompleteness: kind === "video" ? directVideoCompleteness(request.sourceUrl) : "",
      audioStatus: kind === "video" ? (audioProof(element) === "present" ? "present" : "requires-probe") : ""
    };
  }

  function captureContextMedia(event) {
    const element = [...event.composedPath()].find((entry) => entry instanceof HTMLImageElement || entry instanceof HTMLVideoElement) || null;
    const media = mediaInfoForElement(element);
    return media ? { ...media, element, capturedAt: Date.now() } : null;
  }

  function recentContextMedia() {
    if (!lastContextMedia || Date.now() - lastContextMedia.capturedAt > CONTEXT_MEDIA_TTL_MS) return null;
    return document.documentElement.contains(lastContextMedia.element) ? lastContextMedia : null;
  }

  function mediaInfoForElement(element) {
    if (element instanceof HTMLVideoElement) {
      const videoUrl = element.currentSrc || element.src || element.querySelector("source")?.src || "";
      if (videoUrl && !/^blob:/i.test(videoUrl)) return { url: videoUrl, kind: "video" };
      if (element.poster) return { url: element.poster, kind: "image" };
      return null;
    }
    if (element instanceof HTMLImageElement) {
      const url = bestImageUrl(element);
      return url ? { url, kind: "image" } : null;
    }
    return null;
  }

  function showQuickActionsFor(target) {
    const element = target instanceof Element ? target.closest("img,video") : null;
    const media = mediaInfoForElement(element);
    if (!element || !media || !isVisible(element)) return;
    clearTimeout(quickSaveHideTimer);
    quickSaveTarget = element;
    const action = EagleWebMediaProviders.pageActionFor(location.href);
    const postAction = action.collectible && action.mode === "post";
    const rect = element.getBoundingClientRect();
    const host = ensureQuickSaveHost();
    host.style.top = `${Math.max(8, Math.min(innerHeight - 48, rect.top + 10))}px`;
    host.style.left = `${Math.max(8, Math.min(innerWidth - (postAction ? 304 : 164), rect.right - (postAction ? 294 : 154)))}px`;
    host.dataset.url = media.url;
    host.dataset.kind = media.kind;
    host.dataset.postAction = postAction ? "true" : "false";
    host.style.display = "block";
    host.shadowRoot.querySelector("[data-save-single]").textContent = media.kind === "video" ? "保存当前视频至 Eagle" : "保存当前图片至 Eagle";
    host.shadowRoot.querySelector("[data-save-post]").hidden = !postAction;
    host.shadowRoot.querySelector("[data-save-post]").textContent = `${action.label}至 Eagle`;
  }

  function hideQuickActionsAfterPointerOut(event) {
    if (!quickSaveHost || !quickSaveTarget || event.target !== quickSaveTarget) return;
    if (quickSaveHost.contains(event.relatedTarget)) return;
    quickSaveHideTimer = setTimeout(() => {
      if (quickSaveHost && !quickSaveHost.matches(":hover")) quickSaveHost.style.display = "none";
    }, 160);
  }

  function ensureQuickSaveHost() {
    if (quickSaveHost?.isConnected) return quickSaveHost;
    quickSaveHost = document.createElement("div");
    quickSaveHost.id = "eagle-web-media-quick-save";
    quickSaveHost.style.cssText = "position:fixed;z-index:2147483645;display:none";
    const shadow = quickSaveHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `.actions{display:flex;gap:7px;padding:6px;border:1px solid #ffffff33;border-radius:11px;background:#171717e8;box-shadow:0 10px 30px #0007;font:13px/1.2 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.actions button{min-height:32px;padding:0 10px;border:0;border-radius:7px;background:#fff;color:#161616;cursor:pointer;font:inherit;font-weight:650;white-space:nowrap}.actions button[data-save-post]{background:#1769e0;color:#fff}.actions button:focus-visible{outline:3px solid #7eb6ff;outline-offset:2px}`;
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.innerHTML = `<button type="button" data-save-single></button><button type="button" data-save-post></button>`;
    actions.querySelector("[data-save-single]").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const host = event.currentTarget.getRootNode().host;
      openImportPicker({ mode: "selected", sourceUrl: host.dataset.url, selectedKind: host.dataset.kind, sourcePageUrl: location.href })
        .catch((error) => showToast(String(error?.message || "无法保存当前媒体"), "error"));
    });
    actions.querySelector("[data-save-post]").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const host = event.currentTarget.getRootNode().host;
      openImportPicker({ mode: "post", sourceUrl: host.dataset.url, selectedKind: host.dataset.kind, sourcePageUrl: location.href })
        .catch((error) => showToast(String(error?.message || "无法保存当前帖子"), "error"));
    });
    shadow.append(style, actions);
    document.documentElement.append(quickSaveHost);
    return quickSaveHost;
  }

  function directVideoCompleteness(url) {
    const extension = EagleWebMediaCore.extensionForUrl(url);
    // A file suffix is only a hint. The background will verify the real MIME
    // and container before Chrome downloads a complete video, so a direct
    // media element without a suffix may still enter that safe probe path.
    return EagleWebMediaCore.STREAM_EXTENSIONS.has(extension) ? "unknown" : "requires-probe";
  }

  function audioProof(video) {
    if (!video) return "unknown";
    if (video.mozHasAudio === true) return "present";
    if (video.audioTracks && video.audioTracks.length > 0) return "present";
    return "unknown";
  }

  function selectedMediaKind(url) {
    const extension = EagleWebMediaCore.extensionForUrl(url);
    if (EagleWebMediaCore.IMAGE_EXTENSIONS.has(extension)) return "image";
    if (EagleWebMediaCore.VIDEO_EXTENSIONS.has(extension)) return "video";
    return "unknown";
  }

  function metaContent(selector) {
    return document.querySelector(selector)?.content || "";
  }

  function findMediaElement(url) {
    return [...document.querySelectorAll("img,video,source")].find((element) => {
      const values = [element.currentSrc, element.src, element.getAttribute?.("src"), element.getAttribute?.("data-src")];
      return values.some((value) => value && EagleWebMediaCore.canonicalUrl(value) === EagleWebMediaCore.canonicalUrl(url));
    }) || null;
  }

  function uniqueElements(elements) {
    return [...new Set(elements)].filter((element) => !elements.some((parent) => parent !== element && parent.contains(element)));
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width >= 120 && rect.height >= 120 && rect.bottom > 0 && rect.top < innerHeight
      && style.display !== "none" && style.visibility !== "hidden";
  }

  function uniquelyCentered(elements) {
    const center = innerHeight / 2;
    const ranked = elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { element, distance: Math.abs((rect.top + rect.bottom) / 2 - center) };
    }).sort((a, b) => a.distance - b.distance);
    if (!ranked.length) return null;
    if (ranked.length > 1 && ranked[1].distance - ranked[0].distance < 80) return null;
    return ranked[0].element;
  }

  function isPageChrome(element) {
    const owner = element.closest('[class*="avatar" i],[class*="profile" i],[class*="user" i],[aria-label*="头像"]');
    const width = Number(element.naturalWidth || element.width || 0);
    const height = Number(element.naturalHeight || element.height || 0);
    return Boolean(owner) || (width > 0 && height > 0 && width <= 96 && height <= 96);
  }

  function detectIncompleteCount(container) {
    const declared = Number(container.getAttribute("data-total") || container.getAttribute("aria-setsize") || 0);
    const loaded = container.querySelectorAll("img,video").length;
    return declared > loaded ? declared - loaded : 0;
  }

  function chooseFolder(folders, plan, recent = []) {
    const flat = flattenFolders(folders).filter((folder) => EagleWebMediaCore.isSelectableFolder(folder));
    if (!flat.length) throw new Error("当前 Eagle 资源库没有可选的普通文件夹");
    const host = document.createElement("div");
    host.id = "eagle-web-media-picker";
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `:host{all:initial}.backdrop{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:rgba(0,0,0,.56);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.backdrop section{display:grid;grid-template-rows:auto auto minmax(120px,1fr) auto;width:min(680px,calc(100vw - 28px));max-height:min(760px,calc(100vh - 36px));overflow:hidden;border-radius:14px;background:#f6f6f4;color:#202124;box-shadow:0 20px 80px #0008}.backdrop header{display:flex;justify-content:space-between;gap:18px;padding:20px 22px 12px}.backdrop h2{margin:0;font-size:20px}.backdrop p,.backdrop footer{margin:5px 0 0;color:#696969;font-size:13px;line-height:1.5}.backdrop footer{display:grid;gap:8px;padding:12px 22px;border-top:1px solid #ddd}.backdrop input{margin:0 18px 12px;padding:11px 12px;border:1px solid #ccc;border-radius:9px;font:inherit}.folders{overflow:auto;padding:4px 14px 16px}.folder-section{padding:15px 10px 6px;color:#777;font-size:12px;font-weight:650}.folder-divider{height:1px;margin:10px 8px;background:#ddd}.folders button{display:grid;gap:3px;width:100%;padding:11px calc(12px + var(--depth) * 18px);border:0;border-radius:8px;background:transparent;text-align:left;cursor:pointer}.folders button:hover{background:#dce9ff}.folders small{overflow:hidden;color:#8a8a8a;text-overflow:ellipsis;white-space:nowrap}.backdrop header button{min-height:32px;padding:0 12px;border:0;border-radius:7px;background:#1769e0;color:#fff;cursor:pointer}.warning{color:#9b4a00}@media(prefers-color-scheme:dark){.backdrop section{background:#242424;color:#f2f2f2}.backdrop p,.backdrop footer,.folders small,.folder-section{color:#b5b5b5}.backdrop footer,.folder-divider{border-color:#444;background:#444}.backdrop input{border-color:#555;background:#191919;color:#fff}.folders button:hover{background:#29436b}}`;
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    const panel = document.createElement("section");
    const skipped = plan.skipped.length ? `；已拦截/跳过 ${plan.skipped.length} 项` : "";
    const incomplete = plan.incompleteCount ? `；页面提示可能还有 ${plan.incompleteCount} 项未加载` : "";
    const estimated = plan.estimatedBytes ? formatBytes(plan.estimatedBytes) : "未知（下载后仍会执行硬上限）";
    const title = `${EagleWebMediaProviders.wholeSaveLabel(plan.provider)}至 Eagle`;
    const warning = plan.skipped.length || plan.incompleteCount
      ? `<span class="warning">未通过安全校验或尚未加载的媒体不会被导入。</span>` : "";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.innerHTML = `<header><div><h2 id="eagle-web-media-picker-title">${title}</h2><p>可导入 ${plan.ready.length} 项；估计大小 ${estimated}${skipped}${incomplete}</p></div><button type="button" data-close>取消</button></header><input type="search" placeholder="搜索 Eagle 普通文件夹…" aria-label="搜索 Eagle 普通文件夹"><div class="folders"></div><footer><span>点击文件夹后立即创建导入任务。</span>${warning}</footer>`;
    backdrop.append(panel);
    shadow.append(style, backdrop);
    document.documentElement.append(host);
    const search = panel.querySelector('input[type="search"]');
    const list = panel.querySelector(".folders");
    const render = () => {
      const query = search.value.trim().toLowerCase();
      list.replaceChildren();
      const matches = flat.filter((folder) => !query || folder.path.toLowerCase().includes(query));
      const renderFolder = (folder, depth = folder.depth) => {
        const button = document.createElement("button");
        button.type = "button";
        button.style.setProperty("--depth", String(depth));
        button.innerHTML = `<strong></strong><small></small>`;
        button.querySelector("strong").textContent = folder.name;
        button.querySelector("small").textContent = folder.path;
        button.addEventListener("click", () => {
          beginImport(plan, folder, panel);
        });
        list.append(button);
      };
      const recentFolders = query ? [] : (Array.isArray(recent) ? recent : [])
        .map((recentFolder) => flat.find((folder) => String(folder.id) === String(recentFolder?.id || "")))
        .filter((folder, index, values) => folder && values.findIndex((value) => value.id === folder.id) === index)
        .slice(0, 8);
      if (recentFolders.length) {
        const heading = document.createElement("div");
        heading.className = "folder-section";
        heading.textContent = "最近使用";
        list.append(heading);
        recentFolders.forEach((folder) => renderFolder(folder, 0));
        const divider = document.createElement("div");
        divider.className = "folder-divider";
        list.append(divider);
      }
      const heading = document.createElement("div");
      heading.className = "folder-section";
      heading.textContent = query ? "搜索结果" : "全部普通文件夹";
      list.append(heading);
      const recentIds = new Set(recentFolders.map((folder) => String(folder.id)));
      matches.filter((folder) => query || !recentIds.has(String(folder.id))).forEach((folder) => renderFolder(folder));
    };
    panel.querySelector("[data-close]").addEventListener("click", removeUi);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) removeUi(); });
    shadow.addEventListener("keydown", (event) => { if (event.key === "Escape") removeUi(); });
    search.addEventListener("input", render);
    render();
    search.focus();
  }

  async function beginImport(plan, folder, panel) {
    panel.querySelectorAll("button,input").forEach((element) => { element.disabled = true; });
    try {
      const result = await sendRuntimeMessage({ type: "import-web-media", plan, folderId: folder.id });
      if (!result?.ok) throw new Error(result?.error || "导入任务创建失败");
      removeUi();
      showToast(`已创建 ${result.summary?.pending || plan.ready.length} 项可恢复任务；可在扩展弹窗查看进度`, "success");
    } catch (error) {
      panel.querySelectorAll("button,input").forEach((element) => { element.disabled = false; });
      showToast(String(error?.message || "导入任务创建失败"), "error");
    }
  }

  function flattenFolders(folders, depth = 0, parent = "") {
    return (Array.isArray(folders) ? folders : []).flatMap((folder) => {
      const path = parent ? `${parent} / ${folder.name}` : String(folder.name || "未命名文件夹");
      return [{ ...folder, path, depth }, ...flattenFolders(folder.children || [], depth + 1, path)];
    });
  }

  function formatBytes(value) {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }

  function reasonText(reason) {
    return {
      CURRENT_CONTENT_AMBIGUOUS: "当前屏幕有多个帖子，无法证明你要保存哪一个；请在目标图片或视频上右键保存",
      CURRENT_CONTENT_NOT_PROVEN: "无法证明媒体属于当前帖子；请在目标媒体上右键保存",
      XIAOHONGSHU_NOTE_REQUIRED: "当前是小红书推荐流；请先打开一条具体笔记，再保存当前小红书整帖",
      CURRENT_CONTENT_HAS_NO_DIRECT_MEDIA: "当前内容没有公开直连媒体",
      CURRENT_COVER_NOT_FOUND: "没有找到当前视频的公开封面",
      BROWSER_BLOB: "浏览器临时视频不能作为完整文件保存",
      STREAM_MANIFEST: "HLS/DASH 分片流不能作为单文件下载",
      DASH_OR_AUDIO_UNVERIFIED: "视频可能分轨或无法确认声音，已阻止导入",
      YOUTUBE_OFFICIAL_DOWNLOAD_ONLY: "YouTube 视频只允许官方下载流程，本插件仅保存封面",
      DATA_URL: "页面内嵌数据不是独立媒体文件",
      ACTIVE_MEDIA_BLOCKED: "可执行 SVG 等主动内容已被安全阻止",
      UNVERIFIED_MEDIA_URL: "媒体地址真实性无法在下载前证明"
    }[reason] || "媒体地址不可用";
  }

  function removeUi() {
    document.getElementById("eagle-web-media-picker")?.remove();
  }

  function showToast(message, type = "info") {
    document.getElementById("eagle-web-media-toast")?.remove();
    const host = document.createElement("div");
    host.id = "eagle-web-media-toast";
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `:host{all:initial}.toast{position:fixed;right:20px;bottom:20px;z-index:2147483647;max-width:min(420px,calc(100vw - 40px));padding:12px 15px;border-radius:10px;background:#202124;color:#fff;box-shadow:0 10px 40px #0006;font:14px/1.45 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.toast[data-type="success"]{background:#176b3a}.toast[data-type="error"]{background:#a12b2b}`;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.dataset.type = type;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.textContent = message;
    shadow.append(style, toast);
    document.documentElement.append(host);
    setTimeout(() => host.remove(), 8000);
  }
})();
