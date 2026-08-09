importScripts("core.js");

const EAGLE_API = "http://127.0.0.1:41595/api";
const CACHE_DIR = "Eagle-Web-Media-Cache";
const QUEUE_KEY = "eagle.webMediaImporter.queues.v2";
const LEGACY_QUEUE_KEY = "eagle.webMediaImporter.queues.v1";
const SETTINGS_KEY = "eagle.webMediaImporter.settings.v2";
const CREDENTIAL_KEY = "eagle.webMediaImporter.credentials.v2";
const MENU_PAGE = "save-current-page-media-to-eagle";
const MENU_MEDIA = "save-current-media-to-eagle";
const CLEANUP_DELAY_MINUTES = 24 * 60;
const processingBatches = new Set();
const processingDownloads = new Set();
let storageLock = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => {
  installMenus();
  initializeQueues().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  initializeQueues().catch(() => {});
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

chrome.downloads.onChanged.addListener((delta) => {
  if (!delta.state || !["complete", "interrupted"].includes(delta.state.current)) return;
  handleDownloadChange(delta.id).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    "open-web-media-collector": () => openCollectorFromMessage(message).then(() => ({})),
    "get-eagle-folders": () => getEagleFolders(),
    "get-web-media-settings": () => readSettings().then((settings) => ({ settings })),
    "update-web-media-settings": () => updateSettings(message.settings).then((settings) => ({ settings })),
    "import-web-media": () => importPlan(message.plan, message.folderId),
    "web-media-import-status": () => readQueues().then((queues) => ({ queues })),
    "retry-web-media-batch": () => retryBatch(message.batchId),
    "recheck-web-media-batch": () => recheckUnconfirmedBatch(message.batchId),
    "cancel-web-media-batch": () => cancelBatch(message.batchId)
  };
  const handler = handlers[message?.type];
  if (!handler) return undefined;
  handler().then((value) => sendResponse({ ok: true, ...value }))
    .catch((error) => sendResponse({ ok: false, error: formatError(error), code: errorCode(error) }));
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("eagle-web-media-cleanup:")) {
    cleanupConfirmedDownload(alarm.name).catch(() => {});
  } else if (alarm.name.startsWith("eagle-web-media-process:")) {
    processNextEntry(alarm.name.slice("eagle-web-media-process:".length)).catch(() => {});
  } else if (alarm.name.startsWith("eagle-web-media-confirm:")) {
    const [batchId, entryId] = alarm.name.slice("eagle-web-media-confirm:".length).split(":");
    confirmUnconfirmedEntry(batchId, entryId).catch(() => {});
  }
});

function installMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_PAGE, title: "保存当前帖子/内容至 Eagle…", contexts: ["page"] });
    chrome.contextMenus.create({ id: MENU_MEDIA, title: "保存当前媒体至 Eagle…", contexts: ["image", "video"] });
  });
}

async function openCollector(tab, payload) {
  if (!tab?.id || !/^https?:/i.test(String(tab.url || ""))) throw codedError("TAB_UNSUPPORTED", "请先打开一个普通网页");
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "collect-web-media", ...payload });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["core.js", "structured-media.js", "provider-adapters.js", "content.js"]
    });
    await chrome.tabs.sendMessage(tab.id, { type: "collect-web-media", ...payload });
  }
}

async function openCollectorFromMessage(message) {
  const tabId = Number(message?.tabId);
  if (!Number.isInteger(tabId) || tabId <= 0) throw codedError("TAB_MISSING", "无法确认当前网页");
  return openCollector(await chrome.tabs.get(tabId), { mode: "page" });
}

