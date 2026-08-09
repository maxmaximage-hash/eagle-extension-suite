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
const catalogSource = fs.readFileSync(path.join(__dirname, '..', 'eagle-plugin', 'modules', 'font-manager', 'catalog.js'), 'utf8');
const browserSource = fs.readFileSync(path.join(__dirname, '..', 'eagle-plugin', 'modules', 'font-manager', 'browser.js'), 'utf8');

test('发行字体目录不携带开发者用户名路径', () => {
  assert.doesNotMatch(catalogSource, /\/Users\/[^/]+\/Library\/Fonts/);
});

test('Eagle 运行时先从当前 Mac 发现字体，再使用无路径兜底目录', () => {
  assert.match(browserSource, /function loadSystemFontCatalog\(\) \{[\s\S]*?if \(childProcess\) \{[\s\S]*?system_profiler[\s\S]*?resolve\(bundledFontCatalog\(\)\)/);
  assert.doesNotMatch(browserSource, /Array\.isArray\(window\.MAX_FONT_CATALOG\)/);
});

test('已保存但未安装的字体在选择器中明确标示为不可用', () => {
  assert.match(browserSource, /未安装字体/);
});
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

test('随包字体参考目录保留字面身份，不声明其他电脑一定存在', () => {
  for (const family of ['Skia', 'Univers LT Std', 'Brush Script MT', 'Galeere', 'Explora', 'Herculanum']) {
    const entry = catalog.find((font) => font.family === family);
    assert.ok(entry, `缺少字体：${family}`);
    assert.ok(entry.faces.length > 0, `${family} 缺少字面`);
    for (const face of entry.faces) {
      assert.ok(face.postscriptName, `${family} 缺少 PostScript 字面`);
      assert.doesNotMatch(face.fontPath || '', /\/Users\//, `${family}/${face.postscriptName} 不应绑定特定用户目录`);
    }
  }
});
