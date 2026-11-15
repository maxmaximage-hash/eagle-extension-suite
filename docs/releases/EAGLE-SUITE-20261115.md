# Eagle Extension Suite 2026-11-15

本次发布包含当前工作台的全部可安装扩展。

| 类型 | ID 或名称 | 版本 |
| --- | --- | --- |
| Eagle | `com.max.eagle-photo-taken-sort` 媒体智能整理 | `2.5.22-qa.98` |
| Eagle | `com.max.eagle-workbench` Eagle 工作台 | `1.4` |
| Eagle | `com.max.eagle-live-photo-manager` MAX Live Photo 管家 | `0.2.0-dev.11` |
| Eagle | `com.max.eagle-live-photo-inspector` MAX Live Photo 静态照片信息 | `0.1.0` |
| Eagle | `com.max.eagle-avatar-source-publisher` MAX 头像共享源 | `1.0.0` |
| Eagle | `com.max.eagle-online-showcase` MAX Publisher | `1.2.7` |
| 浏览器 | Instagram 整帖保存至 Eagle | `1.1.2` |
| 浏览器 | 小红书整帖保存至 Eagle | `1.0.0` |
| 浏览器 | 网页媒体保存至 Eagle | `2.4.4` |

运行 `scripts/build-eagle-suite-release.sh` 会生成全部插件包、浏览器扩展包、桥接源码、带 SHA256 的审计桥接 `app.asar` 宿主资产和 `SHA256SUMS`。发布包不包含 Eagle Library、NAS 素材、运行状态、备份或诊断日志。

媒体智能整理的主网格桥接通过 `extensions/media-organizer/bridge/` 中的本机重建脚本恢复，目标宿主必须是 Eagle 4.0.0 Build23。
