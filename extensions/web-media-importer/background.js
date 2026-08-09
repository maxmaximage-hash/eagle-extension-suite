importScripts("core.js");

const EAGLE_API = "http://127.0.0.1:41595/api";
const CACHE_DIR = "Eagle-Web-Media-Cache";
const CLEANUP_DELAY_MINUTES = 24 * 60;
const QUEUE_KEY = "eagle.webMediaImporter.queues.v1";
const MENU_PAGE = "save-current-page-media-to-eagle";
const MENU_MEDIA = "save-current-media-to-eagle";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_PAGE,
      title: "保存本页全部图片和视频至 Eagle…",
      contexts: ["page"]
    });
    chrome.contextMenus.create({
      id: MENU_MEDIA,
      title: "保存当前媒体至 Eagle…",
      contexts: ["image", "video"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_PAGE) return openCollector(tab, { mode: "page" });
  if (info.menuItemId === MENU_MEDIA) {
    return openCollector(tab, {
      mode: "selected",
      sourceUrl: String(info.srcUrl || ""),
      selectedKind: String(info.mediaType || "")
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "open-web-media-collector") {
    openCollectorFromMessage(message).then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: formatError(error) }));
    return true;
  }
  if (message?.type === "get-eagle-folders") {
    getEagleFolders().then((value) => sendResponse({ ok: true, ...value }))
      .catch((error) => sendResponse({ ok: false, error: formatError(error) }));
    return true;
  }
  if (message?.type === "import-web-media") {
    importPlan(message.plan, message.folderId).then((value) => sendResponse({ ok: true, ...value }))
      .catch((error) => sendResponse({ ok: false, error: formatError(error) }));
    return true;
  }
  if (message?.type === "web-media-import-status") {
    readQueues().then((queues) => sendResponse({ ok: true, queues }))
      .catch((error) => sendResponse({ ok: false, error: formatError(error) }));
    return true;
  }
  if (message?.type === "retry-web-media-batch") {
    retryBatch(message.batchId).then((value) => sendResponse({ ok: true, ...value }))
      .catch((error) => sendResponse({ ok: false, error: formatError(error) }));
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith("eagle-web-media-cleanup:")) return;
  const downloadId = Number(alarm.name.split(":").at(-1));
  if (!Number.isFinite(downloadId)) return;
  chrome.downloads.removeFile(downloadId).catch(() => {}).finally(() => {
    chrome.downloads.erase({ id: downloadId }).catch(() => {});
  });
});

async function openCollector(tab, payload) {
  if (!tab?.id || !/^https?:/i.test(String(tab.url || ""))) {
    throw new Error("请先打开一个普通网页");
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "collect-web-media", ...payload });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["core.js", "content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "collect-web-media", ...payload });
  }
}

async function openCollectorFromMessage(message) {
  const tabId = Number(message?.tabId);
  if (!Number.isInteger(tabId) || tabId <= 0) throw new Error("无法确认当前网页");
  const tab = await chrome.tabs.get(tabId);
  return openCollector(tab, { mode: "page" });
}

async function eagleRequest(path, options = {}) {
  const response = await fetch(`${EAGLE_API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Eagle API ${response.status}`);
  const result = await response.json();
  if (result?.status !== "success") throw new Error(result?.message || "Eagle 拒绝了请求");
  return result;
}

async function getEagleFolders() {
  const [folders, recent] = await Promise.all([
    eagleRequest("/folder/list"),
    eagleRequest("/folder/listRecent").catch(() => ({ data: [] }))
  ]);
  return { folders: folders.data || [], recent: recent.data || [] };
}

async function readQueues() {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  return Array.isArray(stored[QUEUE_KEY]) ? stored[QUEUE_KEY] : [];
}

async function writeQueue(queue) {
  const queues = await readQueues();
  const next = [queue, ...queues.filter((entry) => entry?.id !== queue.id)].slice(0, 20);
  await chrome.storage.local.set({ [QUEUE_KEY]: next });
  return queue;
}

function providerLabel(entry) {
  const host = new URL(entry.pageUrl || entry.url).hostname.toLowerCase();
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("xiaohongshu.com") || host.includes("xhscdn.com")) return "xiaohongshu";
  return entry.provider || "web";
}

