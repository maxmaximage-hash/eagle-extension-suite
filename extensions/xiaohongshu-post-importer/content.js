(() => {
  if (globalThis.__xhsEagleImporterLoaded) return;
  globalThis.__xhsEagleImporterLoaded = true;

  let collecting = false;
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "collect-xhs-note" && !collecting) void collectNote();
  });
  removeStaleUi();
  mountLauncher();
  installSiteContextMenuBridge();
  setInterval(mountLauncher, 1200);

  async function collectNote() {
    collecting = true;
    showToast("正在读取整篇笔记和静态图片…");
    try {
      if (!XhsEagleCore.extractNoteId(location.href)) throw new Error("请先打开一条小红书笔记详情");
      const stateNote = await requestPageState();
      const note = stateNote ? XhsEagleCore.normalizeNote(stateNote, location.href) : collectFromDom();
      mergeDomMedia(note);
      if (!note.media.length) throw new Error("没有识别到图片，请刷新笔记后重试");

      const folder = await chooseFolder(note);
      if (!folder) return;
      const summary = XhsEagleCore.summarizeMedia(note.media);
      showToast(`正在转换 JPG 并导入 ${summary.contentCount} 个 Eagle 项目…`);
      const response = await chrome.runtime.sendMessage({ type: "save-xhs-note", note, folderId: folder.id });
      if (!response?.ok) throw new Error(response?.error || "导入失败");
      const liveText = response.liveCount ? `（含 ${response.liveCount} 张 Live 静态图）` : "";
      showToast(`已保存 ${response.accepted} 个 Eagle 项目${liveText}至「${folder.name}」`, "success");
    } catch (error) {
      showToast(formatUserError(error), "error");
    } finally {
      collecting = false;
    }
  }

  function requestPageState() {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 1200);
      const receive = (event) => {
        clearTimeout(timer);
        window.removeEventListener("xhs-eagle-note-state", receive);
        const carrier = document.getElementById("xhs-eagle-note-payload");
        try { resolve(carrier ? JSON.parse(carrier.textContent || "null") : null); }
        catch { resolve(null); }
        finally { carrier?.remove(); }
      };
      window.addEventListener("xhs-eagle-note-state", receive, { once: true });
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("page-bridge.js");
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function collectFromDom() {
    const title = textOf("#detail-title, .title, [class*='note-content'] [class*='title']") || document.title.replace(/\s*[-_]\s*小红书.*$/i, "");
    const description = textOf("#detail-desc, .desc, [class*='note-content'] [class*='desc']");
    const author = textOf(".author-container .name, [class*='author'] [class*='name']");
    return { id: XhsEagleCore.extractNoteId(location.href), url: location.href, title, description, author, media: [] };
  }

  function mergeDomMedia(note) {
    const additions = [];
    document.querySelectorAll("img").forEach((image, index) => {
      const rect = image.getBoundingClientRect();
      if (rect.width < 260 || rect.height < 220 || image.closest("header, [class*='avatar']")) return;
      const url = largestImageUrl(image);
      if (url) additions.push({ url, type: "image", role: "image", liveGroup: null, order: index + 1 });
    });
    note.media = XhsEagleCore.uniqueMedia([...note.media, ...additions]);
  }

  function largestImageUrl(image) {
    const candidates = (image.getAttribute("srcset") || "").split(",").map((part) => {
      const match = part.trim().match(/^(\S+)\s+(\d+)w$/);
      return match ? { url: match[1], width: Number(match[2]) } : null;
    }).filter(Boolean).sort((a, b) => b.width - a.width);
    return candidates[0]?.url || image.currentSrc || image.src || null;
  }

  function textOf(selector) {
    return document.querySelector(selector)?.textContent?.trim() || "";
  }

  function mountLauncher() {
    const existing = document.getElementById("xhs-eagle-launcher");
    if (!XhsEagleCore.extractNoteId(location.href)) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const host = document.createElement("div");
    host.id = "xhs-eagle-launcher";
    const shadow = host.attachShadow({ mode: "closed" });
    const button = element("button", "launcher", "整篇存 Eagle");
    const style = document.createElement("style");
    style.textContent = `.launcher{position:fixed;right:22px;bottom:22px;z-index:2147483645;padding:11px 16px;border:0;border-radius:999px;color:#fff;background:#ff2442;box-shadow:0 8px 28px #0005;font:650 14px/1.2 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;cursor:pointer}.launcher:hover{background:#e71937;transform:translateY(-1px)}.launcher:active{transform:translateY(0)}`;
    button.addEventListener("click", () => { if (!collecting) void collectNote(); });
    shadow.append(style, button);
    document.documentElement.appendChild(host);
  }

  function installSiteContextMenuBridge() {
    let timer = 0;
    const schedule = () => {
      if (!XhsEagleCore.extractNoteId(location.href)) return;
      clearTimeout(timer);
      timer = setTimeout(augmentSiteContextMenu, 80);
    };
    document.addEventListener("contextmenu", schedule, true);
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  }

  function augmentSiteContextMenu() {
    const menu = findSiteContextMenu();
    if (!menu || menu.querySelector("[data-xhs-eagle-site-menu-item='true']")) return;

    const item = document.createElement("button");
    item.type = "button";
    item.dataset.xhsEagleSiteMenuItem = "true";
    item.textContent = "整篇存 Eagle";
    Object.assign(item.style, {
      all: "unset",
      boxSizing: "border-box",
      display: "block",
      width: "100%",
      padding: "12px 26px",
      color: "#f5f5f5",
      background: "transparent",
      borderRadius: "8px",
      cursor: "pointer",
      font: "500 16px/1.4 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif",
      textAlign: "left",
      whiteSpace: "nowrap"
    });
    item.addEventListener("mouseenter", () => { item.style.background = "rgba(255,255,255,.1)"; });
    item.addEventListener("mouseleave", () => { item.style.background = "transparent"; });
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    }, true);
    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!collecting) void collectNote();
    }, true);
    menu.appendChild(item);
  }

  function findSiteContextMenu() {
    const labels = ["下载图片", "复制图片", "复制笔记链接", "复制链接"];
    return [...document.querySelectorAll("div,section,ul,menu,[role='menu']")]
      .map((node) => ({ node, score: scoreSiteContextMenu(node, labels) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || visibleArea(a.node) - visibleArea(b.node))[0]?.node || null;
  }

  function scoreSiteContextMenu(node, labels) {
    if (!(node instanceof HTMLElement) || node.id?.startsWith("xhs-eagle-")) return 0;
    const rect = node.getBoundingClientRect();
    if (rect.width < 110 || rect.width > 430 || rect.height < 40 || rect.height > 520) return 0;
    if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return 0;

    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return 0;
    const zIndex = Number.parseInt(style.zIndex, 10);
    const floatsAbovePage = ["absolute", "fixed", "sticky"].includes(style.position) || Number.isFinite(zIndex) && zIndex > 10;
    if (!floatsAbovePage) return 0;

    const text = (node.textContent || "").replace(/\s+/g, "");
    const hits = labels.filter((label) => text.includes(label)).length;
    if (!hits) return 0;
    if (hits < 2 && node.childElementCount < 2) return 0;
    return hits * 100 - visibleArea(node) / 100000;
  }

  function visibleArea(node) {
    const rect = node.getBoundingClientRect();
    return rect.width * rect.height;
  }

  async function chooseFolder(note) {
    const response = await chrome.runtime.sendMessage({ type: "get-eagle-folders" });
    if (!response?.ok) throw new Error(response?.error || "无法读取 Eagle 文件夹");
    const folders = flattenFolders(response.folders || []);
    if (!folders.length) throw new Error("当前 Eagle 资源库没有可选文件夹");

    return new Promise((resolve) => {
      removePicker();
      const host = document.createElement("div");
      host.id = "xhs-eagle-picker";
      const shadow = host.attachShadow({ mode: "closed" });
      const backdrop = element("div", "backdrop");
      const panel = element("section", "panel");
      const summary = XhsEagleCore.summarizeMedia(note.media);
      panel.innerHTML = `<header><div><h2>保存整篇至 Eagle</h2><p>${summary.contentCount} 个 Eagle 项目${summary.liveCount ? ` · 其中 ${summary.liveCount} 张 Live 只保存静态图` : ""}</p></div><button class="cancel">取消</button></header><input class="search" type="search" placeholder="搜索 Eagle 文件夹…"><div class="list"></div>`;
      const style = document.createElement("style");
      style.textContent = `:host{all:initial}*{box-sizing:border-box}.backdrop{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:#0009;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.panel{width:min(680px,calc(100vw - 28px));max-height:min(760px,calc(100vh - 40px));display:grid;grid-template-rows:auto auto 1fr;overflow:hidden;border-radius:16px;background:#f5f5f5;color:#222;box-shadow:0 24px 90px #0008}header{display:flex;justify-content:space-between;align-items:center;padding:20px 22px 14px}h2{margin:0;font-size:21px}p{margin:5px 0 0;color:#777;font-size:13px}.cancel{border:0;background:none;color:#666;cursor:pointer}.search{margin:0 18px 12px;padding:12px;border:1px solid #d1d1d1;border-radius:10px;background:#fff;font-size:15px;outline:none}.search:focus{border-color:#ff2442;box-shadow:0 0 0 3px #ff24421f}.list{overflow:auto;padding:6px 14px 18px}.folder{width:100%;display:flex;justify-content:space-between;gap:12px;padding:12px calc(12px + var(--depth)*18px);border:1px solid transparent;border-radius:9px;background:transparent;text-align:left;cursor:pointer}.folder:hover{background:#e8e8e8}.name{font-weight:600}.path{overflow:hidden;color:#999;font-size:12px;text-overflow:ellipsis;white-space:nowrap}`;
      shadow.append(style, backdrop);
      backdrop.appendChild(panel);
      document.documentElement.appendChild(host);
      const list = panel.querySelector(".list");
      const search = panel.querySelector(".search");
      const finish = (value) => { host.remove(); resolve(value); };
      const render = () => {
        list.replaceChildren();
        const query = search.value.trim().toLowerCase();
        folders.filter((folder) => !query || folder.path.toLowerCase().includes(query)).forEach((folder) => {
          const row = element("button", "folder"); row.type = "button"; row.style.setProperty("--depth", folder.depth);
          row.append(element("span", "name", folder.name), element("span", "path", folder.path));
          row.addEventListener("click", () => finish(folder)); list.appendChild(row);
        });
      };
      panel.querySelector(".cancel").addEventListener("click", () => finish(null));
      backdrop.addEventListener("click", (event) => { if (event.target === backdrop) finish(null); });
      search.addEventListener("input", render); render(); search.focus();
    });
  }

  function flattenFolders(folders, depth = 0, parent = "") {
    return folders.flatMap((folder) => {
      const path = parent ? `${parent} / ${folder.name}` : folder.name;
      return [{ id: folder.id, name: folder.name, path, depth }, ...flattenFolders(folder.children || [], depth + 1, path)];
    });
  }

  function element(tag, className = "", text = "") { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; }
  function removeStaleUi() {
    document.getElementById("xhs-eagle-launcher")?.remove();
    document.getElementById("xhs-eagle-picker")?.remove();
    document.getElementById("xhs-eagle-toast")?.remove();
    document.querySelectorAll("[data-xhs-eagle-site-menu-item='true']").forEach((node) => node.remove());
  }
  function removePicker() { document.getElementById("xhs-eagle-picker")?.remove(); }
  function formatUserError(error) {
    const message = String(error?.message || error || "");
    if (/extension context invalidated/i.test(message)) return "扩展刚刚重新加载过，请刷新这个小红书页面后再使用";
    if (/receiving end does not exist|message port closed/i.test(message)) return "扩展页面脚本已过期，请刷新这个小红书页面后再使用";
    return message || "读取失败";
  }
  function showToast(message, type = "loading") {
    document.getElementById("xhs-eagle-toast")?.remove();
    const toast = element("div", "", message); toast.id = "xhs-eagle-toast";
    Object.assign(toast.style, { position:"fixed",left:"50%",bottom:"32px",transform:"translateX(-50%)",zIndex:"2147483647",maxWidth:"min(520px,calc(100vw - 32px))",padding:"12px 16px",borderRadius:"10px",color:"#fff",background:type === "error" ? "#b42318" : type === "success" ? "#067647" : "#262626",boxShadow:"0 8px 30px #0006",font:"600 14px/1.45 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif",textAlign:"center" });
    document.documentElement.appendChild(toast); if (type !== "loading") setTimeout(() => toast.remove(), 5200);
  }
})();
