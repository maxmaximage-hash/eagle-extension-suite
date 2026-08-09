"use strict";

(function startApplication() {
  const anchorKey = "max-live-browse-anchor-v1";
  const elements = {
    sourcePath: document.getElementById("sourcePath"),
    grid: document.getElementById("liveGrid"),
    empty: document.getElementById("emptyState"),
    error: document.getElementById("errorBanner"),
    queueState: document.getElementById("queueState"),
    anchorState: document.getElementById("anchorState"),
    contextMenu: document.getElementById("contextMenu"),
    toast: document.getElementById("toast"),
    total: document.getElementById("countTotal"),
    ready: document.getElementById("countReady"),
    processing: document.getElementById("countProcessing"),
    failed: document.getElementById("countFailed"),
    remaining: document.getElementById("countRemaining"),
  };
  let currentState = null;
  let activeVideo = null;
  let contextItemId = null;
  let pollTimer = null;
  let renderedSignature = "";

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "-";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function readAnchor() {
    try {
      return JSON.parse(localStorage.getItem(anchorKey) || "null");
    } catch {
      return null;
    }
  }

  function saveAnchor(item) {
    const itemIndex = currentState.items.findIndex((candidate) => candidate.id === item.id);
    const anchor = {
      itemId: item.id,
      stem: item.stem,
      sourceDirectory: currentState.sourceDirectory,
      imageName: item.imageName,
      movieName: item.movieName,
      shotAt: item.shotAt || null,
      modifiedAt: item.modifiedAt || null,
      thumbnailUrl: item.imageUrl || item.result?.imageUrl || null,
      selectedAt: new Date().toISOString(),
      rangeBefore: currentState.items.slice(Math.max(0, itemIndex - 2), itemIndex).map((candidate) => candidate.stem),
      rangeAfter: currentState.items.slice(itemIndex + 1, itemIndex + 3).map((candidate) => candidate.stem),
    };
    localStorage.setItem(anchorKey, JSON.stringify(anchor));
    renderAnchor(anchor);
  }

  function renderAnchor(anchor = readAnchor()) {
    elements.anchorState.textContent = anchor
      ? `上次停在 ${anchor.stem} · ${new Date(anchor.selectedAt).toLocaleString("zh-CN", { hour12: false })}`
      : "尚未记录浏览位置";
  }

  function queueLabel(state) {
    if (state.queue.circuitOpen) return "连续失败，队列已熔断";
    if (state.queue.running) return "正在串行检查预览";
    if (state.queue.paused) return "队列已暂停";
    if (state.counts.remaining === 0) return "本批检查完成";
    return "等待继续";
  }

  function statusLabel(status) {
    const labels = {
      paired: "待检查",
      previewing: "检查中",
      preview_ready: "Live",
      failed: "失败",
      cancelled: "已暂停",
      conflict: "冲突",
      incomplete: "缺少伴侣文件",
    };
    return labels[status] || status;
  }

  function cardMarkup(item) {
    const issue = item.error || (item.issues && item.issues[0]) || "";
    const imageUrl = item.imageUrl || item.result?.imageUrl || "";
    const movieUrl = item.movieUrl || item.result?.movieUrl || "";
    return `
      <article class="live-card ${escapeHtml(item.status)}" data-item-id="${escapeHtml(item.id)}" tabindex="0">
        <div class="media-frame">
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.stem)} 封面" loading="lazy">` : ""}
          ${movieUrl ? `<video muted playsinline loop preload="none" data-movie-url="${escapeHtml(movieUrl)}"></video>` : ""}
          <span class="live-badge"><i></i>${escapeHtml(statusLabel(item.status))}</span>
          <span class="motion-indicator" aria-hidden="true">LIVE</span>
        </div>
        <div class="card-meta">
          <div class="card-title-row"><strong>${escapeHtml(item.stem)}</strong><span>${formatBytes((item.imageBytes || 0) + (item.movieBytes || 0))}</span></div>
          <div class="component-row"><span>${escapeHtml(item.imageName || "缺少静态图")}</span><span>${escapeHtml(item.movieName || "缺少 MOV")}</span></div>
          ${issue ? `<p class="item-error" title="${escapeHtml(issue)}">${escapeHtml(issue)}</p>` : ""}
        </div>
      </article>`;
  }

  function render(state) {
    const signature = JSON.stringify({
      sourceDirectory: state.sourceDirectory,
      queue: state.queue,
      counts: state.counts,
      items: state.items.map((item) => [item.id, item.status, item.error, item.result?.checkedAt]),
    });
    if (signature === renderedSignature) return;
    renderedSignature = signature;
    currentState = state;
    elements.sourcePath.textContent = state.sourceDirectory;
    elements.total.textContent = state.counts.total;
    elements.ready.textContent = state.counts.ready;
    elements.processing.textContent = state.counts.processing;
    elements.failed.textContent = state.counts.failed;
    elements.remaining.textContent = state.counts.remaining + state.counts.conflicts;
    elements.queueState.textContent = queueLabel(state);
    elements.grid.innerHTML = state.items.map(cardMarkup).join("");
    elements.empty.hidden = state.items.length > 0;
    elements.error.hidden = true;
    renderAnchor();
  }

  function showError(error) {
    elements.error.textContent = error && error.message ? error.message : String(error);
    elements.error.hidden = false;
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => elements.toast.classList.remove("visible"), 2400);
  }

  async function request(action) {
    if (window.MaxLivePhotoBridge) {
      const result = action === "scan"
        ? window.MaxLivePhotoBridge.scan()
        : window.MaxLivePhotoBridge[action]();
      if (result && typeof result.then === "function") await result;
      render(window.MaxLivePhotoBridge.getState());
      return;
    }
    const response = await fetch(`/api/${action}`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `Request failed: ${response.status}`);
    render(body);
  }

  async function loadState() {
    if (window.MaxLivePhotoBridge) {
      render(window.MaxLivePhotoBridge.getState());
      window.MaxLivePhotoBridge.subscribe(render);
      return;
    }
    const refresh = async () => {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || `Request failed: ${response.status}`);
        render(body);
      } catch (error) {
        showError(error);
      }
    };
    await refresh();
    pollTimer = setInterval(refresh, 700);
  }

  function stopVideo() {
    if (!activeVideo) return;
    activeVideo.pause();
    activeVideo.removeAttribute("src");
    activeVideo.load();
    activeVideo.closest(".media-frame")?.classList.remove("playing");
    activeVideo = null;
  }

  async function playCard(card) {
    const video = card.querySelector("video[data-movie-url]");
    if (!video || activeVideo === video) return;
    stopVideo();
    activeVideo = video;
    video.src = video.dataset.movieUrl;
    video.closest(".media-frame")?.classList.add("playing");
    try {
      await video.play();
    } catch {
      stopVideo();
    }
  }

  function continueFromAnchor() {
    const anchor = readAnchor();
    if (!anchor) {
      showToast("还没有上次浏览位置");
      return;
    }
    const card = elements.grid.querySelector(`[data-item-id="${anchor.itemId}"]`);
    if (!card) {
      showToast(`上次停在 ${anchor.stem}，当前批次未找到`);
      return;
    }
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("anchor-highlight");
    card.focus({ preventScroll: true });
    setTimeout(() => card.classList.remove("anchor-highlight"), 2200);
  }

  document.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action) {
      try {
        if (action === "continue-anchor") continueFromAnchor();
        else await request(action);
      } catch (error) {
        showError(error);
      }
      return;
    }

    const exportAction = event.target.closest("[data-export]")?.dataset.export;
    if (exportAction) {
      const item = currentState?.items.find((candidate) => candidate.id === contextItemId);
      const labels = { image: "静态 JPG", movie: "MOV", photos: "苹果照片（Live）" };
      showToast(`${item?.stem || "当前项目"}：${labels[exportAction]}导出将在下一试点开放`);
      elements.contextMenu.hidden = true;
      return;
    }

    const card = event.target.closest(".live-card");
    if (card && currentState) {
      const item = currentState.items.find((candidate) => candidate.id === card.dataset.itemId);
      if (item) saveAnchor(item);
    }
    elements.contextMenu.hidden = true;
  });

  elements.grid.addEventListener("pointerover", (event) => {
    const card = event.target.closest(".live-card");
    if (card && !card.contains(event.relatedTarget)) playCard(card);
  });
  elements.grid.addEventListener("pointerout", (event) => {
    const card = event.target.closest(".live-card");
    if (card && !card.contains(event.relatedTarget)) stopVideo();
  });
  elements.grid.addEventListener("focusin", (event) => {
    const card = event.target.closest(".live-card");
    if (card) playCard(card);
  });
  elements.grid.addEventListener("focusout", stopVideo);
  elements.grid.addEventListener("contextmenu", (event) => {
    const card = event.target.closest(".live-card");
    if (!card) return;
    event.preventDefault();
    contextItemId = card.dataset.itemId;
    elements.contextMenu.hidden = false;
    const menuWidth = 208;
    const menuHeight = 136;
    elements.contextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - menuWidth - 12)}px`;
    elements.contextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - menuHeight - 12)}px`;
  });

  window.addEventListener("beforeunload", () => {
    clearInterval(pollTimer);
    stopVideo();
  });

  loadState().catch(showError);
})();
