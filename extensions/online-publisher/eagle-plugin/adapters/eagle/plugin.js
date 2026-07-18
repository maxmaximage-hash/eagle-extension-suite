const isNodeRuntime = typeof require === 'function';
let fs = { existsSync: () => false };
let path = {
  basename: (value) => String(value || '').split(/[\\/]/).pop() || '',
  join: (...parts) => parts.filter(Boolean).join('/')
};

const PREVIEW_CONFIG_KEY = 'max-publisher-config-v1';
const watermarkSchema = globalThis.GravityWatermarkSchema;
const watermarkPresetsApi = globalThis.GravityWatermarkPresets;
const eagleWatermarkDefaults = globalThis.MaxEagleWatermarkDefaults;

if (!watermarkSchema || !watermarkPresetsApi || !eagleWatermarkDefaults) {
  throw new Error('水印编辑共享模块加载失败');
}

function previewMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      previewMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function previewStoredConfig() {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_CONFIG_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

let loadConfig = () => previewMerge({
  schemaVersion: 1,
  publishTag: '线上展示',
  pollSeconds: 30,
  watermarkPresets: [eagleWatermarkDefaults.COPYRIGHT_PRESET],
  fontClassification: { version: 1, overrides: {}, excluded: [], favorites: [] },
  online: { maxWidth: 1920, jpegQuality: 86, watermark: eagleWatermarkDefaults.copyrightWatermark() },
  localExport: { directory: '', format: 'jpg', maxWidth: 0, compressionMode: 'quality', quality: 100, maxFileSizeMb: '', collisionMode: 'rename', suffix: '-watermarked', watermark: eagleWatermarkDefaults.copyrightWatermark() },
  cloudflare: { projectName: '', pagesRoot: '', publicBaseUrl: '', localPreviewPort: 8788, eagleLibraryRoot: '', wranglerCommand: '' }
}, previewStoredConfig());
let saveConfig = (nextConfig) => {
  if (typeof localStorage === 'undefined') return '';
  localStorage.setItem(PREVIEW_CONFIG_KEY, JSON.stringify(nextConfig));
  return `浏览器本地存储：${PREVIEW_CONFIG_KEY}`;
};
let loadState = () => ({ items: {}, lastSyncAt: null, lastError: null, lastResult: null });
let Publisher = class {
  constructor() {}
  async exportSelected() { throw new Error('请在 Eagle 插件窗口中使用导出功能'); }
  async sync() { throw new Error('请在 Eagle 插件窗口中使用发布功能'); }
};
let resolveItemFilePath = (item) => item && item.filePath ? item.filePath : '';
let childProcess = null;
let http = null;
let renderWatermarkPreviewPayload = null;
let renderWatermarkVectorPreviewPayload = null;
let renderPrivacyEdited = null;
let runtimeLoadError = null;

function pluginModulePath(nativePath, relativePath) {
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
    const htmlPath = decodeURIComponent(window.location.pathname || '');
    return nativePath.join(nativePath.dirname(htmlPath), relativePath);
  }
  return './' + relativePath;
}

if (isNodeRuntime) {
  try {
    fs = require('fs');
    path = require('path');
    http = require('http');
    childProcess = require('child_process');
    ({ loadConfig, saveConfig, loadState } = require(pluginModulePath(path, 'lib/config.js')));
    ({ Publisher, resolveItemFilePath } = require(pluginModulePath(path, 'lib/publisher.js')));
    ({ renderWatermarkPreviewPayload, renderWatermarkVectorPreviewPayload } = require(pluginModulePath(path, 'modules/watermark-editor/renderer.js')));
    ({ renderPrivacyEdited } = require(pluginModulePath(path, 'lib/privacy-exporter.cjs')));
  } catch (error) {
    runtimeLoadError = error;
  }
}

let config = loadConfig();
let publisher;
let pollTimer;
let showcaseServer = null;
let showcaseServerPort = 0;
let activeExportToast = null;
let localQuickExportController = null;
const previewRenderJobs = {
  local: { version: 0, frame: null, settleTimer: null, running: false, pending: null, lastPayload: null, lastSettings: null },
  online: { version: 0, frame: null, settleTimer: null, running: false, pending: null, lastPayload: null, lastSettings: null }
};
const previewState = {
  local: { items: [], index: 0 },
  online: { items: [], index: 0 }
};
const FALLBACK_FONTS = ['PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Helvetica Neue', 'Helvetica', 'Arial', 'Hiragino Sans GB', 'Songti SC', 'Kaiti SC', 'STSong', 'STHeiti', 'STFangsong', 'Times New Roman', 'Georgia'];
const FALLBACK_FONT_CATALOG = FALLBACK_FONTS.map((family) => ({
  family,
  faces: [{ label: '常规体', fullName: family, postscriptName: family, weight: 400, style: 'normal' }]
}));
let availableFontCatalog = FALLBACK_FONT_CATALOG;
let availableFonts = FALLBACK_FONT_CATALOG.map((font) => font.family);
let availableFontGroups = [{ label: '英文字体', fonts: availableFonts }];
let fontCatalogReady = false;
const BUILTIN_WATERMARK = watermarkSchema.emptyWatermark();

