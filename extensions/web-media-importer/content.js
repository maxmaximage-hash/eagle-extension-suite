(() => {
  if (globalThis.__eagleWebMediaImporterLoaded) return;
  globalThis.__eagleWebMediaImporterLoaded = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "collect-web-media") return;
    openImportPicker(message).catch((error) => showToast(String(error?.message || "无法读取当前网页媒体"), "error"));
  });

  async function openImportPicker(request) {
    removeUi();
    const candidates = collectMedia(request);
    const plan = EagleWebMediaCore.buildBatchPlan(candidates, {
      pageUrl: location.href,
      pageTitle: document.title,
      provider: providerFor(location.hostname),
      maxItems: 80
    });
    if (!plan.ready.length) {
      const reasons = [...new Set(plan.skipped.map((item) => reasonText(item.reason)))].join("；");
      throw new Error(reasons || "当前页面没有可直接下载的图片或视频");
    }
    const folderResponse = await chrome.runtime.sendMessage({ type: "get-eagle-folders" });
    if (!folderResponse?.ok) throw new Error(folderResponse?.error || "无法读取 Eagle 文件夹");
    chooseFolder(folderResponse.folders || [], plan);
  }

  function collectMedia(request = {}) {
    const selected = String(request.sourceUrl || "");
    if (request.mode === "selected" && selected) {
      return [{
        url: selected,
        kind: request.selectedKind === "image" || request.selectedKind === "video"
          ? request.selectedKind
          : selectedMediaKind(selected),
        label: document.title
      }];
    }
    const entries = [];
    const add = (url, kind, label) => entries.push({ url, kind, label });
    document.querySelectorAll("img").forEach((image) => {
      add(image.currentSrc || image.src || image.getAttribute("data-src"), "image", image.alt || document.title);
    });
    document.querySelectorAll("video").forEach((video) => {
      add(video.currentSrc || video.src, "video", video.getAttribute("aria-label") || document.title);
      video.querySelectorAll("source").forEach((source) => add(source.src, "video", document.title));
      if (video.poster) add(video.poster, "image", document.title);
    });
    document.querySelectorAll("a[href]").forEach((link) => {
      const type = selectedMediaKind(link.href);
      if (type) add(link.href, type, link.textContent || document.title);
    });
    return entries.filter((entry) => String(entry.url || "").trim());
  }

  function selectedMediaKind(url) {
    const extension = EagleWebMediaCore.extensionForUrl(url);
    if (EagleWebMediaCore.IMAGE_EXTENSIONS.has(extension)) return "image";
    if (EagleWebMediaCore.VIDEO_EXTENSIONS.has(extension)) return "video";
    return "unknown";
  }

  function providerFor(hostname) {
    const host = String(hostname || "").toLowerCase();
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("xiaohongshu.com")) return "xiaohongshu";
    return "web";
  }

  function chooseFolder(folders, plan) {
    const flat = flattenFolders(folders).filter((folder) => EagleWebMediaCore.isSelectableFolder(folder));
    if (!flat.length) throw new Error("当前 Eagle 资源库没有可选的普通文件夹");
    const host = document.createElement("div");
    host.id = "eagle-web-media-picker";
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `:host{all:initial}.backdrop{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:rgba(0,0,0,.56);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.backdrop section{display:grid;grid-template-rows:auto auto minmax(120px,1fr) auto;width:min(680px,calc(100vw - 28px));max-height:min(760px,calc(100vh - 36px));overflow:hidden;border-radius:14px;background:#f6f6f4;color:#202124;box-shadow:0 20px 80px #0008}.backdrop header{display:flex;justify-content:space-between;gap:18px;padding:20px 22px 12px}.backdrop h2{margin:0;font-size:20px}.backdrop p,.backdrop footer{margin:5px 0 0;color:#696969;font-size:13px;line-height:1.5}.backdrop footer{padding:12px 22px;border-top:1px solid #ddd}.backdrop input{margin:0 18px 12px;padding:11px 12px;border:1px solid #ccc;border-radius:9px;font:inherit}.folders{overflow:auto;padding:4px 14px 16px}.folders button{display:grid;gap:3px;width:100%;padding:11px calc(12px + var(--depth) * 18px);border:0;border-radius:8px;background:transparent;text-align:left;cursor:pointer}.folders button:hover{background:#e9e9e6}.folders small{overflow:hidden;color:#8a8a8a;text-overflow:ellipsis;white-space:nowrap}.backdrop header button{height:32px;padding:0 10px;border:0;border-radius:7px;background:#e7e7e3;color:#333;cursor:pointer}@media(prefers-color-scheme:dark){.backdrop section{background:#242424;color:#f2f2f2}.backdrop p,.backdrop footer,.folders small{color:#b5b5b5}.backdrop footer{border-color:#444}.backdrop input{border-color:#555;background:#191919;color:#fff}.folders button:hover{background:#353535}.backdrop header button{background:#3d3d3d;color:#fff}}`;
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    const panel = document.createElement("section");
    const skipped = plan.skipped.length ? `；已跳过 ${plan.skipped.length} 个不能直接下载的地址` : "";
    panel.innerHTML = `<header><div><h2>保存网页媒体至 Eagle</h2><p>将导入 ${plan.ready.length} 个文件${skipped}</p></div><button type="button" data-close>取消</button></header><input type="search" placeholder="搜索 Eagle 文件夹…"><div class="folders"></div><footer>只保存当前网页已加载且具有直连地址的媒体；受保护视频流会明确跳过。</footer>`;
    backdrop.append(panel);
    shadow.append(style, backdrop);
    document.documentElement.append(host);
    const search = panel.querySelector("input");
    const list = panel.querySelector(".folders");
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
        button.addEventListener("click", () => {
          beginImport(plan, folder, panel).catch((error) => {
            removeUi();
            showToast(String(error?.message || "导入失败"), "error");
          });
        });
        list.append(button);
      });
    };
    panel.querySelector("[data-close]").addEventListener("click", removeUi);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) removeUi(); });
    search.addEventListener("input", render);
    render();
    search.focus();
  }

  async function beginImport(plan, folder, panel) {
    panel.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    showToast(`正在下载并导入 ${plan.ready.length} 个文件至「${folder.name}」…`);
    const result = await chrome.runtime.sendMessage({ type: "import-web-media", plan, folderId: folder.id });
    removeUi();
    if (!result?.ok) throw new Error(result?.error || "导入失败");
    const summary = result.summary || {};
    const failed = Number(summary.failed || 0);
    const accepted = Number(summary.accepted || 0);
    showToast(
      failed
        ? `Eagle 已接收 ${accepted} 个，失败 ${failed} 个`
        : `Eagle 已接收 ${accepted} 个至「${folder.name}」`,
      failed ? "error" : "success"
    );
  }

  function flattenFolders(folders, depth = 0, parent = "") {
    return (Array.isArray(folders) ? folders : []).flatMap((folder) => {
      const path = parent ? `${parent} / ${folder.name}` : String(folder.name || "未命名文件夹");
      return [{ ...folder, path, depth }, ...flattenFolders(folder.children || [], depth + 1, path)];
    });
  }

  function reasonText(reason) {
    return {
      BROWSER_BLOB: "浏览器临时视频不能直接保存",
      STREAM_MANIFEST: "HLS/DASH 流不能作为单文件下载",
      DATA_URL: "页面内嵌数据不是独立媒体文件",
      UNKNOWN_MEDIA_TYPE: "没有可识别的媒体文件地址"
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
    setTimeout(() => host.remove(), 7000);
  }
})();
