(function(root, factory) {
  const api = factory();
  const isCommonJsModule = typeof module === 'object' && module.exports
    && typeof __filename === 'string' && /[\\/]classifier\.js$/.test(__filename);
  if (isCommonJsModule) module.exports = api;
  if (root) root.MAX_FONT_CLASSIFIER = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  const DEFAULT_GROUPS = [
    ['latin-sans', '英文 · 无衬线'],
    ['latin-serif', '英文 · 有衬线'],
    ['latin-handwriting', '英文 · 手写'],
    ['cjk-sans', '中文 · 无衬线'],
    ['cjk-serif', '中文 · 有衬线'],
    ['cjk-handwriting', '中文 · 手写']
  ];

  const NON_TARGET_PATTERN = /arabic|hebrew|devanagari|gurmukhi|gujarati|bengali|bangla|tamil|telugu|kannada|malayalam|sinhala|thai|lao|khmer|myanmar|burmese|tibetan|oriya|odia|korean|japanese|kana|hiragana|katakana|hangul|nanum|malgun|dotum|batang|gothic neo|applemyungjo|apple sd gothic|hiragino kaku|hiragino mincho|hiragino maru|yu mincho|yu gothic|diwan|farah|naskh|kufi|thuluth|kohinoor|noto (?:sans|serif) (?:arabic|hebrew|devanagari|bengali|tamil|telugu|kannada|thai|khmer|myanmar)/i;
  const SYSTEM_PATTERN = /^\.|dingbats|webdings|wingdings|symbol|symbols|emoji|ornament|icon|awesome|material icons|lastresort|braille/i;

  function languageText(entry) {
    return [entry && entry.family, ...((entry && entry.faces) || []).map((face) => face.postscriptName)]
      .filter(Boolean)
      .join(' ');
  }

  function identityText(entry) {
    return [entry && entry.family, ...((entry && entry.faces) || []).flatMap((face) => [face.fullName, face.postscriptName])]
      .filter(Boolean)
      .join(' ');
  }

  function metadataFor(entry, metadata) {
    const records = metadata && metadata.fonts ? metadata.fonts : metadata || {};
    for (const face of (entry && entry.faces) || []) {
      if (face.postscriptName && records[face.postscriptName]) return records[face.postscriptName];
    }
    return records[entry && entry.family] || null;
  }

  function fallbackLanguage(entry) {
    const text = languageText(entry);
    if (NON_TARGET_PATTERN.test(text) || /[\u3040-\u30ff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f\u0e00-\u0e7f\u1100-\u11ff\u3130-\u318f]/.test(text)) return 'exclude';
    if (/[\u3400-\u9fff]/.test(text) || /(?:^|[\s._-])(cjk|sc|tc|hk|gb|gbk|hans|hant)(?:$|[\s._-])|pingfang|microsoft yahei|simsun|simhei|source han|noto (?:sans|serif) (?:cjk|sc|tc|hk)|songti|heiti|kaiti|fangsong|wawati|lantinghei|hanyi|hanzi/i.test(text)) return 'zh';
    return 'latin';
  }

  function fallbackStyle(entry, language) {
    const text = identityText(entry).toLowerCase();
    const handwriting = language === 'zh'
      ? /kaiti|kai(?:ti)?|wawati|hannotate|hand|script|brush|calligraphy|cursive|楷|行|草|隶|篆|书法|手写|签名|钢笔|毛笔|写宋|启体|颜体|魏碑/.test(text)
      : /script|hand|handwriting|brush|calligraphy|cursive|penman|signature|chalk|marker|comic|casual/.test(text);
    if (handwriting) return 'handwriting';
    const serif = language === 'zh'
      ? /serif|songti|simsun|song|sung|ming|fangsong|宋|明|仿宋/.test(text)
      : /serif|times|georgia|baskerville|didot|garamond|bodoni|palatino|bookman|cambria|constantia|caslon|minion|rockwell|slab/.test(text);
    return serif ? 'serif' : 'sans';
  }

  function fontFamilyVariant(family, face = {}) {
    const sourceFamily = String(family || '').trim();
    const familyMatch = sourceFamily.match(/^(.*?)(?:\s+(Italic))?\s+(\d{2,4})W$/i);
    const faceText = [face.label, face.styleName, face.fullName, face.fullname, face.postscriptName, face.postscript, face._name]
      .filter(Boolean)
      .join(' ');
    const faceMatch = faceText.match(/(?:^|[\s_-])(Italic[\s_-]+)?(\d{2,4})W(?:$|[\s_-])/i);
    const weightCode = familyMatch ? Number(familyMatch[3]) : faceMatch ? Number(faceMatch[2]) : null;
    const italic = !!(familyMatch && familyMatch[2]) || /italic|oblique|斜/i.test(`${sourceFamily} ${faceText}`);
    return {
      family: familyMatch ? familyMatch[1].trim() : sourceFamily,
      weight: weightCode ? Math.min(900, Math.max(100, weightCode)) : null,
      style: italic ? 'italic' : null,
      label: weightCode ? `${familyMatch && familyMatch[2] ? 'Italic ' : ''}${weightCode}W` : ''
    };
  }

  function classifyFont(entry, options = {}) {
    const classification = options.classification || {};
    const overrides = classification.overrides || {};
    const excluded = new Set(classification.excluded || []);
    if (!entry || !entry.family || excluded.has(entry.family)) return null;
    if (Object.prototype.hasOwnProperty.call(overrides, entry.family)) return overrides[entry.family] || null;
    const sourceText = languageText(entry);
    if (SYSTEM_PATTERN.test(sourceText)) return null;
    if (fallbackLanguage(entry) === 'exclude') return null;

    const metadata = metadataFor(entry, options.metadata);
    const fallback = fallbackLanguage(entry);
    const coverage = metadata && metadata.coverage && typeof metadata.coverage === 'object'
      ? metadata.coverage
      : {};
    if (
      metadata?.language === 'exclude'
      && Number(coverage.latin || 0) < 0.8
      && Number(coverage.han || 0) < 0.8
    ) return null;
    // A Latin family may also contain Arabic/Hebrew glyph coverage (Arial and
    // Times New Roman are common examples). Metadata marks those faces as
    // "exclude", but the family is still a valid Latin font. Only trust a
    // positive zh/latin metadata classification; otherwise fall back to the
    // family identity classifier, which continues to reject non-target
    // scripts by name.
    const language = metadata && (metadata.language === 'zh' || metadata.language === 'latin')
      ? metadata.language
      : fallback;
    if (language !== 'zh' && language !== 'latin') return null;
    const metadataStyleIsReliable = metadata && ['sans', 'serif', 'handwriting'].includes(metadata.style) && metadata.confidence !== 'low' && !(
      language === 'zh' && metadata.style === 'handwriting' && metadata.source === 'OS/2.sFamilyClass'
    );
    const style = metadataStyleIsReliable ? metadata.style : fallbackStyle(entry, language);
    const group = `${language === 'zh' ? 'cjk' : 'latin'}-${style}`;
    const allowed = new Set((classification.groups || DEFAULT_GROUPS).map(([id]) => id));
    return allowed.has(group) ? group : `${language === 'zh' ? 'cjk' : 'latin'}-sans`;
  }

  function mergeClassification(base = {}, custom = {}) {
    const normalizeGroup = (group) => group === 'latin-other' ? 'latin-sans' : group === 'cjk-other' ? 'cjk-sans' : group;
    const overrides = {
      ...(base.overrides && typeof base.overrides === 'object' ? base.overrides : {}),
      ...(custom.overrides && typeof custom.overrides === 'object' ? custom.overrides : {})
    };
    for (const family of Object.keys(overrides)) overrides[family] = normalizeGroup(overrides[family]);
    const excluded = [...new Set([
      ...(Array.isArray(base.excluded) ? base.excluded : []),
      ...(Array.isArray(custom.excluded) ? custom.excluded : [])
    ])];
    return {
      ...base,
      groups: Array.isArray(base.groups) ? base.groups : DEFAULT_GROUPS,
      overrides,
      excluded
    };
  }

  function buildFontGroups(catalog, options = {}) {
    const groups = options.classification && Array.isArray(options.classification.groups)
      ? options.classification.groups
      : DEFAULT_GROUPS;
    const buckets = new Map(groups.map(([id, label]) => [id, { id, label, fonts: [] }]));
    for (const entry of catalog || []) {
      const id = classifyFont(entry, options);
      if (id && buckets.has(id)) buckets.get(id).fonts.push(entry.family);
    }
    return groups
      .map(([id]) => buckets.get(id))
      .filter((group) => group.fonts.length)
      .map((group) => ({
        ...group,
        fonts: [...new Set(group.fonts)].sort((a, b) => String(a).replace(/^\./, '').localeCompare(String(b).replace(/^\./, ''), 'zh-Hans-CN'))
      }));
  }

  return { DEFAULT_GROUPS, classifyFont, buildFontGroups, metadataFor, mergeClassification, fontFamilyVariant };
});