const $ = (id) => document.getElementById(id);
const value = (id) => {
  const element = $(id);
  return element ? element.value : '';
};
const numberValue = (id) => Number(value(id));

function notify(message, type = 'info') {
  if (window.eagle && window.eagle.notification) {
    eagle.notification.show({ title: 'MAX Publisher', body: message, mute: type !== 'error' });
    return;
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.classList.add('show'), 10);
  window.setTimeout(() => toast.remove(), 2400);
}

function clearExportResultToast() {
  if (!activeExportToast) return;
  activeExportToast.remove();
  activeExportToast = null;
}

function revealExportedFile(filePath) {
  if (!filePath) return;
  if (window.eagle && eagle.shell && typeof eagle.shell.showItemInFolder === 'function') {
    eagle.shell.showItemInFolder(filePath);
    return;
  }
  if (childProcess && process.platform === 'darwin') {
    childProcess.execFile('open', ['-R', filePath]);
    return;
  }
  notify('请在 Eagle 插件中打开导出文件', 'error');
}

function showExportResultToast(results, failedCount = 0) {
  clearExportResultToast();
  const successful = results.filter((result) => result.ok && result.outputPath);
  if (!successful.length) return;
  const toast = document.createElement('div');
  toast.className = 'export-result-toast';
  toast.innerHTML = `
    <button type="button" class="export-result-close" aria-label="关闭导出结果">×</button>
    <strong>${failedCount ? `导出完成，${failedCount} 张失败` : `已导出 ${successful.length} 张图片`}</strong>
    <small>${escapeHtml(path.basename(successful[0].outputPath))}${successful.length > 1 ? ` 等 ${successful.length} 个文件` : ''}</small>
    <button type="button" class="export-result-reveal">在访达中显示</button>`;
  toast.addEventListener('click', (event) => {
    const revealButton = event.target && event.target.closest
      ? event.target.closest('.export-result-reveal')
      : null;
    if (revealButton) revealExportedFile(successful[0].outputPath);
    clearExportResultToast();
  }, { once: true });
  document.body.append(toast);
  activeExportToast = toast;
  window.setTimeout(() => toast.classList.add('show'), 10);
}

window.addEventListener('error', function(event) {
  const status = $('localPreviewLabel');
  if (status) status.textContent = '插件脚本错误：' + (event.message || '未知错误');
});

function askPresetName(title, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'preset-dialog-backdrop';
    overlay.innerHTML = `
      <div class="preset-dialog" role="dialog" aria-modal="true">
        <h3>${escapeHtml(title)}</h3>
        <input data-dialog-name value="${escapeHtml(defaultValue)}" placeholder="输入预设名称"/>
        <div class="preset-dialog-actions">
          <button type="button" data-dialog-cancel>取消</button>
          <button type="button" class="primary compact" data-dialog-ok>确定</button>
        </div>
      </div>`;
    document.body.append(overlay);
    const input = overlay.querySelector('[data-dialog-name]');
    const close = (value) => {
      overlay.remove();
      resolve(value);
    };
    overlay.querySelector('[data-dialog-cancel]').addEventListener('click', () => close(''));
    overlay.querySelector('[data-dialog-ok]').addEventListener('click', () => close(input.value.trim()));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close('');
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') close(input.value.trim());
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close('');
      }
    });
    input.focus();
    input.select();
  });
}

function setMessage(message, type = '') {
  const target = $('settingsMessage');
  if (!target) return;
  target.textContent = message;
  target.className = `message ${type}`;
}

function closePluginWindow() {
  discardUnsavedWatermarkChanges();
  window.dispatchEvent(new Event('max-privacy-reset'));
  window.close();
}

function updateStatus(status) {
  const labels = {
    idle: '等待同步',
    scanning: '正在检查标签',
    processing: `正在处理 ${status.current || 0}/${status.total || 0}`,
    deploying: '正在发布到 Pages',
    complete: `已上线 ${status.published || 0} 张`,
    error: '同步失败'
  };
  if ($('syncStatus')) $('syncStatus').textContent = labels[status.stage] || status.stage;
  if ($('serviceDot')) $('serviceDot').style.background = status.stage === 'error' ? '#ef4444' : status.stage === 'processing' ? '#f59e0b' : '#22c55e';
  if (status.stage === 'complete') {
    $('publishedCount').textContent = `${status.published || 0} 张`;
    $('lastSync').textContent = `刚刚完成同步`;
  }
  if (status.stage === 'error') {
    $('lastSync').textContent = status.message || '未知错误';
  }
}

