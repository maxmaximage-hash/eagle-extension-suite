const assert = require('node:assert/strict');
const test = require('node:test');

const classifier = require('../eagle-plugin/modules/font-manager/classifier.js');
const classification = require('../eagle-plugin/modules/font-manager/classification.js');

function font(family, postscriptName = family, fullName = family) {
  return {
    family,
    faces: [{ label: '常规体', fullName, postscriptName, weight: 400, style: 'normal' }]
  };
}

test('人工校正覆盖容易误判的视觉字体', () => {
  assert.equal(classifier.classifyFont(font('Aniyah'), { classification }), 'latin-handwriting');
  assert.equal(classifier.classifyFont(font('Explora'), { classification }), 'latin-serif');
  assert.equal(classifier.classifyFont(font('Bodoni Moda'), { classification }), 'latin-serif');
  assert.equal(classifier.classifyFont(font('卓特清雅体', 'ZTQingYaTi-Regular'), { classification }), 'cjk-handwriting');
});

test('中文样式后缀不会把英文字体误判成中文', () => {
  const entry = font('Example Sans', 'ExampleSans-Regular', 'Example Sans 常规体');
  assert.equal(classifier.classifyFont(entry, { classification }), 'latin-sans');
});

test('字体文件元数据优先排除韩文和阿拉伯字体', () => {
  const metadata = {
    fonts: {
      AppleSDGothicNeo: { language: 'exclude', style: 'sans' },
      DiwanKufi: { language: 'exclude', style: 'other' }
    }
  };
  assert.equal(classifier.classifyFont(font('Apple SD Gothic Neo', 'AppleSDGothicNeo'), { classification, metadata }), null);
  assert.equal(classifier.classifyFont(font('Diwan Kufi', 'DiwanKufi'), { classification, metadata }), null);
});

test('分组顺序固定为英文三组后接中文三组', () => {
  const catalog = [
    font('Arial'),
    font('Bodoni Moda'),
    font('Aniyah'),
    font('Andale Mono'),
    font('PingFang SC', 'PingFangSC-Regular'),
    font('飞花宋体', 'FlyFlowerSong'),
    font('卓特清雅体', 'ZTQingYaTi-Regular'),
    font('阿里妈妈方圆体 VF')
  ];
  const groups = classifier.buildFontGroups(catalog, { classification });
  assert.deepEqual(groups.map((group) => group.id), [
    'latin-sans',
    'latin-serif',
    'latin-handwriting',
    'cjk-sans',
    'cjk-serif',
    'cjk-handwriting'
  ]);
});

test('人工编辑配置覆盖自动分类并合并隐藏字体', () => {
  const customized = classifier.mergeClassification(classification, {
    overrides: { Aniyah: 'latin-serif' },
    excluded: ['Arial']
  });
  assert.equal(classifier.classifyFont(font('Aniyah'), { classification: customized }), 'latin-serif');
  assert.equal(classifier.classifyFont(font('Arial'), { classification: customized }), null);
  assert.ok(customized.excluded.includes('Diwan Kufi'));
  assert.ok(customized.excluded.includes('Arial'));
});

test('旧版其他字体人工分类会迁移到无衬线', () => {
  const customized = classifier.mergeClassification(classification, {
    overrides: { Monaco: 'latin-other', '阿里妈妈数黑体': 'cjk-other' }
  });
  assert.equal(customized.overrides.Monaco, 'latin-sans');
  assert.equal(customized.overrides['阿里妈妈数黑体'], 'cjk-sans');
});

test('独立字重字体能够识别为同一字体家族', () => {
  assert.deepEqual(classifier.fontFamilyVariant('江城黑体 100W'), {
    family: '江城黑体',
    weight: 100,
    style: null,
    label: '100W'
  });
  assert.deepEqual(classifier.fontFamilyVariant('江城黑体 Italic 700W'), {
    family: '江城黑体',
    weight: 700,
    style: 'italic',
    label: 'Italic 700W'
  });
});
