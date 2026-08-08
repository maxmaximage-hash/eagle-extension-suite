const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sharp = require('../eagle-plugin/node_modules/sharp');

const pluginRoot = path.resolve(__dirname, '../eagle-plugin');
const upstreamRoot = path.resolve(
  __dirname,
  '../../../../共享模块/packages/gravity-privacy-editor'
);
const vendorRoot = path.join(pluginRoot, 'modules/vendor/gravity-privacy-editor');
const privacyNode = require('../eagle-plugin/modules/vendor/gravity-privacy-editor/1.1.0/node.cjs');
const { renderPrivacyEdited } = require('../eagle-plugin/lib/privacy-exporter.cjs');

function filesRecursively(root) {
  return fs.readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const filename = path.join(root, entry.name);
      return entry.isDirectory() ? filesRecursively(filename) : [filename];
    })
    .sort();
}

function sha256(filename) {
  return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function pixel(data, width, x, y, channels = 4) {
  const offset = (y * width + x) * channels;
  return [...data.subarray(offset, offset + channels)];
}

test('Eagle vendor 只保留当前 1.1.0 且与独立上游逐文件一致', () => {
  assert.equal(fs.existsSync(path.join(vendorRoot, '1.0.0')), false);
  for (const version of ['1.1.0']) {
    const upstream = path.join(upstreamRoot, version);
    const vendor = path.join(vendorRoot, version);
    const upstreamFiles = filesRecursively(upstream).map((file) => path.relative(upstream, file));
    const vendorFiles = filesRecursively(vendor).map((file) => path.relative(vendor, file));
    assert.deepEqual(vendorFiles, upstreamFiles, `${version} 文件列表不一致`);
    for (const relative of upstreamFiles) {
      assert.equal(
        sha256(path.join(vendor, relative)),
        sha256(path.join(upstream, relative)),
        `${version}/${relative} 与上游不一致`
      );
    }
  }
});

test('隐私 schema 支持矩形和椭圆，但效果与强度只保存在全局层', async () => {
  const schema = await import('../eagle-plugin/modules/vendor/gravity-privacy-editor/1.1.0/schema.js');
  const layer = schema.normalizePrivacyLayer({
    effectType: 'blur',
    intensity: 8,
    items: [
      { id: 'rect', x: 10, y: 12, width: 50, height: 40, shape: 'rect', effectType: 'blur', intensity: 6 },
      { id: 'ellipse', x: 70, y: 20, width: 60, height: 50, shape: 'ellipse', effectType: 'pixelate', intensity: 21 },
    ],
  }, {
    width: 200,
    height: 160,
    allowedAnchors: ['image'],
    defaultAnchor: 'image',
  });
  assert.deepEqual(schema.PRIVACY_SHAPES, ['rect', 'ellipse']);
  assert.equal(layer.effectType, 'blur');
  assert.equal(layer.intensity, 8);
  assert.equal(layer.items[0].shape, 'rect');
  assert.equal(layer.items[1].shape, 'ellipse');
  assert.equal(Object.hasOwn(layer.items[0], 'effectType'), false);
  assert.equal(Object.hasOwn(layer.items[0], 'intensity'), false);
  assert.equal(Object.hasOwn(layer.items[1], 'effectType'), false);
  assert.equal(Object.hasOwn(layer.items[1], 'intensity'), false);

  const normalizedForExport = privacyNode.normalizeLayer({
    effectType: 'pixelate',
    intensity: 19,
    items: [
      { id: 'weak', x: 0, y: 0, width: 50, height: 40, effectType: 'blur', intensity: 2 },
      { id: 'strong', x: 60, y: 0, width: 50, height: 40, effectType: 'pixelate', intensity: 24 },
    ],
  }, 120, 80);
  assert.equal(normalizedForExport.effectType, 'pixelate');
  assert.equal(normalizedForExport.intensity, 19);
  assert.ok(normalizedForExport.items.every((item) => !Object.hasOwn(item, 'effectType')));
  assert.ok(normalizedForExport.items.every((item) => !Object.hasOwn(item, 'intensity')));

  const workspaceSource = fs.readFileSync(
    path.join(__dirname, '../privacy-app/EaglePrivacyWorkspace.jsx'),
    'utf8'
  );
  assert.match(workspaceSource, /label="全部区域强度"/);
  assert.doesNotMatch(workspaceSource, /selectedMask\?\.effectType|selectedMask\?\.intensity|patchSelectedMask/);
});

test('马赛克最大强度进入隐私安全档且浏览器与导出共用映射', async () => {
  const { calculateMosaicGrid } = await import(
    '../eagle-plugin/modules/vendor/gravity-privacy-editor/1.1.0/mosaic.js'
  );
  assert.deepEqual(calculateMosaicGrid(88, 42, 12), { width: 8, height: 4, strength: 12 });
  assert.deepEqual(calculateMosaicGrid(88, 42, 22), { width: 4, height: 2, strength: 22 });
  assert.deepEqual(calculateMosaicGrid(88, 42, 23), { width: 3, height: 1, strength: 23 });
  assert.deepEqual(calculateMosaicGrid(88, 42, 24), { width: 2, height: 1, strength: 24 });
  assert.deepEqual(calculateMosaicGrid(80, 80, 24), { width: 2, height: 2, strength: 24 });

  const rendererSource = fs.readFileSync(
    path.join(vendorRoot, '1.1.0/renderer.js'),
    'utf8'
  );
  const nodeSource = fs.readFileSync(
    path.join(vendorRoot, '1.1.0/node.cjs'),
    'utf8'
  );
  assert.match(rendererSource, /calculateMosaicGrid\(destinationRect\.width, destinationRect\.height, intensity\)/);
  assert.match(nodeSource, /calculateMosaicGrid\(item\.width, item\.height, intensity\)/);
  assert.match(nodeSource, /effectPatch\(base, item, normalized\.effectType, normalized\.intensity\)/);
  assert.doesNotMatch(nodeSource, /\bimport\s*\(/);

  for (const [width, height] of [[1, 1], [88, 42], [80, 80], [120, 2048], [4096, 120]]) {
    for (let intensity = 2; intensity <= 24; intensity += 1) {
      assert.deepEqual(
        privacyNode.calculateMosaicGrid(width, height, intensity),
        calculateMosaicGrid(width, height, intensity),
        `浏览器与 Node 马赛克网格不一致：${width}x${height}，强度 ${intensity}`
      );
    }
  }
});

test('隐私选区支持八方向自由缩放且严格限制在图片范围内', async () => {
  const { movePrivacyRect, resizePrivacyRect } = await import(
    '../eagle-plugin/modules/vendor/gravity-privacy-editor/1.1.0/renderer.js'
  );
  const rect = { x: 30, y: 40, width: 100, height: 80 };
  assert.deepEqual(
    movePrivacyRect(rect, 24, 18, { width: 200, height: 160 }),
    { x: 54, y: 58, width: 100, height: 80 }
  );
  assert.deepEqual(
    movePrivacyRect(rect, 500, 500, { width: 200, height: 160 }),
    { x: 100, y: 80, width: 100, height: 80 }
  );
  assert.deepEqual(
    movePrivacyRect(rect, -500, -500, { width: 200, height: 160 }),
    { x: 0, y: 0, width: 100, height: 80 }
  );
  assert.deepEqual(
    resizePrivacyRect(rect, 'nw', -20, -15, { width: 200, height: 160 }),
    { x: 10, y: 25, width: 120, height: 95 }
  );
  assert.deepEqual(
    resizePrivacyRect(rect, 'e', 90, 0, { width: 180, height: 160 }),
    { x: 30, y: 40, width: 150, height: 80 }
  );
  assert.deepEqual(
    resizePrivacyRect(rect, 's', 0, 100, { width: 200, height: 140 }),
    { x: 30, y: 40, width: 100, height: 100 }
  );
  assert.deepEqual(
    resizePrivacyRect(rect, 'w', 200, 0, { width: 200, height: 160, minSize: 12 }),
    { x: 118, y: 40, width: 12, height: 80 }
  );

  const reactSource = fs.readFileSync(path.join(vendorRoot, '1.1.0/react.jsx'), 'utf8');
  assert.match(reactSource, /const RESIZE_HANDLES = Object\.freeze/);
  assert.equal((reactSource.match(/\["(?:nw|n|ne|e|se|s|sw|w)",/g) || []).length, 8);
  assert.match(reactSource, /displayScale = 1/);
  assert.match(reactSource, /window\.addEventListener\("pointermove", move, true\)/);
  assert.match(reactSource, /session\.mode === "move"\s*\?\s*movePrivacyRect/);
  assert.doesNotMatch(reactSource, /target\.addEventListener\("pointermove"/);

  const workspaceSource = fs.readFileSync(
    path.join(__dirname, '../privacy-app/EaglePrivacyWorkspace.jsx'),
    'utf8'
  );
  assert.match(workspaceSource, /setLayer\(\(current\) => \(\{/);
});

test('Eagle 隐私预览不会因图片已缓存而跳过模糊和马赛克画布', () => {
  const workspaceSource = fs.readFileSync(
    path.join(__dirname, '../privacy-app/EaglePrivacyWorkspace.jsx'),
    'utf8'
  );
  assert.match(workspaceSource, /const attachImageElement = useCallback/);
  assert.match(workspaceSource, /if \(image\.complete\) syncImageElement\(image\)/);
  assert.match(workspaceSource, /imageElement \|\| imageRef\.current/);
  assert.doesNotMatch(
    workspaceSource,
    /layer\.previewVisible && imageElement && layer\.items\.map/
  );
});

test('Sharp 最大强度马赛克只保留极少大色块且明显强于中档', async () => {
  const width = 120;
  const height = 60;
  const input = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      input[offset] = (x * 17 + y * 5) % 256;
      input[offset + 1] = (x * 7 + y * 19) % 256;
      input[offset + 2] = (x * 23 + y * 3) % 256;
    }
  }
  const source = await sharp(input, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const renderAt = async (intensity) => privacyNode.renderPrivacyBuffer(source, {
    layer: {
      effectType: 'pixelate',
      intensity,
      items: [{
        id: `privacy-${intensity}`,
        x: 10,
        y: 10,
        width: 100,
        height: 40,
        shape: 'rect',
        effectType: 'pixelate',
        intensity,
      }],
    },
  });
  const medium = await renderAt(12);
  const maximum = await renderAt(24);
  const uniqueColors = async (buffer) => {
    const pixels = await sharp(buffer).ensureAlpha().raw().toBuffer();
    const colors = new Set();
    for (let y = 10; y < 50; y += 1) {
      for (let x = 10; x < 110; x += 1) {
        colors.add(pixel(pixels, width, x, y).slice(0, 3).join(','));
      }
    }
    return colors.size;
  };
  const mediumColors = await uniqueColors(medium.buffer);
  const maximumColors = await uniqueColors(maximum.buffer);
  assert.ok(mediumColors >= 20, `中档应保留多个马赛克色块，实际 ${mediumColors}`);
  assert.ok(maximumColors <= 2, `24 档只能保留至多 2 个大色块，实际 ${maximumColors}`);
  assert.ok(maximumColors < mediumColors, '24 档必须明显强于 12 档');
});

test('Sharp 原分辨率渲染矩形和椭圆且椭圆外角不受影响', async () => {
  const width = 220;
  const height = 160;
  const input = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      input[offset] = (x * 7 + y * 3) % 256;
      input[offset + 1] = (x * 2 + y * 11) % 256;
      input[offset + 2] = (x * 13 + y * 5) % 256;
    }
  }
  const source = await sharp(input, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const result = await privacyNode.renderPrivacyBuffer(source, {
    layer: {
      effectType: 'blur',
      intensity: 9,
      items: [
        { id: 'rect', x: 18, y: 20, width: 70, height: 54, shape: 'rect', effectType: 'blur', intensity: 12 },
        { id: 'ellipse', x: 116, y: 50, width: 82, height: 72, shape: 'ellipse', effectType: 'pixelate', intensity: 18 },
      ],
    },
  });
  assert.equal(result.width, width);
  assert.equal(result.height, height);
  const rendered = await sharp(result.buffer).ensureAlpha().raw().toBuffer();
  const original = await sharp(source).ensureAlpha().raw().toBuffer();
  assert.notDeepEqual(pixel(rendered, width, 45, 45), pixel(original, width, 45, 45), '矩形中心应被模糊');
  let changedEllipsePixels = 0;
  for (let y = 70; y < 102; y += 1) {
    for (let x = 136; x < 178; x += 1) {
      if (pixel(rendered, width, x, y).some((value, index) => value !== pixel(original, width, x, y)[index])) {
        changedEllipsePixels += 1;
      }
    }
  }
  assert.ok(changedEllipsePixels > 500, '椭圆中心区域应大面积产生马赛克变化');
  assert.deepEqual(pixel(rendered, width, 117, 51), pixel(original, width, 117, 51), '椭圆包围盒左上角不应被修改');
});

test('完整导出按打码、文字、水印、编码执行且不修改原图', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'max-privacy-export-'));
  const inputPath = path.join(temporary, 'source.png');
  const outputPath = path.join(temporary, 'result.jpg');
  await sharp({
    create: {
      width: 640,
      height: 420,
      channels: 3,
      background: { r: 224, g: 214, b: 198 },
    },
  }).png().toFile(inputPath);
  const originalHash = sha256(inputPath);
  const metadata = await renderPrivacyEdited(inputPath, outputPath, {
    format: 'jpg',
    quality: 92,
    privacyLayer: {
      effectType: 'blur',
      intensity: 10,
      items: [
        { id: 'privacy', x: 60, y: 80, width: 180, height: 120, shape: 'ellipse', effectType: 'pixelate', intensity: 16 },
      ],
    },
    annotations: [{
      id: 'note',
      text: '辅助说明',
      x: 250,
      y: 150,
      fontSize: 54,
      fontFamily: 'Arial',
      fontFace: 'Arial',
      fontWeight: 700,
      fontStyle: 'normal',
      letterSpacing: 0,
      lineSpacing: 1.2,
      textAlign: 'left',
      color: '#ef4444',
      opacity: 1,
      strokeColor: '#ffffff',
      strokeWidth: 2,
      shadowEnabled: true,
      shadowColor: '#000000',
      shadowOpacity: 0.45,
      shadowOffset: 2,
      shadowRadius: 8,
      shadowAngle: 45,
      rotation: 0,
    }],
    watermark: {
      enabled: true,
      type: 'text',
      text: 'WATERMARK',
      fontFamily: 'Arial',
      fontFace: 'Arial',
      fontWeight: 700,
      color: '#111111',
      opacity: 0.8,
      scaleMode: 'single',
      scale: 0.12,
      position: 'bottom-right',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      shadowEnabled: false,
    },
  });
  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(sha256(inputPath), originalHash, '原图不得被改写');
  assert.equal(metadata.width, 640);
  assert.equal(metadata.height, 420);
  const output = await sharp(outputPath).metadata();
  assert.equal(output.width, 640);
  assert.equal(output.height, 420);
  assert.notEqual(sha256(outputPath), originalHash);
});

test('隐私页没有项目持久化接口，快速导出只处理当前预览图', () => {
  const workspace = fs.readFileSync(path.join(__dirname, '../privacy-app/EaglePrivacyWorkspace.jsx'), 'utf8');
  const adapter = fs.readFileSync(path.join(pluginRoot, 'adapters/eagle/plugin.js'), 'utf8');
  assert.doesNotMatch(workspace, /localStorage|savePrivacyProject|loadPrivacyProject|projectFile/i);
  assert.doesNotMatch(adapter, /savePrivacyProject|loadPrivacyProject|privacyProject|privacyStatePath/i);
  assert.match(workspace, /setItemCount\(currentItem \? 1 : 0\)/);
  assert.match(adapter, /suffix: '-打码'/);
});
