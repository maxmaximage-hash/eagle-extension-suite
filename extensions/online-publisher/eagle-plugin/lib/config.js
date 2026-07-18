const fs = require('fs');
const os = require('os');
const path = require('path');
const { DEFAULT_WATERMARK, normalizeWatermark } = require('../modules/watermark-editor/schema.js');
const { normalizePresets } = require('../modules/watermark-editor/presets.js');
const {
  COPYRIGHT_PRESET,
  COPYRIGHT_PRESET_ID,
  copyrightWatermark
} = require('../adapters/eagle/defaults.js');

const CONFIG_SCHEMA_VERSION = 1;

const DEFAULT_CONFIG = Object.freeze({
  schemaVersion: CONFIG_SCHEMA_VERSION,
  publishTag: '线上展示',
  pollSeconds: 30,
  watermarkPresets: [COPYRIGHT_PRESET],
  fontClassification: {
    version: 1,
    overrides: {},
    excluded: [],
    favorites: []
  },
  online: {
    maxWidth: 1920,
    jpegQuality: 86,
    watermark: copyrightWatermark()
  },
  localExport: {
    directory: '',
    format: 'jpg',
    maxWidth: 0,
    compressionMode: 'quality',
    quality: 100,
    maxFileSizeMb: '',
    collisionMode: 'rename',
    suffix: '-watermarked',
    watermark: copyrightWatermark()
  },
  cloudflare: {
    projectName: '',
    pagesRoot: '',
    publicBaseUrl: '',
    localPreviewPort: 8788,
    wranglerCommand: '',
    eagleLibraryRoot: ''
  }
});

function dataDirectory() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Eagle', 'MAX Publisher');
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || os.homedir(), 'Eagle', 'MAX Publisher');
  }
  return path.join(os.homedir(), '.config', 'eagle', 'max-publisher');
}

function number(value, fallback, min = -Infinity, max = Infinity) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : fallback;
}

function string(value, fallback = '') {
  return value == null ? fallback : String(value);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
}

function normalizeClassification(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: 1,
    overrides: source.overrides && typeof source.overrides === 'object' && !Array.isArray(source.overrides)
      ? { ...source.overrides }
      : {},
    excluded: Array.isArray(source.excluded) ? [...new Set(source.excluded.map(String))] : [],
    favorites: Array.isArray(source.favorites)
      ? [...new Set(source.favorites
        .filter((value) => value !== null && value !== undefined)
        .map((value) => String(value).trim())
        .filter(Boolean))]
      : []
  };
}

function normalizeConfig(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const local = source.localExport && typeof source.localExport === 'object' ? source.localExport : {};
  const online = source.online && typeof source.online === 'object' ? source.online : {};
  const cloudflare = source.cloudflare && typeof source.cloudflare === 'object' ? source.cloudflare : {};
  const presets = normalizePresets(source.watermarkPresets);
  const normalizedPresets = presets.length ? presets : [COPYRIGHT_PRESET];
  const presetIds = new Set(normalizedPresets.map((preset) => preset.id));
  const normalizeScopedWatermark = (watermark) => {
    const normalized = normalizeWatermark(watermark, { includePresetId: true });
    const presetId = presetIds.has(normalized.presetId) ? normalized.presetId : COPYRIGHT_PRESET_ID;
    const preset = normalizedPresets.find((item) => item.id === presetId) || normalizedPresets[0];
    return { ...normalizeWatermark(preset.watermark), presetId: preset.id };
  };

  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    publishTag: string(source.publishTag, DEFAULT_CONFIG.publishTag) || DEFAULT_CONFIG.publishTag,
    pollSeconds: number(source.pollSeconds, DEFAULT_CONFIG.pollSeconds, 10, 3600),
    watermarkPresets: normalizedPresets,
    fontClassification: normalizeClassification(source.fontClassification),
    online: {
      maxWidth: number(online.maxWidth, DEFAULT_CONFIG.online.maxWidth, 320, 16000),
      jpegQuality: number(online.jpegQuality, DEFAULT_CONFIG.online.jpegQuality, 1, 100),
      watermark: normalizeScopedWatermark(online.watermark)
    },
    localExport: {
      directory: string(local.directory),
      format: ['jpg', 'png', 'webp'].includes(local.format) ? local.format : DEFAULT_CONFIG.localExport.format,
      maxWidth: number(local.maxWidth, DEFAULT_CONFIG.localExport.maxWidth, 0, 16000),
      compressionMode: local.compressionMode === 'size' ? 'size' : 'quality',
      quality: number(local.quality, DEFAULT_CONFIG.localExport.quality, 1, 100),
      maxFileSizeMb: number(local.maxFileSizeMb, 0, 0, 1000) || '',
      collisionMode: local.collisionMode === 'overwrite' ? 'overwrite' : 'rename',
      suffix: string(local.suffix, DEFAULT_CONFIG.localExport.suffix) || DEFAULT_CONFIG.localExport.suffix,
      watermark: normalizeScopedWatermark(local.watermark)
    },
    cloudflare: {
      projectName: string(cloudflare.projectName),
      pagesRoot: string(cloudflare.pagesRoot),
      publicBaseUrl: string(cloudflare.publicBaseUrl),
      localPreviewPort: number(cloudflare.localPreviewPort, DEFAULT_CONFIG.cloudflare.localPreviewPort, 1024, 65535),
      wranglerCommand: string(cloudflare.wranglerCommand),
      eagleLibraryRoot: string(cloudflare.eagleLibraryRoot)
    }
  };
}

function loadConfig() {
  const file = path.join(dataDirectory(), 'config.json');
  const stored = readJson(file, {});
  const normalized = normalizeConfig(stored);
  if (JSON.stringify(stored) !== JSON.stringify(normalized)) writeJson(file, normalized);
  return normalized;
}

function saveConfig(config) {
  const file = path.join(dataDirectory(), 'config.json');
  writeJson(file, normalizeConfig(config));
  return file;
}

function emptyState() {
  return { items: {}, lastSyncAt: null, lastError: null, lastResult: null };
}

function loadState() {
  const stored = readJson(path.join(dataDirectory(), 'state.json'), emptyState());
  return {
    items: stored.items && typeof stored.items === 'object' ? stored.items : {},
    lastSyncAt: stored.lastSyncAt || null,
    lastError: stored.lastError || null,
    lastResult: stored.lastResult || null
  };
}

function saveState(state) {
  writeJson(path.join(dataDirectory(), 'state.json'), state);
}

module.exports = {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  DEFAULT_WATERMARK,
  dataDirectory,
  normalizeConfig,
  loadConfig,
  saveConfig,
  emptyState,
  loadState,
  saveState,
  writeJson
};
