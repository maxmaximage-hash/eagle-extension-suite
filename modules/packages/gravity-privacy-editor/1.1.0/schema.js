export const PRIVACY_EDITOR_VERSION = "1.1.0";
export const PRIVACY_EFFECT_TYPES = Object.freeze(["blur", "pixelate"]);
export const PRIVACY_SHAPES = Object.freeze(["rect", "ellipse"]);

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function createPrivacyId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `privacy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeSmartMasks(value, defaults = {}) {
  const source = value && typeof value === "object" ? value : {};
  const keys = new Set([...Object.keys(defaults || {}), ...Object.keys(source)]);
  return Object.fromEntries([...keys].map((key) => [key, Boolean(source[key] ?? defaults?.[key])]));
}

export function createPrivacyLayer({
  effectType = "blur",
  intensity = 12,
  previewVisible = true,
  smartMasks = {},
  items = [],
} = {}) {
  return {
    previewVisible: previewVisible !== false,
    effectType: PRIVACY_EFFECT_TYPES.includes(effectType) ? effectType : "blur",
    intensity: Math.max(2, Math.min(24, finiteNumber(intensity, 12))),
    smartMasks: normalizeSmartMasks(smartMasks),
    items: Array.isArray(items) ? items : [],
  };
}

export function normalizePrivacyItem(item = {}, index = 0, {
  width = 430,
  height = 932,
  minSize = 12,
  allowedAnchors = [],
  defaultAnchor = "screen",
  relativeAnchors = [],
} = {}) {
  const anchors = Array.isArray(allowedAnchors) ? allowedAnchors : [];
  const anchor = !anchors.length || anchors.includes(item.anchor) ? (item.anchor || defaultAnchor) : defaultAnchor;
  const relative = relativeAnchors.includes(anchor);
  const rawX = finiteNumber(item.x);
  const rawY = finiteNumber(item.y);
  const x = relative ? Math.max(-width, Math.min(width, rawX)) : Math.max(0, Math.min(width, rawX));
  const y = relative ? Math.max(-height, Math.min(height, rawY)) : Math.max(0, Math.min(height, rawY));
  return {
    id: item.id || createPrivacyId(),
    anchor,
    messageId: item.messageId || "",
    x,
    y,
    width: Math.max(minSize, Math.min(width, finiteNumber(item.width, 80))),
    height: Math.max(minSize, Math.min(height, finiteNumber(item.height, 40))),
    shape: PRIVACY_SHAPES.includes(item.shape) ? item.shape : "rect",
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
  };
}

export function normalizePrivacyLayer(value, options = {}) {
  const fallback = createPrivacyLayer(options);
  if (!value || typeof value !== "object") return fallback;
  const legacyItem = Array.isArray(value.items)
    ? value.items.find((item) => item && typeof item === "object")
    : null;
  const effectType = PRIVACY_EFFECT_TYPES.includes(value.effectType)
    ? value.effectType
    : legacyItem?.type === "pixelate"
      ? "pixelate"
      : fallback.effectType;
  const rawIntensity = finiteNumber(value.intensity ?? legacyItem?.intensity, fallback.intensity);
  return {
    previewVisible: value.previewVisible !== false,
    effectType,
    intensity: Math.max(2, Math.min(24, rawIntensity)),
    smartMasks: normalizeSmartMasks(value.smartMasks, options.smartMasks),
    items: Array.isArray(value.items)
      ? value.items
        .map((item, index) => normalizePrivacyItem(item, index, {
          ...options,
        }))
        .sort((left, right) => left.order - right.order)
      : [],
  };
}

export function privacyLayerHasMasks(layer) {
  return Boolean(
    layer?.items?.length
    || Object.values(layer?.smartMasks || {}).some(Boolean)
  );
}

export function patchPrivacyLayer(layer, patch, options = {}) {
  return normalizePrivacyLayer({ ...(layer || {}), ...(patch || {}) }, options);
}
