const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sharp = require('../eagle-plugin/node_modules/sharp');
const { renderWatermarked, renderWatermarkLayer, renderWatermarkPreviewPayload, renderWatermarkVectorPreviewPayload, overlaysFor, positionFor, exactFontForSettings, textMark } = require('../eagle-plugin/modules/watermark-editor/renderer.js');

const root = path.resolve(__dirname, '..');
const source = path.resolve(root, '.preview-assets', 'detail-post-01.jpg');
const logo = path.resolve(root, 'eagle-plugin', 'logo.png');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'max-watermark-tests-'));

test.after(() => {
  fs.rmSync(output, { recursive: true, force: true });
});

test('单点文字水印可以生成 WebP', async () => {
  const target = path.join(output, 'single.webp');
  await renderWatermarked(source, target, {
    maxWidth: 800,
    quality: 82,
    format: 'webp',
    watermark: { enabled: true, type: 'text', text: 'MAX', position: 'bottom-right', opacity: 0.4, fontSize: 0.05, color: '#ffffff', rotation: 0 }
  });
  const metadata = await sharp(target).metadata();
  assert.equal(metadata.format, 'webp');
  assert.ok(metadata.width <= 800);
  assert.ok(fs.statSync(target).size > 1000);
});

test('平铺水印可以生成 JPEG', async () => {
  const target = path.join(output, 'cross.jpg');
  await renderWatermarked(source, target, {
    maxWidth: 900,
    quality: 86,
    format: 'jpg',
    watermark: { enabled: true, type: 'text', text: 'MAX SAMPLE', scaleMode: 'fill', density: 7, opacity: 0.22, fontSize: 0.035, color: '#ffffff' }
  });
  const metadata = await sharp(target).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.ok(fs.statSync(target).size > 1000);
});

test('多行文字水印会按换行增加真实导出高度', async () => {
  const base = {
    enabled: true,
    type: 'text',
    scaleMode: 'proportional',
    scale: 0.12,
    position: 'center',
    opacity: 1,
    shadowEnabled: false,
    rotation: 0
  };
  const [singleLine] = await overlaysFor({ ...base, text: 'Gravityglobal' }, 1000, 800);
  const [multiLine] = await overlaysFor({ ...base, text: 'Gravity\nglobal' }, 1000, 800);
  const singleMetadata = await sharp(singleLine.input).metadata();
  const multiMetadata = await sharp(multiLine.input).metadata();
  assert.ok(multiMetadata.height > singleMetadata.height);
});

test('多行文字水印行间距会改变真实导出高度', async () => {
  const base = {
    enabled: true,
    type: 'text',
    text: 'Gravity\nglobal',
    scaleMode: 'proportional',
    scale: 0.12,
    position: 'center',
    opacity: 1,
    shadowEnabled: false,
    rotation: 0
  };
  const [compact] = await overlaysFor({ ...base, lineSpacing: 0.8 }, 1000, 800);
  const [relaxed] = await overlaysFor({ ...base, lineSpacing: 2 }, 1000, 800);
  const compactMetadata = await sharp(compact.input).metadata();
  const relaxedMetadata = await sharp(relaxed.input).metadata();
  assert.ok(relaxedMetadata.height > compactMetadata.height);
});

test('长文本水印不会被真实导出算法自动换行', async () => {
  const base = {
    enabled: true,
    type: 'text',
    scaleMode: 'proportional',
    scale: 0.08,
    position: 'center',
    opacity: 1,
    shadowEnabled: false,
    rotation: 0
  };
  const [shortLine] = await overlaysFor({ ...base, text: 'Copyright' }, 1000, 800);
  const [longLine] = await overlaysFor({ ...base, text: 'Copyright ©Gravity Global. All rights reserved.' }, 1000, 800);
  const shortMetadata = await sharp(shortLine.input).metadata();
  const longMetadata = await sharp(longLine.input).metadata();
  assert.equal(longMetadata.height, shortMetadata.height);
  assert.ok(longMetadata.width > shortMetadata.width);
});

test('空文字和缺失文字都不会生成任何水印', async () => {
  const emptyText = await overlaysFor({
    enabled: true,
    type: 'text',
    text: '',
    scaleMode: 'proportional',
    scale: 0.12,
    position: 'center',
    opacity: 1,
    shadowEnabled: false,
    rotation: 0
  }, 1000, 800);
  const missingText = await overlaysFor({
    enabled: true,
    type: 'text',
    scaleMode: 'fill'
  }, 1000, 800);
  assert.deepEqual(emptyText, []);
  assert.deepEqual(missingText, []);
});

