# 网页媒体导入器 2.1.0 视觉验收

- source visual truth: `docs/ui-qa/design-source-option-3.png`
- implementation screenshot: `docs/ui-qa/implementation-expanded.png`
- combined comparison: `docs/ui-qa/comparison-expanded.png`
- target viewport: Chrome 扩展弹窗，CSS `420 × 620`
- source pixels: `1031 × 1525`，按比例包含到 `420 × 620`
- implementation pixels: `450 × 614`，真实 Chrome 弹窗截图；Chrome 可见高度约 600，页面支持纵向滚动
- comparison density: 两侧均转换为 RGB 后按比例放入 `890 × 620` 对比画布，没有裁切正文
- state: 普通 HTTPS 页面，功能说明已展开，暂无导入任务

## Findings

- 没有 P0、P1 或 P2 问题。
- 字体与层级：使用 macOS/Chrome 系统中文字体；标题、辅助说明和状态层级清楚，没有截断。
- 间距与布局：真实弹窗宽度完整填充；主功能“右键保存”与批量入口“扫描当前帖子/页面”均在首屏。
- 颜色：深色界面与 Eagle/Chrome 环境一致；主按钮采用满足可读性的深蓝，绿色只用于就绪与隐私说明。
- 图像与图标：扩展使用独立生成并经过透明边缘验证的 PNG 图标；未使用占位符、文字图标或手绘 SVG。
- 文案：明确说明“大多数普通网页图片”而非“所有图片”；YouTube 封面限定及 blob、DRM、登录、防盗链限制均可展开查看。

## Comparison history

1. 初次真实 Chrome 截图发现弹窗右侧出现大块空白，属于 P1 宽度错误。
2. 将 `html` 与 `body` 同时固定为 420px，并启用纵向滚动；重新加载后空白消失，内容完整占满弹窗。
3. 复测展开说明和纵向滚动：平台限制、最近任务和安全上限均可访问；没有新增 P0/P1/P2。

## Focused region comparison

完整对比图已能清楚读取标题、右键菜单示意、主按钮和平台限制，关键细节不需要额外裁切。新图标另以 `icons/icon-master.png` 原始透明 PNG 验证边缘与清晰度。

## Follow-up polish

- P3：最近任务位于首屏下方，需要滚动后查看；这是为保留 14–16px 可读字号和完整功能解释做出的有意取舍。

final result: passed
