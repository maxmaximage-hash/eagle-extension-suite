const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const pluginRoot = path.resolve(__dirname, '../eagle-plugin');
const watermark = require('../eagle-plugin/modules/watermark-editor');
const fonts = require('../eagle-plugin/modules/font-manager');

test('水印共享模块提供版本化 schema、预设、预览层和真实导出 API', () => {
  assert.equal(watermark.version, '1.1.1');
  assert.equal(typeof watermark.schema.normalizeWatermark, 'function');
  assert.equal(typeof watermark.presets.createPreset, 'function');
  assert.equal(typeof watermark.renderWatermarkLayer, 'function');
  assert.equal(typeof watermark.renderWatermarkPreviewPayload, 'function');
  assert.equal(typeof watermark.renderWatermarked, 'function');
});

test('字体模块提供独立版本化分类 API', () => {
  assert.equal(fonts.version, '1.1.2');
  assert.equal(typeof fonts.classifier.classifyFont, 'function');
  assert.equal(typeof fonts.classifier.buildFontGroups, 'function');
  assert.equal(fonts.classification.version, 2);
});

test('Eagle 根目录不再保留旧的重复编辑器与样式入口', () => {
  assert.equal(fs.existsSync(path.join(pluginRoot, 'plugin.js')), false);
  assert.equal(fs.existsSync(path.join(pluginRoot, 'styles.css')), false);
  assert.equal(fs.existsSync(path.join(pluginRoot, 'font-classifier.js')), false);
  assert.equal(fs.existsSync(path.join(pluginRoot, 'lib/watermark.js')), false);
  assert.equal(fs.existsSync(path.join(pluginRoot, 'modules/watermark-editor/editor.css')), true);
});
