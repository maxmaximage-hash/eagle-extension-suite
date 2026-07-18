const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const pluginRoot = path.resolve(__dirname, '../eagle-plugin');

function runBrowserScript(context, relativePath) {
  const source = fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

test('Eagle 同时提供 window 和 require 时共享模块仍按浏览器脚本加载', () => {
  const sandbox = {
    document: {},
    module: { exports: { untouched: true }, filename: '/fake/eagle/index.html' },
    __filename: '/fake/eagle/index.html',
    require() {
      throw new Error('Eagle 页面脚本不应通过相对 require 加载共享浏览器模块');
    }
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);

  runBrowserScript(context, 'modules/watermark-editor/schema.js');
  runBrowserScript(context, 'modules/watermark-editor/presets.js');
  runBrowserScript(context, 'adapters/eagle/defaults.js');
  runBrowserScript(context, 'modules/font-manager/classification.js');
  runBrowserScript(context, 'modules/font-manager/classifier.js');

  assert.equal(context.GravityWatermarkSchema.VERSION, 1);
  assert.equal(typeof context.GravityWatermarkPresets.createPreset, 'function');
  assert.equal(context.MaxEagleWatermarkDefaults.COPYRIGHT_PRESET.name, '引力环球版权文字');
  assert.equal(typeof context.MAX_FONT_CLASSIFIER.classifyFont, 'function');
  assert.deepEqual(context.module.exports, { untouched: true });
});

test('Eagle 后台 require 在存在 document 时仍获得完整 CommonJS API', () => {
  const previousDocument = global.document;
  global.document = {};
  const defaultsPath = path.join(pluginRoot, 'adapters/eagle/defaults.js');
  const schemaPath = path.join(pluginRoot, 'modules/watermark-editor/schema.js');
  delete require.cache[require.resolve(defaultsPath)];
  delete require.cache[require.resolve(schemaPath)];
  try {
    const defaults = require(defaultsPath);
    assert.equal(typeof defaults.copyrightWatermark, 'function');
    assert.equal(defaults.copyrightWatermark().presetId, 'gravityglobal-copyright');
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});
