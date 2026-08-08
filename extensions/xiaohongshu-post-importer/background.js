importScripts("core.js");

const MENU_ID = "save-xiaohongshu-post-to-eagle";
const EAGLE_API = "http://127.0.0.1:41595/api";
const CACHE_DIR = "Eagle-XHS-JPG-Cache";
const CLEANUP_ALARM_PREFIX = "xhs-jpg-cleanup:";
const CLEANUP_DELAY_MINUTES = 30;

chrome.runtime.onInstalled.addListener(createMenu);
chrome.runtime.onStartup.addListener(createMenu);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith(CLEANUP_ALARM_PREFIX)) void cleanupCachedJpeg(Number(alarm.name.slice(CLEANUP_ALARM_PREFIX.length)));
});
createMenu();

function createMenu() {
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "小红书：保存整篇静态图片至 Eagle…",
      contexts: ["all"],
      documentUrlPatterns: ["https://www.xiaohongshu.com/*"]
    }, () => void chrome.runtime.lastError);
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  await triggerCollector(tab.id);
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  await triggerCollector(tab.id);
});

async function triggerCollector(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "collect-xhs-note" });
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["core.js", "content.js"] });
      await chrome.tabs.sendMessage(tabId, { type: "collect-xhs-note" });
    } catch (error) {
      console.error("Unable to start Xiaohongshu collector", error);
    }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "get-eagle-folders") {
    getFolders().then((data) => sendResponse({ ok: true, ...data })).catch((error) => sendResponse({ ok: false, error: formatError(error) }));
    return true;
  }
  if (message?.type === "save-xhs-note") {
    saveNote(message.note, message.folderId).then((data) => sendResponse({ ok: true, ...data })).catch((error) => sendResponse({ ok: false, error: formatError(error) }));
    return true;
  }
  return false;
});

async function getFolders() {
  const [folders, recents] = await Promise.all([
    eagleRequest("/folder/list"),
    eagleRequest("/folder/listRecent").catch(() => ({ data: [] }))
  ]);
  return { folders: folders.data || [], recents: recents.data || [] };
}

async function saveNote(note, folderId) {
  if (!folderId) throw new Error("请选择 Eagle 文件夹");
  const plan = XhsEagleCore.buildImportPlan(note);
  if (!plan.length) throw new Error("没有识别到可导入媒体");

  const results = [];
  for (const entry of plan) {
    const jpegFile = await convertImageToJpegFile(note, entry);
    const item = XhsEagleCore.buildEagleItem(note, entry.media, entry.sequence, { path: jpegFile.filename });
    const result = await eagleRequest("/item/addFromPath", {
      method: "POST",
      body: JSON.stringify({ ...item, folderId })
    });
    results.push(result.data);
    scheduleCachedJpegCleanup(jpegFile.id);
  }
  return { accepted: plan.length, ...XhsEagleCore.summarizeMedia(note.media), jpgOnly: true, result: results };
}

async function convertImageToJpegFile(note, entry) {
  const source = await fetchImage(entry.media.url, `第 ${entry.sequence} 张图片`);
  const jpeg = await convertToJpeg(source, `第 ${entry.sequence} 张图片`);
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  const filename = `${CACHE_DIR}/${buildJpegFilename(note, entry)}.jpg`;
  const downloadId = await chrome.downloads.download({
    url: uint8ArrayToDataUrl(bytes, "image/jpeg"),
    filename,
    conflictAction: "uniquify",
    saveAs: false
  });
  const downloaded = await waitForDownload(downloadId);
  return { id: downloadId, filename: downloaded.filename };
}

async function fetchImage(url, label) {
  const response = await fetch(url, { referrer: "https://www.xiaohongshu.com/" });
  if (!response.ok) throw new Error(`${label}下载失败（HTTP ${response.status}）`);
  const blob = await response.blob();
  if (!blob.type || /^image\//i.test(blob.type)) return blob;
  throw new Error(`${label}不是可转换的图片资源`);
}

async function convertToJpeg(blob, label) {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, bitmap.width, bitmap.height);
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await canvas.convertToBlob({ type: "image/jpeg", quality: 0.95 });
  } catch {
    throw new Error(`${label}无法转换为 JPG，请确认 Chrome 能打开该图片格式`);
  }
}

function buildJpegFilename(note, entry) {
  const base = XhsEagleCore.sanitizeName(note.title || note.id || "xiaohongshu_note");
  const sequence = String(entry.sequence).padStart(2, "0");
  const liveSuffix = entry.media.liveGroup ? `_live${String(entry.media.liveGroup).padStart(2, "0")}` : "";
  return `${base}_${sequence}${liveSuffix}`;
}

function uint8ArrayToDataUrl(bytes, mime) {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function waitForDownload(downloadId) {
  return new Promise((resolve, reject) => {
    const listener = (delta) => {
      if (delta.id !== downloadId || !delta.state) return;
      if (delta.state.current === "complete") finish();
      if (delta.state.current === "interrupted") fail(delta.error?.current || "下载被中断");
    };
    const finish = async () => {
      chrome.downloads.onChanged.removeListener(listener);
      const [item] = await chrome.downloads.search({ id: downloadId });
      if (!item?.filename) reject(new Error("无法定位 JPG 临时文件"));
      else resolve(item);
    };
    const fail = (message) => {
      chrome.downloads.onChanged.removeListener(listener);
      reject(new Error(`JPG 临时文件写入失败：${message}`));
    };
    chrome.downloads.onChanged.addListener(listener);
    chrome.downloads.search({ id: downloadId }).then(([item]) => {
      if (item?.state === "complete") finish();
      if (item?.state === "interrupted") fail(item.error || "下载被中断");
    });
  });
}

function scheduleCachedJpegCleanup(downloadId) {
  if (!downloadId) return;
  chrome.alarms.create(`${CLEANUP_ALARM_PREFIX}${downloadId}`, { delayInMinutes: CLEANUP_DELAY_MINUTES });
}

async function cleanupCachedJpeg(downloadId) {
  if (!Number.isFinite(downloadId)) return;
  try { await chrome.downloads.removeFile(downloadId); } catch {}
  try { await chrome.downloads.erase({ id: downloadId }); } catch {}
}

async function eagleRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${EAGLE_API}${path}`, { ...options, headers });
  if (!response.ok) throw new Error(`Eagle API ${response.status}`);
  const result = await response.json();
  if (result?.status !== "success") throw new Error(result?.message || "Eagle 拒绝了请求");
  return result;
}

function formatError(error) {
  if (error instanceof TypeError && /fetch/i.test(error.message)) return "无法连接 Eagle，请先打开 Eagle 和目标资源库";
  return error?.message || "Eagle 连接失败";
}
