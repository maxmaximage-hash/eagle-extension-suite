import { calculateMosaicGrid } from "./mosaic.js";

export function intersectPrivacyRects(rect, clipRect) {
  if (!rect || !clipRect) return null;
  const left = Math.max(rect.x, clipRect.x);
  const top = Math.max(rect.y, clipRect.y);
  const right = Math.min(rect.x + rect.width, clipRect.x + clipRect.width);
  const bottom = Math.min(rect.y + rect.height, clipRect.y + clipRect.height);
  if (right <= left || bottom <= top) return null;
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export function clampPrivacyRect(rect, {
  width = 430,
  height = 932,
  minSize = 12,
} = {}) {
  const x = Math.max(0, Math.min(width, Number(rect?.x) || 0));
  const y = Math.max(0, Math.min(height, Number(rect?.y) || 0));
  return {
    x,
    y,
    width: Math.max(minSize, Math.min(width - x, Number(rect?.width) || minSize)),
    height: Math.max(minSize, Math.min(height - y, Number(rect?.height) || minSize)),
  };
}

export function movePrivacyRect(rect, deltaX, deltaY, {
  width = 430,
  height = 932,
} = {}) {
  const rectWidth = Math.max(0, Math.min(width, Number(rect?.width) || 0));
  const rectHeight = Math.max(0, Math.min(height, Number(rect?.height) || 0));
  const originX = Math.max(0, Math.min(width - rectWidth, Number(rect?.x) || 0));
  const originY = Math.max(0, Math.min(height - rectHeight, Number(rect?.y) || 0));
  return {
    x: Math.max(0, Math.min(width - rectWidth, originX + (Number(deltaX) || 0))),
    y: Math.max(0, Math.min(height - rectHeight, originY + (Number(deltaY) || 0))),
    width: rectWidth,
    height: rectHeight,
  };
}

export function resizePrivacyRect(rect, direction, deltaX, deltaY, {
  width = 430,
  height = 932,
  minSize = 12,
} = {}) {
  const left = Math.max(0, Math.min(width, Number(rect?.x) || 0));
  const top = Math.max(0, Math.min(height, Number(rect?.y) || 0));
  const right = Math.max(left + minSize, Math.min(width, left + (Number(rect?.width) || minSize)));
  const bottom = Math.max(top + minSize, Math.min(height, top + (Number(rect?.height) || minSize)));
  const horizontalDelta = Number(deltaX) || 0;
  const verticalDelta = Number(deltaY) || 0;
  let nextLeft = left;
  let nextTop = top;
  let nextRight = right;
  let nextBottom = bottom;

  if (direction.includes("w")) {
    nextLeft = Math.max(0, Math.min(right - minSize, left + horizontalDelta));
  }
  if (direction.includes("e")) {
    nextRight = Math.min(width, Math.max(left + minSize, right + horizontalDelta));
  }
  if (direction.includes("n")) {
    nextTop = Math.max(0, Math.min(bottom - minSize, top + verticalDelta));
  }
  if (direction.includes("s")) {
    nextBottom = Math.min(height, Math.max(top + minSize, bottom + verticalDelta));
  }

  return {
    x: nextLeft,
    y: nextTop,
    width: nextRight - nextLeft,
    height: nextBottom - nextTop,
  };
}

export function logicalRectForElement(target, element, {
  width = 430,
  height = 932,
  minSize = 12,
  padding = 0,
} = {}) {
  if (!target || !element) return null;
  const targetRect = target.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const scaleX = width / Math.max(1, targetRect.width);
  const scaleY = height / Math.max(1, targetRect.height);
  const rawX = (elementRect.left - targetRect.left) * scaleX - padding;
  const rawY = (elementRect.top - targetRect.top) * scaleY - padding;
  const x = Math.max(0, Math.min(width, rawX));
  const y = Math.max(0, Math.min(height, rawY));
  return {
    x,
    y,
    width: Math.max(minSize, Math.min(width - x, elementRect.width * scaleX + padding * 2)),
    height: Math.max(minSize, Math.min(height - y, elementRect.height * scaleY + padding * 2)),
  };
}

function clipPrivacyShape(context, destinationRect, shape = "rect") {
  context.beginPath();
  if (shape === "ellipse") {
    context.ellipse(
      destinationRect.x + destinationRect.width / 2,
      destinationRect.y + destinationRect.height / 2,
      destinationRect.width / 2,
      destinationRect.height / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else {
    context.rect(destinationRect.x, destinationRect.y, destinationRect.width, destinationRect.height);
  }
  context.clip();
}

export function drawPixelatedRegion(context, source, sourceRect, destinationRect, intensity, shape = "rect") {
  const grid = calculateMosaicGrid(destinationRect.width, destinationRect.height, intensity);
  const smallWidth = grid.width;
  const smallHeight = grid.height;
  const buffer = document.createElement("canvas");
  buffer.width = smallWidth;
  buffer.height = smallHeight;
  const bufferContext = buffer.getContext("2d");
  if (!bufferContext) return;
  bufferContext.imageSmoothingEnabled = true;
  bufferContext.drawImage(
    source,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    smallWidth,
    smallHeight,
  );
  context.save();
  clipPrivacyShape(context, destinationRect, shape);
  context.imageSmoothingEnabled = false;
  context.drawImage(
    buffer,
    0,
    0,
    smallWidth,
    smallHeight,
    destinationRect.x,
    destinationRect.y,
    destinationRect.width,
    destinationRect.height,
  );
  context.restore();
}

export function drawBlurredRegion(context, source, sourceRect, destinationRect, intensity, shape = "rect") {
  const strength = Math.max(2, Math.min(24, Number(intensity) || 2));
  const progress = (strength - 2) / 22;
  const resolutionRatio = Math.max(
    1 / Math.max(destinationRect.width, destinationRect.height),
    (1 - progress) ** 2,
  );
  const smallWidth = Math.max(1, Math.round(destinationRect.width * resolutionRatio));
  const smallHeight = Math.max(1, Math.round(destinationRect.height * resolutionRatio));
  const buffer = document.createElement("canvas");
  buffer.width = smallWidth;
  buffer.height = smallHeight;
  const bufferContext = buffer.getContext("2d");
  if (!bufferContext) return;
  bufferContext.imageSmoothingEnabled = true;
  bufferContext.imageSmoothingQuality = "high";
  bufferContext.drawImage(
    source,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    smallWidth,
    smallHeight,
  );

  if (strength >= 22) {
    const averageBuffer = document.createElement("canvas");
    averageBuffer.width = 1;
    averageBuffer.height = 1;
    const averageContext = averageBuffer.getContext("2d", { willReadFrequently: true });
    if (!averageContext) return;
    averageContext.imageSmoothingEnabled = true;
    averageContext.imageSmoothingQuality = "high";
    averageContext.drawImage(
      source,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      0,
      0,
      1,
      1,
    );
    let averageColor = "rgba(127, 127, 127, 1)";
    try {
      const [red, green, blue, alpha] = averageContext.getImageData(0, 0, 1, 1).data;
      averageColor = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
    } catch {
      // Keep the opaque fallback if a future external source taints the browser canvas.
    }
    context.save();
    clipPrivacyShape(context, destinationRect, shape);
    context.fillStyle = averageColor;
    context.fillRect(
      destinationRect.x,
      destinationRect.y,
      destinationRect.width,
      destinationRect.height,
    );
    context.restore();
    return;
  }

  const blurRadius = Math.min(7, 1.5 + (strength * .22));
  const padding = Math.ceil(blurRadius * 2);
  context.save();
  clipPrivacyShape(context, destinationRect, shape);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = `blur(${blurRadius}px)`;
  context.drawImage(
    buffer,
    0,
    0,
    smallWidth,
    smallHeight,
    destinationRect.x - padding,
    destinationRect.y - padding,
    destinationRect.width + (padding * 2),
    destinationRect.height + (padding * 2),
  );
  context.restore();
}

export function drawPrivacyEffect(context, source, {
  sourceRect,
  destinationRect,
  effectType = "blur",
  intensity = 12,
  shape = "rect",
} = {}) {
  if (!context || !source || !sourceRect || !destinationRect) return;
  if (effectType === "pixelate") {
    drawPixelatedRegion(context, source, sourceRect, destinationRect, intensity, shape);
  } else {
    drawBlurredRegion(context, source, sourceRect, destinationRect, intensity, shape);
  }
}