test('没有选择图形文件或文件不存在时不会生成水印', async () => {
  assert.deepEqual(await overlaysFor({
    enabled: true,
    type: 'image',
    imagePath: ''
  }, 1000, 800), []);
  assert.deepEqual(await overlaysFor({
    enabled: true,
    type: 'image',
    imagePath: '/tmp/not-a-real-watermark-logo.png'
  }, 1000, 800), []);
});

test('图片水印忽略旧预设中的阴影配置', async () => {
  const base = {
    enabled: true,
    type: 'image',
    imagePath: logo,
    scaleMode: 'proportional',
    scale: 0.18,
    position: 'center',
    opacity: 0.8,
    rotation: 0
  };
  const [withoutShadow] = await overlaysFor({ ...base, shadowEnabled: false }, 1000, 800);
  const [withLegacyShadow] = await overlaysFor({
    ...base,
    shadowEnabled: true,
    shadowColor: '#123456',
    shadowOpacity: 0.7,
    shadowOffset: 12,
    shadowRadius: 40,
    shadowAngle: 35
  }, 1000, 800);
  assert.deepEqual(withLegacyShadow.input, withoutShadow.input);
});

test('透明黑底 PNG 缩放不会污染白色图形边缘', async () => {
  const transparentLogo = path.join(output, 'transparent-black-rgb-logo.png');
  await sharp({
    create: {
      width: 420,
      height: 180,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{
      input: Buffer.from('<svg width="420" height="180" xmlns="http://www.w3.org/2000/svg"><circle cx="210" cy="90" r="64" fill="#fff"/></svg>')
    }])
    .png()
    .toFile(transparentLogo);

  const [overlay] = await overlaysFor({
    enabled: true,
    type: 'image',
    imagePath: transparentLogo,
    scaleMode: 'proportional',
    scale: 0.08,
    position: 'center',
    opacity: 1,
    shadowEnabled: false
  }, 1000, 800);

  const raw = await sharp(overlay.input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let checked = 0;
  let darkestEdge = 255;
  for (let index = 0; index < raw.data.length; index += raw.info.channels) {
    const alpha = raw.data[index + 3];
    if (alpha > 1 && alpha < 255) {
      checked += 1;
      darkestEdge = Math.min(darkestEdge, raw.data[index], raw.data[index + 1], raw.data[index + 2]);
    }
  }
  assert.ok(checked > 0);
  assert.ok(darkestEdge > 240);
});

test('超出画布的水印保留真实锚点，不会被强制推到左上角', () => {
  assert.deepEqual(positionFor('center', 1000, 800, 1600, 1000, 40, 32), {
    left: -300,
    top: -100
  });
  assert.deepEqual(positionFor('bottom-right', 1000, 800, 1600, 1000, 40, 32), {
    left: -640,
    top: -232
  });
});

test('透明预览层与真实导出共用同一张水印层', async () => {
  const width = 640;
  const height = 480;
  const basePath = path.join(output, 'shared-layer-base.png');
  const target = path.join(output, 'shared-layer-export.png');
  const settings = {
    enabled: true,
    type: 'text',
    text: 'Gravity Global',
    scaleMode: 'proportional',
    fontSize: 0.05,
    position: 'center',
    opacity: 0.8,
    color: '#ffffff',
    shadowEnabled: true,
    shadowOpacity: 0.4,
    shadowOffset: 2,
    shadowRadius: 12,
    shadowAngle: -45
  };
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 31, g: 47, b: 63 }
    }
  }).png().toFile(basePath);
  const layer = await renderWatermarkLayer(settings, width, height);
  const expected = await sharp(basePath)
    .composite([{ input: layer, left: 0, top: 0 }])
    .png()
    .toBuffer();
  await renderWatermarked(basePath, target, {
    maxWidth: 0,
    quality: 100,
    format: 'png',
    watermark: settings
  });
  const [expectedRaw, actualRaw] = await Promise.all([
    sharp(expected).ensureAlpha().raw().toBuffer(),
    sharp(target).ensureAlpha().raw().toBuffer()
  ]);
  assert.deepEqual(actualRaw, expectedRaw);
});