function savedWatermarkForSettings(settings) {
  const preset = ensureWatermarkPresets().find((item) => item.id === settings.presetId);
  if (!preset) return { ...clone(BUILTIN_WATERMARK), presetId: '' };
  return { ...clone(preset.watermark), presetId: preset.id };
}

function persistedConfigSnapshot() {
  const persisted = clone(config);
  if (persisted.localExport && config.localExport && config.localExport.watermark) {
    persisted.localExport.watermark = savedWatermarkForSettings(config.localExport.watermark);
  }
  if (persisted.online && config.online && config.online.watermark) {
    persisted.online.watermark = savedWatermarkForSettings(config.online.watermark);
  }
  return persisted;
}

function save() {
  saveConfig(persistedConfigSnapshot());
}

function restoreWatermarkFromSavedPreset(settings) {
  if (!settings) return false;
  const preset = ensureWatermarkPresets().find((item) => item.id === settings.presetId);
  if (preset) {
    applyObject(settings, preset.watermark);
    settings.presetId = preset.id;
  } else {
    applyObject(settings, BUILTIN_WATERMARK);
    settings.presetId = '';
  }
  prepareWatermarkSettings(settings);
  return true;
}

function discardUnsavedWatermarkChanges(options = {}) {
  const rerender = options.rerender === true;
  const scopes = [
    ['localWatermarkForm', config.localExport && config.localExport.watermark],
    ['onlineWatermarkForm', config.online && config.online.watermark]
  ];
  for (const [containerId, settings] of scopes) {
    if (!restoreWatermarkFromSavedPreset(settings)) continue;
    const container = $(containerId);
    if (rerender && container && typeof container._rerenderWatermarkForm === 'function') {
      container._rerenderWatermarkForm();
    }
  }
}

function ensurePublisher() {
  if (!publisher && window.eagle) {
    publisher = new Publisher({ eagleApi: eagle, getConfig: () => runtimePublisherConfig(), onStatus: updateStatus });
  }
  return publisher;
}

function resetExportProgress() {
  localQuickExportController?.reset?.();
}

function syncExportModeUi() {
  config.localExport.compressionMode = config.localExport.compressionMode === 'size' ? 'size' : 'quality';
  localQuickExportController?.sync?.();
}

function syncCollisionModeUi() {
  config.localExport.collisionMode = config.localExport.collisionMode === 'overwrite' ? 'overwrite' : 'rename';
  localQuickExportController?.sync?.();
}

