const MENU_ID = "save-instagram-post-to-eagle";
const EAGLE_API = "http://127.0.0.1:41595/api";

chrome.runtime.onStartup.addListener(createContextMenu);

// Unpacked extensions do not always receive onInstalled after a manual reload.
// Recreating the menu when the worker starts makes the menu self-healing.
createContextMenu();

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Instagram：保存整条帖子至 Eagle…",
      contexts: ["all"],
      documentUrlPatterns: ["https://www.instagram.com/*"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to create context menu:", chrome.runtime.lastError.message);
      }
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  triggerCollector(tab.id, info);
});

async function triggerCollector(tabId, info) {
  const message = {
    type: "collect-post-media",
    sourceUrl: info.srcUrl || null
  };

  try {
    await chrome.tabs.sendMessage(tabId, message);
    return;
  } catch {
    // The Instagram tab may have been opened before the extension was loaded.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.error("Failed to start Instagram collector:", error);
    await showInjectionError(tabId).catch(() => {});
  }
}

function showInjectionError(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const existing = document.getElementById("ig-eagle-injection-error");
      if (existing) existing.remove();
      const notice = document.createElement("div");
      notice.id = "ig-eagle-injection-error";
      notice.textContent = "Instagram 整帖扩展未能启动，请刷新页面后重试";
      Object.assign(notice.style, {
        position: "fixed", left: "50%", bottom: "32px", transform: "translateX(-50%)",
        zIndex: "2147483647", padding: "12px 16px", borderRadius: "10px",
        color: "#fff", background: "#b42318", font: "600 14px/1.45 sans-serif"
      });
      document.documentElement.appendChild(notice);
      setTimeout(() => notice.remove(), 5000);
    }
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "get-eagle-folders") {
    getEagleFolders()
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((error) => sendResponse({ ok: false, error: eagleError(error) }));
    return true;
  }

  if (message?.type === "save-media-to-eagle") {
    saveMediaToEagle(message.media, message.folderId, message.post)
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((error) => sendResponse({ ok: false, error: eagleError(error) }));
    return true;
  }

  return false;
});

async function getEagleFolders() {
  const [foldersResult, recentsResult] = await Promise.all([
    eagleRequest("/folder/list"),
    eagleRequest("/folder/listRecent").catch(() => ({ data: [] }))
  ]);

  return {
    folders: Array.isArray(foldersResult.data) ? foldersResult.data : [],
    recents: Array.isArray(recentsResult.data) ? recentsResult.data : []
  };
}

async function saveMediaToEagle(media, folderId, post) {
  if (!Array.isArray(media) || media.length === 0) {
    throw new Error("没有可保存的图片或视频");
  }
  if (!folderId) throw new Error("请选择 Eagle 文件夹");

  const postId = sanitizeName(post?.id || "instagram_post");
  const website = post?.url || "https://www.instagram.com/";
  const items = media.map((item, index) => ({
    url: item.url,
    name: `${postId}_${String(index + 1).padStart(2, "0")}`,
    website,
    tags: ["Instagram"],
    headers: { referer: "https://www.instagram.com/" }
  }));

  const result = await eagleRequest("/item/addFromURLs", {
    method: "POST",
    body: JSON.stringify({ items, folderId })
  });

  return { accepted: items.length, result: result.data };
}

async function eagleRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${EAGLE_API}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) throw new Error(`Eagle API ${response.status}`);
  const result = await response.json();
  if (result?.status !== "success") {
    throw new Error(result?.message || "Eagle 拒绝了请求");
  }
  return result;
}

function sanitizeName(value) {
  return String(value).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").slice(0, 80);
}

function eagleError(error) {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return "无法连接 Eagle，请先打开 Eagle 应用和目标资源库";
  }
  return error?.message || "Eagle 连接失败";
}