async function eagleRequest(path, options = {}) {
  const response = await fetch(`${EAGLE_API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) throw codedError("EAGLE_HTTP_ERROR", `Eagle API ${response.status}`);
  const result = await response.json();
  if (result?.status !== "success") throw codedError("EAGLE_REJECTED", result?.message || "Eagle 拒绝了请求");
  return result;
}

async function getEagleFolders() {
  const [folders, recent] = await Promise.all([
    eagleRequest("/folder/list"),
    eagleRequest("/folder/listRecent").catch(() => ({ data: [] }))
  ]);
  return { folders: folders.data || [], recent: recent.data || [] };
}

async function readSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return EagleWebMediaCore.normalizeSettings(stored[SETTINGS_KEY] || {});
}

async function updateSettings(settings) {
  const normalized = EagleWebMediaCore.normalizeSettings(settings || {});
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
  return normalized;
}

async function readQueues() {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  return Array.isArray(stored[QUEUE_KEY]) ? stored[QUEUE_KEY] : [];
}

async function initializeQueues() {
  const stored = await chrome.storage.local.get([QUEUE_KEY, LEGACY_QUEUE_KEY]);
  const current = Array.isArray(stored[QUEUE_KEY]) ? stored[QUEUE_KEY] : [];
  const legacy = Array.isArray(stored[LEGACY_QUEUE_KEY]) ? stored[LEGACY_QUEUE_KEY] : [];
  if (legacy.length) {
    const currentIds = new Set(current.map((queue) => queue?.id));
    const migrated = legacy.filter((queue) => !currentIds.has(queue?.id)).map(EagleWebMediaCore.migrateLegacyQueue);
    await chrome.storage.local.set({ [QUEUE_KEY]: [...current, ...migrated] });
    await chrome.storage.local.remove(LEGACY_QUEUE_KEY);
  }
  await recoverQueues();
}

async function replaceQueue(queue) {
  return withStorageLock(async () => {
    const queues = await readQueues();
    const merged = [queue, ...queues.filter((entry) => entry?.id !== queue.id)];
    const active = merged.filter((entry) => entry.entries?.some((item) => !EagleWebMediaCore.TERMINAL_STATES.has(item.state)));
    const terminal = merged.filter((entry) => !active.includes(entry)).slice(0, 20);
    await chrome.storage.local.set({ [QUEUE_KEY]: [...active, ...terminal] });
    return queue;
  });
}

async function updateQueue(batchId, updater) {
  return withStorageLock(async () => {
    const queues = await readQueues();
    const index = queues.findIndex((queue) => queue?.id === batchId);
    if (index < 0) throw codedError("BATCH_NOT_FOUND", "找不到导入批次");
    const next = await updater(queues[index]);
    queues[index] = next;
    await chrome.storage.local.set({ [QUEUE_KEY]: queues });
    return next;
  });
}

function withStorageLock(task) {
  const run = storageLock.then(task, task);
  storageLock = run.catch(() => {});
  return run;
}

async function readCredentials() {
  const stored = await chrome.storage.session.get(CREDENTIAL_KEY);
  return stored[CREDENTIAL_KEY] && typeof stored[CREDENTIAL_KEY] === "object" ? stored[CREDENTIAL_KEY] : {};
}

async function storeCredentials(values) {
  const current = await readCredentials();
  await chrome.storage.session.set({ [CREDENTIAL_KEY]: { ...current, ...values } });
}

async function readCredential(ref) {
  return (await readCredentials())[String(ref || "")] || "";
}

async function clearCredential(ref) {
  const current = await readCredentials();
  delete current[String(ref || "")];
  await chrome.storage.session.set({ [CREDENTIAL_KEY]: current });
}

async function importPlan(plan, folderId) {
  const settings = await readSettings();
  await assertOrdinaryFolder(folderId);
  const submitted = Array.isArray(plan?.ready) ? plan.ready : [];
  const first = submitted[0] || {};
  const validated = EagleWebMediaCore.buildBatchPlan(submitted.map((entry) => ({
    url: entry?.url,
    kind: entry?.type || entry?.kind,
    label: entry?.label,
    role: entry?.role,
    mimeHint: entry?.mimeHint,
    sourceEvidence: entry?.sourceEvidence,
    mediaCompleteness: entry?.mediaCompleteness,
    audioStatus: entry?.audioStatus,
    estimatedBytes: entry?.estimatedBytes
  })), {
    pageUrl: first.pageUrl,
    pageTitle: first.pageTitle,
    provider: first.provider,
    ...settings
  });
  if (!validated.ready.length) throw codedError("NO_SAFE_MEDIA", "没有通过安全门禁的图片或视频");
  const batchId = `web-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const credentials = {};
  const entries = validated.ready.map((entry) => {
    const requestRef = `credential:${batchId}:${entry.id}`;
    credentials[requestRef] = entry.url;
    return EagleWebMediaCore.toPersistentEntry({ ...entry, requestRef });
  });
  await storeCredentials(credentials);
  const queue = EagleWebMediaCore.createQueue({
    id: batchId, folderId: String(folderId), entries, limits: validated.limits
  });
  await replaceQueue(queue);
  processNextEntry(batchId).catch(() => {});
  return { batchId, summary: queue.summary, entries: queue.entries };
}

async function assertOrdinaryFolder(folderId) {
  const targetId = String(folderId || "");
  if (!targetId) throw codedError("FOLDER_REQUIRED", "请选择 Eagle 普通文件夹");
  const { folders } = await getEagleFolders();
  const target = findFolderById(folders, targetId);
  if (!target || !EagleWebMediaCore.isSelectableFolder(target)) {
    throw codedError("FOLDER_NOT_ORDINARY", "目标必须是当前 Eagle 资源库中的普通文件夹");
  }
  return target;
}

function findFolderById(folders, folderId) {
  for (const folder of Array.isArray(folders) ? folders : []) {
    if (String(folder?.id || "") === folderId) return folder;
    const nested = findFolderById(folder?.children || [], folderId);
    if (nested) return nested;
  }
  return null;
}

async function processNextEntry(batchId) {
  if (processingBatches.has(batchId)) return;
  processingBatches.add(batchId);
  try {
    const queue = (await readQueues()).find((entry) => entry?.id === batchId);
    if (!queue || queue.cancelled) return;
    const active = queue.entries.find((entry) => ["downloading", "downloaded", "validated", "accepted"].includes(entry.state));
    const entry = active || queue.entries.find((item) => item.state === "pending");
    if (!entry) return;
    if (entry.state === "pending") await startDownload(queue, entry);
    else if (entry.state === "downloaded") await validateCompletedDownload(queue, entry);
    else if (entry.state === "validated") await acceptValidatedEntry(queue, entry);
    else if (entry.state === "accepted") await confirmAcceptedEntry(queue, entry);
  } finally {
    processingBatches.delete(batchId);
  }
}

async function startDownload(queue, entry) {
  const rawUrl = await readCredential(entry.requestRef);
  if (!rawUrl) {
    await transition(queue.id, entry.id, {
      type: "blocked", code: "SIGNED_URL_EXPIRED",
      message: "浏览器重启后临时下载地址已清除，请回原页面重新选择"
    });
    return scheduleNext(queue.id);
  }
  const network = EagleWebMediaCore.classifyNetworkAccess(entry, rawUrl);
  if (!network.ok) {
    await transition(queue.id, entry.id, {
      type: "blocked", code: network.reason,
      message: "媒体地址不属于当前站点或已登记的平台 CDN"
    });
    return scheduleNext(queue.id);
  }
  await transition(queue.id, entry.id, {
    type: "downloading",
    networkStatus: network.requiresBrowserValidation ? "requires-browser-validation" : "browser-managed"
  });
  try {
    const downloadId = await chrome.downloads.download({
      url: rawUrl,
      filename: `${CACHE_DIR}/${EagleWebMediaCore.buildCacheFilename(entry)}`,
      conflictAction: "uniquify",
      saveAs: false
    });
    await transition(queue.id, entry.id, { type: "downloading", downloadId });
    const [item] = await chrome.downloads.search({ id: downloadId });
    if (item?.state === "complete" || item?.state === "interrupted") await handleDownloadChange(downloadId);
  } catch (error) {
    await failEntry(queue.id, entry.id, errorCode(error), formatError(error));
    scheduleNext(queue.id);
  }
}

async function handleDownloadChange(downloadId) {
  if (processingDownloads.has(Number(downloadId))) return;
  processingDownloads.add(Number(downloadId));
  try {
    const located = await findEntryByDownloadId(downloadId);
    if (!located) return;
    const [item] = await chrome.downloads.search({ id: downloadId });
    if (item?.state === "interrupted") {
      if (item.canResume) {
        try { await chrome.downloads.resume(downloadId); return; } catch { /* fall through */ }
      }
      await failEntry(located.queue.id, located.entry.id, "DOWNLOAD_INTERRUPTED", item?.error || "浏览器下载中断");
      return scheduleNext(located.queue.id);
    }
    if (item?.state !== "complete") return;
    const updated = await transition(located.queue.id, located.entry.id, {
      type: "downloaded", downloadId, path: item.filename
    });
    const updatedEntry = updated.entries.find((entry) => entry.id === located.entry.id);
    return validateCompletedDownload(updated, updatedEntry);
  } finally {
    processingDownloads.delete(Number(downloadId));
  }
}

async function validateCompletedDownload(queue, entry) {
  const [item] = await chrome.downloads.search({ id: Number(entry.downloadId) });
  const validation = EagleWebMediaCore.validateDownloadItem(entry, item || {});
  if (!validation.ok) {
    await transition(queue.id, entry.id, {
      type: "blocked", code: validation.reason,
      message: validationMessage(validation.reason)
    });
    await removeInvalidDownload(entry.downloadId);
    await clearCredential(entry.requestRef);
    return scheduleNext(queue.id);
  }
  const actualBatchBytes = (queue.entries || [])
    .filter((itemEntry) => itemEntry.id !== entry.id)
    .reduce((sum, itemEntry) => sum + Math.max(0, Number(itemEntry.actualBytes) || 0), 0)
    + validation.size;
  if (actualBatchBytes > Number(queue.limits?.maxBatchBytes || Infinity)) {
    await transition(queue.id, entry.id, {
      type: "blocked", code: "BATCH_SIZE_LIMIT",
      message: "实际下载总量超过整批安全上限"
    });
    await removeInvalidDownload(entry.downloadId);
    await clearCredential(entry.requestRef);
    return scheduleNext(queue.id);
  }
  const updated = await transition(queue.id, entry.id, {
    type: "validated", downloadId: entry.downloadId, path: validation.filename,
    validatedExtension: validation.extension, actualBytes: validation.size
  });
  const validatedEntry = updated.entries.find((itemEntry) => itemEntry.id === entry.id);
  return acceptValidatedEntry(updated, validatedEntry);
}

async function acceptValidatedEntry(queue, entry) {
  try {
    await assertOrdinaryFolder(queue.folderId);
    const result = await eagleRequest("/item/addFromPath", {
      method: "POST",
      body: JSON.stringify({ ...EagleWebMediaCore.toEagleItem(entry, entry.path), folderId: queue.folderId })
    });
    const eagleItemIds = extractEagleItemIds(result);
    const accepted = await transition(queue.id, entry.id, { type: "accepted", eagleItemIds });
    const acceptedEntry = accepted.entries.find((item) => item.id === entry.id);
    if (!eagleItemIds.length) {
      await transition(queue.id, entry.id, { type: "accepted_unconfirmed" });
      await clearCredential(entry.requestRef);
      return scheduleNext(queue.id);
    }
    return confirmAcceptedEntry(accepted, acceptedEntry);
  } catch (error) {
    await failEntry(queue.id, entry.id, errorCode(error), formatError(error));
    return scheduleNext(queue.id);
  }
}

async function confirmAcceptedEntry(queue, entry) {
  const ids = Array.isArray(entry.eagleItemIds) ? entry.eagleItemIds : [];
  if (!ids.length) {
    await transition(queue.id, entry.id, { type: "accepted_unconfirmed" });
    return scheduleNext(queue.id);
  }
  const confirmed = await confirmEagleItems(ids);
  if (!confirmed) {
    const attempts = Math.max(0, Number(entry.confirmationAttempts) || 0) + 1;
    await transition(queue.id, entry.id, { type: "accepted_unconfirmed", confirmationAttempts: attempts });
    scheduleConfirmation(queue.id, entry.id, attempts);
    await clearCredential(entry.requestRef);
    return scheduleNext(queue.id);
  }
  await transition(queue.id, entry.id, { type: "confirmed", eagleItemIds: ids });
  scheduleCleanup(queue.id, entry.id, entry.downloadId);
  await clearCredential(entry.requestRef);
  return scheduleNext(queue.id);
}

function scheduleConfirmation(batchId, entryId, attempts) {
  const backoffMinutes = [1, 5, 15, 60, 240][Math.min(Math.max(0, attempts - 1), 4)];
  chrome.alarms.create(`eagle-web-media-confirm:${batchId}:${entryId}`, { delayInMinutes: backoffMinutes });
}

async function confirmUnconfirmedEntry(batchId, entryId) {
  const queue = (await readQueues()).find((item) => item?.id === batchId);
  const entry = queue?.entries?.find((item) => item?.id === entryId);
  if (!entry || entry.state !== "accepted_unconfirmed") return false;
  const ids = Array.isArray(entry.eagleItemIds) ? entry.eagleItemIds : [];
  if (!ids.length) return false;
  if (await confirmEagleItems(ids)) {
    await transition(batchId, entryId, { type: "confirmed", eagleItemIds: ids });
    scheduleCleanup(batchId, entryId, entry.downloadId);
    return true;
  }
  const attempts = Math.max(0, Number(entry.confirmationAttempts) || 0) + 1;
  await transition(batchId, entryId, { type: "accepted_unconfirmed", confirmationAttempts: attempts });
  scheduleConfirmation(batchId, entryId, attempts);
  return false;
}

async function recheckUnconfirmedBatch(batchId) {
  const queue = (await readQueues()).find((item) => item?.id === String(batchId || ""));
  if (!queue) throw codedError("BATCH_NOT_FOUND", "找不到导入批次");
  let confirmed = 0;
  for (const entry of queue.entries || []) {
    if (entry.state === "accepted_unconfirmed" && await confirmUnconfirmedEntry(queue.id, entry.id)) confirmed += 1;
  }
  const updated = (await readQueues()).find((item) => item?.id === queue.id) || queue;
  return { batchId: queue.id, confirmed, summary: updated.summary };
}

async function confirmEagleItems(ids) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const results = await Promise.all(ids.map(async (id) => {
      try {
        const result = await eagleRequest(`/item/info?id=${encodeURIComponent(id)}`);
        const item = result?.data;
        return String(item?.id || "") === String(id)
          && item?.isDeleted !== true
          && item?.deleted !== true;
      } catch {
        return false;
      }
    }));
    if (results.every(Boolean)) return true;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  return false;
}

