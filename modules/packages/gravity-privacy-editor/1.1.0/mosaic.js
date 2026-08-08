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
  24: 2,
});

function positiveDimension(value) {
  return Math.max(1, Math.round(Number(value) || 1));
}

export function normalizeMosaicIntensity(intensity) {
  return Math.max(2, Math.min(24, Math.round(Number(intensity) || 2)));
}

export function calculateMosaicGrid(width, height, intensity) {
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
      strength,
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
    strength,
  };
}
