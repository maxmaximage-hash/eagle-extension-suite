# MAX Publisher 1.2

这是 Eagle 水印导出、隐私打码与线上作品发布工具。1.2 在 1.0 的纯净水印版本上新增独立隐私打码工作区，并继续只保留唯一水印模块、唯一字体目录和唯一导出链。

## 1.0 目录边界

- `eagle-plugin/modules/watermark-editor/`：唯一水印原版，包含 schema、预设操作、完整 UI/交互、实时预览、真实导出和样式。
- `eagle-plugin/modules/font-manager/`：Mac 字体目录、字体元数据、分类与人工管理 UI。
- `eagle-plugin/modules/vendor/gravity-privacy-editor/1.1.0/`：版本化隐私打码共享模块安装副本。
- `privacy-app/`：Eagle 图片/长截图宿主工作区，不保存项目数据。
- `eagle-plugin/modules/quick-export/`：本地水印页与隐私页共用的唯一快速导出 UI。
- `eagle-plugin/adapters/eagle/`：Eagle 选择项、窗口、通知和配置的宿主适配层。
- `eagle-plugin/lib/publisher.js`：本地导出与 Cloudflare Pages 发布流程。
- `cloudflare-pages/public/`：当前线上作品页及业务图片；它是发布数据，不属于共享模块。

共享模块不包含 Eagle Library、项目图片或用户运行状态。MORROW 后续接入时应复制/发布对应模块版本并实现 MORROW 适配层，不能运行时引用 Eagle 项目目录。

## 初始状态

- 只内置一个预设：`引力环球版权文字`。
- 水印文字：`Copyright ©Gravity Global.All rights reserved.`
- 其余水印预设、未保存草稿、导出进度、同步结果和字体人工调整均为空。
- 未输入文字或未选择图形文件时绝不生成占位水印。
- 只有点击“保存”或“另存为”才会写入预设；未保存修改关闭后丢弃。

## 使用

1. 在 Eagle 选择照片，打开插件进行本地导出。
2. 进入“隐私打码”，使用矩形/椭圆模糊或马赛克，按需增加文字标注和已保存水印预设，再使用同一套快速导出。
3. 隐私编辑只存在当前窗口内，离开页面或关闭插件即清空，永远不修改 Eagle 原图。
4. 给需上线照片添加 `线上展示` 标签，在“线上发布”页同步。
5. 本地作品页默认端口为 `8788`；线上页由连接设置中的 Cloudflare Pages 地址决定。

## 开发与验证

```bash
npm test
npm run build:privacy
npm run preview
npm run package:plugin
```

本地开发预览为 `http://127.0.0.1:8799/`。正式验收还需在 Eagle 中验证系统字体、真实图片导出、同名文件策略和 Pages 发布。

模块公开 API 和迁移契约分别见：

- `eagle-plugin/modules/watermark-editor/README.md`
- `eagle-plugin/modules/font-manager/README.md`
- `eagle-plugin/modules/vendor/gravity-privacy-editor/1.1.0/README.md`
- `eagle-plugin/modules/quick-export/README.md`
- `eagle-plugin/adapters/eagle/README.md`
