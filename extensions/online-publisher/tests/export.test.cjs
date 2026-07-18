const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sharp = require('../eagle-plugin/node_modules/sharp');
const { Publisher } = require('../eagle-plugin/lib/publisher.js');
const { renderWatermarked, resolveFontFile } = require('../eagle-plugin/modules/watermark-editor/renderer.js');

async function createPhoto(file, width = 900, height = 1200) {
  const pixels = crypto.randomBytes(width * height * 3);
  await sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 94 })
    .toFile(file);
}

test('本地导出不设置最大宽度时保留原始分辨率', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'max-export-size-'));
  const input = path.join(directory, 'input.jpg');
  const output = path.join(directory, 'output.jpg');
  await createPhoto(input);
  await renderWatermarked(input, output, {
    maxWidth: 0,
    quality: 100,
    format: 'jpg',
    watermark: { enabled: false }
  });
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 900);
  assert.equal(metadata.height, 1200);
});

test('限制文件大小会把 JPEG 成品压到目标以内', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'max-export-limit-'));
  const input = path.join(directory, 'input.jpg');
  const output = path.join(directory, 'output.jpg');
  await createPhoto(input);
  await renderWatermarked(input, output, {
    maxWidth: 0,
    quality: 100,
    maxFileSizeMb: 0.2,
    format: 'jpg',
    watermark: { enabled: false }
  });
  assert.ok(fs.statSync(output).size <= 0.2 * 1_000_000);
});

test('同名文件可以选择生成新文件名或覆盖', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'max-export-collision-'));
  const input = path.join(directory, 'input.jpg');
  await createPhoto(input, 300, 400);
  const item = { id: 'photo-1', name: '示例照片', ext: 'jpg', filePath: input };
  const publisher = new Publisher({
    eagleApi: { item: { getSelected: async () => [item] } },
    getConfig: () => ({}),
    onStatus: () => {}
  });
  const options = {
    items: [item],
    format: 'jpg',
    maxWidth: 0,
    quality: 90,
    suffix: '-watermarked',
    watermark: { enabled: false }
  };

  const first = await publisher.exportSelected(directory, { ...options, collisionMode: 'rename' });
  const second = await publisher.exportSelected(directory, { ...options, collisionMode: 'rename' });
  assert.notEqual(first[0].outputPath, second[0].outputPath);
  assert.match(second[0].outputPath, /-watermarked-2\.jpg$/);
  assert.ok(fs.existsSync(first[0].outputPath));
  assert.ok(fs.existsSync(second[0].outputPath));

  const overwrite = await publisher.exportSelected(directory, { ...options, collisionMode: 'overwrite' });
  assert.equal(overwrite[0].outputPath, first[0].outputPath);
  assert.ok(fs.existsSync(overwrite[0].outputPath));
});

test('按质量导出时不会同时套用文件大小限制', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'max-export-mode-'));
  const input = path.join(directory, 'input.jpg');
  await createPhoto(input, 600, 800);
  const item = { id: 'photo-mode', name: '导出方式', ext: 'jpg', filePath: input };
  const publisher = new Publisher({
    eagleApi: { item: { getSelected: async () => [item] } },
    getConfig: () => ({}),
    onStatus: () => {}
  });
  const [result] = await publisher.exportSelected(directory, {
    items: [item],
    format: 'jpg',
    compressionMode: 'quality',
    quality: 100,
    maxFileSizeMb: 0.01,
    suffix: '-quality',
    collisionMode: 'rename',
    watermark: { enabled: false }
  });
  assert.equal(result.ok, true);
  assert.ok(fs.statSync(result.outputPath).size > 0.01 * 1024 * 1024);
  assert.ok(fs.statSync(result.outputPath).size <= fs.statSync(input).size);
  const [inputMetadata, outputMetadata] = await Promise.all([
    sharp(input).rotate().metadata(),
    sharp(result.outputPath).metadata()
  ]);
  const orientedInputWidth = [5, 6, 7, 8].includes(inputMetadata.orientation)
    ? inputMetadata.height
    : inputMetadata.width;
  const orientedInputHeight = [5, 6, 7, 8].includes(inputMetadata.orientation)
    ? inputMetadata.width
    : inputMetadata.height;
  assert.equal(outputMetadata.width, orientedInputWidth);
  assert.equal(outputMetadata.height, orientedInputHeight);
});

test('真实导出可以定位所选 Mac 字体文件', () => {
  const resolved = resolveFontFile({
    fontFamily: 'Arial',
    fontFace: 'Arial'
  });
  if (process.platform === 'darwin') {
    assert.match(resolved, /Arial\.ttf$/);
    assert.equal(fs.existsSync(resolved), true);
  }
});
