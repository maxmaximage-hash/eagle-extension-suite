(function exposeWatermarkSchema(root, factory) {
  const api = factory();
  const isCommonJsModule = typeof module === 'object' && module.exports
    && typeof __filename === 'string' && /[\\/]schema\.js$/.test(__filename);
  if (isCommonJsModule) module.exports = api;
  if (root) root.GravityWatermarkSchema = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createWatermarkSchema() {
  const VERSION = 1;
  const TYPES = new Set(['text', 'image']);
  const POSITIONS = new Set([
    'top-left', 'top-center', 'top-right',
    'center-left', 'center', 'center-right',
    'bottom-left', 'bottom-center', 'bottom-right'
  ]);
  const ALIGNMENTS = new Set(['left', 'center', 'right']);
  const SCALE_MODES = new Set(['proportional', 'fill']);
  const FONT_STYLES = new Set(['normal', 'italic', 'oblique']);

  const DEFAULT_WATERMARK = Object.freeze({
    enabled: true,
    type: 'text',
    text: '',
    imagePath: '',
    position: 'bottom-right',
    textAlign: 'center',
    opacity: 0.32,
    scale: 0.12,
    scaleMode: 'proportional',
    fontFamily: 'Arial',
    fontFace: 'Arial',
    fontPostscriptName: '',
    fontPath: '',
    fontWeight: 600,
    fontStyle: 'normal',
    letterSpacing: 0,
    lineSpacing: 1.28,
    color: '#ffffff',
    rotation: 0,
    shadowEnabled: true,
    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowOffset: 1,
    shadowRadius: 25,
    shadowAngle: -52,
    density: 7,
    offsetX: 0,
    offsetY: 0
  });

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function string(value, fallback = '') {
    return value == null ? fallback : String(value);
  }

  function enumValue(value, allowed, fallback) {
    return allowed.has(value) ? value : fallback;
  }

  function color(value, fallback) {
    const next = string(value).trim();
    return /^#[0-9a-f]{6}$/i.test(next) ? next.toLowerCase() : fallback;
  }

  function normalizeWatermark(value = {}, options = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const type = enumValue(source.type, TYPES, DEFAULT_WATERMARK.type);
    const normalized = {
      enabled: source.enabled !== false,
      type,
      text: string(source.text),
      imagePath: type === 'image' ? string(source.imagePath) : '',
      position: enumValue(source.position, POSITIONS, DEFAULT_WATERMARK.position),
      textAlign: enumValue(source.textAlign, ALIGNMENTS, DEFAULT_WATERMARK.textAlign),
      opacity: clamp(source.opacity, 0, 1, DEFAULT_WATERMARK.opacity),
      scale: clamp(source.scale, 0.01, 0.8, DEFAULT_WATERMARK.scale),
      scaleMode: enumValue(source.scaleMode, SCALE_MODES, DEFAULT_WATERMARK.scaleMode),
      fontFamily: string(source.fontFamily, DEFAULT_WATERMARK.fontFamily) || DEFAULT_WATERMARK.fontFamily,
      fontFace: string(source.fontFace, DEFAULT_WATERMARK.fontFace) || DEFAULT_WATERMARK.fontFace,
      fontPostscriptName: string(source.fontPostscriptName),
      fontPath: string(source.fontPath),
      fontWeight: Math.round(clamp(source.fontWeight, 1, 1000, DEFAULT_WATERMARK.fontWeight)),
      fontStyle: enumValue(source.fontStyle, FONT_STYLES, DEFAULT_WATERMARK.fontStyle),
      letterSpacing: clamp(source.letterSpacing, -0.2, 0.8, DEFAULT_WATERMARK.letterSpacing),
      lineSpacing: clamp(source.lineSpacing, 0.6, 3, DEFAULT_WATERMARK.lineSpacing),
      color: color(source.color, DEFAULT_WATERMARK.color),
      rotation: clamp(source.rotation, -360, 360, DEFAULT_WATERMARK.rotation),
      shadowEnabled: source.shadowEnabled !== false,
      shadowColor: color(source.shadowColor, DEFAULT_WATERMARK.shadowColor),
      shadowOpacity: clamp(source.shadowOpacity, 0, 1, DEFAULT_WATERMARK.shadowOpacity),
      shadowOffset: clamp(source.shadowOffset, 0, 40, DEFAULT_WATERMARK.shadowOffset),
      shadowRadius: clamp(source.shadowRadius, 0, 100, DEFAULT_WATERMARK.shadowRadius),
      shadowAngle: clamp(source.shadowAngle, -180, 180, DEFAULT_WATERMARK.shadowAngle),
      density: Math.round(clamp(source.density, 1, 10, DEFAULT_WATERMARK.density)),
      offsetX: clamp(source.offsetX, -0.5, 0.5, DEFAULT_WATERMARK.offsetX),
      offsetY: clamp(source.offsetY, -0.5, 0.5, DEFAULT_WATERMARK.offsetY)
    };
    if (options.includePresetId && source.presetId) normalized.presetId = string(source.presetId);
    return normalized;
  }

  function canonicalWatermark(value) {
    return normalizeWatermark(value);
  }

  function emptyWatermark() {
    return normalizeWatermark(DEFAULT_WATERMARK);
  }

  function hasWatermarkContent(value) {
    const watermark = normalizeWatermark(value);
    return watermark.type === 'image'
      ? Boolean(watermark.imagePath)
      : watermark.text.length > 0;
  }

  return Object.freeze({
    VERSION,
    DEFAULT_WATERMARK,
    normalizeWatermark,
    canonicalWatermark,
    emptyWatermark,
    hasWatermarkContent
  });
}));
