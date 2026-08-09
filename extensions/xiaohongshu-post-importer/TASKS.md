# 任务

## 当前稳定状态

- 小红书整帖保存至 Eagle 当前只保留稳定版本 `1.0.0`。
- 2026-08-08：已按 GitHub 新版 `extensions/` 结构并入唯一 `main`，与 Instagram 及两个 Eagle 插件共用同一仓库分发。
- 项目内不保留旧发布目录、打包代码、第三方打包依赖或历史下载缓存。
- 当前导入策略是普通图片和 Live 静态图片统一转换为 JPG 后进入 Eagle。

## 验收门禁

- `npm test` 必须通过。
- `npm run check` 必须通过。
- Chrome 必须加载唯一稳定发布目录。
- 真实 Eagle 验收必须确认 Eagle 中导入结果为 JPG，不产生 HEIC/HEIF、ZIP 或 LIVP 项目，并确认中转 JPG 会自动延迟清理。
