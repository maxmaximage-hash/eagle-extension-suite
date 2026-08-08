let lastContextTarget = null;
let isCollecting = false;

document.addEventListener("contextmenu", (event) => {
  lastContextTarget = event.target;
}, true);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "collect-post-media" || isCollecting) return;
  collectAndSave(message.sourceUrl);
});

async function collectAndSave(sourceUrl) {
  const root = findPostRoot(lastContextTarget, sourceUrl);
  if (!root) {
    showToast("请在帖子的大图或视频区域内右键", "error");
    return;
  }

  isCollecting = true;
  showToast("正在读取这条帖子的全部内容…");

  try {
    const media = new Map();
    const movedBack = await moveToBoundary(root, "previous", media);
    addMedia(root, media);
    const movedForward = await moveToBoundary(root, "next", media);
    await moveSteps(root, "previous", Math.max(0, movedForward - movedBack));

    const items = [...media.values()];
    if (items.length === 0) {
      throw new Error("这条帖子里没有识别到可保存的图片或视频");
    }

    removeToast();
    const folder = await chooseEagleFolder(items);
    if (!folder) return;

    showToast(`正在将 ${items.length} 个文件交给 Eagle…`);
    const response = await chrome.runtime.sendMessage({
      type: "save-media-to-eagle",
      media: items,
      folderId: folder.id,
      post: getPostInfo(root)
    });

    if (!response?.ok) throw new Error(response?.error || "Eagle 导入失败");
    showToast(`已将 ${response.accepted} 个文件保存至「${folder.name}」`, "success");
  } catch (error) {
    showToast(error.message || "读取失败，请刷新页面后重试", "error");
  } finally {
    isCollecting = false;
  }
}

function findPostRoot(target, sourceUrl) {
  if (!(target instanceof Element) && sourceUrl) {
    target = [...document.querySelectorAll("img, video")].find((media) =>
      mediaUrlMatches(media, sourceUrl)
    ) || null;
  }
  if (!(target instanceof Element)) return null;
  const article = target.closest("article");
  if (!article) return null;

  const media = target.closest("img, video");
  if (media && !isLargeMedia(media)) return null;
  return article;
}

