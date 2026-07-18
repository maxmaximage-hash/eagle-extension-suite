# 任务

## 正在进行

- 完成旧 Codex 任务与旧源码目录的退出流程。

## 下一步

- 记录 Eagle 宿主版本、桥接修改、备份和恢复流程。
- 真实打开 Eagle 后做一次媒体整理和 MAX Publisher 的人工冒烟验收。

## 等待确认

- 无。

## 已完成

- 2026-07-18：确认 Eagle 扩展是独立产品体系，不属于 MORROW。
- 2026-07-18：定位 Eagle 线上展示源目录为旧 `朋友圈模拟器/Eagle线上展示`，已安装插件 ID 为 `com.max.eagle-online-showcase`，显示名为 `MAX Publisher`，已包含水印、隐私打码、字体管理、快速导出和线上发布能力。
- 2026-07-18：确认媒体智能整理项目包含排序、连续重编号、地域标签及 Eagle 主程序桥接；迁移时需保留原始 `app.asar` 备份和恢复脚本。
- 2026-07-18：媒体智能整理迁入 `extensions/media-organizer`；六组自动测试全部通过，关键源码与已安装插件一致，原始 `app.asar` 备份指纹通过校验。
- 2026-07-18：MAX Publisher 1.2.5 迁入 `extensions/online-publisher`；线上发布数据独立到 `/Users/max/引力环球/Eagle线上发布数据`，配置与安装插件默认路径同步更新。
- 2026-07-18：MAX Publisher 已脱离 MORROW 旧目录中的测试素材，73/73 项测试、隐私编辑器构建和插件打包全部通过；生成的 `.eagleplugin` 压缩包完整性通过。
