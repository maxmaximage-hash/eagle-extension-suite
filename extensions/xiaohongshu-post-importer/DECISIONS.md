# 决策记录

## 2026-08-08：并入唯一 GitHub 主线

- 决定：小红书导入器保留为 `extensions/xiaohongshu-post-importer` 独立扩展，提交到 `eagle-extension-suite` 唯一 `main`。
- 原因：另一台电脑必须能够从同一 GitHub 主线获得媒体整理、线上发布、Instagram 和小红书四个入口。
- 约束：不保留第二条长期版本分支；运行缓存、下载中转文件和本机发布目录不进入 GitHub。

## 当前稳定版只保留静态图片导入

- 决定：小红书整帖保存至 Eagle 只保留稳定版本 `1.0.0`。
- 决定：普通图片和 Live 静态图片统一转换为 JPG 后通过 Eagle `addFromPath` 导入。
- 决定：本扩展把转换后的 JPG 保存在 Chrome 下载目录下的 `Eagle-XHS-JPG-Cache`，再通过 Eagle `addFromPath` 导入；本机用 macOS 隐藏属性让该目录不出现在日常 Finder 视图。
- 决定：不在导入后立即删除 JPG 中转文件；导入成功后通过 Chrome alarm 延迟 30 分钟清理对应文件。
- 原因：Eagle 会异步读取本地路径，过早删除会导致 `ENOENT`；延迟清理能避免用户长期手动管理下载目录。
- 决定：本扩展不保留历史发布版本、历史缓存或第三方打包依赖。
- 原因：Live 识别器将作为独立 Eagle 项目处理；当前稳定版必须避免向用户暴露中转文件、下载缓存或半成品 Live 行为。
- 约束：不修改 Eagle.app，不写 `.library`，不合并到 Instagram 导入扩展。
