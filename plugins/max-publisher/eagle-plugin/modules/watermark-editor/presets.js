(function exposeWatermarkPresets(root, factory) {
  const isCommonJsModule = typeof module === 'object' && module.exports
    && typeof __filename === 'string' && /[\\/]presets\.js$/.test(__filename);
  const schema = isCommonJsModule ? require('./schema.js') : root.GravityWatermarkSchema;
  const api = factory(schema);
  if (isCommonJsModule) module.exports = api;
  if (root) root.GravityWatermarkPresets = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createWatermarkPresets(schema) {
  function normalizePreset(value) {
    if (!value || !value.id || !value.name || !value.watermark) return null;
    return {
      id: String(value.id),
      name: String(value.name).trim(),
      watermark: schema.canonicalWatermark(value.watermark)
    };
  }

  function normalizePresets(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).map(normalizePreset).filter((preset) => {
      if (!preset || !preset.name || seen.has(preset.id)) return false;
      seen.add(preset.id);
      return true;
    });
  }

  function findPreset(values, presetId) {
    if (!presetId) return null;
    return normalizePresets(values).find((preset) => preset.id === presetId) || null;
  }

  function uniquePresetName(values, requestedName) {
    const base = String(requestedName || '我的水印').trim() || '我的水印';
    const names = new Set(normalizePresets(values).map((preset) => preset.name));
    if (!names.has(base)) return base;
    let index = 2;
    while (names.has(`${base} ${index}`)) index += 1;
    return `${base} ${index}`;
  }

  function createPreset(values, watermark, name, idFactory = () => `preset-${Date.now()}`) {
    const presets = normalizePresets(values);
    const preset = {
      id: String(idFactory()),
      name: uniquePresetName(presets, name),
      watermark: schema.canonicalWatermark(watermark)
    };
    return { presets: [...presets, preset], preset };
  }

  return Object.freeze({ normalizePreset, normalizePresets, findPreset, uniquePresetName, createPreset });
}));
