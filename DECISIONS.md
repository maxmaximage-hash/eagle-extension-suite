# Eagle 项目决策

## 2026-08-08：唯一 GitHub 主线

- Eagle 扩展只维护 `eagle-extension-suite` 的一个长期版本：`main`。
- 媒体整理、线上发布、Instagram 和小红书都位于同一仓库的 `extensions/` 下，另一台电脑直接从该主线同步。
- 不建立第二个长期兼容分支；历史强制改写只通过 Git reflog 和迁移期临时保护处理。

## 2026-08-08：仓库必须跨电脑自包含

- 共享模块真源位于 `modules/packages/`，扩展内版本化副本由自动测试逐字节校验。
- 自动测试不得依赖仓库外共享目录、本机隐藏预览图片、真实 Library、团队 sidecar、NAS 路径或用户运行数据。
- `runtime-data/`、下载中转文件、生成安装包和真实验收资料只保留在本机并由 Git 忽略。
