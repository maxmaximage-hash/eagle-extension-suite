# Eagle 隐私打码 1.2.0 完成说明

## 产品行为

- 在 Eagle 当前选择图片后进入独立“隐私打码”页。
- 支持矩形、椭圆；模糊、马赛克；每个区域独立效果与强度。
- 支持选择、移动、缩放、删除、清除全部、撤销和重做。
- 画布使用原图像素坐标，普通图片和超长截图均可缩放、滚动编辑。
- 支持文字标注：共享字体分类、收藏字体、字重、大小、字间距、行间距、对齐、颜色、描边、阴影、不透明度和旋转。
- 只能选择已保存的水印预设，不能在隐私页修改水印。
- 导出顺序固定为：原图 → 打码 → 文字标注 → 水印预设 → 编码。
- 快速导出与水印页共用目录、质量/大小、同名策略、进度、结果卡片和访达定位。
- 导出文件默认后缀为 `-打码`。
- 不修改 Eagle 原图，不保存隐私项目、选区或文字历史；离开隐私页或关闭插件即清空。
- 第一版不包含画笔、纯色遮挡、人脸检测、头像识别或 OCR。

## 版本化模块

- 隐私共享上游：`/Users/max/.codex/worktrees/d3f0/朋友圈模拟器/共享模块/gravity-privacy-editor/1.1.0`
- Eagle 安装副本：`eagle-plugin/modules/vendor/gravity-privacy-editor/1.1.0`
- 两处通过自动测试逐文件 SHA-256 校验一致。
- 共享包公开浏览器 API：Schema、normalize、Canvas renderer、`PrivacyCanvas`、`PrivacyEditor`、`PrivacyControlPanel`。
- 共享包公开 Node API：`require("./node.cjs").renderPrivacyBuffer()`。

## Eagle 宿主文件

- `privacy-app/EaglePrivacyWorkspace.jsx`：完整图片/长截图工作区。
- `privacy-app/privacy-workspace.css`：工作区界面。
- `vite.privacy.config.mjs`：React IIFE 构建。
- `eagle-plugin/lib/privacy-exporter.cjs`：打码、文字、水印、编码流水线。
- `eagle-plugin/modules/quick-export/browser.js`：水印页和隐私页共用导出 UI。
- `eagle-plugin/adapters/eagle/plugin.js`：Eagle 选择项、预设、通知、访达和导出适配。
- `eagle-plugin/dist/privacy-editor.js/css`：插件运行资源。

## 验证

```bash
npm run build:privacy
npm test
```

当前自动测试共 69 项，覆盖水印回归、字体目录、共享模块逐文件一致、Schema、矩形/椭圆 Sharp 渲染、真实马赛克、文字与水印组合导出、原图不变、同名策略和质量/大小导出。