function mediaUrlMatches(media, sourceUrl) {
  const candidates = [
    media.currentSrc,
    media.src,
    media.getAttribute("src"),
    media.getAttribute("srcset")
  ].filter(Boolean);
  if (candidates.some((value) => value.includes(sourceUrl))) return true;

  try {
    const sourcePath = new URL(sourceUrl).pathname;
    return candidates.some((value) => {
      try {
        return new URL(value.split(" ")[0]).pathname === sourcePath;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

async function moveToBoundary(root, direction, media) {
  let moves = 0;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    addMedia(root, media);
    const button = findCarouselButton(root, direction);
    if (!button) break;

    const before = mediaSignature(root);
    button.click();
    if (!(await waitForMediaChange(root, before))) break;
    moves += 1;
  }
  addMedia(root, media);
  return moves;
}

async function moveSteps(root, direction, steps) {
  for (let index = 0; index < steps; index += 1) {
    const button = findCarouselButton(root, direction);
    if (!button) break;
    const before = mediaSignature(root);
    button.click();
    if (!(await waitForMediaChange(root, before))) break;
  }
}

function addMedia(root, media) {
  for (const image of root.querySelectorAll("img")) {
    if (!isPostImage(image, root)) continue;
    const url = getLargestImageUrl(image);
    if (url) addUniqueMedia(media, url, "image");
  }

  for (const video of root.querySelectorAll("video")) {
    if (!isLargeMedia(video)) continue;
    const url = getVideoUrl(video);
    if (url) addUniqueMedia(media, url, "video");
  }
}

function addUniqueMedia(media, url, type) {
  const key = canonicalMediaKey(url);
  if (!media.has(key)) media.set(key, { url, type });
}

function isPostImage(image, root) {
  if (!image.currentSrc && !image.src) return false;
  if (image.closest("header")) return false;
  const alt = (image.alt || "").toLowerCase();
  if (/(profile picture|profile photo|头像|大头照)/i.test(alt)) return false;
  if (!isLargeMedia(image)) return false;

  const video = nearestMediaContainer(image)?.querySelector("video");
  if (video && overlaps(image.getBoundingClientRect(), video.getBoundingClientRect())) return false;
  return root.contains(image);
}

function isLargeMedia(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width >= 240 && rect.height >= 240) return true;
  return element instanceof HTMLImageElement && element.naturalWidth >= 400 && element.naturalHeight >= 300;
}

function nearestMediaContainer(element) {
  let node = element.parentElement;
  for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
    if (node.querySelector(":scope > video, :scope > div > video")) return node;
  }
  return element.parentElement;
}

function overlaps(a, b) {
  if (!a.width || !a.height || !b.width || !b.height) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function getLargestImageUrl(image) {
  const candidates = (image.getAttribute("srcset") || "")
    .split(",")
    .map((part) => {
      const match = part.trim().match(/^(\S+)\s+(\d+)w$/);
      return match ? { url: match[1], width: Number(match[2]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.width - a.width);
  return candidates[0]?.url || image.currentSrc || image.src || null;
}

function getVideoUrl(video) {
  const direct = [
    video.currentSrc,
    video.src,
    ...[...video.querySelectorAll("source")].map((source) => source.src)
  ].find((url) => /^https?:/i.test(url || ""));
  if (direct) return direct;

  const candidates = performance.getEntriesByType("resource")
    .filter((entry) => isProbableInstagramVideoUrl(entry.name))
    .sort((a, b) => b.startTime - a.startTime);
  return candidates[0]?.name || null;
}

function isProbableInstagramVideoUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/(cdninstagram\.com|fbcdn\.net)$/i.test(parsed.hostname)) return false;
    return /\.mp4(?:$|\?)/i.test(url) || /\/t16\//i.test(parsed.pathname) || /video/i.test(url);
  } catch {
    return false;
  }
}

function canonicalMediaKey(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${decodeURIComponent(parsed.pathname)}`;
  } catch {
    return url;
  }
}

function findCarouselButton(root, direction) {
  const mediaRect = largestVisibleMediaRect(root);
  if (!mediaRect) return null;

  const words = direction === "next"
    ? ["next", "下一步", "下一个", "下一张", "suivant", "weiter", "avanti", "siguiente", "seguinte", "volgende", "dalej", "次へ", "다음", "след"]
    : ["previous", "prev", "上一步", "上一个", "上一张", "précédent", "zurück", "indietro", "anterior", "vorige", "wstecz", "前へ", "이전", "пред"];

  const buttons = [...root.querySelectorAll("button")].filter((button) => {
    if (button.disabled) return false;
    const rect = button.getBoundingClientRect();
    if (rect.width < 16 || rect.height < 16 || rect.width > 96 || rect.height > 96) return false;
    const centerY = rect.top + rect.height / 2;
    return centerY >= mediaRect.top && centerY <= mediaRect.bottom;
  });

  const labelled = buttons.find((button) => {
    const label = [
      button.getAttribute("aria-label"),
      button.title,
      button.querySelector("svg")?.getAttribute("aria-label"),
      button.querySelector("svg title")?.textContent
    ].filter(Boolean).join(" ").toLowerCase();
    return words.some((word) => label.includes(word));
  });
  if (labelled) return labelled;

  return buttons.find((button) => {
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    return direction === "next"
      ? centerX > mediaRect.left + mediaRect.width * 0.72
      : centerX < mediaRect.left + mediaRect.width * 0.28;
  }) || null;
}

function largestVisibleMediaRect(root) {
  return [...root.querySelectorAll("img, video")]
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width >= 240 && rect.height >= 240)
    .sort((a, b) => b.width * b.height - a.width * a.height)[0] || null;
}

function mediaSignature(root) {
  return [...root.querySelectorAll("img, video")]
    .filter(isLargeMedia)
    .map((element) => element.currentSrc || element.src || element.poster || "")
    .join("|");
}

function waitForMediaChange(root, previousSignature) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (mediaSignature(root) !== previousSignature) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - startedAt >= 1800) {
        clearInterval(timer);
        resolve(false);
      }
    }, 80);
  });
}

async function chooseEagleFolder(media) {
  const response = await chrome.runtime.sendMessage({ type: "get-eagle-folders" });
  if (!response?.ok) throw new Error(response?.error || "无法读取 Eagle 文件夹");

  return new Promise((resolve) => {
    const existing = document.getElementById("ig-eagle-folder-picker");
    if (existing) existing.remove();

    const host = document.createElement("div");
    host.id = "ig-eagle-folder-picker";
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = pickerStyles();
    shadow.appendChild(style);

    const backdrop = element("div", "backdrop");
    const panel = element("section", "panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "选择 Eagle 文件夹");

    const header = element("header", "header");
    const headingWrap = element("div");
    const title = element("h2", "title", "保存整条帖子至 Eagle");
    const imageCount = media.filter((item) => item.type === "image").length;
    const videoCount = media.filter((item) => item.type === "video").length;
    const summary = element("p", "summary", `${imageCount} 张图片 · ${videoCount} 个视频`);
    headingWrap.append(title, summary);
    const close = element("button", "close", "取消");
    close.type = "button";
    header.append(headingWrap, close);

    const search = document.createElement("input");
    search.className = "search";
    search.type = "search";
    search.placeholder = "搜索 Eagle 文件夹…";
    search.setAttribute("aria-label", "搜索 Eagle 文件夹");

    const list = element("div", "list");
    const footer = element("footer", "footer");
    const selection = element("span", "selection", "请选择一个文件夹");
    const save = element("button", "save", `保存 ${media.length} 个文件`);
    save.type = "button";
    save.disabled = true;
    footer.append(selection, save);
    panel.append(header, search, list, footer);
    backdrop.appendChild(panel);
    shadow.appendChild(backdrop);

    let selected = null;
    const allFolders = flattenFolders(response.folders || []);
    const recentIds = new Set((response.recents || []).map((folder) => folder.id));

    const render = () => {
      list.replaceChildren();
      const query = search.value.trim().toLocaleLowerCase();
      const visible = allFolders.filter((folder) => !query || folder.name.toLocaleLowerCase().includes(query));

      const recents = query ? [] : visible.filter((folder) => recentIds.has(folder.id)).slice(0, 8);
      if (recents.length) {
        list.appendChild(element("div", "section-title", "最近使用"));
        recents.forEach((folder) => list.appendChild(folderRow(folder, 0, selectFolder)));
        list.appendChild(element("div", "divider"));
      }

      list.appendChild(element("div", "section-title", query ? "搜索结果" : "全部文件夹"));
      visible.forEach((folder) => list.appendChild(folderRow(folder, query ? 0 : folder.depth, selectFolder)));
      if (!visible.length) list.appendChild(element("p", "empty", "没有找到匹配的文件夹"));
    };

    function selectFolder(folder, row) {
      selected = folder;
      list.querySelectorAll(".folder.selected").forEach((item) => item.classList.remove("selected"));
      row.classList.add("selected");
      selection.textContent = `将保存至：${folder.path}`;
      save.disabled = false;
    }

    const finish = (value) => {
      host.remove();
      resolve(value);
    };
    close.addEventListener("click", () => finish(null));
    save.addEventListener("click", () => selected && finish(selected));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) finish(null);
    });
    search.addEventListener("input", render);
    shadow.addEventListener("keydown", (event) => {
      if (event.key === "Escape") finish(null);
    });

    render();
    search.focus();
  });
}

function flattenFolders(folders, depth = 0, parentPath = "") {
  const result = [];
  for (const folder of folders) {
    const path = parentPath ? `${parentPath} / ${folder.name}` : folder.name;
    result.push({ id: folder.id, name: folder.name, path, depth });
    if (Array.isArray(folder.children)) {
      result.push(...flattenFolders(folder.children, depth + 1, path));
    }
  }
  return result;
}

function folderRow(folder, depth, onSelect) {
  const row = element("button", "folder");
  row.type = "button";
  row.style.setProperty("--depth", String(depth));
  row.append(
    element("span", "folder-name", folder.name),
    element("span", "folder-path", folder.path === folder.name ? "" : folder.path)
  );
  row.addEventListener("click", () => onSelect(folder, row));
  row.addEventListener("dblclick", () => onSelect(folder, row));
  return row;
}

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function pickerStyles() {
  return `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .backdrop { position: fixed; inset: 0; z-index: 2147483646; display: grid; place-items: center; padding: 24px; background: rgba(0,0,0,.58); font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif; color: #292929; }
    .panel { width: min(720px, 100%); height: min(760px, calc(100vh - 48px)); display: grid; grid-template-rows: auto auto 1fr auto; overflow: hidden; border: 1px solid rgba(255,255,255,.7); border-radius: 16px; background: #f4f4f4; box-shadow: 0 24px 90px rgba(0,0,0,.42); }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 22px 24px 16px; }
    .title { margin: 0; color: #202124; font-size: 21px; font-weight: 650; letter-spacing: -.2px; }
    .summary { margin: 5px 0 0; color: #777; font-size: 13px; }
    button, input { font: inherit; }
    .close { border: 0; padding: 8px 10px; color: #666; background: transparent; cursor: pointer; }
    .close:hover { color: #111; }
    .search { width: auto; margin: 0 18px 14px; padding: 12px 14px; border: 1px solid #d2d2d2; border-radius: 10px; outline: none; background: #fff; color: #222; font-size: 15px; }
    .search:focus { border-color: #ff5a4f; box-shadow: 0 0 0 3px rgba(255,90,79,.12); }
    .list { overflow: auto; padding: 0 14px 18px; border-top: 1px solid #ddd; }
    .section-title { padding: 17px 10px 7px; color: #919191; font-size: 12px; font-weight: 650; letter-spacing: .08em; }
    .divider { height: 1px; margin: 10px 8px 0; background: #ddd; }
    .folder { width: 100%; min-height: 46px; display: grid; grid-template-columns: minmax(120px,1fr) minmax(0,1.2fr); align-items: center; gap: 16px; padding: 8px 12px 8px calc(12px + var(--depth) * 24px); border: 1px solid transparent; border-radius: 9px; color: #353535; background: transparent; text-align: left; cursor: pointer; }
    .folder:hover { background: #e8e8e8; }
    .folder.selected { border-color: #ff5a4f; background: #fff0ee; }
    .folder-name { overflow: hidden; font-size: 15px; font-weight: 520; text-overflow: ellipsis; white-space: nowrap; }
    .folder-path { overflow: hidden; color: #999; font-size: 12px; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
    .empty { padding: 40px 12px; color: #888; text-align: center; }
    .footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 15px 20px; border-top: 1px solid #d5d5d5; background: #ededed; }
    .selection { min-width: 0; overflow: hidden; color: #737373; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
    .save { flex: 0 0 auto; min-width: 150px; padding: 11px 18px; border: 0; border-radius: 9px; color: #fff; background: #ff5147; font-weight: 650; cursor: pointer; }
    .save:hover { background: #ed443b; }
    .save:disabled { color: #aaa; background: #d8d8d8; cursor: default; }
    @media (max-width: 560px) { .backdrop { padding: 10px; } .panel { height: calc(100vh - 20px); } .folder { grid-template-columns: 1fr; gap: 2px; } .folder-path { text-align: left; } .footer { align-items: stretch; flex-direction: column; } .save { width: 100%; } }
  `;
}

function getPostInfo(root) {
  const permalink = root.querySelector("a[href*='/p/'], a[href*='/reel/']")?.href || location.href;
  const match = permalink.match(/\/(?:p|reel)\/([^/?#]+)/);
  return {
    id: match?.[1] || `post_${new Date().toISOString().replace(/[:.]/g, "-")}`,
    url: permalink
  };
}

function showToast(message, type = "loading") {
  removeToast();
  const toast = document.createElement("div");
  toast.id = "ig-eagle-toast";
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed", left: "50%", bottom: "32px", transform: "translateX(-50%)",
    zIndex: "2147483647", maxWidth: "min(440px, calc(100vw - 32px))", padding: "12px 16px",
    borderRadius: "10px", color: "#fff",
    background: type === "error" ? "#b42318" : type === "success" ? "#067647" : "#262626",
    boxShadow: "0 8px 30px rgba(0,0,0,.24)",
    font: "600 14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", textAlign: "center"
  });
  document.documentElement.appendChild(toast);
  if (type !== "loading") setTimeout(() => toast.remove(), 4600);
}

function removeToast() {
  document.getElementById("ig-eagle-toast")?.remove();
}
