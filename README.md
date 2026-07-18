# EAGLE 扩展

这是独立于 MORROW 的 Eagle 产品体系。所有围绕 Eagle 运行的线上展示、水印、打码、字体和媒体整理能力归这里。

当前只建立干净项目骨架，历史代码尚未迁入。

## 计划结构

- `extensions/`：可安装、可运行的 Eagle 扩展。
- `modules/`：只在 Eagle 产品体系内部复用的模块。
- `adapters/`：Eagle API、窗口、资料库和共享能力接入。
- `tests/`：扩展和兼容性验证。
