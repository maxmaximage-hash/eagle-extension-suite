const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const adapterSource = fs.readFileSync(
  path.resolve(__dirname, '../eagle-plugin/adapters/eagle/plugin.js'),
  'utf8'
);
const watermarkSource = fs.readFileSync(
  path.resolve(__dirname, '../eagle-plugin/modules/watermark-editor/browser.js'),
  'utf8'
);
const fontSource = fs.readFileSync(
  path.resolve(__dirname, '../eagle-plugin/modules/font-manager/browser.js'),
  'utf8'
);
const quickExportSource = fs.readFileSync(
  path.resolve(__dirname, '../eagle-plugin/modules/quick-export/browser.js'),
  'utf8'
);
const pluginSource = `${adapterSource}\n${fontSource}\n${watermarkSource}\n${quickExportSource}`;
const pluginHtml = fs.readFileSync(
  path.resolve(__dirname, '../eagle-plugin/index.html'),
  'utf8'
);
const pluginStyles = fs.readFileSync(
  path.resolve(__dirname, '../eagle-plugin/modules/watermark-editor/editor.css'),
  'utf8'
);

test('预览代码没有 MAX 或 LOGO 的隐式占位文字', () => {
  assert.doesNotMatch(pluginSource, /:\s*['"]MAX['"]/);
  assert.doesNotMatch(pluginSource, /:\s*['"]LOGO['"]/);
});

test('字体目录刷新只重绘，不修改或保存水印预设', () => {
  const match = fontSource.match(/async function refreshFonts\(\) \{([\s\S]*?)\n\}/);
  assert.ok(match, '未找到 refreshFonts');
  assert.doesNotMatch(match[1], /\bsave\s*\(/);
  assert.doesNotMatch(match[1], /watermarkPresets|preset\.watermark|reconcile/);
});

test('旧的字体自动校正和重复模块入口已经移除', () => {
  assert.doesNotMatch(pluginSource, /reconcileAllWatermarkFonts|reconcileFontSettings/);
  for (const file of ['config.cjs', 'watermark.cjs', 'publisher.cjs', 'r2.cjs']) {
    assert.equal(fs.existsSync(path.resolve(__dirname, '../eagle-plugin/lib', file)), false);
  }
});

test('Eagle 只通过共享模块公开入口挂载水印、字体和快速导出功能', () => {
  assert.match(adapterSource, /GravityWatermarkEditor\.mount\('localWatermarkForm'/);
  assert.match(adapterSource, /GravityWatermarkEditor\.mount\('onlineWatermarkForm'/);
  assert.match(adapterSource, /GravityFontManager\.refresh\(\)/);
  assert.doesNotMatch(adapterSource, /function mountWatermarkForm\(/);
  assert.doesNotMatch(adapterSource, /function renderFontManager\(/);
  assert.match(adapterSource, /GravityQuickExport\.mount\('localQuickExport'/);
  assert.match(watermarkSource, /version: '1\.1\.2'/);
  assert.match(fontSource, /version: '1\.1\.3'/);
  assert.match(quickExportSource, /const VERSION = '1\.0\.1'/);
});

test('同名文件策略使用软件统一的分段按钮，不使用原生下拉框', () => {
  assert.doesNotMatch(pluginHtml, /id="exportCollisionMode"/);
  assert.match(quickExportSource, /data-collision-mode="rename"/);
  assert.match(quickExportSource, /data-collision-mode="overwrite"/);
  assert.match(pluginSource, /function syncCollisionModeUi\(\)/);
});

test('两组导出选项使用单层矩形分段控件和明确选中态', () => {
  assert.match(pluginStyles, /\.export-mode-switch,\.export-collision-switch\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important;[\s\S]*?border-radius:12px!important;/);
  assert.match(pluginStyles, /\.preview-card \.export-actions \.export-mode-switch button\.active,[\s\S]*?button\[aria-pressed="true"\][\s\S]*?background:#2563eb!important;/);
  assert.match(quickExportSource, /button\.setAttribute\('aria-pressed', active \? 'true' : 'false'\)/);
  assert.match(quickExportSource, /button\.dataset\.exportMode === state\.compressionMode/);
  assert.match(quickExportSource, /button\.dataset\.collisionMode === state\.collisionMode/);
  assert.match(quickExportSource, /quality\.disabled = !qualityActive/);
  assert.match(quickExportSource, /size\.disabled = qualityActive/);
  assert.match(quickExportSource, /await nextPaint\(\)/);
});

test('每次导出结果卡片只需点击一次便消失', () => {
  const match = pluginSource.match(/function showExportResultToast\(results, failedCount = 0\) \{([\s\S]*?)\n\}/);
  assert.ok(match, '未找到导出结果卡片');
  assert.match(match[1], /clearExportResultToast\(\);/);
  assert.match(match[1], /toast\.addEventListener\('click',[\s\S]*?\{ once: true \}\)/);
  assert.match(match[1], /if \(revealButton\) revealExportedFile\(successful\[0\]\.outputPath\);[\s\S]*?clearExportResultToast\(\);/);
  assert.doesNotMatch(match[1], /\.export-result-reveal'\)\.addEventListener/);
});

test('文本与图形水印按模式显示各自位置的大小控制', () => {
  assert.match(watermarkSource, /settings\.type !== 'image'[\s\S]*?rangeField\('大小', 'scale',[\s\S]*?text-size-field/);
  assert.match(watermarkSource, /segmentedField\('模式', 'scaleMode'/);
  assert.match(watermarkSource, /settings\.type === 'image'[\s\S]*?rangeField\('大小', 'scale',[\s\S]*?image-size-field/);
  assert.match(watermarkSource, /if \(key === 'type'\) \{[\s\S]*?rerenderForm\(\);[\s\S]*?return;/);
  assert.doesNotMatch(watermarkSource, /rangeField\('比例', 'scale'/);
});

test('浏览器预览和 Eagle 预览都调用真实水印渲染服务', () => {
  assert.match(watermarkSource, /fetch\(['"]\/api\/watermark-preview-layout['"]/);
  assert.match(watermarkSource, /function previewLayerDimensions\(preview, scope, photoRect\)/);
  assert.match(watermarkSource, /const width = Math\.max\(1, Math\.round\(outputWidth\)\)/);
  assert.doesNotMatch(watermarkSource, /Math\.min\(1400,\s*Math\.round\(outputWidth\)\)/);
});

test('本地导出页不再显示手动重新读取照片按钮', () => {
  assert.doesNotMatch(pluginHtml, /id="refreshSelection"/);
  assert.doesNotMatch(pluginHtml, />重新读取当前选中照片</);
});

test('滑杆拖动使用逐帧即时投影且不写配置文件', () => {
  const commit = watermarkSource.match(/function commit\(key\) \{([\s\S]*?)\n  \}/);
  assert.ok(commit, '未找到水印字段提交函数');
  assert.match(commit[1], /applyInstantPreviewProjection\(previewId, settings, key\)/);
  assert.doesNotMatch(commit[1], /\bsave\s*\(/);
  assert.match(watermarkSource, /window\.requestAnimationFrame/);
  assert.match(watermarkSource, /job\.lastPayload = payload/);
});

test('字间距和行间距先使用真实字形矢量层再延迟像素校准', () => {
  assert.match(watermarkSource, /fetch\(['"]\/api\/watermark-preview-vector['"]/);
  assert.match(watermarkSource, /fastSpacingPreview = key === 'letterSpacing' \|\| key === 'lineSpacing'/);
  assert.match(watermarkSource, /fastVector: fastSpacingPreview/);
  assert.match(watermarkSource, /window\.setTimeout\([\s\S]*?, 72\)/);
});

test('字体框、下拉项和左侧渲染共享同一个精确字面', () => {
  assert.match(fontSource, /function exactFontFaceAlias\(face, entry = null\)/);
  assert.match(fontSource, /function applyExactFontPreview\(element, settings = \{\}, face = null, entry = null\)/);
  assert.match(fontSource, /settings\.fontPath = face\.fontPath \|\| ''/);
  assert.doesNotMatch(fontSource, /settings\.fontPath = face\.fontPath \|\| settings\.fontPath/);
  assert.match(watermarkSource, /const preferred = defaultFaceForEntry\(entry\)/);
  assert.match(watermarkSource, /if \(key === 'fontFace'\) renderFontPickers\(\)/);
});

test('字体和字重使用一致的左右分区键盘交互', () => {
  assert.match(watermarkSource, /data-font-face-focus/);
  assert.match(watermarkSource, /data-action="toggle-font-face-picker"/);
  assert.match(watermarkSource, /function selectFontFace\(faceValueToSelect, picker, options = \{\}\)/);
  assert.match(watermarkSource, /event\.target\.closest\('\[data-font-face-focus\]'\)/);
  assert.match(watermarkSource, /selectFontFace\(faceValue\(entry\.faces\[nextIndex\]\), picker, \{ close: false \}\)/);
  assert.doesNotMatch(watermarkSource, /样式<select/);
});

test('字体和字重下拉会把当前选项滚动到列表中部', () => {
  assert.match(fontSource, /function centerActivePickerOption\(picker, selector = '\.font-option\.active'\)/);
  assert.match(fontSource, /active\.offsetTop - Math\.max\(0, \(list\.clientHeight - active\.offsetHeight\) \/ 2\)/);
  assert.match(watermarkSource, /togglePickerMenu\(picker, '\[data-font-value\]\[data-font-copy="original"\]\.active'\)/);
  assert.match(watermarkSource, /togglePickerMenu\(picker, '\[data-font-face-value\]\.active'\)/);
});

test('字体目录按 PostScript 字面去重，不展示重复的伪字重', () => {
  assert.match(fontSource, /const signature = face\.postscriptName \|\|/);
  assert.match(fontSource, /candidate\.postscriptName \|\|/);
});

test('字体收藏在顶部重复展示且保留原分类位置', () => {
  assert.match(fontSource, /function favoriteFontFamilies\(\)/);
  assert.match(fontSource, /function toggleFontFavorite\(family\)/);
  assert.match(fontSource, /appendFontPickerGroup\(list, '收藏', favorites, 'favorite'\)/);
  assert.match(fontSource, /appendFontPickerGroup\(list, group\.label, group\.fonts, 'original'\)/);
  assert.match(fontSource, /favorite\.dataset\.fontFavorite = font/);
  assert.match(fontSource, /row\.dataset\.fontCopy = copyType/);
  assert.match(fontSource, /item\.dataset\.fontCopy = copyType/);
  assert.match(pluginStyles, /\.font-favorite-toggle/);
  assert.match(pluginStyles, /\.font-favorite-toggle\.is-favorite/);
});

test('点击收藏星只切换收藏状态，不选择字体或跳转列表', () => {
  assert.match(watermarkSource, /const favoriteToggle = event\.target\.closest\('\[data-font-favorite\]'\)/);
  assert.match(watermarkSource, /if \(favoriteToggle\) \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?GravityFontManager\.toggleFavorite\(favoriteToggle\.dataset\.fontFavorite\);[\s\S]*?return;/);
  assert.match(fontSource, /scrollTop: list\.scrollTop,[\s\S]*?scrollHeight: list\.scrollHeight/);
  assert.match(fontSource, /const insertedHeight = state\.list\.scrollHeight - state\.scrollHeight/);
  assert.match(fontSource, /state\.list\.scrollTop = Math\.max\(0, state\.scrollTop \+ insertedHeight\)/);
});

test('字体键盘选择在首尾停止，不再循环到另一端', () => {
  assert.doesNotMatch(watermarkSource, /\(currentIndex \+ direction \+ availableFonts\.length\) % availableFonts\.length/);
  assert.match(watermarkSource, /const nextIndex = Math\.min\(availableFonts\.length - 1, Math\.max\(0, currentIndex \+ direction\)\)/);
  assert.match(watermarkSource, /if \(nextIndex !== currentIndex\) selectFontFamily/);
});