async function importPlan(plan, folderId) {
  const validated = await validateImportRequest(plan, folderId);
  const ready = validated.ready;
  const batchId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let queue = EagleWebMediaCore.createQueue({ id: batchId, folderId, entries: ready });
  await writeQueue(queue);

  for (const original of ready) {
    const entry = { ...original, provider: providerLabel(original) };
    try {
      queue = EagleWebMediaCore.applyQueueEvent(queue, { type: "downloading", entryId: entry.id });
      await writeQueue(queue);
      const download = await downloadEntry(entry);
      queue = EagleWebMediaCore.applyQueueEvent(queue, {
        type: "downloaded", entryId: entry.id, path: download.filename
      });
      await writeQueue(queue);
      const result = await eagleRequest("/item/addFromPath", {
        method: "POST",
        body: JSON.stringify({ ...EagleWebMediaCore.toEagleItem(entry, download.filename), folderId })
      });
      queue = EagleWebMediaCore.applyQueueEvent(queue, {
        type: "accepted", entryId: entry.id, eagleItemIds: extractEagleItemIds(result)
      });
      await writeQueue(queue);
      scheduleCleanup(download.id);
    } catch (error) {
      queue = EagleWebMediaCore.applyQueueEvent(queue, {
        type: "failed", entryId: entry.id, code: importErrorCode(error), message: formatError(error)
      });
      await writeQueue(queue);
    }
  }
  return { batchId: queue.id, summary: queue.summary, entries: queue.entries };
}

async function validateImportRequest(plan, folderId) {
  const targetId = String(folderId || "");
  if (!targetId) throw new Error("请选择 Eagle 普通文件夹");
  const { folders } = await getEagleFolders();
  const target = findFolderById(folders, targetId);
  if (!target || !EagleWebMediaCore.isSelectableFolder(target)) {
    throw new Error("目标必须是当前 Eagle 资源库中的普通文件夹");
  }

  const submitted = Array.isArray(plan?.ready) ? plan.ready : [];
  const first = submitted[0] || {};
  const validated = EagleWebMediaCore.buildBatchPlan(submitted.map((entry) => ({
    url: entry?.url,
    kind: entry?.type || entry?.kind,
    label: entry?.label
  })), {
    pageUrl: first.pageUrl,
    pageTitle: first.pageTitle,
    provider: first.provider,
    maxItems: 80
  });
  if (!validated.ready.length) throw new Error("没有可直接下载的图片或视频");
  return validated;
}

function findFolderById(folders, folderId) {
  for (const folder of Array.isArray(folders) ? folders : []) {
    if (String(folder?.id || "") === folderId) return folder;
    const nested = findFolderById(folder?.children || [], folderId);
    if (nested) return nested;
  }
  return null;
}

async function retryBatch(batchId) {
  const previous = (await readQueues()).find((queue) => queue?.id === String(batchId || ""));
  if (!previous) throw new Error("找不到原导入批次");
  if (!previous.folderId) throw new Error("原批次没有目标 Eagle 文件夹");
  const failed = (previous.entries || [])
    .filter((entry) => entry?.state === "failed")
    .map(({ state, error, path, eagleItemIds, ...entry }) => entry);
  if (!failed.length) throw new Error("这个批次没有可重试的失败项");
  return importPlan({ ready: failed }, previous.folderId);
}

async function downloadEntry(entry) {
  const id = await chrome.downloads.download({
    url: entry.url,
    filename: `${CACHE_DIR}/${EagleWebMediaCore.buildCacheFilename(entry)}`,
    conflictAction: "uniquify",
    saveAs: false
  });
  return waitForDownload(id);
}

function waitForDownload(downloadId) {
  return new Promise((resolve, reject) => {
    const finish = async () => {
      const [item] = await chrome.downloads.search({ id: downloadId });
      if (!item?.filename) return reject(new Error("浏览器没有返回下载文件路径"));
      resolve({ id: downloadId, filename: item.filename });
    };
    const listener = (delta) => {
      if (delta.id !== downloadId || !delta.state) return;
      chrome.downloads.onChanged.removeListener(listener);
      if (delta.state.current === "complete") finish().catch(reject);
      else reject(new Error(delta.error?.current || "浏览器下载失败"));
    };
    chrome.downloads.onChanged.addListener(listener);
    chrome.downloads.search({ id: downloadId }).then(([item]) => {
      if (item?.state === "complete") {
        chrome.downloads.onChanged.removeListener(listener);
        finish().catch(reject);
      } else if (item?.state === "interrupted") {
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error(item.error || "浏览器下载失败"));
      }
    }).catch((error) => {
      chrome.downloads.onChanged.removeListener(listener);
      reject(error);
    });
  });
}

function extractEagleItemIds(result) {
  const data = result?.data;
  if (Array.isArray(data)) return data.map((item) => String(item?.id || item || "")).filter(Boolean);
  return data?.id ? [String(data.id)] : [];
}

function scheduleCleanup(downloadId) {
  if (!Number.isFinite(Number(downloadId))) return;
  chrome.alarms.create(`eagle-web-media-cleanup:${downloadId}`, { delayInMinutes: CLEANUP_DELAY_MINUTES });
}

function importErrorCode(error) {
  const message = String(error?.message || "");
  if (/Eagle API|无法连接 Eagle/i.test(message)) return "EAGLE_UNAVAILABLE";
  if (/download|下载/i.test(message)) return "DOWNLOAD_FAILED";
  return "IMPORT_FAILED";
}

function formatError(error) {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return "无法连接 Eagle，请先打开 Eagle 和目标资源库";
  }
  return String(error?.message || "导入失败");
}
