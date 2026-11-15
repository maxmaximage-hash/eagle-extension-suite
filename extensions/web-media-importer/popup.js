const savePageButton = document.getElementById("save-page");
const status = document.getElementById("status");
const queues = document.getElementById("queues");
const maxItems = document.getElementById("max-items");
const maxItemMb = document.getElementById("max-item-mb");
const maxBatchMb = document.getElementById("max-batch-mb");
const saveSettings = document.getElementById("save-settings");
const pageState = document.getElementById("page-state");
const scanTitle = document.getElementById("scan-title");
const platformNote = document.getElementById("platform-note");
let currentPageMode = "page";
let currentWholeSaveLabel = "保存当前媒体整体";

async function sendRuntimeMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    const invalidated = /extension context invalidated/i.test(String(error?.message || error));
    return { ok: false, error: invalidated ? "扩展已更新，请关闭并重新打开弹窗后重试" : String(error?.message || "扩展通信失败") };
  }
}

function setStatus(message, tone = "") {
  status.textContent = message;
  status.className = `status${tone ? ` ${tone}` : ""}`;
}

savePageButton.addEventListener("click", async () => {
  savePageButton.disabled = true;
  setStatus(`正在识别${currentWholeSaveLabel.replace(/^保存/, "")}…`);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/i.test(String(tab.url || ""))) throw new Error("请先打开一个普通网页");
    const result = await sendRuntimeMessage({ type: "open-web-media-collector", tabId: tab.id, mode: currentPageMode });
    if (!result?.ok) throw new Error(result?.error || "当前页面无法读取媒体");
    setStatus("识别完成，请在页面中选择 Eagle 普通文件夹。", "success");
  } catch (error) {
    setStatus(String(error?.message || "当前页面无法读取媒体"), "error");
  } finally {
    savePageButton.disabled = false;
  }
});

saveSettings.addEventListener("click", async () => {
  saveSettings.disabled = true;
  const response = await sendRuntimeMessage({
    type: "update-web-media-settings",
    settings: {
      maxItems: Number(maxItems.value),
      maxItemBytes: Number(maxItemMb.value) * 1024 * 1024,
      maxBatchBytes: Number(maxBatchMb.value) * 1024 * 1024
    }
  });
  setStatus(response?.ok ? "安全上限已保存。" : (response?.error || "保存失败"), response?.ok ? "success" : "error");
  saveSettings.disabled = false;
});

async function loadSettings() {
  const response = await sendRuntimeMessage({ type: "get-web-media-settings" });
  if (!response?.ok) return;
  maxItems.value = response.settings.maxItems;
  maxItemMb.value = Math.round(response.settings.maxItemBytes / 1024 / 1024);
  maxBatchMb.value = Math.round(response.settings.maxBatchBytes / 1024 / 1024);
}

async function loadPageState() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const eligible = Boolean(tab?.id && /^https?:/i.test(String(tab.url || "")));
  const action = EagleWebMediaProviders.pageActionFor(String(tab?.url || ""));
  currentPageMode = action.mode;
  currentWholeSaveLabel = action.label;
  pageState.textContent = eligible ? action.state : "请先打开普通网页";
  pageState.className = `page-state ${eligible && action.collectible ? "ready" : "blocked"}`;
  scanTitle.textContent = currentWholeSaveLabel;
  savePageButton.textContent = currentWholeSaveLabel;
  platformNote.textContent = action.note;
  savePageButton.disabled = !eligible || !action.collectible;
}

async function refreshQueues() {
  const response = await sendRuntimeMessage({ type: "web-media-import-status" });
  queues.replaceChildren();
  if (!response?.ok) return;
  for (const queue of (response.queues || []).slice(0, 5)) {
    const row = document.createElement("section");
    row.className = "queue";
    const summary = queue.summary || {};
    row.innerHTML = `<strong></strong><span></span>`;
    const uncertain = Number(summary.download_unknown || 0) + Number(summary.submission_unknown || 0);
    row.querySelector("strong").textContent = `API 已读回 ${summary.confirmed || 0} · 待确认 ${summary.accepted_unconfirmed || 0} · 需核对 ${uncertain} · 失败/阻止 ${(summary.failed || 0) + (summary.blocked || 0)}`;
    row.querySelector("span").textContent = new Date(queue.updatedAt || queue.createdAt || Date.now()).toLocaleString();
    if (Number(summary.failed || 0) > 0) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "重试失败项";
      retry.addEventListener("click", async () => {
        retry.disabled = true;
        const result = await sendRuntimeMessage({ type: "retry-web-media-batch", batchId: queue.id });
        setStatus(result?.ok ? "已重新开始失败项。" : (result?.error || "重试失败"), result?.ok ? "success" : "error");
        await refreshQueues();
      });
      row.append(retry);
    }
    if (Number(summary.accepted_unconfirmed || 0) > 0) {
      const recheck = document.createElement("button");
      recheck.type = "button";
      recheck.textContent = "重新确认已接收项";
      recheck.addEventListener("click", async () => {
        recheck.disabled = true;
        const result = await sendRuntimeMessage({ type: "recheck-web-media-batch", batchId: queue.id });
        setStatus(result?.ok
          ? `本轮新增 API 已读回 ${result.confirmed || 0} 项；不会重复导入。`
          : (result?.error || "重新确认失败"), result?.ok ? "success" : "error");
        await refreshQueues();
      });
      row.append(recheck);
    }
    if (uncertain > 0) {
      const warning = document.createElement("p");
      warning.className = "queue-warning";
      warning.textContent = "浏览器曾在关键交接点中断。为避免重复下载或重复导入，这些项目不会自动重试。";
      row.append(warning);
    }
    const active = Number(summary.pending || 0) + Number(summary.download_starting || 0)
      + Number(summary.downloading || 0) + Number(summary.downloaded || 0)
      + Number(summary.validated || 0) + Number(summary.submitting || 0);
    if (active > 0) {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "取消未完成项";
      cancel.addEventListener("click", async () => {
        cancel.disabled = true;
        const result = await sendRuntimeMessage({ type: "cancel-web-media-batch", batchId: queue.id });
        setStatus(result?.ok ? "未完成项已取消；已被 Eagle 接收的项目不会删除。" : (result?.error || "取消失败"), result?.ok ? "success" : "error");
        await refreshQueues();
      });
      row.append(cancel);
    }
    queues.append(row);
  }
}

Promise.all([loadSettings(), loadPageState(), refreshQueues()]).catch(() => {});