function scheduleCleanup(batchId, entryId, downloadId) {
  if (!Number.isFinite(Number(downloadId))) return;
  chrome.alarms.create(`eagle-web-media-cleanup:${batchId}:${entryId}:${downloadId}`, {
    delayInMinutes: CLEANUP_DELAY_MINUTES
  });
}

async function cleanupConfirmedDownload(alarmName) {
  const parts = alarmName.split(":");
  const downloadId = Number(parts.at(-1));
  const entryId = parts.at(-2);
  const batchId = parts.slice(1, -2).join(":");
  const queue = (await readQueues()).find((item) => item?.id === batchId);
  const entry = queue?.entries?.find((item) => item?.id === entryId);
  if (!entry || entry.state !== "confirmed" || Number(entry.downloadId) !== downloadId) return;
  await chrome.downloads.removeFile(downloadId).catch(() => {});
  await chrome.downloads.erase({ id: downloadId }).catch(() => {});
}

async function removeInvalidDownload(downloadId) {
  if (!Number.isFinite(Number(downloadId))) return;
  await chrome.downloads.removeFile(Number(downloadId)).catch(() => {});
  await chrome.downloads.erase({ id: Number(downloadId) }).catch(() => {});
}

async function retryBatch(batchId) {
  const queue = (await readQueues()).find((item) => item?.id === String(batchId || ""));
  if (!queue) throw codedError("BATCH_NOT_FOUND", "找不到原导入批次");
  await assertOrdinaryFolder(queue.folderId);
  let retryable = 0;
  const next = {
    ...queue,
    cancelled: false,
    entries: queue.entries.map((entry) => {
      if (!entry.error || !["failed", "blocked"].includes(entry.state)) return entry;
      if (entry.validatedAt && entry.path && entry.downloadId) {
        retryable += 1;
        return { ...entry, state: "validated", error: null };
      }
      retryable += 1;
      return { ...entry, state: "pending", error: null };
    })
  };
  next.summary = EagleWebMediaCore.summarize(next.entries);
  if (!retryable) throw codedError("NOTHING_TO_RETRY", "这个批次没有可重试项");
  await replaceQueue(next);
  processNextEntry(next.id).catch(() => {});
  return { batchId: next.id, summary: next.summary };
}

