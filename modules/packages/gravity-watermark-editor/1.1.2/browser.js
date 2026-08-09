/* MAX Publisher 1.0 · portable watermark editor browser module.
 * The Eagle adapter supplies host state, persistence hooks and preview items;
 * this module owns the complete editor UI, interactions and preview pipeline.
 */

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function colorToRgba(color, opacity = 1) {
  const hex = String(color || '#000000').trim();
  const match = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return `rgba(0,0,0,${opacity})`;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyObject(target, source) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, clone(source));
}

function ensureWatermarkPresets() {
  config.watermarkPresets = watermarkPresetsApi.normalizePresets(config.watermarkPresets);
  return config.watermarkPresets;
}

function uniquePresetName(baseName) {
  return watermarkPresetsApi.uniquePresetName(ensureWatermarkPresets(), baseName);
}

function activeWatermarkPreset(settings) {
  if (!settings || !settings.presetId) return null;
  return ensureWatermarkPresets().find((preset) => preset.id === settings.presetId) || null;
}

function canonicalPresetWatermark(settings) {
  return watermarkSchema.canonicalWatermark(settings);
}

function createWatermarkPreset(settings, name = '我的水印') {
  const created = watermarkPresetsApi.createPreset(
    ensureWatermarkPresets(),
    settings,
    name,
    () => `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  );
  config.watermarkPresets = created.presets;
  const preset = created.preset;
  applyObject(settings, preset.watermark);
  settings.presetId = preset.id;
  prepareWatermarkSettings(settings);
  return preset;
}

function presetDraftName(settings) {
  const current = activeWatermarkPreset(settings);
  if (current && current.name) return current.name;
  const base = settings.type === 'image' ? '图形水印' : (settings.text || '文字水印');
  return `${base} ${ensureWatermarkPresets().length + 1}`;
}

function watermarkPresetBar(settings) {
  const presets = ensureWatermarkPresets();
  const current = activeWatermarkPreset(settings);
  const currentPresetId = current ? current.id : '';
  return `
    <div class="preset-bar">
      <label>水印预设
        <select data-preset-select>
          ${current ? '' : '<option value="" selected>未保存预设</option>'}
          ${presets.map((preset) => `<option value="${escapeHtml(preset.id)}" ${currentPresetId === preset.id ? 'selected' : ''}>${escapeHtml(preset.name)}</option>`).join('')}
        </select>
      </label>
      <div class="preset-actions">
        <button type="button" data-action="save-preset">另存为</button>
        <button type="button" data-action="update-preset">保存</button>
        <button type="button" data-action="rename-preset">重命名</button>
        <button type="button" data-action="delete-preset">删除</button>
      </div>
    </div>`;
}

function snapshotWatermark(settings) {
  return watermarkSchema.canonicalWatermark(settings);
}

function prepareWatermarkSettings(settings) {
  const normalized = watermarkSchema.normalizeWatermark(settings, { includePresetId: true });
  applyObject(settings, normalized);
}

function rangeField(label, key, min, max, step, value, options = {}) {
  const disabled = options.disabled ? 'disabled' : '';
  const className = options.className || '';
  const progress = max === min ? 0 : ((Number(value) - Number(min)) / (Number(max) - Number(min))) * 100;
  const numberMeta = rangeNumberMeta(key, min, max, step);
  const unit = numberMeta.unit ? ` data-unit="${numberMeta.unit}"` : '';
  const unitClass = numberMeta.unit ? ' has-unit' : '';
  return `<label class="range-field ${className}"><span>${label}</span><div class="range-row"><input data-key="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" style="--range-progress:${Math.min(100, Math.max(0, progress))}%" ${disabled}/><span class="range-number-wrap${unitClass}"${unit}><input class="range-number" data-range-number="${key}" type="number" min="${numberMeta.min}" max="${numberMeta.max}" step="${numberMeta.step}" value="${rangeNumberDisplayValue(key, value)}" ${disabled}/></span></div></label>`;
}

const PERCENT_RANGE_KEYS = new Set(['shadowOpacity', 'opacity', 'scale', 'letterSpacing', 'lineSpacing']);

function rangeNumberMeta(key, min, max, step) {
  if (!PERCENT_RANGE_KEYS.has(key)) return { min, max, step, unit: '' };
  return {
    min: Math.round(Number(min) * 100),
    max: Math.round(Number(max) * 100),
    step: Math.max(1, Math.round(Number(step) * 100)),
    unit: '%'
  };
}

function rangeNumberDisplayValue(key, value) {
  if (!PERCENT_RANGE_KEYS.has(key)) return value;
  return Math.round(Number(value || 0) * 100);
}

function rangeNumberInternalValue(key, value) {
  if (!PERCENT_RANGE_KEYS.has(key)) return Number(value);
  return Number((Number(value) / 100).toFixed(4));
}

function fontPicker(settings) {
  const current = settings.fontFamily || 'Arial';
  return `
    <label class="full text-only font-field">字体
      <div class="font-picker" data-font-picker data-current="${escapeHtml(current)}">
        <div class="font-picker-control">
          <button type="button" class="font-picker-button" data-font-picker-focus aria-label="当前字体：${escapeHtml(current)}" style="font-family:'${escapeHtml(current)}', Arial, sans-serif">
            <span>${escapeHtml(current)}</span>
          </button>
          <button type="button" class="font-picker-arrow" data-action="toggle-font-picker" aria-label="展开字体列表">⌄</button>
        </div>
        <input data-key="fontFamily" type="hidden" value="${escapeHtml(current)}"/>
        <div class="font-picker-menu" data-font-list></div>
      </div>
    </label>`;
}

function fontStyleField(settings) {
  const current = settings.fontPostscriptName || settings.fontFace || '';
  return `<label class="text-only">样式
    <div class="font-picker font-face-picker" data-font-face-picker data-current="${escapeHtml(current)}">
      <div class="font-picker-control">
        <button type="button" class="font-picker-button font-face-picker-button" data-font-face-focus aria-label="当前字重"><span>当前样式</span></button>
        <button type="button" class="font-picker-arrow" data-action="toggle-font-face-picker" aria-label="展开字重列表">⌄</button>
      </div>
      <input data-key="fontFace" type="hidden" value="${escapeHtml(current)}"/>
      <div class="font-picker-menu font-face-picker-menu" data-font-face-list></div>
    </div>
  </label>`;
}

function segmentedField(label, key, options, current, className = '') {
  return `<div class="segmented-field ${className}"><span>${label}</span><div class="segmented" data-segmented="${key}">${options.map(([value, text]) => `<button type="button" data-set-key="${key}" data-set-value="${escapeHtml(value)}" class="${String(current) === String(value) ? 'active' : ''}">${text}</button>`).join('')}</div><input data-key="${key}" type="hidden" value="${escapeHtml(current)}"/></div>`;
}

function positionGrid(current, rotation = 0) {
  const positions = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  const names = {
    'top-left': '左上',
    'top-center': '上中',
    'top-right': '右上',
    'center-left': '左中',
    center: '中央',
    'center-right': '右中',
    'bottom-left': '左下',
    'bottom-center': '下中',
    'bottom-right': '右下'
  };
  return `
    <div class="position-rotation-field single-only full">
      <div class="position-field"><span>定位</span><div class="position-grid">${positions.map((position) => `<button type="button" data-position-value="${position}" class="${current === position ? 'active' : ''}" title="${names[position]}" aria-label="${names[position]}"><span></span></button>`).join('')}</div><input data-key="position" type="hidden" value="${escapeHtml(current || 'bottom-right')}"/></div>
      <div class="rotate-field"><span>旋转</span><button type="button" data-rotate-step="-90">-90°</button><button type="button" data-rotate-step="-45">-45°</button><button type="button" data-rotate-step="45">+45°</button><button type="button" data-rotate-step="90">+90°</button><input data-key="rotation" type="hidden" value="${rotation || 0}"/></div>
    </div>`;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function updateRangeProgress(input) {
  if (!input || input.type !== 'range') return;
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const current = Number(input.value || 0);
  const progress = max === min ? 0 : ((current - min) / (max - min)) * 100;
  input.style.setProperty('--range-progress', `${Math.min(100, Math.max(0, progress))}%`);
}

function densityValue(settings) {
  return clampNumber(settings.density != null ? settings.density : 7, 1, 10);
}

function shadowFields(settings) {
  return `
    <div class="shadow-row full">
      <label class="check shadow-toggle"><input data-key="shadowEnabled" type="checkbox" ${settings.shadowEnabled !== false ? 'checked' : ''}/>阴影</label>
      <label class="color-field shadow-color shadow-only">阴影颜色<input data-key="shadowColor" type="color" value="${settings.shadowColor || '#000000'}"/></label>
      <details class="shadow-advanced shadow-only">
        <summary>阴影细节</summary>
        <div class="shadow-advanced-grid">
          ${rangeField('不透明度', 'shadowOpacity', 0, 1, 0.01, settings.shadowOpacity != null ? settings.shadowOpacity : 0.55, { className: 'shadow-only' })}
          ${rangeField('距离', 'shadowOffset', 0, 40, 1, settings.shadowOffset != null ? settings.shadowOffset : 1, { className: 'shadow-only' })}
          ${rangeField('扩散', 'shadowRadius', 0, 100, 1, settings.shadowRadius != null ? settings.shadowRadius : 25, { className: 'shadow-only' })}
          ${rangeField('角度', 'shadowAngle', -180, 180, 1, settings.shadowAngle != null ? settings.shadowAngle : -52, { className: 'shadow-only' })}
        </div>
      </details>
    </div>`;
}

function watermarkFields(prefix, settings) {
  const typeName = `${prefix}-watermark-type`;
  const logoButtonLabel = settings.imagePath ? '更换图片…' : '选择图片…';
  return `
    ${watermarkPresetBar(settings)}
    <div class="watermark-style"><span class="watermark-style-title">水印样式：</span><span class="watermark-style-options"><label><input data-key="type" name="${typeName}" type="radio" value="text" ${settings.type !== 'image' ? 'checked' : ''}/>文本</label><label><input data-key="type" name="${typeName}" type="radio" value="image" ${settings.type === 'image' ? 'checked' : ''}/>图形</label></span></div>

    <details class="wm-panel image-only" open>
      <summary>图像选项</summary>
      <div class="wm-panel-body logo-picker">
        <button type="button" data-action="choose-logo">${logoButtonLabel}</button>
        <input data-logo-file type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden/>
        <input data-key="imagePath" type="hidden" value="${escapeHtml(settings.imagePath || '')}"/>
      </div>
    </details>

    <details class="wm-panel text-panel text-only" open>
      <summary>文本选项</summary>
      <div class="wm-panel-body">
        <label class="full text-only watermark-text-field">水印文字<textarea data-key="text" rows="2" wrap="off">${escapeHtml(settings.text || '')}</textarea></label>
        ${fontPicker(settings)}
        ${fontStyleField(settings)}
        ${rangeField('字间距', 'letterSpacing', -0.2, 0.8, 0.01, settings.letterSpacing != null ? settings.letterSpacing : 0, { className: 'text-only' })}
        ${rangeField('行间距', 'lineSpacing', 0.6, 3, 0.01, settings.lineSpacing != null ? settings.lineSpacing : 1.28, { className: 'text-only' })}
        ${settings.type !== 'image'
          ? rangeField('大小', 'scale', 0.01, 0.8, 0.01, settings.scale != null ? settings.scale : 0.12, { className: 'text-only text-size-field' })
          : ''}
        ${segmentedField('对齐', 'textAlign', [['left', '左'], ['center', '中'], ['right', '右']], settings.textAlign || 'center', 'text-only')}
        <label class="color-field text-only">颜色<input data-key="color" type="color" value="${settings.color || '#ffffff'}"/></label>
        ${shadowFields(settings)}
      </div>
    </details>

    <details class="wm-panel effect-panel" open>
      <summary>水印效果</summary>
      <div class="wm-panel-body">
        ${rangeField('不透明度', 'opacity', 0, 1, 0.01, settings.opacity != null ? settings.opacity : 0.32, { className: 'full' })}
        ${segmentedField('模式', 'scaleMode', [['proportional', '比例'], ['fill', '平铺']], settings.scaleMode || 'proportional', 'full')}
        ${settings.type === 'image'
          ? rangeField('大小', 'scale', 0.01, 0.8, 0.01, settings.scale != null ? settings.scale : 0.12, { className: 'full image-size-field' })
          : ''}
        ${(settings.scaleMode || 'proportional') === 'fill'
          ? rangeField('铺满密度', 'density', 1, 10, 1, densityValue(settings), { className: 'full fill-only' })
          : ''}
        ${rangeField('旋转角度', 'rotation', -90, 90, 1, settings.rotation != null ? settings.rotation : 0, { className: 'full' })}
        ${rangeField('水平平移', 'offsetX', -0.5, 0.5, 0.005, settings.offsetX != null ? settings.offsetX : 0, { className: 'full' })}
        ${rangeField('垂直平移', 'offsetY', -0.5, 0.5, 0.005, settings.offsetY != null ? settings.offsetY : 0, { className: 'full' })}
        ${positionGrid(settings.position || 'bottom-right', settings.rotation || 0)}
      </div>
    </details>`;
}

function mountWatermarkForm(containerId, settings, previewId) {
  const container = $(containerId);
  if (!container) return;
  restoreWatermarkFromSavedPreset(settings);
  container._watermarkSettings = settings;
  container.innerHTML = watermarkFields(containerId, settings);

  function normalizeSettings(key) {
    if (key === 'fontFamily') {
      const entry = fontFamilyEntry(settings.fontFamily, { allowFallback: false });
      if (!entry) return;
      const preferred = defaultFaceForEntry(entry);
      applyFontFace(settings, preferred);
      renderFontStyleSelects();
    }
    if (key === 'fontFace') {
      const entry = fontFamilyEntry(settings.fontFamily, { allowFallback: false });
      if (!entry) return;
      const face = entry.faces.find((item) => item.postscriptName === settings.fontFace)
        || entry.faces.find((item) => item.fullName === settings.fontFace || item.label === settings.fontFace)
        || defaultFaceForEntry(entry);
      applyFontFace(settings, face);
    }
  }

  function syncPanelState() {
    const isFillSize = (settings.scaleMode || 'proportional') === 'fill';
    container.classList.toggle('is-image-watermark', settings.type === 'image');
    container.classList.toggle('is-text-watermark', settings.type !== 'image');
    container.classList.toggle('is-proportional-size', !isFillSize);
    container.classList.toggle('is-fill-size', isFillSize);
    container.classList.toggle('has-shadow', settings.shadowEnabled !== false);
    container.querySelectorAll('.fill-only').forEach((element) => {
      element.toggleAttribute('hidden', !isFillSize);
    });
    container.querySelectorAll('.single-only').forEach((element) => {
      element.toggleAttribute('hidden', isFillSize);
    });
    container.querySelectorAll('[data-range-number]').forEach((input) => {
      const key = input.dataset.rangeNumber;
      if (settings[key] !== undefined) input.value = rangeNumberDisplayValue(key, settings[key]);
    });
    container.querySelectorAll('input[type="range"]').forEach(updateRangeProgress);
  }

  function commit(key) {
    normalizeSettings(key);
    prepareWatermarkSettings(settings);
    if (key === 'type' || key === 'scaleMode' || key === 'shadowEnabled') syncPanelState();
    applyInstantPreviewProjection(previewId, settings, key);
    const fastSpacingPreview = key === 'letterSpacing' || key === 'lineSpacing';
    updatePreview(previewId, settings, { deferExact: fastSpacingPreview, fastVector: fastSpacingPreview });
  }

  function rerenderForm() {
    prepareWatermarkSettings(settings);
    container._watermarkSettings = settings;
    container.innerHTML = watermarkFields(containerId, settings);
    syncPanelState();
    updatePreview(previewId, settings);
    renderFontPickers();
  }
  container._rerenderWatermarkForm = rerenderForm;

  async function chooseLogo() {
    if (!window.eagle) {
      const logoInput = container.querySelector('[data-logo-file]');
      if (logoInput) logoInput.click();
      return;
    }
    const result = await eagle.dialog.showOpenDialog({
      title: '选择水印 Logo',
      filters: [{ name: '图片', extensions: ['png', 'webp', 'jpg', 'jpeg', 'svg'] }],
      properties: ['openFile']
    });
    if (!result.canceled && result.filePaths[0]) {
      settings.imagePath = result.filePaths[0];
      container.querySelector('[data-key="imagePath"]').value = settings.imagePath;
      const logoButton = container.querySelector('[data-action="choose-logo"]');
      if (logoButton) logoButton.textContent = '更换图片…';
      commit('imagePath');
    }
  }

  function applyLogoPreviewFile(file) {
    if (!file) return;
    if (settings._previewLogoUrl && settings._previewLogoUrl.startsWith('blob:')) URL.revokeObjectURL(settings._previewLogoUrl);
    const url = URL.createObjectURL(file);
    settings._previewLogoUrl = url;
    settings.imagePath = url;
    const input = container.querySelector('[data-key="imagePath"]');
    if (input) input.value = settings.imagePath;
    const logoButton = container.querySelector('[data-action="choose-logo"]');
    if (logoButton) logoButton.textContent = '更换图片…';
    commit('imagePath');
  }

  function selectFontFamily(font, picker, options = {}) {
    if (!font || !picker) return;
    const input = picker.querySelector('[data-key="fontFamily"]');
    settings.fontFamily = font;
    if (input) input.value = settings.fontFamily;
    commit('fontFamily');
    renderFontPickers();
    if (options.close !== false) picker.classList.remove('open');
  }

  function selectFontFace(faceValueToSelect, picker, options = {}) {
    if (!faceValueToSelect || !picker) return;
    const entry = fontFamilyEntry(settings.fontFamily, { allowFallback: false });
    if (!entry) return;
    const face = entry.faces.find((item) => item.postscriptName === faceValueToSelect)
      || entry.faces.find((item) => faceMatchesValue(item, faceValueToSelect));
    if (!face) return;
    settings.fontFace = faceValue(face);
    const input = picker.querySelector('[data-key="fontFace"]');
    if (input) input.value = settings.fontFace;
    commit('fontFace');
    renderFontPickers();
    if (options.close !== false) picker.classList.remove('open');
  }

  container.addEventListener('click', async (event) => {
    const actionTarget = event.target.closest('[data-action]');
    const favoriteToggle = event.target.closest('[data-font-favorite]');
    const fontOption = event.target.closest('[data-font-value]');
    const fontFaceOption = event.target.closest('[data-font-face-value]');
    const segmented = event.target.closest('[data-set-key]');
    const positionButton = event.target.closest('[data-position-value]');
    if (favoriteToggle) {
      event.preventDefault();
      event.stopPropagation();
      if (globalThis.GravityFontManager) GravityFontManager.toggleFavorite(favoriteToggle.dataset.fontFavorite);
      return;
    }
    if (actionTarget && actionTarget.dataset.action === 'choose-logo') chooseLogo();
    if (actionTarget && actionTarget.dataset.action === 'save-preset') {
      const name = await askPresetName('另存为新预设', presetDraftName(settings));
      if (!name || !name.trim()) return;
      const preset = createWatermarkPreset(settings, name.trim());
      save();
      rerenderForm();
      notify(`已保存水印预设：${preset.name}`);
    }
    if (actionTarget && actionTarget.dataset.action === 'update-preset') {
      let preset = activeWatermarkPreset(settings);
      if (!preset) {
        const name = await askPresetName('保存水印预设', presetDraftName(settings));
        if (!name || !name.trim()) return;
        preset = createWatermarkPreset(settings, name.trim());
      } else {
        preset.watermark = canonicalPresetWatermark(settings);
        applyObject(settings, preset.watermark);
        settings.presetId = preset.id;
        prepareWatermarkSettings(settings);
      }
      save();
      rerenderForm();
      notify(`已保存预设：${preset.name}`);
    }
    if (actionTarget && actionTarget.dataset.action === 'rename-preset') {
      const preset = activeWatermarkPreset(settings);
      if (!preset) return notify('当前是未保存草稿，请先保存预设', 'error');
      const name = await askPresetName('重命名预设', preset.name);
      if (!name || !name.trim()) return;
      preset.name = name.trim();
      save();
      rerenderForm();
      notify(`已重命名预设：${preset.name}`);
    }
    if (actionTarget && actionTarget.dataset.action === 'delete-preset') {
      const presets = ensureWatermarkPresets();
      const index = presets.findIndex((item) => item.id === settings.presetId);
      if (index < 0) return notify('没有找到当前预设', 'error');
      const [removed] = presets.splice(index, 1);
      const nextPreset = presets[Math.max(0, index - 1)] || presets[0] || null;
      if (nextPreset) {
        applyObject(settings, nextPreset.watermark);
        settings.presetId = nextPreset.id;
      } else {
        applyObject(settings, BUILTIN_WATERMARK);
        settings.presetId = '';
      }
      prepareWatermarkSettings(settings);
      save();
      rerenderForm();
      notify(`已删除预设：${removed.name}`);
    }
    if (actionTarget && actionTarget.dataset.action === 'toggle-font-picker') {
      const picker = actionTarget.closest('[data-font-picker]');
      togglePickerMenu(picker, '[data-font-value][data-font-copy="original"].active');
    }
    if (actionTarget && actionTarget.dataset.action === 'toggle-font-face-picker') {
      const picker = actionTarget.closest('[data-font-face-picker]');
      togglePickerMenu(picker, '[data-font-face-value].active');
    }
    if (fontOption) {
      const picker = fontOption.closest('[data-font-picker]');
      selectFontFamily(fontOption.dataset.fontValue, picker);
    }
    if (fontFaceOption) {
      const picker = fontFaceOption.closest('[data-font-face-picker]');
      selectFontFace(fontFaceOption.dataset.fontFaceValue, picker);
    }
    if (segmented) {
      const key = segmented.dataset.setKey;
      const value = segmented.dataset.setValue;
      settings[key] = value;
      container.querySelector(`[data-key="${key}"]`).value = value;
      container.querySelectorAll(`[data-set-key="${key}"]`).forEach((button) => button.classList.toggle('active', button === segmented));
      commit(key);
      if (key === 'scaleMode') rerenderForm();
    }
    if (positionButton) {
      event.preventDefault();
      settings.position = positionButton.dataset.positionValue;
      container.querySelector('[data-key="position"]').value = settings.position;
      container.querySelectorAll('[data-position-value]').forEach((button) => button.classList.toggle('active', button === positionButton));
      commit('position');
    }
    const rotateTarget = event.target.closest('[data-rotate-step]');
    if (rotateTarget) {
      event.preventDefault();
      const step = Number(rotateTarget.dataset.rotateStep || 0);
      settings.rotation = (((Number(settings.rotation || 0) + step) % 360) + 360) % 360;
      const rotationRange = container.querySelector('[data-key="rotation"]');
      if (rotationRange) {
        rotationRange.value = settings.rotation;
        updateRangeProgress(rotationRange);
      }
      const rotationNumber = container.querySelector('[data-range-number="rotation"]');
      if (rotationNumber) rotationNumber.value = rangeNumberDisplayValue('rotation', settings.rotation);
      commit('rotation');
    }
  });

  container.addEventListener('keydown', (event) => {
    const focusButton = event.target.closest('[data-font-picker-focus]');
    if (focusButton) {
      const picker = focusButton.closest('[data-font-picker]');
      if (!picker) return;
      const pickerInput = picker.querySelector('[data-key="fontFamily"]');
      const current = settings.fontFamily || (pickerInput && pickerInput.value) || availableFonts[0];
      const currentIndex = Math.max(0, availableFonts.indexOf(current));
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = Math.min(availableFonts.length - 1, Math.max(0, currentIndex + direction));
        if (nextIndex !== currentIndex) selectFontFamily(availableFonts[nextIndex], picker, { close: false });
      }
      if (event.key === 'Escape') picker.classList.remove('open');
      return;
    }
    const faceFocusButton = event.target.closest('[data-font-face-focus]');
    if (faceFocusButton) {
      const picker = faceFocusButton.closest('[data-font-face-picker]');
      const entry = fontFamilyEntry(settings.fontFamily, { allowFallback: false });
      if (!picker || !entry || !entry.faces.length) return;
      const currentFace = selectedFaceForSettings(settings, entry) || defaultFaceForEntry(entry);
      const currentIndex = Math.max(0, entry.faces.indexOf(currentFace));
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = Math.min(entry.faces.length - 1, Math.max(0, currentIndex + direction));
        if (nextIndex !== currentIndex) selectFontFace(faceValue(entry.faces[nextIndex]), picker, { close: false });
      }
      if (event.key === 'Escape') picker.classList.remove('open');
    }
  });

  container.addEventListener('change', (event) => {
    if (event.target.matches('[data-logo-file]')) {
      applyLogoPreviewFile(event.target.files && event.target.files[0]);
      event.target.value = '';
      return;
    }
  });

  function handleFieldChange(event) {
    if (event.target.matches('[data-preset-select]')) {
      const presetId = event.target.value;
      const preset = ensureWatermarkPresets().find((item) => item.id === presetId);
      if (!preset) return;
      applyObject(settings, preset.watermark);
      settings.presetId = preset.id;
      save();
      rerenderForm();
      return;
    }
    const rangeNumberKey = event.target.dataset.rangeNumber;
    if (rangeNumberKey) {
      const range = container.querySelector(`input[type="range"][data-key="${rangeNumberKey}"]`);
      if (!range) return;
      if (event.target.value === '') {
        if (event.type === 'change') {
          event.target.value = rangeNumberDisplayValue(
            rangeNumberKey,
            settings[rangeNumberKey] != null ? settings[rangeNumberKey] : range.min
          );
        }
        return;
      }
      const meta = rangeNumberMeta(rangeNumberKey, range.min, range.max, range.step);
      const displayNext = clampNumber(event.target.value, Number(meta.min), Number(meta.max));
      const next = rangeNumberInternalValue(rangeNumberKey, displayNext);
      event.target.value = rangeNumberDisplayValue(rangeNumberKey, next);
      range.value = next;
      settings[rangeNumberKey] = next;
      updateRangeProgress(range);
      commit(rangeNumberKey);
      return;
    }
    const key = event.target.dataset.key;
    if (!key) return;
    if (event.target.type === 'radio' && !event.target.checked) return;
    const numeric = event.target.type === 'number' || event.target.type === 'range';
    settings[key] = event.target.type === 'checkbox' ? event.target.checked : numeric ? Number(event.target.value) : event.target.value;
    if (event.target.type === 'checkbox') {
      container.querySelectorAll(`[data-key="${key}"][type="checkbox"]`).forEach((input) => {
        input.checked = settings[key];
      });
    } else if (event.target.type !== 'radio') {
      container.querySelectorAll(`[data-key="${key}"]`).forEach((input) => {
        input.value = settings[key];
        if (input.type === 'range') updateRangeProgress(input);
      });
    }
    if (key === 'type') {
      container.querySelectorAll('[data-key="type"]').forEach((input) => {
        input.checked = input.value === settings.type;
      });
    }
    updateRangeProgress(event.target);
    container.querySelectorAll(`[data-range-number="${key}"]`).forEach((rangeNumber) => {
      rangeNumber.value = rangeNumberDisplayValue(key, event.target.value);
    });
    commit(key);
    if (key === 'type') {
      rerenderForm();
      return;
    }
    if (key === 'fontFace') renderFontPickers();
  }
  container.addEventListener('input', handleFieldChange);
  container.addEventListener('change', handleFieldChange);
  syncPanelState();
  updatePreview(previewId, settings);
  renderFontPickers();
}

function previewScopeForId(previewOrId) {
  const id = typeof previewOrId === 'string' ? previewOrId : (previewOrId && previewOrId.id);
  return id === 'onlinePreview' ? 'online' : 'local';
}

function scopedPreviewState(scope) {
  return previewState[scope] || previewState.local;
}

function previewElementForScope(scope) {
  return scope === 'online' ? $('onlinePreview') : $('localPreview');
}

function previewLabelForScope(scope) {
  return scope === 'online' ? $('onlinePreviewLabel') : $('localPreviewLabel');
}

function watermarkSettingsForScope(scope) {
  return runtimeWatermarkSettings(scope === 'online' ? config.online.watermark : config.localExport.watermark);
}

function previewHasWatermarkContent(settings) {
  if (!settings || !settings.enabled) return false;
  if (settings.type === 'image') return Boolean(settings.imagePath);
  return String(settings.text != null ? settings.text : '').length > 0;
}

function clearPreviewWatermark(mark) {
  if (mark.dataset.renderedObjectUrl) {
    URL.revokeObjectURL(mark.dataset.renderedObjectUrl);
    delete mark.dataset.renderedObjectUrl;
  }
  mark.className = 'preview-watermark is-hidden';
  mark.removeAttribute('style');
  mark.innerHTML = '';
}

function showRenderedPreviewPayload(mark, photoRect, payload) {
  if (mark.dataset.renderedObjectUrl) {
    URL.revokeObjectURL(mark.dataset.renderedObjectUrl);
    delete mark.dataset.renderedObjectUrl;
  }
  mark.className = 'preview-watermark is-rendered-layout';
  mark.style.cssText = [
    'position:absolute',
    `left:${photoRect.left}px`,
    `top:${photoRect.top}px`,
    `width:${photoRect.width}px`,
    `height:${photoRect.height}px`,
    'right:auto',
    'bottom:auto',
    'max-width:none',
    'opacity:1',
    'transform:none',
    'pointer-events:none',
    'overflow:hidden'
  ].join(';');
  mark.innerHTML = payload.placements.map((placement, placementIndex) => {
    const asset = payload.assets[placement.asset];
    if (!asset) return '';
    const left = placement.left / payload.width * photoRect.width;
    const top = placement.top / payload.height * photoRect.height;
    const width = asset.width / payload.width * photoRect.width;
    const height = asset.height / payload.height * photoRect.height;
    return `<img src="${asset.dataUrl}" alt="" draggable="false" data-preview-placement="${placementIndex}" style="position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;max-width:none;transform-origin:center;will-change:left,top,width,height,transform,opacity">`;
  }).join('');
}

function projectedPreviewPosition(position, canvasWidth, canvasHeight, markWidth, markHeight) {
  const marginX = Math.round(canvasWidth * 0.04);
  const marginY = Math.round(canvasHeight * 0.04);
  const horizontal = position.endsWith('left')
    ? marginX
    : position.endsWith('right')
      ? canvasWidth - markWidth - marginX
      : Math.round((canvasWidth - markWidth) / 2);
  const vertical = position.startsWith('top')
    ? marginY
    : position.startsWith('bottom')
      ? canvasHeight - markHeight - marginY
      : Math.round((canvasHeight - markHeight) / 2);
  return { left: horizontal, top: vertical };
}

function applyInstantPreviewProjection(previewId, settings, changedKey) {
  const instantKeys = ['opacity', 'scale', 'rotation', 'offsetX', 'offsetY', 'position', 'letterSpacing', 'lineSpacing'];
  if (!instantKeys.includes(changedKey) || settings.scaleMode === 'fill') return false;
  const preview = $(previewId);
  if (!preview) return false;
  const scope = previewScopeForId(preview);
  const job = previewRenderJobs[scope];
  const payload = job.lastPayload;
  const previous = job.lastSettings;
  const mark = preview.querySelector('.preview-watermark.is-rendered-layout');
  if (!payload || !previous || previous.scaleMode === 'fill' || payload.placements.length !== 1 || !mark) return false;
  const placement = payload.placements[0];
  const asset = payload.assets[placement.asset];
  const image = mark.querySelector('[data-preview-placement="0"]');
  if (!asset || !image) return false;

  const previousScale = Math.max(0.01, Number(previous.scale || 0.12));
  const nextScale = Math.max(0.01, Number(settings.scale || 0.12));
  const scaleRatio = nextScale / previousScale;
  let letterRatio = 1;
  let lineRatio = 1;
  if (settings.type !== 'image') {
    const lines = String(settings.text != null ? settings.text : '').replace(/\r\n?/g, '\n').split('\n');
    const longestLength = Math.max(1, ...lines.map((line) => Array.from(line).length));
    const glyphWidth = 0.62 * longestLength;
    const gapCount = Math.max(0, longestLength - 1);
    const previousLetterWidth = Math.max(0.1, glyphWidth + Number(previous.letterSpacing || 0) * gapCount);
    const nextLetterWidth = Math.max(0.1, glyphWidth + Number(settings.letterSpacing || 0) * gapCount);
    letterRatio = nextLetterWidth / previousLetterWidth;
    const previousLineHeight = 2.3 + Math.max(0, lines.length - 1) * Number(previous.lineSpacing || 1.28);
    const nextLineHeight = 2.3 + Math.max(0, lines.length - 1) * Number(settings.lineSpacing || 1.28);
    lineRatio = nextLineHeight / Math.max(0.1, previousLineHeight);
  }
  const projectedWidth = asset.width * scaleRatio * letterRatio;
  const projectedHeight = asset.height * scaleRatio * lineRatio;
  const position = projectedPreviewPosition(
    settings.position || 'bottom-right',
    payload.width,
    payload.height,
    projectedWidth,
    projectedHeight
  );
  const left = position.left + Math.round(payload.width * clampNumber(settings.offsetX || 0, -0.5, 0.5));
  const top = position.top + Math.round(payload.height * clampNumber(settings.offsetY || 0, -0.5, 0.5));
  const photoRect = previewPhotoRect(preview, scope);
  const xScale = photoRect.width / payload.width;
  const yScale = photoRect.height / payload.height;
  const previousOpacity = Math.max(0.001, Number(previous.opacity != null ? previous.opacity : 0.32));
  const nextOpacity = Math.max(0, Number(settings.opacity != null ? settings.opacity : 0.32));
  let angleDelta = Number(settings.rotation || 0) - Number(previous.rotation || 0);
  while (angleDelta > 180) angleDelta -= 360;
  while (angleDelta < -180) angleDelta += 360;

  image.style.left = `${left * xScale}px`;
  image.style.top = `${top * yScale}px`;
  image.style.width = `${projectedWidth * xScale}px`;
  image.style.height = `${projectedHeight * yScale}px`;
  image.style.opacity = String(Math.min(1, nextOpacity / previousOpacity));
  image.style.transform = angleDelta ? `rotate(${angleDelta}deg)` : 'none';
  return true;
}

function cancelPreviewFrame(job) {
  if (job.frame == null) return;
  window.cancelAnimationFrame(job.frame);
  job.frame = null;
}

function cancelExactPreviewSchedule(job) {
  cancelPreviewFrame(job);
  if (job.settleTimer != null) {
    window.clearTimeout(job.settleTimer);
    job.settleTimer = null;
  }
}

function queuePreviewFrame(job, callback) {
  cancelPreviewFrame(job);
  job.frame = window.requestAnimationFrame(() => {
    job.frame = null;
    callback();
  });
}

function queueExactPreview(job, callback, deferExact) {
  cancelExactPreviewSchedule(job);
  if (deferExact) {
    job.settleTimer = window.setTimeout(() => {
      job.settleTimer = null;
      queuePreviewFrame(job, callback);
    }, 72);
    return;
  }
  queuePreviewFrame(job, callback);
}

function hasRemotePreviewRenderer() {
  return typeof window !== 'undefined'
    && window.location
    && /^https?:$/.test(window.location.protocol);
}

async function renderPreviewPayload(settings, width, height) {
  if (typeof renderWatermarkPreviewPayload === 'function') {
    return renderWatermarkPreviewPayload(settings, width, height);
  }
  const response = await fetch('/api/watermark-preview-layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, width, height })
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `预览渲染失败：${response.status}`);
  }
  return response.json();
}

async function renderVectorPreviewPayload(settings, width, height) {
  if (typeof renderWatermarkVectorPreviewPayload === 'function') {
    return renderWatermarkVectorPreviewPayload(settings, width, height);
  }
  const response = await fetch('/api/watermark-preview-vector', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, width, height })
  });
  if (!response.ok) return null;
  return response.json();
}

function previewLayerDimensions(preview, scope, photoRect) {
  const state = scopedPreviewState(scope);
  const item = state.items[state.index];
  const dimensions = previewItemDimensions(item);
  const sourceRatio = dimensions && dimensions.width && dimensions.height
    ? dimensions.width / dimensions.height
    : photoRect.width / Math.max(1, photoRect.height);
  const configuredMaxWidth = scope === 'online'
    ? Number(config.online.maxWidth || 0)
    : Number(config.localExport.maxWidth || 0);
  const outputWidth = dimensions
    ? (configuredMaxWidth > 0 ? Math.min(dimensions.width, configuredMaxWidth) : dimensions.width)
    : Math.max(1, Math.round(photoRect.width));
  const width = Math.max(1, Math.round(outputWidth));
  return { width, height: Math.max(1, Math.round(width / Math.max(0.01, sourceRatio))) };
}

function scheduleEnginePreview(previewId, settings, options = {}) {
  const preview = $(previewId);
  if (!preview) return;
  const scope = previewScopeForId(preview);
  const mark = preview.querySelector('.preview-watermark');
  const job = previewRenderJobs[scope];
  job.version += 1;
  const version = job.version;
  cancelExactPreviewSchedule(job);
  if (!previewHasWatermarkContent(settings)) {
    job.pending = null;
    job.lastPayload = null;
    job.lastSettings = null;
    clearPreviewWatermark(mark);
    return;
  }
  job.pending = {
    previewId,
    version,
    deferExact: options.deferExact === true,
    snapshot: JSON.parse(JSON.stringify(settings))
  };
  if (options.fastVector === true) {
    const vectorSnapshot = JSON.parse(JSON.stringify(settings));
    const vectorRect = previewPhotoRect(preview, scope);
    const vectorDimensions = previewLayerDimensions(preview, scope, vectorRect);
    renderVectorPreviewPayload(vectorSnapshot, vectorDimensions.width, vectorDimensions.height)
      .then((payload) => {
        if (!payload || version !== job.version) return;
        showRenderedPreviewPayload(mark, previewPhotoRect(preview, scope), payload);
        job.lastPayload = payload;
        job.lastSettings = vectorSnapshot;
      })
      .catch((error) => console.error('快速文字排版预览失败：', error));
  }
  const flush = async () => {
    if (job.running || !job.pending) return;
    const task = job.pending;
    job.pending = null;
    job.running = true;
    const photoRect = previewPhotoRect(preview, scope);
    const layerDimensions = previewLayerDimensions(preview, scope, photoRect);
    const layerWidth = layerDimensions.width;
    const layerHeight = layerDimensions.height;
    try {
      const payload = await renderPreviewPayload(task.snapshot, layerWidth, layerHeight);
      if (task.version !== job.version) {
        return;
      }
      const latestRect = previewPhotoRect(preview, scope);
      showRenderedPreviewPayload(mark, latestRect, payload);
      job.lastPayload = payload;
      job.lastSettings = JSON.parse(JSON.stringify(task.snapshot));
    } catch (error) {
      if (task.version !== job.version) return;
      console.error('真实水印预览渲染失败，已切换浏览器预览：', error);
      updateDomPreview(task.previewId, task.snapshot);
    } finally {
      job.running = false;
      if (job.pending) {
        queueExactPreview(job, flush, job.pending.deferExact);
      }
    }
  };
  queueExactPreview(job, flush, options.deferExact === true);
}

function updatePreview(previewId, settings, options = {}) {
  if (typeof renderWatermarkPreviewPayload === 'function' || hasRemotePreviewRenderer()) {
    scheduleEnginePreview(previewId, settings, options);
    return;
  }
  updateDomPreview(previewId, settings);
}

function updateDomPreview(previewId, settings) {
  const preview = $(previewId);
  if (!preview) return;
  const scope = previewScopeForId(preview);
  const mark = preview.querySelector('.preview-watermark');
  const photoRect = previewPhotoRect(preview, scope);
  const isImage = settings.type === 'image';
  const imageSource = isImage && settings.imagePath ? fileUrl(settings.imagePath) : '';
  const label = isImage
    ? (settings.imagePath ? path.basename(settings.imagePath) : '')
    : (settings.text != null ? String(settings.text) : '');
  const hasContent = isImage ? Boolean(imageSource) : label.length > 0;
  mark.classList.toggle('is-hidden', !settings.enabled || !hasContent);
  if (!settings.enabled || !hasContent) {
    mark.innerHTML = '';
    return;
  }
  const scaleMode = settings.scaleMode || 'proportional';
  const scale = clampNumber(settings.scale != null ? settings.scale : 0.12, 0.01, 0.8);
  mark.style.opacity = String(settings.opacity != null ? settings.opacity : 0.32);
  mark.style.fontFamily = fontCssStack(settings, null, fontFamilyEntry(settings.fontFamily, { allowFallback: false }));
  mark.style.fontWeight = String(settings.fontWeight || 600);
  mark.style.fontStyle = settings.fontStyle || 'normal';
  mark.style.textAlign = settings.textAlign || 'center';
  mark.style.letterSpacing = `${clampNumber(settings.letterSpacing != null ? settings.letterSpacing : 0, -0.2, 0.8)}em`;
  mark.style.lineHeight = String(clampNumber(settings.lineSpacing != null ? settings.lineSpacing : 1.28, 0.6, 3));
  mark.style.fontSize = `${Math.max(14, 14 + scale * 100)}px`;
  mark.style.color = settings.color || '#ffffff';
  if (!isImage && settings.shadowEnabled !== false) {
    const distance = Number(settings.shadowOffset != null ? settings.shadowOffset : 1);
    const radians = Number(settings.shadowAngle != null ? settings.shadowAngle : -52) * Math.PI / 180;
    const dx = Math.cos(radians) * distance;
    const dy = Math.sin(radians) * distance;
    const shadowRadius = Math.max(0, Number(settings.shadowRadius != null ? settings.shadowRadius : 25));
    const shadowColor = colorToRgba(settings.shadowColor || '#000000', settings.shadowOpacity != null ? settings.shadowOpacity : 0.55);
    mark.style.textShadow = `${dx.toFixed(1)}px ${dy.toFixed(1)}px ${shadowRadius / 5}px ${shadowColor}`;
    mark.style.filter = '';
  } else {
    mark.style.textShadow = 'none';
    mark.style.filter = '';
  }
  mark.classList.toggle('is-image-mark', isImage);

  if (scaleMode === 'fill') {
    const safeLabel = escapeHtml(label);
    const rotation = Number(settings.rotation || 0);
    const density = densityValue(settings);
    const photoWidth = Math.max(1, photoRect.width);
    const photoHeight = Math.max(1, photoRect.height);
    const outputScale = previewOutputScale(preview, photoRect, scope);
    const textScale = scale / 3;
    const letterSpacing = clampNumber(settings.letterSpacing != null ? settings.letterSpacing : 0, -0.2, 0.8);
    const lineSpacing = clampNumber(settings.lineSpacing != null ? settings.lineSpacing : 1.28, 0.6, 3);
    const textLines = String(label || '').replace(/\r\n?/g, '\n').split('\n');
    const tileFontSize = Math.max(2, Math.round(14 * outputScale), Math.round(photoWidth * clampNumber(textScale, 0.008, 0.25)));
    const tilePadding = Math.max(1, Math.round(8 * outputScale), Math.round(tileFontSize * 0.65));
    const longestTextLine = textLines.reduce((longest, line) => line.length > longest.length ? line : longest, '');
    const tileTextWidth = Math.max(tileFontSize * 2, Math.round(longestTextLine.length * tileFontSize * 0.72 + Math.max(0, longestTextLine.length - 1) * tileFontSize * letterSpacing)) + tilePadding * 2;
    const tileTextHeight = Math.round(tileFontSize * lineSpacing * textLines.length) + tilePadding * 2;
    const tileImageWidth = Math.max(4, Math.round(24 * outputScale), Math.round(photoWidth * scale));
    const tileImageHeight = Math.max(18, Math.round(tileImageWidth * 0.66));
    const gapRatio = 0.19 - density * 0.014;
    const gapX = Math.max(10, Math.round(photoWidth * clampNumber(gapRatio, 0.045, 0.18)));
    const gapY = Math.max(10, Math.round(photoHeight * clampNumber(gapRatio, 0.045, 0.18)));
    const tileStepX = (imageSource ? tileImageWidth : tileTextWidth) + gapX;
    const tileStepY = (imageSource ? tileImageHeight : tileTextHeight) + gapY;
    const offsetXPx = Math.round(tileStepX * clampNumber(settings.offsetX || 0, -0.5, 0.5) * 2);
    const offsetYPx = Math.round(tileStepY * clampNumber(settings.offsetY || 0, -0.5, 0.5) * 2);
    const tiles = [];
    let row = 0;
    for (let top = -photoHeight * 0.35 + offsetYPx; top < photoHeight * 1.35; top += tileStepY) {
      const stagger = row % 2 ? Math.round(tileStepX / 2) : 0;
      for (let left = -photoWidth * 0.35 + offsetXPx + stagger; left < photoWidth * 1.35; left += tileStepX) {
        tiles.push(imageSource
          ? `<span style="position:absolute;left:${Math.round(left)}px;top:${Math.round(top)}px;width:${tileImageWidth}px;transform:rotate(${rotation}deg);transform-origin:center"><img src="${imageSource}" alt="${safeLabel}" style="width:${tileImageWidth}px;max-width:${tileImageWidth}px"/></span>`
          : `<span style="position:absolute;left:${Math.round(left)}px;top:${Math.round(top)}px;font-size:${tileFontSize}px;letter-spacing:${letterSpacing}em;line-height:${lineSpacing};white-space:pre;transform:rotate(${rotation}deg);transform-origin:center">${safeLabel}</span>`);
      }
      row += 1;
    }
    mark.innerHTML = `<div class="wm-tile-layer" style="position:relative;display:block;width:100%;height:100%;transform:none">${tiles.join('')}</div>`;
    mark.style.inset = 'auto';
    mark.style.left = `${photoRect.left}px`;
    mark.style.top = `${photoRect.top}px`;
    mark.style.right = 'auto';
    mark.style.bottom = 'auto';
    mark.style.width = `${photoWidth}px`;
    mark.style.height = `${photoHeight}px`;
    mark.style.maxWidth = 'none';
    mark.style.fontSize = `${tileFontSize}px`;
    mark.style.transform = 'none';
    mark.classList.add('is-tiled');
    return;
  }

  mark.style.inset = 'auto';
  mark.style.height = 'auto';
  mark.style.maxWidth = '96%';
  mark.innerHTML = imageSource ? `<img src="${imageSource}" alt="${escapeHtml(label)}"/>` : escapeHtml(label);
  if (imageSource) {
    const outputScale = previewOutputScale(preview, photoRect, scope);
    const width = Math.max(4, Math.round(24 * outputScale), Math.round(photoRect.width * scale));
    mark.style.width = `${width}px`;
    mark.style.fontSize = '';
  } else {
    mark.style.width = 'auto';
    mark.style.maxWidth = 'none';
    mark.style.whiteSpace = 'pre';
    const textScale = scale / 3;
    const outputScale = previewOutputScale(preview, photoRect, scope);
    mark.style.fontSize = `${Math.max(2, Math.round(14 * outputScale), Math.round(photoRect.width * clampNumber(textScale, 0.008, 0.25)))}px`;
  }
  const rotation = Number(settings.rotation || 0);
  const position = settings.position || 'bottom-right';
  const horizontalCenter = position.includes('center') || position === 'center';
  const verticalCenter = position.startsWith('center') || position === 'center';
  const translateX = position.endsWith('right') ? '-100%' : horizontalCenter ? '-50%' : '0';
  const translateY = position.startsWith('bottom') ? '-100%' : verticalCenter ? '-50%' : '0';
  const offsetXPx = Math.round((Number(settings.offsetX || 0)) * photoRect.width);
  const offsetYPx = Math.round((Number(settings.offsetY || 0)) * photoRect.height);
  mark.style.transform = `translate(${translateX}, ${translateY}) translate(${offsetXPx}px, ${offsetYPx}px) rotate(${rotation}deg)`;
  const marginX = photoRect.width * 0.04;
  const marginY = photoRect.height * 0.04;
  const anchorX = position.endsWith('right') ? photoRect.left + photoRect.width - marginX : horizontalCenter ? photoRect.left + photoRect.width / 2 : photoRect.left + marginX;
  const anchorY = position.startsWith('bottom') ? photoRect.top + photoRect.height - marginY : verticalCenter ? photoRect.top + photoRect.height / 2 : photoRect.top + marginY;
  mark.style.right = 'auto';
  mark.style.bottom = 'auto';
  mark.style.left = `${Math.round(anchorX)}px`;
  mark.style.top = `${Math.round(anchorY)}px`;
}

function numberFromItem(item, keys) {
  for (const key of keys) {
    const value = key.split('.').reduce((current, part) => current && current[part], item);
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function previewItemDimensions(item) {
  if (!item) return null;
  const width = numberFromItem(item, ['width', 'naturalWidth', 'originalWidth', 'metadata.width', 'meta.width', 'size.width', '_previewNaturalWidth']);
  const height = numberFromItem(item, ['height', 'naturalHeight', 'originalHeight', 'metadata.height', 'meta.height', 'size.height', '_previewNaturalHeight']);
  return width && height ? { width, height } : null;
}

function previewPhotoRect(preview, scope = previewScopeForId(preview)) {
  const stage = preview.querySelector('.preview-stage');
  const previewWidth = Math.max(1, (stage && stage.clientWidth) || preview.clientWidth || 1);
  const previewHeight = Math.max(1, (stage && stage.clientHeight) || preview.clientHeight || 1);
  const state = scopedPreviewState(scope);
  const item = state.items[state.index];
  const dimensions = previewItemDimensions(item);
  if (!dimensions || stage) return { left: 0, top: 0, width: previewWidth, height: previewHeight };
  const imageRatio = dimensions.width / dimensions.height;
  const boxRatio = previewWidth / previewHeight;
  if (imageRatio > boxRatio) {
    const height = previewWidth / imageRatio;
    return { left: 0, top: (previewHeight - height) / 2, width: previewWidth, height };
  }
  const width = previewHeight * imageRatio;
  return { left: (previewWidth - width) / 2, top: 0, width, height: previewHeight };
}

function previewOutputScale(preview, photoRect, scope = previewScopeForId(preview)) {
  const state = scopedPreviewState(scope);
  const item = state.items[state.index];
  const dimensions = previewItemDimensions(item);
  if (!dimensions || !photoRect.width) return 1;
  const maxWidth = preview && preview.id === 'onlinePreview'
    ? Number(config.online.maxWidth || 1920)
    : Number(config.localExport.maxWidth || 0);
  const outputWidth = Math.max(1, maxWidth > 0 ? Math.min(dimensions.width, maxWidth) : dimensions.width);
  return photoRect.width / outputWidth;
}

function refreshActiveWatermarkPreviews() {
  updatePreview('localPreview', watermarkSettingsForScope('local'));
  updatePreview('onlinePreview', watermarkSettingsForScope('online'));
}



globalThis.GravityWatermarkEditor = Object.freeze({
  version: '1.1.2',
  mount: mountWatermarkForm,
  fields: watermarkFields,
  prepare: prepareWatermarkSettings,
  updatePreview,
  refreshPreviews: refreshActiveWatermarkPreviews
});
