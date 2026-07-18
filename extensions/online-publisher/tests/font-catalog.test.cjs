const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const classifier = require('../eagle-plugin/modules/font-manager/classifier.js');
const classification = require('../eagle-plugin/modules/font-manager/classification.js');

function loadBrowserData(filename, property) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'eagle-plugin', 'modules', 'font-manager', filename), 'utf8'), context);
  return context.window[property];
}

const catalog = loadBrowserData('catalog.js', 'MAX_FONT_CATALOG');
const metadata = loadBrowserData('metadata.js', 'MAX_FONT_METADATA');

test('完整字体清单只输出中文和英文字体', () => {
  const groups = classifier.buildFontGroups(catalog, { classification, metadata });
  const included = new Set(groups.flatMap((group) => group.fonts));
  for (const excluded of ['Apple SD Gothic Neo', 'Diwan Kufi', 'Hangyaku', 'Ayuthaya', 'Plantagenet Cherokee', '몺틇뎬듖뫚볲']) {
    assert.equal(included.has(excluded), false, `${excluded} 不应出现在正式字体列表`);
  }
});

test('完整字体清单没有未经校正的低置信度字体', () => {
  const pending = [];
  for (const entry of catalog) {
    const group = classifier.classifyFont(entry, { classification, metadata });
    const fontMetadata = classifier.metadataFor(entry, metadata);
    const hasOverride = Object.prototype.hasOwnProperty.call(classification.overrides, entry.family);
    if (group && (!fontMetadata || fontMetadata.confidence === 'low') && !hasOverride) pending.push(entry.family);
  }
  assert.deepEqual(pending, []);
});

test('已确认字体固定进入正确视觉分组', () => {
  const expected = {
    Aniyah: 'latin-handwriting',
    Explora: 'latin-serif',
    Impact: 'latin-sans',
    'STIX Two Math': 'latin-serif',
    'Bodoni Moda': 'latin-serif',
    '飞花宋体': 'cjk-serif',
    '爱点签名体': 'cjk-handwriting',
    '方正兰亭大黑简体': 'cjk-sans',
    '阿里妈妈方圆体 VF': 'cjk-sans'
  };
  for (const [family, group] of Object.entries(expected)) {
    const entry = catalog.find((font) => font.family === family);
    assert.ok(entry, `缺少字体：${family}`);
    assert.equal(classifier.classifyFont(entry, { classification, metadata }), group);
  }
});

test('江城黑体各独立字重会合并为一个家族', () => {
  const variants = catalog
    .filter((entry) => classifier.fontFamilyVariant(entry.family).family === '江城黑体')
    .flatMap((entry) => entry.faces.map((face) => classifier.fontFamilyVariant(entry.family, face)));
  assert.equal(variants.length, 14);
  assert.deepEqual([...new Set(variants.map((item) => item.family))], ['江城黑体']);
  assert.ok(variants.some((item) => item.label === '100W'));
  assert.ok(variants.some((item) => item.label === 'Italic 700W'));
});

test('编辑器重点字体都绑定真实 Mac 字体文件', () => {
  for (const family of ['Skia', 'Univers LT Std', 'Brush Script MT', 'Galeere', 'Explora', 'Herculanum']) {
    const entry = catalog.find((font) => font.family === family);
    assert.ok(entry, `缺少字体：${family}`);
    assert.ok(entry.faces.length > 0, `${family} 缺少字面`);
    for (const face of entry.faces) {
      assert.ok(face.fontPath, `${family}/${face.postscriptName} 缺少真实文件路径`);
      assert.ok(fs.existsSync(face.fontPath), `${family}/${face.postscriptName} 字体文件不存在`);
    }
  }
});
