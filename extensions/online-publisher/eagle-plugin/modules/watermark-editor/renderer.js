const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const fontkit = require('fontkit');
const { normalizeWatermark } = require('./schema.js');

const openedFontCache = new Map();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function positionFor(position, canvasWidth, canvasHeight, markWidth, markHeight, marginX, marginY) {
  const horizontal = position.endsWith('left') ? marginX : position.endsWith('right') ? canvasWidth - markWidth - marginX : Math.round((canvasWidth - markWidth) / 2);
  const vertical = position.startsWith('top') ? marginY : position.startsWith('bottom') ? canvasHeight - markHeight - marginY : Math.round((canvasHeight - markHeight) / 2);
  return { left: horizontal, top: vertical };
}

function textAnchorFor(align) {
  if (align === 'left') return { x: '0', anchor: 'start' };
  if (align === 'right') return { x: '100%', anchor: 'end' };
  return { x: '50%', anchor: 'middle' };
}

function targetScale(settings) {
  return clamp(settings.scale || 0.12, 0.01, 0.8);
}

function shadowOffset(settings, canvasWidth) {
  const distance = Math.max(0, Number(settings.shadowOffset != null ? settings.shadowOffset : 1)) * Math.max(1, canvasWidth * 0.0012);
  const radians = Number(settings.shadowAngle != null ? settings.shadowAngle : -52) * Math.PI / 180;
  return {
    dx: Number((Math.cos(radians) * distance).toFixed(2)),
    dy: Number((Math.sin(radians) * distance).toFixed(2))
  };
}

function fontFamilyForSvg(settings) {
  const names = [
    settings.fontFace,
    settings.fontPostscriptName,
    settings.fontFamily,
    'Arial',
    'sans-serif'
  ].filter(Boolean);
  return [...new Set(names)].map((name) => name === 'sans-serif' ? name : `'${String(name).replace(/'/g, "\\'")}'`).join(', ');
}

