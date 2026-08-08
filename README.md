# EAGLE 扩展

这是独立于 MORROW 的 Eagle 产品体系。所有围绕 Eagle 运行的线上展示、水印、打码、字体和媒体整理能力归这里。

跨电脑交接源码已经恢复。三个正式开发入口位于 `extensions/`；安装包与宿主兼容桥接由交接包提供，Eagle `.library` 始终独立管理。

## 项目结构

- `extensions/`：可安装、可运行的 Eagle 扩展。
- `modules/`：只在 Eagle 产品体系内部复用的模块。
- `adapters/`：Eagle API、窗口、资料库和共享能力接入。
- `tests/`：扩展和兼容性验证。
- `tools/icloud-intake-workbench/`：iCloud Photos 到 NAS 待筛选区的可靠搬运台账骨架；当前只做本地台账和“继续上次”首页，不登录、不下载、不创建 NAS 目录。
