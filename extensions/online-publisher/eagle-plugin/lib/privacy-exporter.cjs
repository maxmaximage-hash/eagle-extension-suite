'use strict';

const fs = require('fs');
const sharp = require('sharp');
const privacyRenderer = require('../modules/vendor/gravity-privacy-editor/1.1.0/node.cjs');
const {
  encodeRenderedBuffer,
  renderWatermarkLayer,
  textMark
} = require('../modules/watermark-editor/renderer.js');

function clamp(value, min, max, fallback = min) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

async function fitOverlay(input, left, top, canvasWidth, canvasHeight) {
  const metadata = await sharp(input).metadata();
  const destinationLeft = Math.max(0, Math.round(left));
  const destinationTop = Math.max(0, Math.round(top));
  const sourceLeft = Math.max(0, Math.round(-left));
  const sourceTop = Math.max(0, Math.round(-top));
  const width = Math.min(metadata.width - sourceLeft, canvasWidth - destinationLeft);
  const height = Math.min(metadata.height - sourceTop, canvasHeight - destinationTop);
  if (width <= 0 || height <= 0) return null;
  if (!sourceLeft && !sourceTop && width === metadata.width && height === metadata.height) {
    return { input, left: destinationLeft, top: destinationTop };
  }
  return {
    input: await sharp(input)
      .extract({ left: sourceLeft, top: sourceTop, width, height })
      .png()
      .toBuffer(),
    left: destinationLeft,
    top: destinationTop
  };
}

async function annotationOverlay(annotation, canvasWidth, canvasHeight) {
  const text = String(annotation && annotation.text != null ? annotation.text : '');
  if (!text) return null;
  const fontSize = clamp(annotation.fontSize, 10, Math.max(10, canvasWidth), Math.max(22, canvasWidth * 0.04));
  const mark = await textMark({
    type: 'text',
    text,
    scale: fontSize * 3 / canvasWidth,
    fontFamily: annotation.fontFamily || 'Arial',
    fontFace: annotation.fontFace || annotation.fontFamily || 'Arial',
    fontPostscriptName: annotation.fontPostscriptName || '',
    fontPath: annotation.fontPath || '',
    fontWeight: Number(annotation.fontWeight || 400),
    fontStyle: annotation.fontStyle || 'normal',
    letterSpacing: Number(annotation.letterSpacing || 0),
    lineSpacing: Number(annotation.lineSpacing || 1.28),
    textAlign: annotation.textAlign || 'left',
    color: annotation.color || '#ffffff',
    opacity: clamp(annotation.opacity, 0, 1, 1),
    strokeColor: annotation.strokeColor || '#000000',
    strokeWidth: clamp(annotation.strokeWidth, 0, 24, 0),
    shadowEnabled: annotation.shadowEnabled === true,
    shadowColor: annotation.shadowColor || '#000000',
    shadowOpacity: clamp(annotation.shadowOpacity, 0, 1, 0.45),
    shadowOffset: clamp(annotation.shadowOffset, 0, 40, 2),
    shadowRadius: clamp(annotation.shadowRadius, 0, 100, 12),
    shadowAngle: clamp(annotation.shadowAngle, -180, 180, 45)
  }, canvasWidth);
  const rotation = Number(annotation.rotation || 0);
  const rotated = rotation
    ? await sharp(mark).rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    : mark;
  return fitOverlay(
    rotated,
    Number(annotation.x || 0),
    Number(annotation.y || 0),
    canvasWidth,
    canvasHeight
  );
}

async function renderPrivacyEdited(inputPath, outputPath, options = {}) {
  if (!inputPath || !fs.existsSync(inputPath)) throw new Error('原图文件不存在');
  const privacy = await privacyRenderer.renderPrivacyBuffer(inputPath, { layer: options.privacyLayer });
  const overlays = [];
  for (const annotation of options.annotations || []) {
    const overlay = await annotationOverlay(annotation, privacy.width, privacy.height);
    if (overlay) overlays.push(overlay);
  }
  if (options.watermark && options.watermark.enabled !== false) {
    const watermarkLayer = await renderWatermarkLayer(options.watermark, privacy.width, privacy.height);
    overlays.push({ input: watermarkLayer, left: 0, top: 0 });
  }
  const composited = overlays.length
    ? await sharp(privacy.buffer).composite(overlays).png().toBuffer()
    : privacy.buffer;
  return encodeRenderedBuffer(composited, outputPath, options);
}

module.exports = Object.freeze({
  renderPrivacyEdited,
  annotationOverlay
});