test('统一水印层在不同预览尺寸下保持归一化位置和大小', async () => {
  const settings = {
    enabled: true,
    type: 'text',
    text: 'Gravity Global',
    scaleMode: 'proportional',
    fontSize: 0.04,
    position: 'center',
    opacity: 1,
    color: '#ffffff',
    shadowEnabled: false
  };
  async function alphaBounds(buffer) {
    const raw = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minX = raw.info.width;
    let minY = raw.info.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < raw.info.height; y += 1) {
      for (let x = 0; x < raw.info.width; x += 1) {
        if (raw.data[(y * raw.info.width + x) * 4 + 3] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    return {
      left: minX / raw.info.width,
      top: minY / raw.info.height,
      width: (maxX - minX + 1) / raw.info.width,
      height: (maxY - minY + 1) / raw.info.height
    };
  }
  const small = await alphaBounds(await renderWatermarkLayer(settings, 600, 800));
  const large = await alphaBounds(await renderWatermarkLayer(settings, 1200, 1600));
  for (const key of ['left', 'top', 'width', 'height']) {
    assert.ok(Math.abs(small[key] - large[key]) < 0.012, `${key} should stay normalized`);
  }
});

test('所选字体直接读取真实字体文件并以字形路径渲染', async (context) => {
  const thinPath = '/Users/max/Library/Fonts/江城斜宋体 100W.ttf';
  const heavyPath = '/Users/max/Library/Fonts/江城斜宋体 900W.ttf';
  if (!fs.existsSync(thinPath) || !fs.existsSync(heavyPath)) {
    context.skip('当前机器没有江城斜宋体完整字重文件');
    return;
  }
  const base = {
    text: 'Copyright ©Gravity Global.All rights reserved.',
    fontFamily: '江城斜宋体',
    fontSize: 0.05,
    letterSpacing: -0.09,
    opacity: 1,
    color: '#ffffff',
    shadowEnabled: false
  };
  const thinSettings = {
    ...base,
    fontPath: thinPath,
    fontFace: '江城斜宋体 100W',
    fontPostscriptName: 'JiangChengXieSong-100W',
    fontWeight: 100
  };
  const heavySettings = {
    ...base,
    fontPath: heavyPath,
    fontFace: '江城斜宋体 900W',
    fontPostscriptName: 'JiangChengXieSong-900W',
    fontWeight: 900
  };
  assert.equal(exactFontForSettings(thinSettings).postscriptName, 'JiangChengXieSong-100W');
  assert.equal(exactFontForSettings(heavySettings).postscriptName, 'JiangChengXieSong-900W');
  const [thin, heavy] = await Promise.all([
    textMark(thinSettings, 1200),
    textMark(heavySettings, 1200)
  ]);
  assert.notDeepEqual(thin, heavy);
  const thinAlpha = await sharp(thin).ensureAlpha().extractChannel(3).raw().toBuffer();
  assert.ok(thinAlpha.some((value) => value > 0), '真实字体路径必须生成可见字形');
});

test('可变字体字重选择会读取对应命名字面而不是永远使用默认字面', (context) => {
  const skiaPath = '/System/Library/Fonts/Supplemental/Skia.ttf';
  if (!fs.existsSync(skiaPath)) {
    context.skip('当前机器没有 Skia 可变字体');
    return;
  }
  const regular = exactFontForSettings({
    fontPath: skiaPath,
    fontFamily: 'Skia',
    fontPostscriptName: 'Skia-Regular'
  });
  const black = exactFontForSettings({
    fontPath: skiaPath,
    fontFamily: 'Skia',
    fontPostscriptName: 'Skia-Regular_Black'
  });
  assert.notEqual(regular.getGlyph(36).path.toSVG(), black.getGlyph(36).path.toSVG());
});

test('TTC 多字重字体严格按 PostScript 字面切换而不被家族名提前命中', async (context) => {
  const fontPath = '/System/Library/Fonts/Supplemental/AmericanTypewriter.ttc';
  if (!fs.existsSync(fontPath)) {
    context.skip('当前机器没有 American Typewriter TTC');
    return;
  }
  const base = {
    enabled: true,
    type: 'text',
    scaleMode: 'proportional',
    position: 'center',
    rotation: 0,
    letterSpacing: 0,
    lineSpacing: 1.28,
    color: '#ffffff',
    text: 'American Typewriter',
    fontFamily: 'American Typewriter',
    fontPath,
    fontStyle: 'normal',
    shadowEnabled: false,
    opacity: 1,
    scale: 0.2
  };
  const light = {
    ...base,
    fontFace: 'American Typewriter Light',
    fontPostscriptName: 'AmericanTypewriter-Light',
    fontWeight: 300
  };
  const bold = {
    ...base,
    fontFace: 'American Typewriter Bold',
    fontPostscriptName: 'AmericanTypewriter-Bold',
    fontWeight: 700
  };
  assert.equal(exactFontForSettings(light).postscriptName, 'AmericanTypewriter-Light');
  assert.equal(exactFontForSettings(bold).postscriptName, 'AmericanTypewriter-Bold');
  const lightMark = await textMark(light, 1200);
  const boldMark = await textMark(bold, 1200);
  assert.notDeepEqual(lightMark, boldMark);
});

test('CoreText 专用 TTC 字面不会错误回退到集合第一款字体', async (context) => {
  const fontPath = '/System/Library/PrivateFrameworks/FontServices.framework/Resources/Reserved/PingFangUI.ttc';
  if (!fs.existsSync(fontPath)) {
    context.skip('当前机器没有 PingFangUI TTC');
    return;
  }
  const base = {
    enabled: true,
    type: 'text',
    scaleMode: 'proportional',
    position: 'center',
    text: '引力环球 ABC',
    fontFamily: '苹方-简',
    fontPath,
    fontStyle: 'normal',
    letterSpacing: 0,
    lineSpacing: 1.28,
    color: '#ffffff',
    shadowEnabled: false,
    opacity: 1,
    scale: 0.2
  };
  const light = {
    ...base,
    fontFace: '苹方-简 极细体',
    fontPostscriptName: 'PingFangSC-Ultralight',
    fontWeight: 100
  };
  const semibold = {
    ...base,
    fontFace: '苹方-简 中粗体',
    fontPostscriptName: 'PingFangSC-Semibold',
    fontWeight: 600
  };
  assert.equal(exactFontForSettings(light), null);
  assert.equal(exactFontForSettings(semibold), null);
  assert.notDeepEqual(await textMark(light, 1200), await textMark(semibold, 1200));
});

test('紧凑实时预览图层可无损还原真实导出水印层', async () => {
  const settings = {
    enabled: true,
    type: 'text',
    text: 'Gravity Global',
    fontSize: 0.04,
    position: 'center',
    opacity: 0.8,
    color: '#ffffff',
    shadowEnabled: true,
    shadowOpacity: 0.45,
    shadowRadius: 10
  };
  const width = 1200;
  const height = 1600;
  const payload = await renderWatermarkPreviewPayload(settings, width, height);
  assert.ok(payload.assets.length > 0);
  assert.ok(payload.placements.length > 0);
  const overlays = payload.placements.map((placement) => ({
    input: Buffer.from(payload.assets[placement.asset].dataUrl.split(',')[1], 'base64'),
    left: placement.left,
    top: placement.top
  }));
  const reconstructed = await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).composite(overlays).png().toBuffer();
  const fullLayer = await renderWatermarkLayer(settings, width, height);
  assert.deepEqual(reconstructed, fullLayer);
});

test('字间距和行间距可以复用真实字形路径生成快速矢量预览', async (context) => {
  const fontPath = '/Users/max/Library/Fonts/江城斜宋体 100W.ttf';
  if (!fs.existsSync(fontPath)) {
    context.skip('当前机器没有江城斜宋体 100W');
    return;
  }
  const base = {
    enabled: true,
    type: 'text',
    text: 'Gravity\nGlobal',
    fontPath,
    fontFamily: '江城斜宋体',
    fontFace: '江城斜宋体 100W',
    fontPostscriptName: 'JiangChengXieSong-100W',
    fontWeight: 100,
    fontStyle: 'italic',
    scaleMode: 'proportional',
    scale: 0.2,
    position: 'center',
    opacity: 1,
    shadowEnabled: true
  };
  const compact = await renderWatermarkVectorPreviewPayload({ ...base, letterSpacing: -0.1, lineSpacing: 0.8 }, 1200, 1600);
  const expanded = await renderWatermarkVectorPreviewPayload({ ...base, letterSpacing: 0.4, lineSpacing: 2.2 }, 1200, 1600);
  assert.equal(compact.vector, true);
  assert.equal(compact.assets.length, 1);
  assert.match(compact.assets[0].dataUrl, /^data:image\/svg\+xml;base64,/);
  const svg = Buffer.from(compact.assets[0].dataUrl.split(',')[1], 'base64').toString('utf8');
  assert.match(svg, /<path d=/);
  assert.ok(expanded.assets[0].width > compact.assets[0].width);
  assert.ok(expanded.assets[0].height > compact.assets[0].height);
});