function resolveFontFile(settings = {}) {
  if (settings.fontPath && fs.existsSync(settings.fontPath)) return settings.fontPath;
  const names = [
    settings.fontFace,
    settings.fontPostscriptName,
    settings.fontFamily
  ]
    .filter(Boolean)
    .map((name) => String(name).trim())
    .filter((name, index, values) => name && values.indexOf(name) === index);
  const directories = process.platform === 'darwin'
    ? [
      path.join(os.homedir(), 'Library', 'Fonts'),
      '/Library/Fonts',
      '/System/Library/Fonts',
      '/System/Library/Fonts/Supplemental'
    ]
    : [];
  for (const directory of directories) {
    for (const name of names) {
      for (const extension of ['.ttf', '.otf', '.ttc']) {
        const candidate = path.join(directory, `${name}${extension}`);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return '';
}

function exactFontForSettings(settings) {
  const fontFile = resolveFontFile(settings);
  if (!fontFile) return null;
  let opened = openedFontCache.get(fontFile);
  if (!opened) {
    opened = fontkit.openSync(fontFile);
    openedFontCache.set(fontFile, opened);
  }
  if (!opened) return null;
  if (!Array.isArray(opened.fonts) && opened.namedVariations && typeof opened.getVariation === 'function') {
    const normalizeVariationName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const expected = normalizeVariationName(settings.fontPostscriptName || settings.fontFace);
    const base = normalizeVariationName(opened.postscriptName || opened.fullName || opened.familyName);
    const suffix = expected.startsWith(base) ? expected.slice(base.length) : expected;
    const variationName = Object.keys(opened.namedVariations).find((name) => normalizeVariationName(name) === suffix)
      || (!suffix ? Object.keys(opened.namedVariations).find((name) => normalizeVariationName(name) === 'regular') : null);
    if (variationName) return opened.getVariation(variationName);
  }
  if (!Array.isArray(opened.fonts)) return opened;
  const selectedFaceNames = [settings.fontPostscriptName, settings.fontFace].filter(Boolean);
  const exactPostscriptFace = opened.fonts.find((font) => selectedFaceNames.includes(font.postscriptName));
  if (exactPostscriptFace) return exactPostscriptFace;
  const exactFullNameFace = opened.fonts.find((font) => selectedFaceNames.includes(font.fullName));
  if (exactFullNameFace) return exactFullNameFace;
  // A selected face that is not present as a static member must never fall
  // through to the first family member. Some macOS TTC files (for example
  // PingFangUI.ttc) expose CoreText-only variable instances that fontkit
  // cannot turn into glyph paths. Returning null intentionally switches the
  // shared renderer to its SVG text path, where the requested PostScript name
  // and weight remain intact for both preview and export.
  if (selectedFaceNames.length) return null;
  const familyFace = settings.fontFamily
    ? opened.fonts.find((font) => font.familyName === settings.fontFamily)
    : null;
  return familyFace || opened.fonts[0] || null;
}

function pathLayoutForLine(font, line, fontSize, letterSpacingPx) {
  const run = font.layout(line || ' ');
  const scale = fontSize / font.unitsPerEm;
  const glyphs = [];
  let cursor = 0;
  for (let index = 0; index < run.glyphs.length; index += 1) {
    const glyph = run.glyphs[index];
    const position = run.positions[index];
    glyphs.push({
      path: `<path d="${glyph.path.toSVG()}"/>`,
      x: cursor + Number(position.xOffset || 0) * scale,
      y: Number(position.yOffset || 0) * scale
    });
    cursor += Number(position.xAdvance || 0) * scale;
    if (index < run.glyphs.length - 1) cursor += letterSpacingPx;
  }
  return { glyphs, width: Math.max(0, cursor), scale };
}

function exactPathText(settings, lines, fontSize, letterSpacingPx, lineHeight, padding) {
  let font;
  try {
    font = exactFontForSettings(settings);
  } catch (error) {
    return null;
  }
  if (!font) return null;
  const layouts = lines.map((line) => pathLayoutForLine(font, line, fontSize, letterSpacingPx));
  const contentWidth = Math.max(fontSize * 2, ...layouts.map((layout) => layout.width));
  const ascent = Number(font.ascent || font.unitsPerEm * 0.8) * layouts[0].scale;
  const descent = Math.abs(Number(font.descent || -font.unitsPerEm * 0.2)) * layouts[0].scale;
  const width = Math.ceil(contentWidth + padding * 2);
  const height = Math.ceil(padding * 2 + ascent + descent + Math.max(0, lines.length - 1) * lineHeight);
  const align = settings.textAlign || 'center';
  const paths = layouts.map((layout, lineIndex) => {
    const startX = align === 'left'
      ? padding
      : align === 'right'
        ? width - padding - layout.width
        : (width - layout.width) / 2;
    const baseline = padding + ascent + lineIndex * lineHeight;
    return layout.glyphs.map((glyph) =>
      `<g transform="matrix(${layout.scale.toFixed(8)} 0 0 ${(-layout.scale).toFixed(8)} ${(startX + glyph.x).toFixed(3)} ${(baseline - glyph.y).toFixed(3)})">${glyph.path}</g>`
    ).join('');
  }).join('');
  return { width, height, paths, postscriptName: font.postscriptName };
}

async function resizedImageMark(settings, targetWidth, opacity) {
  const source = await sharp(settings.imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sourceData = source.data;
  const premultiplied = Buffer.alloc(sourceData.length);

  for (let index = 0; index < sourceData.length; index += 4) {
    const alpha = sourceData[index + 3] / 255;
    premultiplied[index] = Math.round(sourceData[index] * alpha);
    premultiplied[index + 1] = Math.round(sourceData[index + 1] * alpha);
    premultiplied[index + 2] = Math.round(sourceData[index + 2] * alpha);
    premultiplied[index + 3] = sourceData[index + 3];
  }

  const resized = await sharp(premultiplied, {
    raw: {
      width: source.info.width,
      height: source.info.height,
      channels: 4
    }
  })
    .resize({ width: targetWidth, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(resized.data.length);

  for (let index = 0; index < resized.data.length; index += 4) {
    const alpha = resized.data[index + 3];
    if (alpha > 0) {
      output[index] = Math.min(255, Math.round(resized.data[index] * 255 / alpha));
      output[index + 1] = Math.min(255, Math.round(resized.data[index + 1] * 255 / alpha));
      output[index + 2] = Math.min(255, Math.round(resized.data[index + 2] * 255 / alpha));
      output[index + 3] = Math.round(alpha * opacity);
      if (alpha <= 32 && Math.max(output[index], output[index + 1], output[index + 2]) <= 32) {
        output[index + 3] = 0;
      }
    }
  }

  return sharp(output, {
    raw: {
      width: resized.info.width,
      height: resized.info.height,
      channels: 4
    }
  })
    .png()
    .toBuffer();
}

function textMarkSvg(settings, canvasWidth) {
  const content = String(settings.text != null ? settings.text : '');
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const textScale = Number(settings.scale || 0.12) / 3;
  const fontSize = Math.max(14, Math.round(canvasWidth * clamp(textScale, 0.008, 0.25)));
  const finalFontSize = fontSize;
  const letterSpacing = clamp(settings.letterSpacing != null ? settings.letterSpacing : 0, -0.2, 0.8);
  const lineSpacing = clamp(settings.lineSpacing != null ? settings.lineSpacing : 1.28, 0.6, 3);
  const letterSpacingPx = Number((finalFontSize * letterSpacing).toFixed(2));
  const padding = Math.max(8, Math.round(fontSize * 0.65));
  const lineHeight = Math.round(finalFontSize * lineSpacing);
  const exactText = exactPathText(settings, lines, finalFontSize, letterSpacingPx, lineHeight, padding);
  const estimatedLineWidths = lines.map((line) => line.length * finalFontSize * 0.72 + Math.max(0, line.length - 1) * letterSpacingPx);
  const estimatedWidth = Math.max(finalFontSize * 2, Math.round(Math.max(0, ...estimatedLineWidths)));
  const width = exactText ? exactText.width : estimatedWidth + padding * 2;
  const height = exactText ? exactText.height : lineHeight * lines.length + padding * 2;
  const opacity = clamp(settings.opacity != null ? settings.opacity : 0.32, 0, 1);
  const align = textAnchorFor(settings.textAlign || 'center');
  const x = align.x === '0' ? padding : align.x === '100%' ? width - padding : '50%';
  const textSpans = lines.map((line, index) =>
    `<tspan x="${x}" y="${padding + finalFontSize + index * lineHeight}">${escapeXml(line || ' ')}</tspan>`
  ).join('');
  const shadow = shadowOffset(settings, canvasWidth);
  const shadowOpacity = clamp(settings.shadowOpacity != null ? settings.shadowOpacity : 0.55, 0, 1);
  const shadowColor = settings.shadowColor || '#000000';
  const shadowBlur = Math.max(0, Number(settings.shadowRadius != null ? settings.shadowRadius : 0)) / 8;
  const hasShadow = settings.shadowEnabled !== false;
  const strokeWidth = Math.max(0, Number(settings.strokeWidth || 0));
  const strokeAttributes = strokeWidth > 0
    ? ` stroke="${escapeXml(settings.strokeColor || '#000000')}" stroke-width="${strokeWidth}" paint-order="stroke fill" stroke-linejoin="round"`
    : '';
  const shadowFilter = hasShadow ? `
      <filter id="wmShadow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="${shadowBlur}" result="blur"/>
        <feOffset dx="${shadow.dx}" dy="${shadow.dy}" result="offsetBlur"/>
        <feFlood flood-color="${escapeXml(shadowColor)}" flood-opacity="${shadowOpacity}" result="shadowColor"/>
        <feComposite in="shadowColor" in2="offsetBlur" operator="in" result="shadow"/>
        <feMerge><feMergeNode in="shadow"/></feMerge>
      </filter>` : '';
  const fallbackFont = escapeXml(fontFamilyForSvg(settings));
  const mainShape = exactText
    ? `<g fill="${escapeXml(settings.color || '#ffffff')}" fill-opacity="${opacity}"${strokeAttributes}>${exactText.paths}</g>`
    : `<text text-anchor="${align.anchor}"
        font-family="${fallbackFont}"
        font-size="${finalFontSize}" font-weight="${Number(settings.fontWeight || 600)}"
        font-style="${escapeXml(settings.fontStyle || 'normal')}"
        letter-spacing="${letterSpacingPx}"
        fill="${escapeXml(settings.color || '#ffffff')}" fill-opacity="${opacity}"${strokeAttributes}>${textSpans}</text>`;
  const shadowText = hasShadow
    ? (exactText
      ? `<g fill="${escapeXml(shadowColor)}" filter="url(#wmShadow)">${exactText.paths}</g>`
      : `<text text-anchor="${align.anchor}"
          font-family="${fallbackFont}"
          font-size="${finalFontSize}" font-weight="${Number(settings.fontWeight || 600)}"
          font-style="${escapeXml(settings.fontStyle || 'normal')}"
          letter-spacing="${letterSpacingPx}"
          fill="${escapeXml(shadowColor)}" filter="url(#wmShadow)">${textSpans}</text>`)
    : '';
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>${shadowFilter}</defs>
      ${shadowText}
      ${mainShape}
    </svg>`;
  return { svg, width, height, exact: Boolean(exactText) };
}

async function textMark(settings, canvasWidth) {
  const mark = textMarkSvg(settings, canvasWidth);
  return sharp(Buffer.from(mark.svg)).png().toBuffer();
}

async function imageMark(settings, canvasWidth) {
  if (!settings.imagePath || !fs.existsSync(settings.imagePath)) {
    throw new Error('图片水印文件不存在');
  }
  const width = Math.max(24, Math.round(canvasWidth * targetScale(settings)));
  const opacity = clamp(settings.opacity != null ? settings.opacity : 0.32, 0, 1);
  return resizedImageMark(settings, width, opacity);
}

async function rotatedMark(mark, angle) {
  const normalized = Number(angle || 0);
  if (!normalized) return mark;
  return sharp(mark).rotate(normalized, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function markBuffer(settings, canvasWidth, angleOverride) {
  const mark = settings.type === 'image'
    ? await imageMark(settings, canvasWidth)
    : await textMark(settings, canvasWidth);
  const angle = angleOverride != null ? angleOverride : (settings.rotation != null ? settings.rotation : 0);
  return rotatedMark(mark, angle);
}

async function fitOverlay(input, left, top, canvasWidth, canvasHeight) {
  const meta = await sharp(input).metadata();
  const dstLeft = Math.max(0, Math.round(left));
  const dstTop = Math.max(0, Math.round(top));
  const srcLeft = Math.max(0, Math.round(-left));
  const srcTop = Math.max(0, Math.round(-top));
  const visibleWidth = Math.min(meta.width - srcLeft, canvasWidth - dstLeft);
  const visibleHeight = Math.min(meta.height - srcTop, canvasHeight - dstTop);
  if (visibleWidth <= 0 || visibleHeight <= 0) return null;
  if (srcLeft === 0 && srcTop === 0 && visibleWidth === meta.width && visibleHeight === meta.height) {
    return { input, left: dstLeft, top: dstTop };
  }
  const cropped = await sharp(input)
    .extract({ left: srcLeft, top: srcTop, width: visibleWidth, height: visibleHeight })
    .png()
    .toBuffer();
  return { input: cropped, left: dstLeft, top: dstTop };
}

async function overlaysFor(settings, width, height) {
  const normalized = normalizeWatermark(settings || {});
  if (!normalized.enabled) return [];
  if (normalized.type === 'image') {
    if (!normalized.imagePath || !fs.existsSync(normalized.imagePath)) return [];
  } else if (normalized.text.length === 0) {
    return [];
  }
  settings = normalized;
  const marginX = Math.round(width * 0.04);
  const marginY = Math.round(height * 0.04);
  const offsetX = Math.round(width * clamp(settings.offsetX || 0, -0.5, 0.5));
  const offsetY = Math.round(height * clamp(settings.offsetY || 0, -0.5, 0.5));

  if (settings.scaleMode === 'fill') {
    const density = clamp(settings.density != null ? settings.density : 7, 1, 10);
    const fillScale = clamp(settings.scale != null ? settings.scale : 0.12, 0.01, 0.8);
    const tileSettings = { ...settings, scaleMode: 'proportional', scale: fillScale };
    const input = await markBuffer(tileSettings, width);
    const meta = await sharp(input).metadata();
    const gapRatio = 0.19 - density * 0.014;
    const gapX = Math.max(18, Math.round(width * clamp(gapRatio, 0.045, 0.18)));
    const gapY = Math.max(18, Math.round(height * clamp(gapRatio, 0.045, 0.18)));
    const stepX = meta.width + gapX;
    const stepY = meta.height + gapY;
    const fillOffsetX = Math.round(width * clamp(settings.offsetX || 0, -0.5, 0.5));
    const fillOffsetY = Math.round(height * clamp(settings.offsetY || 0, -0.5, 0.5));
    const overlays = [];
    let row = 0;
    for (let top = -height * 0.35 + fillOffsetY; top < height * 1.35; top += stepY) {
      const stagger = row % 2 ? Math.round(stepX / 2) : 0;
      for (let left = -width * 0.35 + fillOffsetX + stagger; left < width * 1.35; left += stepX) {
        const overlay = await fitOverlay(input, left, top, width, height);
        if (overlay) overlays.push(overlay);
      }
      row += 1;
    }
    return overlays;
  }

  {
    const input = await markBuffer(settings, width);
    const meta = await sharp(input).metadata();
    const position = positionFor(settings.position || 'bottom-right', width, height, meta.width, meta.height, marginX, marginY);
    const overlay = await fitOverlay(input, position.left + offsetX, position.top + offsetY, width, height);
    return overlay ? [overlay] : [];
  }
}

async function renderWatermarkLayer(settings, width, height) {
  const canvasWidth = Math.max(1, Math.round(Number(width) || 1));
  const canvasHeight = Math.max(1, Math.round(Number(height) || 1));
  const overlays = await overlaysFor(settings, canvasWidth, canvasHeight);
  let pipeline = sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });
  if (overlays.length) pipeline = pipeline.composite(overlays);
  return pipeline.png().toBuffer();
}

async function renderWatermarkPreviewPayload(settings, width, height) {
  const canvasWidth = Math.max(1, Math.round(Number(width) || 1));
  const canvasHeight = Math.max(1, Math.round(Number(height) || 1));
  const overlays = await overlaysFor(settings, canvasWidth, canvasHeight);
  const assets = [];
  const assetIndex = new Map();
  const placements = [];
  for (const overlay of overlays) {
    const hash = crypto.createHash('sha1').update(overlay.input).digest('hex');
    let index = assetIndex.get(hash);
    if (index == null) {
      const metadata = await sharp(overlay.input).metadata();
      index = assets.length;
      assetIndex.set(hash, index);
      assets.push({
        width: metadata.width,
        height: metadata.height,
        dataUrl: `data:image/png;base64,${overlay.input.toString('base64')}`
      });
    }
    placements.push({ asset: index, left: overlay.left, top: overlay.top });
  }
  return { width: canvasWidth, height: canvasHeight, assets, placements };
}

function rotatedVectorMark(mark, angle) {
  const normalized = Number(angle || 0);
  if (!normalized) return mark;
  const radians = normalized * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const width = Math.ceil(mark.width * cosine + mark.height * sine);
  const height = Math.ceil(mark.width * sine + mark.height * cosine);
  const inner = mark.svg
    .replace(/^\s*<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
  return {
    ...mark,
    width,
    height,
    svg: `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${width / 2} ${height / 2}) rotate(${normalized}) translate(${-mark.width / 2} ${-mark.height / 2})">${inner}</g></svg>`
  };
}

async function renderWatermarkVectorPreviewPayload(settings, width, height) {
  const canvasWidth = Math.max(1, Math.round(Number(width) || 1));
  const canvasHeight = Math.max(1, Math.round(Number(height) || 1));
  settings = normalizeWatermark(settings || {});
  if (!settings || !settings.enabled || settings.type === 'image' || settings.scaleMode === 'fill') return null;
  if (String(settings.text != null ? settings.text : '').length === 0) {
    return { width: canvasWidth, height: canvasHeight, assets: [], placements: [], vector: true };
  }
  const mark = rotatedVectorMark(textMarkSvg(settings, canvasWidth), settings.rotation || 0);
  const marginX = Math.round(canvasWidth * 0.04);
  const marginY = Math.round(canvasHeight * 0.04);
  const offsetX = Math.round(canvasWidth * clamp(settings.offsetX || 0, -0.5, 0.5));
  const offsetY = Math.round(canvasHeight * clamp(settings.offsetY || 0, -0.5, 0.5));
  const position = positionFor(
    settings.position || 'bottom-right',
    canvasWidth,
    canvasHeight,
    mark.width,
    mark.height,
    marginX,
    marginY
  );
  return {
    width: canvasWidth,
    height: canvasHeight,
    vector: true,
    assets: [{
      width: mark.width,
      height: mark.height,
      dataUrl: `data:image/svg+xml;base64,${Buffer.from(mark.svg).toString('base64')}`
    }],
    placements: [{ asset: 0, left: position.left + offsetX, top: position.top + offsetY }]
  };
}

async function encodeRenderedBuffer(input, outputPath, options = {}) {
  const format = (options.format || path.extname(outputPath).slice(1) || 'jpg').toLowerCase();
  const quality = clamp(options.quality != null ? options.quality : 88, 1, 100);
  const base = await sharp(input).rotate().toBuffer({ resolveWithObject: true });
  const encode = (nextQuality, resizeWidth = 0) => {
    let pipeline = sharp(base.data);
    if (resizeWidth > 0) {
      pipeline = pipeline.resize({ width: resizeWidth, withoutEnlargement: true });
    }
    pipeline = pipeline.withMetadata({ orientation: undefined });
    if (format === 'webp') pipeline = pipeline.webp({ quality: nextQuality, effort: 4 });
    else if (format === 'png') pipeline = pipeline.png({ compressionLevel: 9 });
    else pipeline = pipeline.jpeg({
      quality: nextQuality,
      mozjpeg: false,
      chromaSubsampling: '4:2:0',
      optimizeCoding: true
    });
    return pipeline.toBuffer();
  };
  const bestEncodingWithinLimit = async (limitBytes, resizeWidth = 0) => {
    let low = 1;
    let high = quality;
    let best = null;
    while (low <= high) {
      const nextQuality = Math.floor((low + high) / 2);
      const attempt = await encode(nextQuality, resizeWidth);
      if (attempt.length <= limitBytes) {
        best = attempt;
        low = nextQuality + 1;
      } else {
        high = nextQuality - 1;
      }
    }
    return best;
  };
  const requestedSizeBytes = Number(options.maxFileSizeMb || 0) > 0
    ? Math.floor(Number(options.maxFileSizeMb) * 1_000_000)
    : 0;
  const sourceSizeCapBytes = Number(options.maxOutputBytes || 0) > 0
    ? Math.floor(Number(options.maxOutputBytes))
    : 0;
  const maxBytes = requestedSizeBytes || sourceSizeCapBytes;
  let output = await encode(quality);
  if (maxBytes && output.length > maxBytes) {
    output = format === 'png' ? null : await bestEncodingWithinLimit(maxBytes);
    if (!output) {
      let nextWidth = base.info.width;
      while (!output && nextWidth > 320) {
        nextWidth = Math.max(320, Math.floor(nextWidth * 0.85));
        output = format === 'png'
          ? await encode(quality, nextWidth).then((attempt) => attempt.length <= maxBytes ? attempt : null)
          : await bestEncodingWithinLimit(maxBytes, nextWidth);
      }
    }
    if (!output) {
      const limitLabel = requestedSizeBytes
        ? `${options.maxFileSizeMb} MB`
        : `${Math.max(1, Math.floor(sourceSizeCapBytes / 1_000))} KB`;
      throw new Error(`无法在不超过 ${limitLabel} 的条件下完成导出`);
    }
  }
  if (maxBytes && output.length > maxBytes) {
    throw new Error(`导出结果超过硬性体积上限 ${maxBytes} bytes`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output);
  return sharp(outputPath).metadata();
}

async function renderWatermarked(inputPath, outputPath, options) {
  const maxWidth = Number(options.maxWidth || 0);
  let basePipeline = sharp(inputPath).rotate();
  if (maxWidth > 0) {
    basePipeline = basePipeline.resize({ width: Math.max(320, maxWidth), withoutEnlargement: true, fit: 'inside' });
  }
  const base = await basePipeline.toBuffer({ resolveWithObject: true });
  const watermarkLayer = await renderWatermarkLayer(options.watermark, base.info.width, base.info.height);
  const composited = await sharp(base.data)
    .composite([{ input: watermarkLayer, left: 0, top: 0 }])
    .png()
    .toBuffer();
  return encodeRenderedBuffer(composited, outputPath, options);
}

module.exports = { renderWatermarked, encodeRenderedBuffer, renderWatermarkLayer, renderWatermarkPreviewPayload, renderWatermarkVectorPreviewPayload, overlaysFor, positionFor, resolveFontFile, exactFontForSettings, textMark, textMarkSvg, escapeXml, clamp };