async function cancelBatch(batchId) {
  const queue = (await readQueues()).find((item) => item?.id === String(batchId || ""));
  if (!queue) throw codedError("BATCH_NOT_FOUND", "找不到导入批次");
  for (const entry of queue.entries) {
    if (entry.state === "downloading" && Number.isFinite(Number(entry.downloadId))) {
      await chrome.downloads.cancel(Number(entry.downloadId)).catch(() => {});
    }
  }
  const next = EagleWebMediaCore.cancelQueue(queue);
  await replaceQueue(next);
  return { batchId: next.id, summary: next.summary };
}

async function recoverQueues() {
  const queues = await readQueues();
  for (const queue of queues) {
    for (const entry of queue.entries || []) {
      if (entry.state === "accepted_unconfirmed" && (entry.eagleItemIds || []).length) {
        scheduleConfirmation(queue.id, entry.id, Math.max(1, Number(entry.confirmationAttempts) || 1));
      }
      if (entry.state !== "downloading") continue;
      const [item] = Number.isFinite(Number(entry.downloadId))
        ? await chrome.downloads.search({ id: Number(entry.downloadId) })
        : [];
      const action = EagleWebMediaCore.recoveryAction(entry, item);
      if (action.action === "resume") {
        await chrome.downloads.resume(Number(entry.downloadId)).catch(async () => {
          await failEntry(queue.id, entry.id, "DOWNLOAD_INTERRUPTED", "下载无法恢复，请重试");
        });
      } else if (action.action === "validate") {
        await handleDownloadChange(Number(entry.downloadId));
      } else if (action.action === "fail") {
        await failEntry(queue.id, entry.id, action.reason, "浏览器后台重启后无法恢复该下载");
      }
    }
    processNextEntry(queue.id).catch(() => {});
  }
}

