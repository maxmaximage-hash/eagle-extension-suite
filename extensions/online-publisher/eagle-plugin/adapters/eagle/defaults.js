(function exposeEagleWatermarkDefaults(root, factory) {
  const isCommonJsModule = typeof module === 'object' && module.exports
    && typeof __filename === 'string' && /[\\/]defaults\.js$/.test(__filename);
  const schema = isCommonJsModule
    ? require('../../modules/watermark-editor/schema.js')
    : root.GravityWatermarkSchema;
  const api = factory(schema);
  if (isCommonJsModule) module.exports = api;
  if (root) root.MaxEagleWatermarkDefaults = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createEagleWatermarkDefaults(schema) {
  const COPYRIGHT_PRESET_ID = 'gravityglobal-copyright';
  const COPYRIGHT_PRESET = Object.freeze({
    id: COPYRIGHT_PRESET_ID,
    name: '引力环球版权文字',
    watermark: schema.canonicalWatermark({
      type: 'text',
      text: 'Copyright ©Gravity Global.All rights reserved.',
      position: 'center',
      textAlign: 'center',
      opacity: 1,
      scale: 0.11,
      scaleMode: 'proportional',
      fontFamily: '江城斜宋体',
      fontFace: '江城斜宋体 100W',
      fontPostscriptName: 'JiangChengXieSong-100W',
      fontWeight: 100,
      fontStyle: 'italic',
      letterSpacing: -0.09,
      lineSpacing: 1.28,
      color: '#ffffff',
      rotation: 0,
      shadowEnabled: true,
      shadowColor: '#000000',
      shadowOpacity: 0.73,
      shadowOffset: 1,
      shadowRadius: 10,
      shadowAngle: -52,
      density: 7,
      offsetX: 0,
      offsetY: 0
    })
  });

  function copyrightWatermark() {
    return { ...COPYRIGHT_PRESET.watermark, presetId: COPYRIGHT_PRESET_ID };
  }

  return Object.freeze({ COPYRIGHT_PRESET_ID, COPYRIGHT_PRESET, copyrightWatermark });
}));
