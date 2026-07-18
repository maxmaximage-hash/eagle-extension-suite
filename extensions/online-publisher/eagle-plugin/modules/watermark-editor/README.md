# Gravity Watermark Editor 1.1.1

这是 Eagle 1.0 使用的唯一水印原版。共享的是 UI、交互、配置结构、预览和真实导出算法，不包含 Eagle Library、预设数据或任何项目图片。

## 文件与公开入口

- `schema.js`：浏览器全局 `GravityWatermarkSchema`，CommonJS 同名导出。
- `presets.js`：浏览器全局 `GravityWatermarkPresets`，CommonJS 同名导出。
- `browser.js`：浏览器全局 `GravityWatermarkEditor`，负责完整编辑 UI 和实时预览。
- `renderer.js`：Node/CommonJS 真实渲染器。
- `editor.css`：当前 1.0 的完整界面样式，是迁移 UI 时的唯一样式源。
- `index.js`：服务端统一入口，版本为 `1.1.1`。

## 1.1.1

- 字重选择器键盘上下移动在首尾停止，不再循环跳转。

`GravityWatermarkEditor` 公开：

- `version`
- `mount(containerId, settings, previewId)`
- `fields(settings)`
- `prepare(settings)`
- `updatePreview(previewId, settings, options)`
- `refreshPreviews()`

CommonJS 入口公开：

- `schema.normalizeWatermark()` / `canonicalWatermark()` / `emptyWatermark()`
- `presets.normalizePresets()` / `findPreset()` / `createPreset()`
- `renderWatermarkLayer()`
- `renderWatermarkPreviewPayload()`
- `renderWatermarkVectorPreviewPayload()`
- `renderWatermarked()`

## 宿主适配契约

浏览器模块只要求宿主提供状态、保存回调、预览图片列表、文件选择和字体目录，不直接读取 Eagle 项目数据。Eagle 的实现位于 `../../adapters/eagle/plugin.js`；MORROW 接入时复制或发布本模块，并实现自己的宿主适配层，不能运行时引用 Eagle 目录。

预览与导出都由 `renderer.js` 生成同一张透明水印层，不能再增加另一套 DOM 字体排版算法作为正式渲染路径。
