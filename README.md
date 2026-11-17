# Eagle Extension Suite

面向 Eagle 4 的团队媒体工作套件：排序与安全改名、GPS/元数据标签、水印与隐私打码、线上展示、Live Photo 管理和 iCloud 搬运台账。它独立于 MORROW；任何跨产品数据交换都只走版本化、只读的契约。

当前源码基线：`媒体智能整理 2.5.22-qa.104`、`Eagle 工作台 2.1`、`交付文案 1.6`、`地点标签 2.6`、`排序与自动编号 2.6`、`人物与环境图重命名 1.0`、`MAX Publisher 1.2.7`、`MAX Live Photo 管家 0.2.0-dev.11`、`MAX Live Photo 静态照片信息 0.1.0`、`MAX 头像共享源 1.0.0`。

工作台是统一管理入口。排序、自动编号和人物/环境图重命名在 Eagle 布局面板执行；媒体智能整理窗口只提供标签功能。交付文案可从布局面板生成，并从工作台管理模板。复制文件夹的历史源码保留，但尚未完成真实 Eagle 验收，不列为已交付能力。

整套同步发布入口是 `scripts/build-eagle-suite-release.sh`，从当前 manifest 读取版本，生成 6 个 Eagle 插件、3 个浏览器扩展及 SHA-256 清单。运行 `node scripts/verify-eagle-suite-release.cjs <发布目录>` 检查版本、运行依赖和包内容。仓库与发布包均不分发 Eagle `app.asar`、Library、NAS 素材、用户模板配置、运行缓存、恢复资料或密钥；本机验收中的客户分享链接留在本地。

跨电脑安装还需要目标电脑的 Eagle 版本和通信兼容性核验。仓库提供可审计的兼容源码与恢复流程，不以复制宿主二进制代替目标电脑验收；入口和安装方式见 `docs/CROSS-COMPUTER-HANDOFF.md`。

## 从这里开始

- [团队安装、配置与使用指南](docs/GITHUB-SETUP-AND-USER-GUIDE.md)：给团队成员和 Codex 的完整操作入口。
- [跨电脑同步与交接](docs/CROSS-COMPUTER-HANDOFF.md)：另一台 Mac 从 GitHub 拉取后，重建并安装同一套扩展的唯一流程。
- [功能与实现架构](docs/ARCHITECTURE-AND-FEATURE-MAP.md)：每项功能的实现位置、数据边界和同步方式。
- [模块边界与 Eagle 原生主权](docs/EAGLE-EXTENSION-MODULE-BOUNDARIES.md)：排序、发布、标签三条业务线不得耦合的强制规则。
- [排序历史回归与验收](extensions/media-organizer/docs/PERMANENT-REGRESSION-CONTRACT.md)：排序修复不能回归的永久门禁。
- `scripts/build-eagle-suite-release.sh`：生成当前全部插件和浏览器扩展的版本化同步包与 SHA256 清单。

## 功能地图

| 业务线 | 对应目录 | 当前能力 |
| --- | --- | --- |
| 排序与安全改名 | `extensions/media-organizer/` | 普通/智能文件夹排序、多级规则、拍摄时间、手动拖动、排序锁定、自动编号、团队排序状态同步 |
| GPS/元数据标签 | `extensions/media-organizer/` | 离线读取图片/视频 GPS、地域标签审核、人工纠错、文件夹地点标签 |
| 水印、隐私与线上发布 | `extensions/online-publisher/` | 水印编辑、字体库、模糊/马赛克/文字标注、快速导出、Cloudflare Pages 发布 |
| Live Photo 管理 | `extensions/live-photo-manager/` | JPG/HEIC 与 MOV 安全配对、冲突识别、可恢复处理队列、只读 Demo |
| 团队头像只读共享源 | `extensions/avatar-source-publisher/` | 从指定 Eagle 头像文件夹生成版本化 manifest 与内容寻址资源 |
| Eagle 工作台 | `extensions/eagle-workbench/` | 统一管理入口、版本与维护记录、交付模板管理及独立标签入口 |
| 内容导入 | `extensions/instagram-post-importer/`、`extensions/xiaohongshu-post-importer/` | 将单条公开帖子媒体整理为可导入 Eagle 的计划；不改写现有 Library |
| iCloud 搬运台账 | `tools/icloud-intake-workbench/` | 本地批次台账、“继续上次”、Live Photo 配对；不登录、不下载、不写 NAS |

## 仓库结构

- `extensions/`：各可独立安装或运行的扩展。
- `docs/`：产品说明、治理规则、安装指南和界面示例。
- `tools/`：不直接接管 Eagle 的独立辅助工具。
- `PROJECT.md`、`TASKS.md`、`DECISIONS.md`：项目范围、状态和可追溯决策。

> 安全底线：扩展不能替代或破坏 Eagle 的选择、预览、右键、导入导出、拖出、普通文件夹、智能文件夹等原生能力。未经明确批准，不得修改 Eagle 宿主、`.library` 内部结构或 NAS 原素材。