async function findEntryByDownloadId(downloadId) {
  for (const queue of await readQueues()) {
    const entry = (queue.entries || []).find((item) => Number(item.downloadId) === Number(downloadId));
    if (entry) return { queue, entry };
  }
  return null;
}

async function transition(batchId, entryId, event) {
  return updateQueue(batchId, (queue) => EagleWebMediaCore.applyQueueEvent(queue, { ...event, entryId }));
}

function scheduleNext(batchId) {
  chrome.alarms.create(`eagle-web-media-process:${batchId}`, { when: Date.now() + 1000 });
  setTimeout(() => processNextEntry(batchId).catch(() => {}), 0);
}

async function failEntry(batchId, entryId, code, message) {
  return transition(batchId, entryId, { type: "failed", code, message });
}

function extractEagleItemIds(result) {
  const data = result?.data;
  if (Array.isArray(data)) return data.map((item) => String(item?.id || item || "")).filter(Boolean);
  if (data?.id) return [String(data.id)];
  if (result?.id) return [String(result.id)];
  return [];
}

function validationMessage(code) {
  return {
    DOWNLOAD_HTML: "下载结果是网页/登录页，不是媒体文件",
    DOWNLOAD_JSON: "下载结果是接口数据，不是媒体文件",
    DOWNLOAD_EMPTY: "下载结果为空文件",
    DOWNLOAD_DANGEROUS: "Chrome 将该下载标记为危险文件",
    DOWNLOAD_TYPE_MISMATCH: "下载文件的真实类型与候选媒体不符",
    DOWNLOAD_EXTENSION_MISMATCH: "下载文件的真实格式与扩展名不符",
    ITEM_SIZE_LIMIT: "单个文件超过安全上限"
  }[code] || "下载文件未通过真实性校验";
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function errorCode(error) {
  if (error?.code) return String(error.code);
  if (error instanceof TypeError && /fetch/i.test(String(error.message))) return "EAGLE_UNAVAILABLE";
  return "IMPORT_FAILED";
}

function formatError(error) {
  if (error instanceof TypeError && /fetch/i.test(String(error.message))) {
    return "无法连接 Eagle，请先打开 Eagle 和目标资源库";
  }
  return String(error?.message || "导入失败");
}

// MV3 may recreate the worker without firing runtime.onStartup. This read-only
// bootstrap makes persisted queues self-healing on every worker incarnation.
initializeQueues().catch(() => {});
