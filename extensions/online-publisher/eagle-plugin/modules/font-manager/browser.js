/* MAX Publisher 1.0 · portable font manager browser module.
 * Host contract: config, saveConfig, $, runtimeFontCatalog, FALLBACK_FONT_CATALOG.
 */

function escapeFontHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clampFontNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function uniqueFonts(fonts) {
  return [...new Set(fonts.filter(Boolean).map((font) => String(font).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function inferFaceTraits(face = {}) {
  const text = `${face.style || ''} ${face.fullName || face.fullname || ''} ${face._name || ''}`.toLowerCase();
  let weight = 400;
  if (/thin|hairline|ultralight|extra ?light|极细|特细|纤细/.test(text)) weight = 100;
  else if (/light|细体|细/.test(text)) weight = 300;
  else if (/medium|中等|中黑|中粗/.test(text)) weight = 500;
  else if (/semi ?bold|demi ?bold|半粗/.test(text)) weight = 600;
  else if (/extra ?bold|ultra ?bold|特粗|超粗/.test(text)) weight = 800;
  else if (/black|heavy|bold|粗体|粗|黑体|黑/.test(text)) weight = 700;
  if (/extra ?black|ultra ?black|特黑/.test(text)) weight = 900;
  const style = /italic|oblique|斜/.test(text) ? 'italic' : 'normal';
  return { weight, style };
}

function styleSortValue(face) {
  return (face.style === 'italic' ? 10000 : 0) + Number(face.weight || 400);
}

function fontFamilyVariant(family, rawFace = {}) {
  if (window.MAX_FONT_CLASSIFIER && typeof window.MAX_FONT_CLASSIFIER.fontFamilyVariant === 'function') {
    return window.MAX_FONT_CLASSIFIER.fontFamilyVariant(family, rawFace);
  }
  const familyMatch = String(family || '').match(/^(.*?)(?:\s+(Italic))?\s+(\d{2,4})W$/i);
  const faceText = [rawFace.label, rawFace.styleName, rawFace.fullName, rawFace.fullname, rawFace.postscriptName, rawFace.postscript, rawFace._name]
    .filter(Boolean)
    .join(' ');
  const weightMatch = familyMatch || faceText.match(/(?:^|[\s_-])(Italic[\s_-]+)?(\d{2,4})W(?:$|[\s_-])/i);
  const weightCode = weightMatch ? Number(familyMatch ? familyMatch[3] : weightMatch[2]) : null;
  const italic = !!(familyMatch && familyMatch[2]) || /italic|oblique|斜/i.test(`${family} ${faceText}`);
  return {
    family: familyMatch ? familyMatch[1].trim() : family,
    weight: weightCode ? clampFontNumber(weightCode, 100, 900) : null,
    style: italic ? 'italic' : null,
    label: weightCode ? `${familyMatch && familyMatch[2] ? 'Italic ' : ''}${weightCode}W` : ''
  };
}

function normalizeFontCatalog(catalog) {
  const byFamily = new Map();
  for (const item of catalog || []) {
    const sourceFamily = String(item.family || '').trim();
    if (!sourceFamily) continue;
    const familyVariant = fontFamilyVariant(sourceFamily);
    const family = familyVariant.family;
    if (!byFamily.has(family)) byFamily.set(family, { family, faces: [], sourceFamilies: [] });
    const target = byFamily.get(family);
    if (!target.sourceFamilies.includes(sourceFamily)) target.sourceFamilies.push(sourceFamily);
    for (const rawFace of item.faces || []) {
      const traits = inferFaceTraits(rawFace);
      const variant = fontFamilyVariant(sourceFamily, rawFace);
      const label = variant.label || String(rawFace.label || rawFace.styleName || rawFace.style || rawFace.fullName || rawFace.fullname || rawFace.name || '常规体').trim();
      const face = {
        label,
        fullName: String(rawFace.fullName || rawFace.fullname || rawFace.name || sourceFamily).trim(),
        postscriptName: String(rawFace.postscriptName || rawFace.postscript || rawFace._name || rawFace.name || rawFace.fullName || sourceFamily).trim(),
        fontPath: String(rawFace.fontPath || rawFace.path || '').trim(),
        weight: Number(variant.weight || rawFace.weight || traits.weight),
        style: variant.style || rawFace.fontStyle || rawFace.cssStyle || rawFace.styleValue || traits.style
      };
      // system_profiler can report the same physical face more than once
      // with different localized full names. PostScript name identifies the
      // actual face; keeping both rows creates duplicate "weights" whose
      // preview must be identical because they are the same font instance.
      const signature = face.postscriptName || `${face.fullName}|${face.label}`;
      const existing = target.faces.find((candidate) =>
        (candidate.postscriptName || `${candidate.fullName}|${candidate.label}`) === signature
      );
      if (existing) {
        if (!existing.fontPath && face.fontPath) existing.fontPath = face.fontPath;
      } else {
        target.faces.push(face);
      }
    }
    if (!target.faces.length) {
      target.faces.push({ label: '常规体', fullName: family, postscriptName: family, weight: 400, style: 'normal' });
    }
  }
  for (const font of byFamily.values()) {
    const hasInstalledFace = font.faces.some((face) => face.fontPath);
    if (hasInstalledFace) {
      font.faces = font.faces.filter((face) => (
        face.fontPath
        || face.fullName !== font.family
        || face.postscriptName !== font.family
      ));
    }
    font.faces.sort((a, b) => styleSortValue(a) - styleSortValue(b) || a.label.localeCompare(b.label, 'zh-Hans-CN'));
  }
  return [...byFamily.values()].sort((a, b) => a.family.localeCompare(b.family, 'zh-Hans-CN'));
}

function displayFontName(family) {
  return String(family || '').replace(/^\./, '');
}

function fontClassificationPreferences() {
  if (!config.fontClassification || typeof config.fontClassification !== 'object') {
    config.fontClassification = { version: 1, overrides: {}, excluded: [] };
  }
  if (!config.fontClassification.overrides || typeof config.fontClassification.overrides !== 'object' || Array.isArray(config.fontClassification.overrides)) {
    config.fontClassification.overrides = {};
  }
  if (!Array.isArray(config.fontClassification.excluded)) config.fontClassification.excluded = [];
  if (!Array.isArray(config.fontClassification.favorites)) config.fontClassification.favorites = [];
  config.fontClassification.favorites = [...new Set(config.fontClassification.favorites
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).trim())
    .filter(Boolean))];
  return config.fontClassification;
}

function baseFontClassification() {
  return window.MAX_FONT_CLASSIFICATION || { groups: window.MAX_FONT_CLASSIFIER.DEFAULT_GROUPS, overrides: {}, excluded: [] };
}

function effectiveFontClassification() {
  const base = baseFontClassification();
  if (!window.MAX_FONT_CLASSIFIER || typeof window.MAX_FONT_CLASSIFIER.mergeClassification !== 'function') return base;
  return window.MAX_FONT_CLASSIFIER.mergeClassification(base, fontClassificationPreferences());
}

function buildFontGroups(catalog) {
  if (!window.MAX_FONT_CLASSIFIER) return [{ id: 'latin-sans', label: '英文字体', fonts: uniqueFonts(catalog.map((entry) => entry.family)) }];
  return window.MAX_FONT_CLASSIFIER.buildFontGroups(catalog, {
    metadata: window.MAX_FONT_METADATA || {},
    classification: effectiveFontClassification()
  });
}

function fontGroupDefinitions() {
  return (baseFontClassification().groups || window.MAX_FONT_CLASSIFIER.DEFAULT_GROUPS || []).map(([id, label]) => ({ id, label }));
}

function classifyFontWith(classification, entry) {
  return window.MAX_FONT_CLASSIFIER.classifyFont(entry, {
    metadata: window.MAX_FONT_METADATA || {},
    classification
  });
}

function rebuildFontGroups() {
  availableFontGroups = buildFontGroups(availableFontCatalog);
  availableFonts = availableFontGroups.reduce((fonts, group) => fonts.concat(group.fonts), []);
  renderFontPickers();
  renderFontManager();
}

function fontManagerRecords() {
  if (!window.MAX_FONT_CLASSIFIER) return [];
  const base = baseFontClassification();
  const effective = effectiveFontClassification();
  const preferences = fontClassificationPreferences();
  const manuallyExcluded = new Set(preferences.excluded);
  return availableFontCatalog
    .map((entry) => {
      const baseGroup = classifyFontWith(base, entry);
      if (!baseGroup) return null;
      const hidden = manuallyExcluded.has(entry.family);
      return {
        entry,
        family: entry.family,
        baseGroup,
        group: hidden ? null : classifyFontWith(effective, entry),
        hidden,
        manual: hidden || Object.prototype.hasOwnProperty.call(preferences.overrides, entry.family)
      };
    })
    .filter(Boolean);
}

function renderFontManager() {
  const container = $('fontManagerGroups');
  if (!container) return;
  if (!fontCatalogReady) {
    container.innerHTML = '<div class="font-manager-empty">正在读取 Mac 字体列表…</div>';
    return;
  }
  const definitions = fontGroupDefinitions();
  const labelById = Object.fromEntries(definitions.map((item) => [item.id, item.label]));
  const search = String(value('fontManagerSearch') || '').trim().toLocaleLowerCase('zh-Hans-CN');
  const filter = value('fontManagerFilter') || 'all';
  const preferences = fontClassificationPreferences();
  const records = fontManagerRecords();
  const visible = records.filter((record) => {
    if (search && !record.family.toLocaleLowerCase('zh-Hans-CN').includes(search)) return false;
    if (filter === 'manual') return record.manual;
    if (filter === 'hidden') return record.hidden;
    if (filter !== 'all') return record.group === filter;
    return true;
  });
  const sections = definitions.map((definition) => ({
    ...definition,
    records: visible.filter((record) => !record.hidden && record.group === definition.id)
  }));
  sections.push({ id: 'hidden', label: '已隐藏', records: visible.filter((record) => record.hidden) });
  container.innerHTML = '';
  for (const section of sections) {
    if (!section.records.length) continue;
    const block = document.createElement('section');
    block.className = 'font-manager-section';
    const title = document.createElement('div');
    title.className = 'font-manager-section-title';
    title.innerHTML = `<strong>${escapeFontHtml(section.label)}</strong><span>${section.records.length}</span>`;
    block.append(title);
    const rows = document.createElement('div');
    rows.className = 'font-manager-rows';
    for (const record of section.records) {
      const row = document.createElement('div');
      row.className = `font-manager-row${record.manual ? ' is-manual' : ''}${record.hidden ? ' is-hidden' : ''}`;
      row.dataset.fontFamily = record.family;
      const preview = document.createElement('div');
      preview.className = 'font-manager-font';
      preview.innerHTML = `<strong>${escapeFontHtml(displayFontName(record.family))}</strong><small>字体分类：${escapeFontHtml(labelById[record.group || record.baseGroup] || record.group || record.baseGroup)} · ${record.entry.faces.length} 个字重/样式</small>`;
      const previewName = preview.querySelector('strong');
      const initialFace = record.entry.faces[0];
      applyExactFontPreview(previewName, { fontFamily: record.family }, defaultFaceForEntry(record.entry), record.entry);
      row.append(preview);
      const faceSelect = document.createElement('select');
      faceSelect.className = 'font-manager-face-select';
      faceSelect.dataset.fontManagerFace = record.family;
      faceSelect.disabled = record.hidden;
      faceSelect.setAttribute('aria-label', `${displayFontName(record.family)}字重`);
      for (const [faceIndex, face] of record.entry.faces.entries()) {
        const option = document.createElement('option');
        option.value = String(faceIndex);
        option.textContent = face.label || face.fullName || '常规体';
        option.title = face.fullName || face.postscriptName || option.textContent;
        faceSelect.append(option);
      }
      row.append(faceSelect);
      const select = document.createElement('select');
      select.className = 'font-manager-group-select';
      select.dataset.fontManagerGroup = record.family;
      select.disabled = record.hidden;
      for (const definition of definitions) {
        const option = document.createElement('option');
        option.value = definition.id;
        option.textContent = definition.label;
        select.append(option);
      }
      select.value = record.group || record.baseGroup;
      row.append(select);
      const action = document.createElement('button');
      action.type = 'button';
      action.className = record.hidden ? 'secondary font-manager-unhide' : 'secondary font-manager-hide';
      action.dataset.fontManagerAction = record.hidden ? 'unhide' : 'hide';
      action.dataset.fontFamily = record.family;
      action.textContent = record.hidden ? '恢复显示' : '隐藏';
      row.append(action);
      rows.append(row);
    }
    block.append(rows);
    container.append(block);
  }
  if (!container.children.length) container.innerHTML = '<div class="font-manager-empty">没有符合当前条件的字体</div>';
  const manualCount = records.filter((record) => record.manual).length;
  if ($('fontManagerCount')) $('fontManagerCount').textContent = `${records.length} 个字体 · ${manualCount} 个人工调整`;
  if ($('fontManagerMessage')) $('fontManagerMessage').textContent = manualCount ? `已保存 ${manualCount} 个手动调整` : '未进行人工调整';
}

function persistFontManagerChange(message) {
  save();
  rebuildFontGroups();
  if (globalThis.GravityWatermarkEditor) GravityWatermarkEditor.refreshPreviews();
  if ($('fontManagerMessage')) $('fontManagerMessage').textContent = message;
  notify(message);
}

function catalogFromFlatFonts(fonts) {
  return normalizeFontCatalog(uniqueFonts(fonts).map((family) => ({ family, faces: [{ label: '常规体', fullName: family, postscriptName: family, weight: 400, style: 'normal' }] })));
}

function catalogFromSystemProfiler(data) {
  const catalog = [];
  for (const font of data.SPFontsDataType || []) {
    for (const face of font.typefaces || []) {
      if (face.enabled === 'no') continue;
      const family = face.family || font.family || font._name || font.name;
      if (!family) continue;
      const traits = inferFaceTraits(face);
      catalog.push({
        family,
        faces: [{
          label: face.style || face.fullname || face._name || '常规体',
          fullName: face.fullname || face._name || family,
          postscriptName: face._name || face.fullname || family,
          fontPath: font.path || '',
          weight: traits.weight,
          style: traits.style
        }]
      });
    }
  }
  return normalizeFontCatalog([...FALLBACK_FONT_CATALOG, ...catalog]);
}

function fontFamilyEntry(family, options = {}) {
  const exact = availableFontCatalog.find((font) => font.family === family);
  const canonicalFamily = fontFamilyVariant(String(family || '')).family;
  const canonical = exact || availableFontCatalog.find((font) => font.family === canonicalFamily || (font.sourceFamilies || []).includes(family));
  if (canonical || options.allowFallback === false) return canonical || null;
  return availableFontCatalog.find((font) => font.family === 'Arial') || FALLBACK_FONT_CATALOG[0];
}

function defaultFaceForEntry(entry) {
  if (!entry || !entry.faces || !entry.faces.length) return null;
  const regularPattern = /(?:^|\b)(regular|roman|book|normal|常规|標準|标准|普通|预设|預設)(?:\b|$)/i;
  const variantPattern = /thin|hairline|light|medium|semibold|demibold|bold|black|heavy|condensed|extended|narrow|wide|italic|oblique|细|粗|黑|窄|宽|斜/i;
  return entry.faces.find((face) =>
    Number(face.weight || 400) === 400
    && (face.style || 'normal') === 'normal'
    && regularPattern.test(`${face.label || ''} ${face.fullName || ''}`)
    && !variantPattern.test(`${face.label || ''} ${face.postscriptName || ''}`)
  ) || entry.faces.find((face) =>
    Number(face.weight || 400) === 400
    && (face.style || 'normal') === 'normal'
    && !variantPattern.test(`${face.label || ''} ${face.postscriptName || ''}`)
  ) || entry.faces.find((face) => Number(face.weight || 400) === 400 && (face.style || 'normal') === 'normal')
    || entry.faces.find((face) => (face.style || 'normal') === 'normal')
    || entry.faces[0];
}

function selectedFaceForSettings(settings, entry) {
  if (!entry) return null;
  const postscriptName = settings && settings.fontPostscriptName;
  if (postscriptName) {
    const exactPostscript = entry.faces.find((face) => face.postscriptName === postscriptName);
    if (exactPostscript) return exactPostscript;
  }
  const selectedValue = settings && settings.fontFace;
  if (selectedValue) {
    const exact = entry.faces.filter((face) => face.fullName === selectedValue || face.label === selectedValue);
    if (exact.length === 1) return exact[0];
  }
  return defaultFaceForEntry(entry);
}

function faceValue(face) {
  return face ? (face.postscriptName || face.fullName || face.label || '') : '';
}

function faceMatchesValue(face, value) {
  return !!face && !!value && (face.fullName === value || face.postscriptName === value || face.label === value);
}

function runtimeWatermarkSettings(settings) {
  if (!settings || settings.type === 'image') return settings;
  const entry = fontFamilyEntry(settings.fontFamily, { allowFallback: false });
  if (!entry) return settings;
  const face = selectedFaceForSettings(settings, entry);
  if (!face) return settings;
  return {
    ...settings,
    fontFace: face.fullName || face.postscriptName || entry.family,
    fontPostscriptName: face.postscriptName || '',
    fontPath: face.fontPath || '',
    fontWeight: Number(face.weight || 400),
    fontStyle: face.style || 'normal'
  };
}

function runtimePublisherConfig() {
  return {
    ...config,
    localExport: {
      ...config.localExport,
      watermark: runtimeWatermarkSettings(config.localExport.watermark)
    },
    online: {
      ...config.online,
      watermark: runtimeWatermarkSettings(config.online.watermark)
    }
  };
}

function quoteFontName(value) {
  return `"${String(value || '').replace(/"/g, '\\"')}"`;
}

const exactFontFaceAliases = new Map();

function stableFontId(value) {
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function exactFontAssetUrl(fontPath) {
  if (!fontPath) return '';
  if (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)) {
    return `/api/font-file?path=${encodeURIComponent(fontPath)}`;
  }
  return fileUrl(fontPath);
}

function exactFontFaceAlias(face, entry = null) {
  if (!face || typeof document === 'undefined') return '';
  const identity = [entry && entry.family, face.postscriptName, face.fullName, face.fontPath].filter(Boolean).join('|');
  if (!identity) return '';
  if (exactFontFaceAliases.has(identity)) return exactFontFaceAliases.get(identity);
  const alias = `MAXExactFont-${stableFontId(identity)}`;
  const sources = [];
  if (face.postscriptName) sources.push(`local(${quoteFontName(face.postscriptName)})`);
  if (face.fullName && face.fullName !== face.postscriptName) sources.push(`local(${quoteFontName(face.fullName)})`);
  const assetUrl = exactFontAssetUrl(face.fontPath);
  if (assetUrl) sources.push(`url(${quoteFontName(assetUrl)})`);
  if (!sources.length) return '';
  let stylesheet = document.getElementById('max-exact-font-faces');
  if (!stylesheet) {
    stylesheet = document.createElement('style');
    stylesheet.id = 'max-exact-font-faces';
    document.head.append(stylesheet);
  }
  stylesheet.append(document.createTextNode(`\n@font-face{font-family:${quoteFontName(alias)};src:${sources.join(',')};font-style:normal;font-weight:400;font-display:block;}`));
  exactFontFaceAliases.set(identity, alias);
  if (document.fonts && typeof document.fonts.load === 'function') {
    document.fonts.load(`24px ${quoteFontName(alias)}`).catch(() => {});
  }
  return alias;
}

function fontCssStack(settings = {}, face = null, entry = null) {
  const exactAlias = exactFontFaceAlias(face, entry);
  const names = [
    exactAlias,
    face && face.fullName,
    face && face.postscriptName,
    settings.fontFace,
    settings.fontPostscriptName,
    entry && entry.family,
    settings.fontFamily,
    'Arial',
    'sans-serif'
  ].filter(Boolean);
  return [...new Set(names)].map((name) => name === 'sans-serif' ? name : quoteFontName(name)).join(', ');
}

function applyExactFontPreview(element, settings = {}, face = null, entry = null) {
  if (!element) return;
  element.style.fontFamily = fontCssStack(settings, face, entry);
  element.style.fontWeight = '400';
  element.style.fontStyle = 'normal';
  element.style.fontSynthesis = 'none';
}

function applyFontFace(settings, face) {
  if (!face) return;
  settings.fontFace = face.fullName || face.postscriptName || settings.fontFamily;
  settings.fontPostscriptName = face.postscriptName || '';
  settings.fontPath = face.fontPath || '';
  settings.fontWeight = Number(face.weight || 400);
  settings.fontStyle = face.style || 'normal';
}

function bundledFontCatalog() {
  if (typeof window === 'undefined') return null;
  if (Array.isArray(window.MAX_FONT_CATALOG) && window.MAX_FONT_CATALOG.length) {
    return normalizeFontCatalog([...FALLBACK_FONT_CATALOG, ...window.MAX_FONT_CATALOG]);
  }
  if (Array.isArray(window.MAX_SYSTEM_FONTS) && window.MAX_SYSTEM_FONTS.length) {
    return catalogFromFlatFonts([...FALLBACK_FONTS, ...window.MAX_SYSTEM_FONTS]);
  }
  return null;
}

function loadSystemFontCatalog() {
  const bundled = bundledFontCatalog();
  if (bundled) return Promise.resolve(bundled);
  if (!childProcess) {
    if (typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function') {
      return window.queryLocalFonts()
        .then((fonts) => normalizeFontCatalog([
          ...FALLBACK_FONT_CATALOG,
          ...fonts.map((font) => ({
            family: font.family,
            faces: [{
              label: font.style || font.fullName || '常规体',
              fullName: font.fullName || font.family,
              postscriptName: font.postscriptName || font.fullName || font.family,
              ...inferFaceTraits(font)
            }]
          }))
        ]))
        .catch((error) => FALLBACK_FONT_CATALOG);
    }
    return Promise.resolve(FALLBACK_FONT_CATALOG);
  }
  return new Promise((resolve) => {
    childProcess.execFile('system_profiler', ['SPFontsDataType', '-json'], { timeout: 60000, maxBuffer: 40 * 1024 * 1024 }, (error, stdout) => {
      if (error || !stdout) return resolve(FALLBACK_FONT_CATALOG);
      try {
        resolve(catalogFromSystemProfiler(JSON.parse(stdout)));
      } catch (error) {
        resolve(FALLBACK_FONT_CATALOG);
      }
    });
  });
}

function renderFontStyleSelects() {
  document.querySelectorAll('[data-font-face-picker]').forEach((picker) => {
    const container = picker.closest('.watermark-form');
    const familyInput = container ? container.querySelector('[data-key="fontFamily"]') : null;
    const family = (familyInput && familyInput.value) || picker.dataset.family || 'Arial';
    const settings = container ? container._watermarkSettings : null;
    const entry = fontFamilyEntry(family, { allowFallback: false });
    const button = picker.querySelector('.font-face-picker-button');
    const input = picker.querySelector('[data-key="fontFace"]');
    const list = picker.querySelector('[data-font-face-list]');
    const current = (settings && (settings.fontPostscriptName || settings.fontFace)) || picker.dataset.current || '';
    if (list) list.innerHTML = '';
    if (!entry) {
      if (input) input.value = current || family;
      if (button) button.querySelector('span').textContent = current && current !== family ? current : '当前样式';
      return;
    }
    const selectedFace = selectedFaceForSettings(settings, entry)
      || entry.faces.find((face) => faceMatchesValue(face, current));
    for (const face of entry.faces) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'font-option font-face-option';
      option.dataset.fontFaceValue = faceValue(face);
      option.textContent = face.label || face.fullName || '常规体';
      option.classList.toggle('active', face === selectedFace);
      if (list) list.append(option);
    }
    if (selectedFace) {
      if (input) input.value = faceValue(selectedFace);
      if (button) {
        button.querySelector('span').textContent = selectedFace.label || selectedFace.fullName || '常规体';
        button.setAttribute('aria-label', `当前字重：${selectedFace.label || selectedFace.fullName || '常规体'}`);
      }
    }
  });
}

function centerActivePickerOption(picker, selector = '.font-option.active') {
  if (!picker) return;
  window.requestAnimationFrame(() => {
    const list = picker.querySelector('.font-picker-menu');
    const active = picker.querySelector(selector);
    if (!list || !active) return;
    const centeredTop = active.offsetTop - Math.max(0, (list.clientHeight - active.offsetHeight) / 2);
    list.scrollTop = Math.max(0, centeredTop);
  });
}

function togglePickerMenu(picker, activeSelector) {
  if (!picker) return;
  const shouldOpen = !picker.classList.contains('open');
  const form = picker.closest('.watermark-form');
  if (form) form.querySelectorAll('.font-picker.open').forEach((item) => item.classList.remove('open'));
  picker.classList.toggle('open', shouldOpen);
  if (shouldOpen) centerActivePickerOption(picker, activeSelector);
}

function favoriteFontFamilies() {
  const available = new Set(availableFonts);
  return fontClassificationPreferences().favorites.filter((family) => available.has(family));
}

function toggleFontFavorite(family) {
  if (!family) return false;
  const preferences = fontClassificationPreferences();
  const wasFavorite = preferences.favorites.includes(family);
  const openLists = [...document.querySelectorAll('.font-picker.open [data-font-list]')].map((list) => ({
    list,
    scrollTop: list.scrollTop,
    scrollHeight: list.scrollHeight
  }));
  preferences.favorites = wasFavorite
    ? preferences.favorites.filter((item) => item !== family)
    : [...preferences.favorites, family];
  save();
  renderFontPickers();
  for (const state of openLists) {
    const insertedHeight = state.list.scrollHeight - state.scrollHeight;
    state.list.scrollTop = Math.max(0, state.scrollTop + insertedHeight);
  }
  return !wasFavorite;
}

function appendFontPickerGroup(list, labelText, fonts, copyType) {
  if (!list || !fonts.length) return;
  const label = document.createElement('div');
  label.className = `font-group-label${copyType === 'favorite' ? ' font-favorite-group-label' : ''}`;
  label.textContent = labelText;
  list.append(label);
  const favorites = new Set(favoriteFontFamilies());
  for (const font of fonts) {
    const row = document.createElement('div');
    row.className = 'font-option-row';
    row.dataset.fontCopy = copyType;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'font-option';
    item.dataset.fontValue = font;
    item.dataset.fontCopy = copyType;
    item.textContent = displayFontName(font);
    const favorite = document.createElement('button');
    const isFavorite = favorites.has(font);
    favorite.type = 'button';
    favorite.className = `font-favorite-toggle${isFavorite ? ' is-favorite' : ''}`;
    favorite.dataset.fontFavorite = font;
    favorite.setAttribute('aria-label', `${isFavorite ? '取消收藏' : '收藏'}${displayFontName(font)}`);
    favorite.setAttribute('aria-pressed', String(isFavorite));
    favorite.title = isFavorite ? '取消收藏' : '收藏';
    favorite.textContent = isFavorite ? '★' : '☆';
    const entry = fontFamilyEntry(font, { allowFallback: false });
    applyExactFontPreview(item, { fontFamily: font }, defaultFaceForEntry(entry), entry);
    row.append(item, favorite);
    list.append(row);
  }
}

function renderFontPickers() {
  document.querySelectorAll('[data-font-picker]').forEach((picker) => {
    const input = picker.querySelector('[data-key="fontFamily"]');
    const button = picker.querySelector('.font-picker-button');
    const list = picker.querySelector('[data-font-list]');
    const current = (input && input.value) || picker.dataset.current || 'Arial';
    const container = picker.closest('.watermark-form');
    const settings = (container && container._watermarkSettings) || { fontFamily: current };
    // The manager can move families between groups without changing either
    // group's item count. Include the complete grouped catalog so the editor
    // always rebuilds after a manual classification or visibility change.
    const favorites = favoriteFontFamilies();
    const renderKey = `${favorites.join('\u001f')}\u001d${availableFontGroups
      .map((group) => `${group.id}:${group.label}:${group.fonts.join('\u001f')}`)
      .join('\u001e')}`;
    if (list && list.dataset.rendered !== renderKey) {
      list.innerHTML = '';
      appendFontPickerGroup(list, '收藏', favorites, 'favorite');
      for (const group of availableFontGroups) {
        appendFontPickerGroup(list, group.label, group.fonts, 'original');
      }
      list.dataset.rendered = renderKey;
    }
    if (list) {
      list.querySelectorAll('[data-font-value]').forEach((item) => {
        const isActive = item.dataset.fontValue === current;
        item.classList.toggle('active', isActive);
        const row = item.closest('.font-option-row');
        if (row) row.classList.toggle('active', isActive);
        const entry = fontFamilyEntry(item.dataset.fontValue, { allowFallback: false });
        const face = isActive ? selectedFaceForSettings(settings, entry) : defaultFaceForEntry(entry);
        applyExactFontPreview(item, { fontFamily: item.dataset.fontValue }, face, entry);
      });
    }
    if (button) {
      button.querySelector('span').textContent = displayFontName(current);
      button.setAttribute('aria-label', `当前字体：${displayFontName(current)}`);
      const entry = fontFamilyEntry(current, { allowFallback: false });
      const face = selectedFaceForSettings(settings, entry);
      applyExactFontPreview(button, settings, face, entry);
    }
  });
  renderFontStyleSelects();
}

async function refreshFonts() {
  renderFontPickers();
  renderFontManager();
  availableFontCatalog = await loadSystemFontCatalog();
  fontCatalogReady = true;
  rebuildFontGroups();
  renderFontPickers();
  renderFontManager();
  if (globalThis.GravityWatermarkEditor) GravityWatermarkEditor.refreshPreviews();
}



globalThis.GravityFontManager = Object.freeze({
  version: '1.1.2',
  refresh: refreshFonts,
  render: renderFontManager,
  favorites: () => favoriteFontFamilies().slice(),
  toggleFavorite: toggleFontFavorite,
  groups: () => availableFontGroups.map((group) => ({
    id: group.id,
    label: group.label,
    fonts: group.fonts.slice()
  })),
  catalog: () => runtimeFontCatalog.slice(),
  entry: (family) => {
    const entry = fontFamilyEntry(family, { allowFallback: false });
    return entry ? { ...entry, faces: entry.faces.map((face) => ({ ...face })) } : null;
  },
  resolveFace(settings) {
    const entry = availableFontCatalog.find((font) => font.family === settings.fontFamily);
    return entry ? selectedFaceForSettings(settings, entry) : null;
  },
  applyFace: applyFontFace,
  applyPreview(element, settings = {}) {
    const entry = fontFamilyEntry(settings.fontFamily, { allowFallback: false });
    const face = selectedFaceForSettings(settings, entry);
    applyExactFontPreview(element, settings, face, entry);
  }
});
