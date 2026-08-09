# 项目档案

- 项目名称：MAX Publisher
- 项目类型：Eagle 独立扩展
- 所属产品：EAGLE 扩展
- 插件 ID：`com.max.eagle-online-showcase`
- 当前版本：`1.2.7`
- 当前状态：sharp 0.35.3 安全修复已完成自动验证，等待真实图片人工冒烟
- 创建日期：2026-07-18
- 最后更新：2026-08-01

## 能力

- Eagle 图片水印编辑与本地导出；
- 隐私模糊、马赛克和文字标注；
- 字体目录与字体管理；
- 快速导出；
- Cloudflare Pages 线上作品展示与发布。

## 数据边界

- 源码位于本目录。
- 线上发布数据位于 `~/引力环球/Eagle线上发布数据`，不进入源码 Git。
- Eagle 插件配置和状态位于 Eagle Application Support，不进入源码 Git。
- 共享模块以明确版本的 vendor 副本安装，不跨目录运行时引用。