function fileUrl(filePath) {
  if (!filePath) return '';
  if (/^(blob:|data:|https?:|file:)/.test(String(filePath))) return filePath;
  return 'file://' + encodeURI(filePath).replace(/#/g, '%23').replace(/\?/g, '%3F');
}

function loadPreviewNaturalDimensions(item, scope = 'local') {
  if (!item || !item.filePath || previewItemDimensions(item) || item._previewDimensionLoading) return;
  item._previewDimensionLoading = true;
  const image = new Image();
  image.onload = () => {
    item._previewNaturalWidth = image.naturalWidth;
    item._previewNaturalHeight = image.naturalHeight;
    item._previewDimensionLoading = false;
    updatePreviewImage(scope);
  };
  image.onerror = () => {
    item._previewDimensionLoading = false;
  };
  image.src = fileUrl(item.filePath);
}

function syncPreviewFrame(preview, item) {
  if (!preview) return;
  const stage = preview.querySelector('.preview-stage');
  const dimensions = previewItemDimensions(item);
  if (!dimensions) {
    for (const property of ['aspect-ratio', 'width', 'height', 'max-width', 'margin-inline', 'min-height', 'overflow-x', 'overflow-y']) {
      preview.style.removeProperty(property);
    }
    if (stage) {
      stage.style.removeProperty('width');
      stage.style.removeProperty('height');
    }
    return;
  }
  const ratio = dimensions.width / dimensions.height;
  const heightCap = preview.id === 'onlinePreview' ? 680 : 660;
  const maxPreviewHeight = Math.min(heightCap, Math.max(420, Math.round(window.innerHeight * 0.72)));
  const parent = preview.parentElement;
  const parentStyle = parent ? window.getComputedStyle(parent) : null;
  const parentContentWidth = parent
    ? parent.clientWidth
      - parseFloat(parentStyle.paddingLeft || 0)
      - parseFloat(parentStyle.paddingRight || 0)
    : 0;
  const availableWidth = Math.max(280, Math.round(parentContentWidth || preview.clientWidth || 560));
  const isExtraTall = ratio < 0.55;
  const isExtraWide = ratio > 2.4;
  let stageWidth;
  let stageHeight;
  let viewportWidth;
  let viewportHeight;

  if (isExtraTall) {
    stageWidth = availableWidth;
    stageHeight = Math.round(stageWidth / ratio);
    viewportWidth = stageWidth;
    viewportHeight = Math.min(maxPreviewHeight, stageHeight);
  } else if (isExtraWide) {
    stageHeight = Math.min(420, Math.max(260, Math.round(availableWidth / 1.6)));
    stageWidth = Math.round(stageHeight * ratio);
    viewportWidth = Math.min(availableWidth, stageWidth);
    viewportHeight = stageHeight;
  } else {
    viewportWidth = Math.min(availableWidth, Math.round(maxPreviewHeight * ratio));
    viewportHeight = Math.round(viewportWidth / ratio);
    stageWidth = viewportWidth;
    stageHeight = viewportHeight;
  }

  preview.style.removeProperty('aspect-ratio');
  preview.style.width = `${viewportWidth}px`;
  preview.style.height = `${viewportHeight}px`;
  preview.style.maxWidth = '100%';
  preview.style.marginInline = 'auto';
  preview.style.setProperty('min-height', '0', 'important');
  preview.style.overflowX = isExtraWide ? 'auto' : 'hidden';
  preview.style.overflowY = isExtraTall ? 'auto' : 'hidden';
  if (stage) {
    stage.style.width = `${stageWidth}px`;
    stage.style.height = `${stageHeight}px`;
  }
  preview.scrollLeft = 0;
  preview.scrollTop = 0;
}

function updatePreviewImage(scope = 'local') {
  const state = scopedPreviewState(scope);
  const item = state.items[state.index];
  const preview = previewElementForScope(scope);
  syncPreviewFrame(preview, item);
  const photo = preview && preview.querySelector('.preview-photo');
  if (photo) {
    if (item && item.filePath) {
      photo.style.backgroundImage = 'url("' + fileUrl(item.filePath) + '")';
      photo.style.filter = 'none';
    } else {
      photo.style.backgroundImage = '';
    }
  }
  loadPreviewNaturalDimensions(item, scope);
  GravityWatermarkEditor.updatePreview(scope === 'online' ? 'onlinePreview' : 'localPreview', watermarkSettingsForScope(scope));
  const total = state.items.length;
  const label = total ? '预览 ' + Math.min(state.index + 1, total) + '/' + total : '预览 0/0';
  const labelNode = previewLabelForScope(scope);
  if (labelNode) labelNode.textContent = label;
}

function movePreview(scope, step) {
  const state = scopedPreviewState(scope);
  if (!state.items.length) {
    updatePreviewImage(scope);
    return;
  }
  state.index = (state.index + step + state.items.length) % state.items.length;
  updatePreviewImage(scope);
}

async function refreshSelection() {
  try {
    if (!window.eagle) throw new Error('browser-preview');
    const items = await eagle.item.getSelected();
    previewState.local.items = items || [];
    previewState.local.index = 0;
    updatePreviewImage('local');
    resetExportProgress();
    localQuickExportController?.setItemCount?.(items.length);
    return items;
  } catch (error) {
    previewState.local.items = [];
    previewState.local.index = 0;
    updatePreviewImage('local');
    resetExportProgress();
    if ($('localPreviewLabel')) $('localPreviewLabel').textContent = '无法读取选中图片';
    localQuickExportController?.setItemCount?.(0);
    return [];
  }
}

async function refreshOnlineItems() {
  try {
    if (!window.eagle) throw new Error('browser-preview');
    const items = await eagle.item.get({ tags: [config.publishTag] });
    previewState.online.items = items || [];
    previewState.online.index = 0;
    updatePreviewImage('online');
    if ($('taggedCount')) $('taggedCount').textContent = items.length + ' 张';
    return items;
  } catch (error) {
    previewState.online.items = [];
    previewState.online.index = 0;
    updatePreviewImage('online');
    if ($('taggedCount')) $('taggedCount').textContent = '读取失败';
    return [];
  }
}

async function chooseExportDirectory() {
  if (!window.eagle) {
    notify('请在 Eagle 插件窗口中选择导出目录', 'error');
    return '';
  }
  const result = await eagle.dialog.showOpenDialog({ title: '选择导出文件夹', properties: ['openDirectory', 'createDirectory'] });
  if (!result.canceled && result.filePaths[0]) {
    config.localExport.directory = result.filePaths[0];
    localQuickExportController?.setDirectory?.(config.localExport.directory);
    save();
  }
  return config.localExport.directory;
}

async function exportLocalItems({ state, onProgress }) {
  ensurePublisher();
  let selected = previewState.local.items.slice();
  if (!selected.length) selected = await refreshSelection();
  if (!selected.length) throw new Error('请先在 Eagle 中选择需要导出的图片');
  return publisher.exportSelected(state.directory, {
    ...config.localExport,
    ...state,
    watermark: runtimeWatermarkSettings(config.localExport.watermark),
    items: selected,
    eagleLibraryRoot: config.cloudflare.eagleLibraryRoot
  }, onProgress);
}

function privacyWatermarkPreset(presetId) {
  if (!presetId) return { enabled: false };
  const preset = ensureWatermarkPresets().find((item) => item.id === presetId);
  return preset ? runtimeWatermarkSettings(preset.watermark) : { enabled: false };
}

async function privacySelection() {
  if (!window.eagle) {
    try {
      const response = await fetch('/api/preview-selection', { cache: 'no-store' });
      if (response.ok) return response.json();
    } catch (error) {
      return [];
    }
    return [];
  }
  const selected = await eagle.item.getSelected();
  return (selected || []).map((item) => {
    const filePath = resolveItemFilePath(item, {
      cloudflare: { eagleLibraryRoot: config.cloudflare.eagleLibraryRoot }
    });
    return {
      id: item.id,
      name: item.name || path.basename(filePath || '') || '图片',
      ext: item.ext || path.extname(filePath || '').replace(/^\./, ''),
      filePath,
      url: fileUrl(filePath),
      width: Number(item.width || 0),
      height: Number(item.height || 0)
    };
  }).filter((item) => item.filePath && /\.(jpe?g|png|webp|tiff?|gif)$/i.test(item.filePath));
}

globalThis.MaxPrivacyHost = Object.freeze({
  version: '1.2.0',
  loadSelection: privacySelection,
  getWatermarkPresets: () => ensureWatermarkPresets().map((preset) => clone(preset)),
  getExportState: () => config.localExport,
  saveExportState: save,
  chooseDirectory: chooseExportDirectory,
  notify,
  showResult: showExportResultToast,
  clearResult: clearExportResultToast,
  async renderWatermarkPreview(settings, width, height) {
    if (!renderWatermarkPreviewPayload) return null;
    return renderWatermarkPreviewPayload(runtimeWatermarkSettings(settings), width, height);
  },
  async exportPrivacy({ item, privacyLayer, annotations, watermarkPresetId, exportState, onProgress }) {
    ensurePublisher();
    if (!publisher || !renderPrivacyEdited) throw new Error('隐私导出模块尚未加载');
    return publisher.exportItems(
      exportState.directory,
      [item],
      {
        ...config.localExport,
        ...exportState,
        suffix: '-打码',
        eagleLibraryRoot: config.cloudflare.eagleLibraryRoot,
        privacyLayer,
        annotations,
        watermark: privacyWatermarkPreset(watermarkPresetId)
      },
      renderPrivacyEdited,
      onProgress
    );
  },
  openWatermarkEditor() {
    const button = document.querySelector('.nav[data-view="export"]');
    if (button) button.click();
    window.setTimeout(() => $('localWatermarkForm')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 60);
  }
});

async function syncNow(force = false) {
  try {
    ensurePublisher();
    await publisher.sync({ force });
    await refreshOnlineItems();
  } catch (error) {
    updateStatus({ stage: 'error', message: error.message });
    notify(error.message, 'error');
  }
}

const SHOWCASE_CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function normalizedShowcasePort() {
  if (!config.cloudflare) config.cloudflare = {};
  const raw = Number(config.cloudflare.localPreviewPort || 8788);
  const port = Math.round(clampNumber(Number.isFinite(raw) ? raw : 8788, 1024, 65535));
  config.cloudflare.localPreviewPort = port;
  return port;
}

function localShowcaseUrl(port = normalizedShowcasePort()) {
  return `http://127.0.0.1:${port}/`;
}

function normalizedOnlineShowcaseUrl() {
  const raw = String((config.cloudflare && config.cloudflare.publicBaseUrl) || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function syncOnlineShowcaseUrl() {
  const url = normalizedOnlineShowcaseUrl();
  const target = $('onlineShowcaseUrl');
  if (!target) return;
  target.textContent = url ? url.replace(/^https?:\/\//i, '') : '请先设置 Pages 地址';
}

function openOnlineShowcasePage() {
  const url = normalizedOnlineShowcaseUrl();
  if (!url) {
    notify('请先在系统设置里填写 Pages 地址', 'error');
    return;
  }
  openExternalUrl(url);
  notify(`已打开线上作品页：${url}`);
}

function inferredPagesRoot() {
  const configured = config.cloudflare && String(config.cloudflare.pagesRoot || '').trim();
  if (configured) return configured;
  const projectDefault = '/Users/max/引力环球/Eagle线上发布数据';
  if (fs.existsSync && fs.existsSync(projectDefault)) return projectDefault;
  if (!window.location || window.location.protocol !== 'file:' || !path.dirname) return '';
  const htmlPath = decodeURIComponent(window.location.pathname || '');
  const projectRoot = path.dirname(path.dirname(htmlPath));
  return path.join(projectRoot, 'cloudflare-pages');
}

function showcasePublicRoot() {
  const pagesRoot = inferredPagesRoot();
  return pagesRoot ? path.join(pagesRoot, 'public') : '';
}

function setShowcaseStatus(text) {
  const target = $('showcaseUrl');
  if (target) target.textContent = text;
}

function syncShowcasePortInputs() {
  const port = normalizedShowcasePort();
  if ($('showcasePort')) $('showcasePort').value = port;
  if ($('localPreviewPort')) $('localPreviewPort').value = port;
  setShowcaseStatus(`127.0.0.1:${port}`);
}

function openExternalUrl(url) {
  if (window.eagle && eagle.shell && typeof eagle.shell.openExternal === 'function') {
    return eagle.shell.openExternal(url);
  }
  if (childProcess && childProcess.execFile) {
    if (typeof process !== 'undefined' && process.platform === 'darwin') return childProcess.execFile('open', [url], () => {});
    if (typeof process !== 'undefined' && process.platform === 'win32') return childProcess.execFile('cmd', ['/c', 'start', '', url], () => {});
    return childProcess.execFile('xdg-open', [url], () => {});
  }
  const opened = window.open(url, '_blank');
  if (!opened) window.location.href = url;
  return opened;
}

function statIfExists(file) {
  try {
    return fs.statSync(file);
  } catch (error) {
    return null;
  }
}

function staticFileForRequest(publicRoot, requestUrl) {
  const parsed = new URL(requestUrl, localShowcaseUrl());
  const pathname = decodeURIComponent(parsed.pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let file = path.resolve(publicRoot, relative);
  const rootWithSep = publicRoot.endsWith(path.sep) ? publicRoot : `${publicRoot}${path.sep}`;
  if (file !== publicRoot && !file.startsWith(rootWithSep)) return null;
  const stat = statIfExists(file);
  if (stat && stat.isDirectory()) {
    file = path.join(file, 'index.html');
  }
  return file;
}

function startShowcaseServer(port = normalizedShowcasePort()) {
  return new Promise((resolve, reject) => {
    if (showcaseServer && showcaseServerPort === port) {
      resolve(localShowcaseUrl(port));
      return;
    }
    if (!http || !fs.createReadStream || !path.resolve) {
      reject(new Error('请在 Eagle 插件窗口中打开本地作品页'));
      return;
    }
    const publicRoot = showcasePublicRoot();
    if (!publicRoot || !fs.existsSync(publicRoot)) {
      reject(new Error('作品页目录不存在，请先设置 Pages 本地目录'));
      return;
    }
    if (!fs.existsSync(path.join(publicRoot, 'index.html'))) {
      reject(new Error('作品页目录里缺少 public/index.html'));
      return;
    }
    const previousServer = showcaseServer;
    const server = http.createServer((request, response) => {
      let file;
      try {
        file = staticFileForRequest(publicRoot, request.url);
      } catch (error) {
        response.writeHead(400).end('Bad request');
        return;
      }
      if (!file) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const stat = statIfExists(file);
      if (!stat || !stat.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': SHOWCASE_CONTENT_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      fs.createReadStream(file).pipe(response);
    });
    server.once('error', (error) => reject(error));
    server.listen(port, '127.0.0.1', () => {
      if (previousServer && previousServer !== server) previousServer.close();
      showcaseServer = server;
      showcaseServerPort = port;
      resolve(localShowcaseUrl(port));
    });
  });
}

async function openShowcasePage() {
  const button = $('openShowcasePage');
  if (button) {
    button.disabled = true;
    button.textContent = '正在打开…';
  }
  try {
    const url = await startShowcaseServer(normalizedShowcasePort());
    setShowcaseStatus(url.replace(/^https?:\/\//, ''));
    openExternalUrl(url);
    notify(`已打开本地作品页：${url}`);
  } catch (error) {
    notify(error.message, 'error');
    setShowcaseStatus(error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '打开作品页';
    }
  }
}

function fillSettings() {
  if (!config.cloudflare.pagesRoot) config.cloudflare.pagesRoot = inferredPagesRoot();
  syncExportModeUi();
  syncCollisionModeUi();
  $('publishTagLabel').textContent = config.publishTag;
  for (const key of ['projectName', 'pagesRoot', 'publicBaseUrl', 'eagleLibraryRoot', 'wranglerCommand']) {
    $(key).value = config.cloudflare[key] || '';
  }
  syncShowcasePortInputs();
  syncOnlineShowcaseUrl();
  const state = loadState();
  $('publishedCount').textContent = `${state.lastResult && state.lastResult.published ? state.lastResult.published : 0} 张`;
  $('lastSync').textContent = state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : '尚未同步';
  $('syncStatus').textContent = state.lastError ? state.lastError : state.lastResult ? '正常' : '等待配置';
}

function bindUi() {
  ensurePublisher();
  const on = (id, event, handler) => {
    const element = $(id);
    if (element) element.addEventListener(event, handler);
  };
  GravityWatermarkEditor.mount('localWatermarkForm', config.localExport.watermark, 'localPreview');
  GravityWatermarkEditor.mount('onlineWatermarkForm', config.online.watermark, 'onlinePreview');
  localQuickExportController = GravityQuickExport.mount('localQuickExport', {
    state: config.localExport,
    chooseDirectory: chooseExportDirectory,
    onStateChange: save,
    notify,
    onResult: showExportResultToast,
    onReset: clearExportResultToast,
    exportItems: exportLocalItems
  });
  const activateView = (button) => {
    const previous = document.querySelector('.nav.active')?.dataset.view || '';
    document.querySelectorAll('.nav,.view').forEach((node) => node.classList.remove('active'));
    button.classList.add('active');
    const view = $('view-' + button.dataset.view);
    if (view) view.classList.add('active');
    if (previous === 'privacy' && button.dataset.view !== 'privacy') {
      window.dispatchEvent(new Event('max-privacy-reset'));
    }
    if (button.dataset.view === 'export') refreshSelection();
    if (button.dataset.view === 'privacy') window.dispatchEvent(new Event('max-privacy-refresh-selection'));
    if (button.dataset.view === 'online') refreshOnlineItems();
    if (button.dataset.view === 'fonts') GravityFontManager.render();
  };
  document.querySelectorAll('.nav').forEach((button) => button.addEventListener('click', () => activateView(button)));
  on('fontManagerSearch', 'input', GravityFontManager.render);
  on('fontManagerFilter', 'change', GravityFontManager.render);
  const fontManagerGroups = $('fontManagerGroups');
  if (fontManagerGroups) {
    fontManagerGroups.addEventListener('change', (event) => {
      const faceSelect = event.target.closest('[data-font-manager-face]');
      if (faceSelect) {
        const family = faceSelect.dataset.fontManagerFace;
        const entry = availableFontCatalog.find((font) => font.family === family);
        const face = entry && entry.faces[Number(faceSelect.value)];
        const previewName = faceSelect.closest('.font-manager-row')?.querySelector('.font-manager-font strong');
        if (face && previewName) {
          previewName.style.fontFamily = fontCssStack({ fontFamily: family }, face, entry);
          previewName.style.fontWeight = String(face.weight || 400);
          previewName.style.fontStyle = face.style || 'normal';
        }
        return;
      }
      const select = event.target.closest('[data-font-manager-group]');
      if (!select) return;
      const family = select.dataset.fontManagerGroup;
      const preferences = fontClassificationPreferences();
      const entry = availableFontCatalog.find((font) => font.family === family);
      const baseGroup = entry ? classifyFontWith(baseFontClassification(), entry) : '';
      if (select.value === baseGroup) delete preferences.overrides[family];
      else preferences.overrides[family] = select.value;
      preferences.excluded = preferences.excluded.filter((font) => font !== family);
      persistFontManagerChange(`已保存字体分类：${displayFontName(family)}`);
    });
    fontManagerGroups.addEventListener('click', (event) => {
      const action = event.target.closest('[data-font-manager-action]');
      if (!action) return;
      const family = action.dataset.fontFamily;
      const preferences = fontClassificationPreferences();
      if (action.dataset.fontManagerAction === 'hide') {
        preferences.excluded = [...new Set([...preferences.excluded, family])];
        persistFontManagerChange(`已隐藏字体：${displayFontName(family)}`);
      } else if (action.dataset.fontManagerAction === 'unhide') {
        preferences.excluded = preferences.excluded.filter((font) => font !== family);
        persistFontManagerChange(`已恢复字体：${displayFontName(family)}`);
      }
    });
  }
  on('closePlugin', 'click', closePluginWindow);
  on('prevLocalPreview', 'click', () => movePreview('local', -1));
  on('nextLocalPreview', 'click', () => movePreview('local', 1));
  on('refreshOnlineItems', 'click', refreshOnlineItems);
  on('prevOnlinePreview', 'click', () => movePreview('online', -1));
  on('nextOnlinePreview', 'click', () => movePreview('online', 1));
  on('syncNow', 'click', () => syncNow(false));
  on('forceSync', 'click', async () => {
    const result = await eagle.dialog.showMessageBox({ type: 'warning', title: '重新生成全部图片', message: '确定使用当前线上水印重新生成全部已发布图片吗？', buttons: ['确定', '取消'] });
    if (result.response === 0) syncNow(true);
  });
  const updateShowcasePort = (sourceId) => {
    const next = Math.round(clampNumber(value(sourceId) || 8788, 1024, 65535));
    config.cloudflare.localPreviewPort = next;
    syncShowcasePortInputs();
    save();
  };
  on('showcasePort', 'input', () => {
    if ($('showcasePort').value) {
      config.cloudflare.localPreviewPort = Math.round(clampNumber(value('showcasePort'), 1024, 65535));
      if ($('localPreviewPort')) $('localPreviewPort').value = config.cloudflare.localPreviewPort;
      setShowcaseStatus(`127.0.0.1:${config.cloudflare.localPreviewPort}`);
    }
  });
  on('showcasePort', 'change', () => updateShowcasePort('showcasePort'));
  on('localPreviewPort', 'change', () => updateShowcasePort('localPreviewPort'));
  on('openShowcasePage', 'click', openShowcasePage);
  on('openOnlineShowcasePage', 'click', openOnlineShowcasePage);
  on('saveSettings', 'click', () => {
    for (const key of ['projectName', 'pagesRoot', 'publicBaseUrl', 'eagleLibraryRoot', 'wranglerCommand']) config.cloudflare[key] = value(key).trim();
    config.cloudflare.localPreviewPort = Math.round(clampNumber(value('localPreviewPort') || value('showcasePort') || 8788, 1024, 65535));
    syncShowcasePortInputs();
    syncOnlineShowcaseUrl();
    save();
    setMessage('设置已保存到本机', 'success');
  });
  on('testCloudflare', 'click', async () => {
    if ($('saveSettings')) $('saveSettings').click();
    setMessage('正在测试 Pages 发布配置…');
    try {
      if (!config.cloudflare.projectName) throw new Error('缺少 Pages 项目名');
      if (!config.cloudflare.pagesRoot || !fs.existsSync(config.cloudflare.pagesRoot)) throw new Error('Pages 项目目录不存在');
      if (!fs.existsSync(path.join(config.cloudflare.pagesRoot, 'public'))) throw new Error('项目目录里缺少 public 文件夹');
      if (!config.cloudflare.eagleLibraryRoot || !fs.existsSync(config.cloudflare.eagleLibraryRoot)) throw new Error('Eagle 资料库目录不存在');
      setMessage('Pages 配置正常', 'success');
    } catch (error) {
      setMessage(error.message, 'error');
    }
  });
  GravityFontManager.refresh();
  fillSettings();
  if ($('serviceLabel')) $('serviceLabel').textContent = runtimeLoadError ? '脚本已启动，后台模块异常' : '脚本已启动';
  if (runtimeLoadError) {
    if ($('lastSync')) $('lastSync').textContent = runtimeLoadError.message || '模块加载失败';
    if ($('localPreviewLabel')) $('localPreviewLabel').textContent = '后台模块异常';
  }
  refreshSelection();
  refreshOnlineItems();
}

function startPolling() {
  clearInterval(pollTimer);
  const interval = Math.max(10, Number(config.pollSeconds || 30)) * 1000;
  pollTimer = setInterval(() => {
    if (config.cloudflare.projectName && config.cloudflare.pagesRoot) syncNow(false);
  }, interval);
}

window.addEventListener('DOMContentLoaded', bindUi);
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
  event.preventDefault();
  closePluginWindow();
});

if (window.eagle) {
  eagle.onPluginCreate(() => {
    ensurePublisher();
    startPolling();
  });
  eagle.onPluginRun(async () => {
    discardUnsavedWatermarkChanges({ rerender: true });
    await eagle.window.show();
    refreshSelection();
  });
  eagle.onLibraryChanged(() => syncNow(false));
  eagle.onPluginBeforeExit(() => {
    clearInterval(pollTimer);
    if (showcaseServer) showcaseServer.close();
  });
}
