const assert = require('node:assert/strict');
const test = require('node:test');
const {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  DEFAULT_WATERMARK,
  normalizeConfig,
  emptyState
} = require('../eagle-plugin/lib/config.js');
const {
  normalizeWatermark,
  canonicalWatermark
} = require('../eagle-plugin/modules/watermark-editor/schema.js');

test('1.0 空软件只内置引力环球版权文字一个预设', () => {
  assert.equal(CONFIG_SCHEMA_VERSION, 1);
  assert.deepEqual(DEFAULT_CONFIG.fontClassification.favorites, []);
  assert.equal(DEFAULT_CONFIG.watermarkPresets.length, 1);
  assert.equal(DEFAULT_CONFIG.watermarkPresets[0].id, 'gravityglobal-copyright');
  assert.equal(DEFAULT_CONFIG.watermarkPresets[0].name, '引力环球版权文字');
  assert.equal(DEFAULT_CONFIG.watermarkPresets[0].watermark.text, 'Copyright ©Gravity Global.All rights reserved.');
  assert.equal(DEFAULT_CONFIG.localExport.watermark.presetId, 'gravityglobal-copyright');
  assert.equal(DEFAULT_CONFIG.online.watermark.presetId, 'gravityglobal-copyright');
});

test('字体收藏列表会规范化、去重并清除空值', () => {
  const normalized = normalizeConfig({
    fontClassification: {
      favorites: ['Arial', 'Arial', 123, '', null, 'PingFang SC']
    }
  });
  assert.deepEqual(normalized.fontClassification.favorites, ['Arial', '123', 'PingFang SC']);
});

test('共享水印 schema 没有旧版本隐藏字段和默认占位文字', () => {
  assert.equal(DEFAULT_WATERMARK.text, '');
  const normalized = normalizeWatermark({
    type: 'text',
    text: '',
    imagePath: '/tmp/legacy-logo.png',
    fontSize: 0.8,
    fontStylePreset: 'legacy',
    strokeColor: '#ff0000',
    strokeWidth: 9,
    mode: 'legacy',
    marginX: 10,
    gapX: 20,
    stagger: true
  });
  assert.equal(normalized.text, '');
  assert.equal(normalized.imagePath, '');
  for (const key of ['fontSize', 'fontStylePreset', 'strokeColor', 'strokeWidth', 'mode', 'marginX', 'gapX', 'stagger']) {
    assert.equal(Object.prototype.hasOwnProperty.call(normalized, key), false, `${key} 应被 schema 清除`);
  }
  assert.deepEqual(canonicalWatermark(normalized), normalized);
});

test('配置规范化直接收敛到 1.0 结构而不运行旧版本迁移链', () => {
  const normalized = normalizeConfig({
    schemaVersion: 4,
    watermarkPresets: [{
      id: 'text-preset',
      name: '文字预设',
      watermark: { type: 'text', text: 'Gravityglobal', imagePath: '/tmp/logo.png', fontSize: 2 }
    }],
    localExport: {
      compressionMode: 'size',
      maxFileSizeMb: 2,
      collisionMode: 'overwrite',
      watermark: { presetId: 'text-preset', type: 'text', text: '被草稿污染的文字' }
    },
    online: { watermark: { presetId: 'text-preset', type: 'text', text: '另一份草稿' } }
  });
  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.watermarkPresets.length, 1);
  assert.equal(normalized.watermarkPresets[0].watermark.text, 'Gravityglobal');
  assert.equal(normalized.watermarkPresets[0].watermark.imagePath, '');
  assert.equal(normalized.localExport.watermark.text, 'Gravityglobal');
  assert.equal(normalized.online.watermark.text, 'Gravityglobal');
  assert.equal(normalized.localExport.compressionMode, 'size');
  assert.equal(normalized.localExport.maxFileSizeMb, 2);
  assert.equal(normalized.localExport.collisionMode, 'overwrite');
});

test('运行状态可以恢复为完全空白', () => {
  assert.deepEqual(emptyState(), {
    items: {},
    lastSyncAt: null,
    lastError: null,
    lastResult: null
  });
});
