const savePageButton = document.getElementById("save-page");
const status = document.getElementById("status");
const queues = document.getElementById("queues");

savePageButton.addEventListener("click", async () => {
  savePageButton.disabled = true;
  status.textContent = "正在读取当前页面媒体…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/i.test(String(tab.url || ""))) throw new Error("请先打开一个普通网页");
    const result = await chrome.runtime.sendMessage({ type: "open-web-media-collector", tabId: tab.id });
    if (!result?.ok) throw new Error(result?.error || "当前页面无法读取媒体");
    status.textContent = "请在页面中选择 Eagle 文件夹。";
  } catch (error) {
    status.textContent = String(error?.message || "当前页面无法读取媒体");
  } finally {
    savePageButton.disabled = false;
  }
});

async function refreshQueues() {
  const response = await chrome.runtime.sendMessage({ type: "web-media-import-status" });
  queues.replaceChildren();
  if (!response?.ok) return;
  for (const queue of (response.queues || []).slice(0, 5)) {
    const row = document.createElement("section");
    row.className = "queue";
    const summary = queue.summary || {};
    row.innerHTML = `<strong></strong><span></span>`;
    row.querySelector("strong").textContent = `Eagle 已接收 ${summary.accepted || 0} · 失败 ${summary.failed || 0}`;
    row.querySelector("span").textContent = new Date(queue.updatedAt || queue.createdAt || Date.now()).toLocaleString();
    if (Number(summary.failed || 0) > 0) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "重试失败项";
      retry.addEventListener("click", async () => {
        retry.disabled = true;
        const result = await chrome.runtime.sendMessage({ type: "retry-web-media-batch", batchId: queue.id });
        status.textContent = result?.ok ? "已重新开始失败项。" : (result?.error || "重试失败");
        await refreshQueues();
      });
      row.append(retry);
    }
    queues.append(row);
  }
}

refreshQueues().catch(() => {});
