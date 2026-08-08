'use strict';

const sharp = require('sharp');

const EFFECT_TYPES = new Set(['blur', 'pixelate']);
const SHAPES = new Set(['rect', 'ellipse']);
const HIGH_INTENSITY_LONG_EDGE_CELLS = Object.freeze({
  15: 10,
  16: 9,
  17: 8,
  18: 7,
  19: 6,
  20: 5,
  21: 4,
  22: 4,
  23: 3,
  24: 2
});

function positiveDimension(value) {
  return Math.max(1, Math.round(Number(value) || 1));
}

function normalizeMosaicIntensity(intensity) {
  return Math.max(2, Math.min(24, Math.round(Number(intensity) || 2)));
}

function calculateMosaicGrid(width, height, intensity) {
  const regionWidth = positiveDimension(width);
  const regionHeight = positiveDimension(height);
  const strength = normalizeMosaicIntensity(intensity);
  const blockSize = Math.max(4, strength);
  const blockGridWidth = Math.max(1, Math.ceil(regionWidth / blockSize));
  const blockGridHeight = Math.max(1, Math.ceil(regionHeight / blockSize));
  const targetLongEdge = HIGH_INTENSITY_LONG_EDGE_CELLS[strength];

  if (!targetLongEdge) {
    return {
      width: blockGridWidth,
      height: blockGridHeight,
      strength
    };
  }

  const landscape = regionWidth >= regionHeight;
  const longEdge = landscape ? regionWidth : regionHeight;
  const shortEdge = landscape ? regionHeight : regionWidth;
  const targetShortEdge = Math.max(1, Math.round(targetLongEdge * shortEdge / longEdge));
  const targetWidth = landscape ? targetLongEdge : targetShortEdge;
  const targetHeight = landscape ? targetShortEdge : targetLongEdge;

  return {
    width: Math.max(1, Math.min(blockGridWidth, targetWidth)),
    height: Math.max(1, Math.min(blockGridHeight, targetHeight)),
    strength
  };
}

function clamp(value, min, max, fallback = min) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizeItem(item, index, width, height) {
  const x = Math.round(clamp(item && item.x, 0, width, 0));
  const y = Math.round(clamp(item && item.y, 0, height, 0));
  const itemWidth = Math.round(clamp(item && item.width, 1, width - x, 1));
  const itemHeight = Math.round(clamp(item && item.height, 1, height - y, 1));
  return {
    id: String((item && item.id) || `privacy-${index + 1}`),
    x,
    y,
    width: itemWidth,
    height: itemHeight,
    shape: SHAPES.has(item && item.shape) ? item.shape : 'rect',
    order: Number.isFinite(Number(item && item.order)) ? Number(item.order) : index
  };
}

function normalizeLayer(layer, width, height) {
  const source = layer && typeof layer === 'object' ? layer : {};
  const normalized = {
    previewVisible: source.previewVisible !== false,
    effectType: EFFECT_TYPES.has(source.effectType) ? source.effectType : 'blur',
    intensity: clamp(source.intensity, 2, 24, 12),
    items: []
  };
  normalized.items = Array.isArray(source.items)
    ? source.items
      .map((item, index) => normalizeItem(item, index, width, height))
      .filter((item) => item.width > 0 && item.height > 0)
      .sort((left, right) => left.order - right.order)
    : [];
  return normalized;
}

async function ellipseMask(width, height) {
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="#fff"/></svg>`
  );
  return sharp(svg).png().toBuffer();
}

async function effectPatch(base, item, effectType, intensity) {
  const source = sharp(base.data, { raw: base.info })
    .extract({ left: item.x, top: item.y, width: item.width, height: item.height })
    .ensureAlpha();
  let buffer;
  if (effectType === 'pixelate') {
    const grid = calculateMosaicGrid(item.width, item.height, intensity);
    const extracted = await source.png().toBuffer();
    const reduced = await sharp(extracted)
      .resize({
        width: grid.width,
        height: grid.height,
        kernel: sharp.kernel.cubic
      })
      .png()
      .toBuffer();
    buffer = await sharp(reduced)
      .resize({ width: item.width, height: item.height, kernel: sharp.kernel.nearest });
  } else if (intensity >= 22) {
    const reduced = await source
      .resize({ width: 1, height: 1, kernel: sharp.kernel.cubic })
      .png()
      .toBuffer();
    buffer = sharp(reduced)
      .resize({ width: item.width, height: item.height, kernel: sharp.kernel.nearest });
  } else {
    buffer = source.blur(Math.max(0.6, intensity * 0.34));
  }
  buffer = await buffer.png().toBuffer();
  if (item.shape === 'ellipse') {
    buffer = await sharp(buffer)
      .composite([{ input: await ellipseMask(item.width, item.height), blend: 'dest-in' }])
      .png()
      .toBuffer();
  }
  return { input: buffer, left: item.x, top: item.y };
}

async function renderPrivacyBuffer(input, { layer } = {}) {
  const base = await sharp(input)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const normalized = normalizeLayer(layer, base.info.width, base.info.height);
  const overlays = [];
  for (const item of normalized.items) {
    overlays.push(await effectPatch(base, item, normalized.effectType, normalized.intensity));
  }
  const buffer = overlays.length
    ? await sharp(base.data, { raw: base.info }).composite(overlays).png().toBuffer()
    : await sharp(base.data, { raw: base.info }).png().toBuffer();
  return { buffer, width: base.info.width, height: base.info.height, layer: normalized };
}

module.exports = Object.freeze({
  version: '1.1.0',
  calculateMosaicGrid,
  normalizeLayer,
  renderPrivacyBuffer
});
