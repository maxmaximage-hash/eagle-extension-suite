(() => {
  if (globalThis.__eagleWebMediaImporterLoaded) return;
  globalThis.__eagleWebMediaImporterLoaded = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "collect-web-media") return;
    openImportPicker(message).catch((error) => showToast(String(error?.message || "无法读取当前网页媒体"), "error"));
  });

  async function openImportPicker(request) {
    removeUi();
    const settingsResponse = await chrome.runtime.sendMessage({ type: "get-web-media-settings" });
    const settings = settingsResponse?.settings || {};
    const model = capturePageModel(request);
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
    const folderResponse = await chrome.runtime.sendMessage({ type: "get-eagle-folders" });
    if (!folderResponse?.ok) throw new Error(folderResponse?.error || "无法读取 Eagle 文件夹");
    chooseFolder(folderResponse.folders || [], plan);
  }

  function capturePageModel(request = {}) {
    const provider = EagleWebMediaProviders.providerFor(location.href);
    const meta = {
      image: metaContent('meta[property="og:image"],meta[name="twitter:image"]'),
      imageMime: metaContent('meta[property="og:image:type"]'),
      video: metaContent('meta[property="og:video"],meta[property="og:video:url"],meta[name="twitter:player:stream"]')
    };
    const selectedUrl = String(request.sourceUrl || "");
    const selectedElement = selectedUrl ? findMediaElement(selectedUrl) : null;
    if (request.mode === "selected" && selectedUrl) {
      return {
        provider,
        pageUrl: location.href,
        pageTitle: document.title,
        meta,
        containers: [{
          id: `${provider}-selected`,
          owned: true,
          candidates: [candidateForSelected(request, selectedElement)],
          incompleteCount: 0
        }],
        structured: {}
      };
    }
    const selectors = provider === "weibo"
      ? ["article", "[mid]", "[data-testid*='feed']"]
      : provider === "douyin"
        ? ["article", "[data-e2e*='feed']", "[data-e2e*='video']"]
        : ["article", "main"];
    const elements = uniqueElements(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]));
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
    container.querySelectorAll("img").forEach((image) => {
      const url = image.currentSrc || image.src || image.getAttribute("data-src") || "";
      if (!url) return;
      const role = isPageChrome(image) ? "avatar" : (provider === "generic" ? "content-image" : "post-image");
      entries.push({
        url,
        kind: "image",
        role,
        label: image.alt || document.title,
        sourceEvidence: "dom-media-element",
        mimeHint: image.type || ""
      });
    });
    container.querySelectorAll("video").forEach((video) => {
      const urls = [video.currentSrc || video.src, ...[...video.querySelectorAll("source")].map((source) => source.src)];
      for (const url of urls.filter(Boolean)) {
        entries.push({
          url,
          kind: "video",
          role: provider === "generic" ? "content-video" : "post-video",
          label: video.getAttribute("aria-label") || document.title,
          sourceEvidence: "dom-media-element",
          mediaCompleteness: directVideoCompleteness(url),
          audioStatus: audioProof(video)
        });
      }
      if (video.poster) entries.push({
        url: video.poster,
        kind: "image",
        role: provider === "generic" ? "content-image" : "post-image",
        label: `${document.title}-封面`,
        sourceEvidence: "dom-media-element"
      });
    });
    return entries;
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
      audioStatus: kind === "video" ? audioProof(element) : ""
    };
  }

  function directVideoCompleteness(url) {
    const extension = EagleWebMediaCore.extensionForUrl(url);
    return EagleWebMediaCore.VIDEO_EXTENSIONS.has(extension) ? "single-file-complete" : "unknown";
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

  function chooseFolder(folders, plan) {
    const flat = flattenFolders(folders).filter((folder) => EagleWebMediaCore.isSelectableFolder(folder));
    if (!flat.length) throw new Error("当前 Eagle 资源库没有可选的普通文件夹");
    const host = document.createElement("div");
    host.id = "eagle-web-media-picker";
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `:host{all:initial}.backdrop{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:rgba(0,0,0,.56);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.backdrop section{display:grid;grid-template-rows:auto auto minmax(120px,1fr) auto;width:min(680px,calc(100vw - 28px));max-height:min(760px,calc(100vh - 36px));overflow:hidden;border-radius:14px;background:#f6f6f4;color:#202124;box-shadow:0 20px 80px #0008}.backdrop header{display:flex;justify-content:space-between;gap:18px;padding:20px 22px 12px}.backdrop h2{margin:0;font-size:20px}.backdrop p,.backdrop footer{margin:5px 0 0;color:#696969;font-size:13px;line-height:1.5}.backdrop footer{display:grid;gap:8px;padding:12px 22px;border-top:1px solid #ddd}.backdrop input{margin:0 18px 12px;padding:11px 12px;border:1px solid #ccc;border-radius:9px;font:inherit}.folders{overflow:auto;padding:4px 14px 16px}.folders button{display:grid;gap:3px;width:100%;padding:11px calc(12px + var(--depth) * 18px);border:0;border-radius:8px;background:transparent;text-align:left;cursor:pointer}.folders button:hover,.folders button[data-selected]{background:#dce9ff}.folders small{overflow:hidden;color:#8a8a8a;text-overflow:ellipsis;white-space:nowrap}.backdrop header button,.backdrop footer button{min-height:32px;padding:0 12px;border:0;border-radius:7px;background:#1769e0;color:#fff;cursor:pointer}.backdrop footer button:disabled{opacity:.45}.confirm{display:flex;align-items:flex-start;gap:8px}.warning{color:#9b4a00}@media(prefers-color-scheme:dark){.backdrop section{background:#242424;color:#f2f2f2}.backdrop p,.backdrop footer,.folders small{color:#b5b5b5}.backdrop footer{border-color:#444}.backdrop input{border-color:#555;background:#191919;color:#fff}.folders button:hover,.folders button[data-selected]{background:#29436b}}`;
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    const panel = document.createElement("section");
    const skipped = plan.skipped.length ? `；阻止/跳过 ${plan.skipped.length} 项` : "";
    const incomplete = plan.incompleteCount ? `；页面提示可能还有 ${plan.incompleteCount} 项未加载` : "";
    const estimated = plan.estimatedBytes ? formatBytes(plan.estimatedBytes) : "未知（下载后仍会执行硬上限）";
    panel.innerHTML = `<header><div><h2>保存当前内容至 Eagle</h2><p>候选 ${plan.ready.length} 项；估计大小 ${estimated}${skipped}${incomplete}</p></div><button type="button" data-close>取消</button></header><input type="search" placeholder="搜索 Eagle 普通文件夹…"><div class="folders"></div><footer><span data-target>请先选择目标文件夹</span><label class="confirm"><input type="checkbox" data-confirm>我确认导入上述 ${plan.ready.length} 项；只处理当前已加载且归属明确的媒体</label><span class="warning">视频只有在能证明是含声音的完整单文件时才会导入；YouTube 视频只提供封面。</span><button type="button" data-import disabled>开始导入</button></footer>`;
    backdrop.append(panel);
    shadow.append(style, backdrop);
    document.documentElement.append(host);
    const search = panel.querySelector('input[type="search"]');
    const confirm = panel.querySelector("[data-confirm]");
    const importButton = panel.querySelector("[data-import]");
    const list = panel.querySelector(".folders");
    let selectedFolder = null;
    const sync = () => { importButton.disabled = !(selectedFolder && confirm.checked); };
    const render = () => {
      const query = search.value.trim().toLowerCase();
      list.replaceChildren();
      flat.filter((folder) => !query || folder.path.toLowerCase().includes(query)).forEach((folder) => {
        const button = document.createElement("button");
        button.type = "button";
        button.style.setProperty("--depth", String(folder.depth));
        button.innerHTML = `<strong></strong><small></small>`;
        button.querySelector("strong").textContent = folder.name;
        button.querySelector("small").textContent = folder.path;
        if (selectedFolder?.id === folder.id) button.dataset.selected = "true";
        button.addEventListener("click", () => {
          selectedFolder = folder;
          panel.querySelector("[data-target]").textContent = `目标：${folder.path}`;
          render();
          sync();
        });
        list.append(button);
      });
    };
    importButton.addEventListener("click", () => beginImport(plan, selectedFolder, panel));
    confirm.addEventListener("change", sync);
    panel.querySelector("[data-close]").addEventListener("click", removeUi);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) removeUi(); });
    search.addEventListener("input", render);
    render();
    search.focus();
  }

  async function beginImport(plan, folder, panel) {
    panel.querySelectorAll("button,input").forEach((element) => { element.disabled = true; });
    const result = await chrome.runtime.sendMessage({ type: "import-web-media", plan, folderId: folder.id });
    removeUi();
    if (!result?.ok) throw new Error(result?.error || "导入任务创建失败");
    showToast(`已创建 ${result.summary?.pending || plan.ready.length} 项可恢复任务；可在扩展弹窗查看进度`, "success");
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
      CURRENT_CONTENT_HAS_NO_DIRECT_MEDIA: "当前内容没有公开直连媒体",
      CURRENT_COVER_NOT_FOUND: "没有找到当前视频的公开封面",
      BROWSER_BLOB: "浏览器临时视频不能作为完整文件保存",
      STREAM_MANIFEST: "HLS/DASH 分片流不能作为单文件下载",
      DASH_OR_AUDIO_UNVERIFIED: "视频可能分轨或无法确认声音，已阻止导入",
      YOUTUBE_OFFICIAL_DOWNLOAD_ONLY: "YouTube 视频只允许官方下载流程，本插件仅保存封面",
      DATA_URL: "页面内嵌数据不是独立媒体文件",
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
