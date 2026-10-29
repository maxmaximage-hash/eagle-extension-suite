# Eagle Extension Suite

面向 Eagle 4 的团队媒体工作套件：排序与安全改名、GPS/元数据标签、水印与隐私打码、线上展示、Live Photo 管理和 iCloud 搬运台账。它独立于 MORROW；任何跨产品数据交换都只走版本化、只读的契约。

当前源码基线：`媒体智能整理 2.5.22-qa.94 / API148`、`MAX Publisher 1.2.7`、`Eagle 工作台 1.1`。这份仓库只包含源码、测试、说明和界面示例，绝不包含 Eagle `.library`、NAS 素材、运行缓存、恢复资料、`app.asar`、密钥或发布后的用户状态。

排序主网格所需的 Eagle 通信桥不再依赖“复制另一台电脑的 app.asar”：目标电脑必须按
`docs/CROSS-COMPUTER-HANDOFF.md` 使用仓库内的重建脚本，在本机 Eagle 4.0.0 原始宿主上
通过精确指纹检查后生成桥接。这样同步的是可审计的补丁和安装流程，而不是第三方主程序二进制。

## 从这里开始

- [团队安装、配置与使用指南](docs/GITHUB-SETUP-AND-USER-GUIDE.md)：给团队成员和 Codex 的完整操作入口。
- [跨电脑同步与交接](docs/CROSS-COMPUTER-HANDOFF.md)：另一台 Mac 从 GitHub 拉取后，重建并安装同一套扩展的唯一流程。
- [功能与实现架构](docs/ARCHITECTURE-AND-FEATURE-MAP.md)：每项功能的实现位置、数据边界和同步方式。
- [模块边界与 Eagle 原生主权](docs/EAGLE-EXTENSION-MODULE-BOUNDARIES.md)：排序、发布、标签三条业务线不得耦合的强制规则。
- [排序历史回归与验收](extensions/media-organizer/docs/PERMANENT-REGRESSION-CONTRACT.md)：排序修复不能回归的永久门禁。

## 功能地图

| 业务线 | 对应目录 | 当前能力 |
| --- | --- | --- |
| 排序与安全改名 | `extensions/media-organizer/` | 普通/智能文件夹排序、多级规则、拍摄时间、手动拖动、排序锁定、自动编号、团队排序状态同步 |
| GPS/元数据标签 | `extensions/media-organizer/` | 离线读取图片/视频 GPS、地域标签审核、人工纠错、文件夹地点标签 |
| 水印、隐私与线上发布 | `extensions/online-publisher/` | 水印编辑、字体库、模糊/马赛克/文字标注、快速导出、Cloudflare Pages 发布 |
| Live Photo 管理 | `extensions/live-photo-manager/` | JPG/HEIC 与 MOV 安全配对、冲突识别、可恢复处理队列、只读 Demo |
| 团队头像只读共享源 | `extensions/avatar-source-publisher/` | 从指定 Eagle 头像文件夹生成版本化 manifest 与内容寻址资源 |
| Eagle 工作台 | `extensions/eagle-workbench/` | 只读汇总各扩展的两段式版本、基本功能和版本修复日志 |
| 内容导入 | `extensions/instagram-post-importer/`、`extensions/xiaohongshu-post-importer/` | 将单条公开帖子媒体整理为可导入 Eagle 的计划；不改写现有 Library |
| iCloud 搬运台账 | `tools/icloud-intake-workbench/` | 本地批次台账、“继续上次”、Live Photo 配对；不登录、不下载、不写 NAS |

## 仓库结构

- `extensions/`：各可独立安装或运行的扩展。
- `docs/`：产品说明、治理规则、安装指南和界面示例。
- `tools/`：不直接接管 Eagle 的独立辅助工具。
- `PROJECT.md`、`TASKS.md`、`DECISIONS.md`：项目范围、状态和可追溯决策。

> 安全底线：扩展不能替代或破坏 Eagle 的选择、预览、右键、导入导出、拖出、普通文件夹、智能文件夹等原生能力。未经明确批准，不得修改 Eagle 宿主、`.library` 内部结构或 NAS 原素材。
