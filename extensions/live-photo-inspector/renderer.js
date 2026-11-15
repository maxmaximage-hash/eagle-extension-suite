"use strict";

(function initInspector() {
  const root = document.getElementById("app");
  const nodeRequire = typeof require === "function"
    ? require
    : (typeof window !== "undefined" && typeof window.require === "function" ? window.require : null);
  const fs = nodeRequire ? nodeRequire("node:fs") : null;
  const os = nodeRequire ? nodeRequire("node:os") : null;
  const path = nodeRequire ? nodeRequire("node:path") : null;
  const childProcess = nodeRequire ? nodeRequire("node:child_process") : null;
  const pluginRoot = path ? path.dirname(decodeURIComponent(window.location.pathname)) : null;
  const metadataReader = nodeRequire && pluginRoot
    ? nodeRequire(path.join(pluginRoot, "photo-metadata.js"))
    : null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;",
    }[character]));
  }

  function formatNumber(value, digits = 6) {
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits).replace(/\.?0+$/, "") : String(value);
  }

  function formatCoordinate(latitude, longitude) {
    if (latitude === null || longitude === null || latitude === undefined || longitude === undefined) return "—";
    return `${formatNumber(latitude)}, ${formatNumber(longitude)}`;
  }

  function run(command, args) {
    if (!childProcess) throw new Error("Eagle inspector Node runtime is unavailable");
    return childProcess.execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  }

  function imageEntry(packagePath) {
    const entries = run("unzip", ["-Z1", packagePath]).split(/\r?\n/).filter(Boolean);
    return entries.find((entry) => /\.(heic|jpe?g)$/i.test(entry)) || null;
  }

  function ledgerImagePath(itemId) {
    if (!fs || !os || !path || !itemId) return null;
    const ledgerPath = path.join(os.homedir(), "Library", "Application Support", "Eagle", "LivePhotoManager", "ledger.json");
    try {
      const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
      const group = Object.values(ledger.groups || {}).find((entry) => String(entry.nativeItemId || "") === String(itemId));
      return group?.imagePath && fs.existsSync(group.imagePath) ? group.imagePath : null;
    } catch { return null; }
  }

  function extractImage(packagePath, itemId) {
    if (!fs || !os || !path) throw new Error("Eagle inspector Node runtime is unavailable");
    const original = ledgerImagePath(itemId);
    if (original) return { imagePath: original, imageEntry: path.basename(original), original: true };
    const entry = imageEntry(packagePath);
    if (!entry) throw new Error("LIVP 中没有静态照片封面");
    const rootPath = path.join(os.homedir(), "Library", "Application Support", "Eagle", "LivePhotoInspector", "Cache", String(itemId || "unknown"));
    fs.mkdirSync(rootPath, { recursive: true });
    const destination = path.join(rootPath, path.basename(entry));
    const bytes = childProcess.execFileSync("unzip", ["-p", packagePath, entry], { maxBuffer: 128 * 1024 * 1024 });
    fs.writeFileSync(destination, bytes);
    return { imagePath: destination, imageEntry: entry, original: false };
  }

  function uniqueExportPath(directory, fileName) {
    const extension = path.extname(fileName);
    const stem = path.basename(fileName, extension);
    let candidate = path.join(directory, fileName);
    let index = 2;
    while (fs.existsSync(candidate)) {
      candidate = path.join(directory, `${stem} (${index})${extension}`);
      index += 1;
    }
    return candidate;
  }

  function exportStaticPhoto(imagePath) {
    if (!fs || !os || !path || !childProcess) throw new Error("静态照片导出能力不可用");
    const directory = path.join(os.homedir(), "Downloads", "MAX Live Photo Exports");
    fs.mkdirSync(directory, { recursive: true });
    const destination = uniqueExportPath(directory, path.basename(imagePath));
    // 避免覆盖用户已有文件，并在完成后定位新文件。
    fs.copyFileSync(imagePath, destination);
    const opener = childProcess.spawn("open", ["-R", destination], { detached: true, stdio: "ignore" });
    opener.unref?.();
    return destination;
  }

  function fallbackMetadata(item) {
    return {
      sourceType: "static-photo",
      sourcePath: item?.filePath || null,
      format: String(item?.ext || "").toUpperCase() || "—",
      ext: String(item?.ext || "").toUpperCase() || "—",
      width: Number(item?.width) || null,
      height: Number(item?.height) || null,
      fileSize: Number(item?.size) || null,
      takenAt: item?.takenAt || item?.metadata?.DateTimeOriginal || null,
      exif: item?.metadata?.exif || {},
      gps: item?.metadata?.gps || {},
    };
  }

  function render(item, metadata, source) {
    const exif = metadata.exif || {};
    const gps = metadata.gps || {};
    const rows = [
      ["原生格式", metadata.format || metadata.ext || "—"],
      ["尺寸", metadata.width && metadata.height ? `${metadata.width} × ${metadata.height}` : "—"],
      ["文件大小", metadata.fileSize ? `${(Number(metadata.fileSize) / 1024 / 1024).toFixed(2)} MB` : "—"],
      ["拍摄时间", metadata.takenAt || exif.dateTimeOriginal || "—"],
      ["拍摄地点", formatCoordinate(gps.latitude, gps.longitude)],
      ["海拔", gps.altitude === null || gps.altitude === undefined ? "—" : `${formatNumber(gps.altitude, 2)} m`],
      ["相机", [exif.make, exif.model].filter(Boolean).join(" ") || "—"],
      ["镜头", exif.focalLength ? `${formatNumber(exif.focalLength, 2)} mm` : "—"],
      ["光圈", exif.aperture ? `ƒ/${formatNumber(exif.aperture, 2)}` : "—"],
      ["快门", exif.exposureTime ? `${formatNumber(exif.exposureTime, 4)} s` : "—"],
      ["ISO", exif.iso || "—"],
      ["色彩配置", exif.profile || "—"],
    ];
    const rawMetadata = Object.entries(metadata.rawMetadata || {})
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([field, value]) => [`EXIF ${field}`, value]);
    rows.push(...rawMetadata);
    root.innerHTML = `<div class="title"><strong>静态照片原始信息</strong><small>${escapeHtml(item?.name || "LIVP")}</small></div>`
      + `<p class="hint">LIVP 仅作为内部封装；以下字段来自封面照片本身。点击导出按钮即可得到静态 HEIC/JPG。网格卡片直接拖出仍按 Eagle 原生方式处理。</p>`
      + `<button class="drag-button" id="exportStaticPhoto" type="button">导出静态照片到下载</button>`
      + `<button class="drag-button secondary" id="dragStaticPhoto" type="button">从此处拖出静态照片</button>`
      + `<p class="hint">需要拖动时，点击按钮后立即移动鼠标到 Finder、Photoshop 或桌面并松开。</p>`
      + `<div class="grid">${rows.map(([label, value]) => `<div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div>`).join("")}</div>`
      + `<p class="hint">${source.original ? "已读取配对台账中的原始静态照片。" : "已从 LIVP 外部暂存区读取封面；未写入 Eagle Library。"}</p>`;
    const exportButton = document.getElementById("exportStaticPhoto");
    exportButton?.addEventListener("click", () => {
      exportButton.disabled = true;
      try {
        const destination = exportStaticPhoto(source.imagePath);
        exportButton.textContent = "已导出到下载";
        exportButton.title = destination;
      } catch (error) {
        exportButton.disabled = false;
        exportButton.textContent = `导出失败：${error?.message || error}`;
      }
    });
    const dragButton = document.getElementById("dragStaticPhoto");
    dragButton?.addEventListener("click", async () => {
      dragButton.disabled = true;
      try {
        if (!eagle.drag?.startDrag) throw new Error("Eagle 拖出 API 不可用");
        await eagle.drag.startDrag([source.imagePath]);
        dragButton.textContent = "已开始拖出静态照片";
      } catch (error) {
        dragButton.disabled = false;
        dragButton.textContent = `拖出失败：${error?.message || error}`;
      }
    });
  }

  async function load() {
    try {
      const selected = await eagle.item.getSelected();
      const item = (selected || [])[0];
      if (!item || String(item.ext || "").toLowerCase() !== "livp") {
        root.innerHTML = `<div class="empty">请选择一张 LIVP 卡片。</div>`;
        return;
      }
      const source = extractImage(item.filePath, item.id);
      const metadata = metadataReader
        ? metadataReader.readStaticPhotoMetadata(source.imagePath)
        : fallbackMetadata(item);
      render(item, metadata, source);
    } catch (error) {
      root.innerHTML = `<div class="error">读取静态照片信息失败：${escapeHtml(error?.message || error)}</div>`;
    }
  }

  if (typeof eagle === "undefined") {
    root.innerHTML = `<div class="error">Eagle Inspector API 不可用。</div>`;
    return;
  }
  eagle.onPluginCreate(load);
  eagle.onThemeChanged((theme) => document.body.setAttribute("data-theme", theme));
})();
