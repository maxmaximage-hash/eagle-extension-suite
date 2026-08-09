# 任务

## 2026-08-04 MAX Live Photo 管家只读 Demo

- [x] 新建独立扩展 `extensions/live-photo-manager`，未放入排序、发布或 GPS 模块；
  Eagle 生命周期和 Live 业务核心分层，未调用任何资料库写入 API。
- [x] 复用 iCloud 搬运台配对核心，对
  `/Users/max/Downloads/iCloud 照片 2/` 只读扫描：108 个源文件稳定识别为 54 个
  `JPG + MOV` Live 项目，重复静态图、重复 MOV 和缺少伴侣文件均拒绝猜测配对。
- [x] 完成本地网格 Demo：每组只显示一个项目，无右侧预览；悬停或键盘聚焦播放原 MOV；
  右键只保留导入苹果照片（Live）、导出静态 JPG、导出 MOV 三个出口。多选仍复用同一
  命令，不向用户暴露 `.livp`、中间封装包或“批量同步到 iPhone”。
- [x] 完成独立浏览锚点：记录源目录、素材 ID、文件名、缩略图 URL、选择时间与前后范围；
  “继续上次”跨刷新恢复到对应项目。浏览锚点与预览/下载队列状态分开，不会因处理成功
  错误推进用户浏览位置。
- [x] 预览检查严格串行，每项使用独立临时目录，覆盖取消、超时、连续失败熔断、重试、
  ID 去重和 HTTP Range；新扩展 10/10 测试、原搬运台 10/10 回归测试通过。
- [x] 浏览器实测 1280x720 和 390x844：54 张封面无破图、无页面横向溢出；样本 MOV
  达到 `readyState=4` 并播放；“继续上次”从滚动后位置回到 `IMG_3248`。
- [x] 本轮没有安装插件、重启或操作 Eagle UI，没有写 NAS 接收区或正式
  `.library`，没有封装/导入 `.livp`，没有修改 108 个源文件。
- [ ] 下一阶段须另获用户批准：先安装到低风险 QA Library，按 `1 -> 3 -> 10 -> 50`
  组逐级验证公开 API 交接、宿主响应和恢复；任一级异常立即停止，正式 NAS Library
  在 QA 全部通过前继续禁止测试。

## 2026-08-01 GitHub 团队稳定基线发布

- [x] 创建仓库 `maxmaximage-hash/eagle-extension-suite`，按用户明确指令改为公开，上传默认分支 `main`，发布
  `v2026.08.01-baseline.1`。
- [x] 发布媒体智能整理 `2.5.22-qa.27 / API104`；排序业务仍冻结于 qa.26/API103，
  首次自动标签默认不扫整库、不写标签。
- [x] 发布 MAX Publisher `1.2.7`；`sharp 0.35.3`、`wrangler 4.118.0`，82/82 测试、
  构建和根/插件全依赖审计均为 0 漏洞。
- [x] 安装包本地/线上 SHA-256 一致；仓库 README、详细功能、Codex 安装、团队同步、
  配置/API、回滚、截图和发行范围文档齐全；GitHub Actions 通过。
- [x] 未上传真实素材、Library、NAS 路径、sidecar、状态、缓存、配置、密钥、`app.asar`
  或桥载荷；未安装候选、未重启 Eagle、未操作真实 Library/NAS。
- [ ] 已知阻断：全新未知 Eagle 宿主不能只靠公开插件 API 获得 1:1 主网格排序；当前
  安装器只读检查并拒绝无桥/未知桥，不修改 `app.asar`。

## 正在进行

- 排序系统重建与稳定性验收已切换到新任务
  `019f8fb9-90c5-7a72-a2a3-41a8240f78f3`。旧任务
  `019f8a75-f211-73f0-8520-6be3f601d8c4` 因 `systemError` 归档保留历史；新任务从
  R34 A 已通过、候选等待 R34 B 的当前现场继续，不重做长对话和已完成基线。

- 三条长期功能任务线已建立并集中管理：媒体智能整理的排序与重命名
  `019f8f9d-8be8-71f1-a71e-85e2503c1157`，媒体智能整理的 GPS/元数据标签
  `019f8f9d-b5d1-7a21-a9b1-e009881b56ff`，MAX Publisher 的水印与媒体处理
  `019f8f9d-de44-7493-9db6-4d44b3a2e58c`。每条线只维护一个功能域的 Bug、
  测试、版本和长期维护；跨线改动必须由总管拆分派发。

- 按用户最终选择继续修复 `extensions/media-organizer` 的 2.5 原生排序工作流，不要求
  用户改用独立 3.0 原型界面。所有已报故障由
  `extensions/media-organizer/docs/PERMANENT-REGRESSION-CONTRACT.md` 永久约束；
  自动门禁只作开发预检，唯一验收是用户实际看到的真实 Eagle 界面。连续 20 次拖动、
  逐张编号、刷新、切换和重启后的界面结果全部通过前不得交付。

- 2026-07-24 最新同步：R34 A 无插件基线和 R34 B 单一候选均已通过。用户用物理鼠标
  将同一张 `1-传奇地貌1.jpg` 从 Eagle 拖到 Finder；R34 B 实际落点为
  `/Users/max/Downloads/1-传奇地貌1.jpg`，大小 `12009496` 字节，SHA-256
  `42f245070359d0c0e1d8911a2161295d3daac53cbc94c917f5c88a6e59f56890`
  与 QA Library 原图及 R34 A 基线一致。候选 `2.5.22-qa.1 / API 78` 仅加载到本地
  `Eagle QA Sort 2026-07-23.library`；生产 Library/NAS 未被候选操作。R34 原生跨
  应用拖出门禁完成，最终发布结论仍等待其余排序专项真实 UI 证据。

- 2026-07-24 00:07 只读核对：当前 Eagle 正在运行且 `rootDir` 为本地
  `Eagle QA Sort 2026-07-23.library`，生产 Library 未在本轮启动日志中加载；安装目录
  当前为 `2.5.22-qa.1 / API 78`，指纹与 `qa-candidate` 一致；Finder B 对照目录仍为空。
  但最新日志同时初始化安装目录候选和仓库 `extensions/media-organizer` 旧版源码，并创建
  两次“媒体智能整理”服务插件，因此当前运行态不能作为“单一候选”R34 B 判定环境。
  证据见 `qa-evidence/QA-R34-CURRENT-STATE-2026-07-24.md`。未经用户批准，不清理插件、
  不退出/重启 Eagle、不继续 R34 B/R21/其它真实 Eagle 测试。

- 2026-07-24 00:35 按用户批准完成 R34 B 准备：已完整退出 Eagle，保留安装目录
  `2.5.22-qa.1 / API 78` 候选；以可恢复方式备份 Eagle Chromium Local Storage
  LevelDB，停用开发插件登记来源，不删除、不移动、不改仓库
  `extensions/media-organizer` 源码。重新启动后日志确认只加载 QA Library，媒体智能整理
  只剩安装目录候选一个来源，未再加载仓库源码。已创建全新空 Finder 目录
  `qa-library/r34-candidate-physical-drag-20260724-0035`，并用
  `eagle://item/MF2ELGINFXWF2` 定位 `1-传奇地貌1.jpg`；等待用户物理鼠标执行 R34 B
  拖到 Finder。用户反馈前不得进入 R21、内部排序、改名或其它测试。证据见
  `qa-evidence/QA-R34-B-PREP-2026-07-24.md`。

- 2026-07-24 00:38 用户完成 R34 B 物理鼠标拖出并确认表现正常。Finder 实际落点为
  `/Users/max/Downloads/1-传奇地貌1.jpg`；副本大小 `12009496` 字节，SHA-256
  与 QA Library 原图和 R34 A 无插件基线一致。`2.5.22-qa.1 / API 78` 单一候选的
  R34 门禁通过；未使用 Computer Use 跨应用拖动，未操作生产 Library/NAS。证据见
  `qa-evidence/QA-R34-B-PREP-2026-07-24.md`。

- 2026-07-24 R34 B 后续验收在文件夹
  `7-撒盐哥Nusr-Et Steakhouse Kapalıçarşı`（`MEUL73DQPC4ZS`，90 项）发现首个
  真实 UI 失败：排序锁定未勾选、手动拖动可用，但自动编号单独置灰。已确认这不是
  Eagle 权限或文件夹硬锁，而是 `api.rename.running` 任务状态被错误投影成开关权限，
  并存在 `sourceContextId` 生命周期不同步。登记 R21，交叉影响 R14/R26；候选
  `2.5.22-qa.1 / API 78` 保持未通过，后续真实编号链暂停。证据见
  `qa-evidence/QA-R21-AUTO-NUMBER-DISABLED-2026-07-24.md`。

- 媒体智能整理“排序与重命名”主任务登记：本任务只负责 `extensions/media-organizer` 排序与重命名的长期
  台账、门禁、版本/回滚和真实 Eagle 验收协调；当前冻结基线为 `2.5.21 / API 77`，
  QA 候选为 `2.5.22-qa.1 / API 78`。未经项目总管派发和用户批准，不修改排序源码、
  不安装或重启 Eagle、不操作真实 Library/NAS，也不把 QA 候选宣称为生产可用。

- 独立 `extensions/media-organizer-v3` 原型路线已停止；当前工作区只维护
  `extensions/media-organizer` 这一套原生照片网格排序实现。

## 下一步

- 在不改动真实资料库的测试环境复现“启动/切换资料库后未自动注入”，修正插件生命周期后重新打包，并在 Eagle 4.0 build 23 验证无需手动打开插件即可看到入口。

- iCloud–NAS–Eagle 专项：由用户确认 Photos 是否启用 iCloud Photos、当前储存选项、显示项目数/容量，以及是否要求 Eagle 管理全部原片。
- iCloud–NAS–Eagle 专项：等待用户批准 Apple 账号授权方式、50-100 个混合试点相簿/批次，以及是否安装 `icloudpd` 或 `osxphotos`；目标 NAS 待筛选路径已确认为 `/Volumes/团队文件-MAX线上协作中台/icloud 待分类素材/`，批准前不登录、不读取照片、不启动下载。
- iCloud–NAS–Eagle 专项：与 Mac–NAS 工作系统共同完成固定 SMB 挂载、真实持续读写、睡眠恢复、NAS 文件系统/快照/剩余空间和第二备份核验。
- iCloud–NAS–Eagle 专项：确认上述条件后，用 500–1000 个代表性文件建立独立试点库；在此之前不开始迁移。
- iCloud–NAS–Eagle 专项：试点比较普通导入与“导入现有文件”的真实磁盘行为，并验证哈希、Live Photo、视频、缩略图、首次索引、断线恢复和整库恢复。
- iCloud 搬运台专项：在用户批准后接入下载核心候选，优先试 `icloudpd --domain cn --album <待下载相簿>`，外层台账继续负责“继续上次”、NAS 熔断、同名冲突、Live Photo 成组和 Eagle 交接。
- iCloud 搬运台专项：为 Live Photo 增加封面替换试点：保留原 Live 母版，导出 JPG 工作封面，编辑后用新封面 + 原 MOV 重建可被 iPhone 相册识别的 Live 发布版，并分别测试小红书和微信朋友圈。
- iCloud 搬运台专项：实现 PhotoKit 发布回流适配器，把编辑 JPG/HEIC 和 paired MOV 作为同一 Photos 资产导入；核验资产标识、still-image-time、方向/尺寸、声音、封面时间点及 iCloud 同步，拒绝把 `.livp` 直接标记为手机发布版。
- iCloud 搬运台专项：增加极空间识别试点：分别测试同名 `JPG + MOV`、`HEIC + MOV`、`.livp` 放入极空间后，极空间 App 是否显示为实况；在验证前不承诺 NAS 文件夹会自动合并实况。
- iCloud 搬运台专项：增加 Eagle `.livp` 试点：将 iCloud 下载组件组规范化为 `.heic/.jpeg + .mov` 小写扩展并打包成 `.livp`，导入 Eagle 后验证 `eagle-extension-livp` 能生成缩略图和 Live 预览。
- iCloud 搬运台专项：若 `.livp` 试点不足，再评估并开发自有 Eagle 插件 `MAX Live Photo 管家`，支持自定义包、封面编辑入口、发布版导出和状态展示。
- iCloud 搬运台专项：下一步把单张 PhotoKit 导入助手接入搬运台台账和 UI，批量导入前先增加“待导入/导入中/已导入 Photos/失败”状态、重复导入检测和失败重试。

- 用一条 Instagram 多图或视频帖子完成真实导入冒烟。
- 在有测试素材的普通 Eagle 文件夹中完成一次非破坏性的媒体整理预览。
- Instagram 单帖导入稳定后，再单独评估创作者主页批量下载、分批、断点续传和去重；当前版本尚未包含这些能力。

## 等待确认

- 是否从旧电脑迁移 `Univers LT Std` 等可能受许可证约束的字体；未获确认前不复制。

## 已完成

- 2026-07-23：2.5 原生排序工作流建立永久回归合同 R01-R24 和自动完整性门禁；
  13 组测试与语法检查通过。合同覆盖连续拖动、无拍摄时间、拖动后自动编号、
  锁定零副作用、深层传播、智能集合性能、批处理隔离、重复注入和安全改名。
- 2026-07-23：验收标准收敛为真实 Eagle 界面唯一真源；自动测试、日志和内部状态
  仅作开发预检，不能再据此宣布排序功能通过。

- 2026-07-22：媒体智能整理 2.5.21 候选包完成。旧 17 条团队保护从不可见兼容层
  自动升级为 `sortingLocks.v3` 最高级硬锁，现有 3 条锁不丢失；手动拖动和自动编号
  批量操作跳过锁定目录，显示简介仍可同步。11 组测试和语法检查通过，包 SHA-256
  为 `ec566b5315bd7c93deadc2db4700402562da6c7f95e4154dca8a773d9e4929a8`。

- 2026-07-22：媒体智能整理 2.5.20 已安装。统一修复手动拖动、自动编号开关、
  显示简介递归状态下发，受保护目录仍保存并显示状态，只有排列覆盖和真实改名执行
  继续受保护；批处理提示按发起目录隔离，`全部`视图停止传输整库约2.4万条素材。
  真实`作品集`同步216个文件夹，旧保护目录`1-Sirkeci Lokantası 1912`重启前读回
  手动拖动与相机拍摄时间。正式包 SHA-256 为
  `23551365c64bd5c1cf5aa3ee8115be91afa05ab696d64c4a34c712feacdf3b3a`。
- 2026-07-22：缩略图空白、Shift+X慢和“即将完成”另行定位为 NAS/SMB 对 Library
  `images`约2.4万子目录的冷元数据枚举瓶颈；已知素材读取约0.02秒、网络往返约
  0.5ms。插件整库轮询负担已去除，NAS目录性能不通过修改`.library`规避。

- 2026-07-22：媒体智能整理 2.5.19 修复`手动拖动 -> 应用到全部`。真实
  `🔥🔥🔥作品集`范围 216 个文件夹，成功开启 197 个并明确跳过 19 个保护项，
  一级子文件夹现场复查已开启；未触发自动编号或媒体改名。NAS 重连后 Eagle 日志
  确认加载 24,191 个文件和 303 个文件夹；正式包 SHA-256 为
  `caefac528c8fb2fb183a00cf738e370440a376d3b94e47b457000608b5b011fd`。
- 2026-07-22：媒体智能整理 2.5.12 修复智能文件夹打开严重卡顿。根因为 Eagle
  切换智能视图时短暂同时保留普通文件夹上下文，而插件优先普通文件夹并把
  `bodyScope.raw` 整库约 2.4 万项当成当前结果，每 500ms 重算和跨窗口传输。
  现已改为智能上下文优先、只消费 `allData/filtereds` 当前结果、空结果不回退整库，
  拍摄时间按当前 ID 分批解析并等待视图稳定；真实 554/49/96 项三组均可打开，
  CPU 由约 99% 降至约 2%–5%。已安装、重启、通过 11 组测试，未修改 Library。
- 2026-07-22：完成 2026-07-18 跨电脑交接包收尾。EAGLE 与 MORROW 两个 Git
  bundle 的完整历史均已在主代码仓库中验证，已移除两个仓库对包内 `handoff`
  远端的依赖；旧交接包 410 MB 已移入废纸篓，主代码仓库再次通过 Git 完整性检查。
- 2026-07-22：媒体智能整理 2.5.11 修复当前文件夹多级排序后自动编号仍按
  `bodyScope.raw` 旧顺序命名的问题。新链路为“当前规则确定性排序 → 可选手动
  视图覆盖 → 连续编号”；回归样本原始名称顺序为 `1,3,5,4,9,13,11,8`，
  编号结果为 `1..8`。2.5.11 已安装并重启 Eagle，宿主注入自检通过；未代替
  用户再次改名真实素材。安装前备份为 `media-organizer-plugin-before-2.5.11-20260722-020508`。
- 2026-07-22：媒体智能整理 2.5.10 完成父层/子层作用域重构并直接安装。真实
  `土耳其`父层 15 个子文件夹界面确认三项高层功能各有`应用到全部`，手动拖动可用，
  自动编号识别直接子文件夹；未在真实 Library 执行拖动、改名或递归应用。

- 2026-07-22：媒体智能整理 2.5.8 将排列下拉框作为内联规则显隐真源，并新增真实
  DOM 可见性与相邻位置断言；不再以“节点存在”冒充界面可见。

- 2026-07-20：媒体智能整理完成 schema v3 排序底层重构；艺术展 48 项真实回归
  证明旧 visible 违规 7，新 raw/visible/刷新/自动编号后均为 0。17 个旧保护状态
  保留为配置保护，809 条 legacy order 被明确忽略；普通/智能集合共用引擎且状态隔离。

- 2026-07-20：媒体智能整理 2.4.8 已将低频“团队排序与展示状态”区域移动到插件
  页面最底部；候选包与当前安装页只替换 HTML，未带入并行中的排序核心修改。真实
  Eagle 重启验证首屏为日常整理，底部团队状态仍为 303 个文件夹、ID 匹配 100%。
- 2026-07-19：媒体智能整理 2.4.7 已在本机 NAS Library 完成团队锁定状态接力；修复启动早期误导入 `default` 和同 ID 旧插件重复注入，真实界面确认 `散组` 下级 17 个保护文件夹、`浴袍照` 保护已勾选。
- 2026-07-19：将 `tools/icloud-intake-workbench` 从静态台账骨架升级为可运行本地 demo 应用；支持本批进度、继续上次、暂停/继续、模拟搬运一步、重试失败、素材列表和设置锚点。Demo 使用本地样例台账 `~/.eagle-icloud-intake/demo-ledger.json`，不登录 iCloud、不下载、不创建 NAS 目录、不导入 Eagle。
- 2026-07-19：用户指定 NAS 目标文件夹 `/Volumes/团队文件-MAX线上协作中台/icloud 待分类素材/`，本机核对存在且可写；本地 demo 已改为显示该目标路径。随后根据小红书/朋友圈 Live 发布需求，将格式策略修正为：JPG 仅作筛选/预览/轻编辑代理，Live Photo 必须保留原始组件或可重建发布版，并纳入“电脑端编辑 JPG 封面 + 原 MOV 重建 Live 发布版”的工作流。
- 2026-07-19：用户实测 iCloud 网页下载 Live Photo 得到 zip，解开为同名 `JPG + MOV`；记录判断为“Live 组件组”而非 NAS/Finder 原生实况对象。极空间能否自动识别需单独试点验证。
- 2026-07-19：确认 `.livp` 不应作为 iCloud.com 可稳定直接下载的正式依赖；iCloud 网页外部导出以 zip 内组件组为主。Live 保真优先保存“未修改原片”组件组和台账绑定，若需要 `.livp` 由搬运台本地生成归档副本。
- 2026-07-19：只读检查本机 Eagle `eagle-extension-livp` 1.0.2：插件只注册 `.livp` 预览类型，内部按 zip 解包并查找小写 `.heic` 或 `.jpeg` 图片组件与 `.mov` 视频组件；不自动关联普通目录里的同名 `JPG + MOV`。
- 2026-07-19：搬运台新增 Live 识别/封装器，已用测试验证可识别大写 `IMG_9264.JPG + IMG_9264.MOV` 并生成包内规范化为 `image.jpeg + motion.mov` 的 `.livp`；当前只用临时测试文件，未处理真实素材。
- 2026-07-20：核准 Apple PhotoKit 以照片资源 + `pairedVideo` 资源表示 Live Photo；`.livp` 仅作为 Eagle 预览封装。核查 2026-07-16 小红书电脑创作平台前端，图片上传明确不支持 live，`.mov` 只会进入普通视频流程。搬运台 demo 新增 Live 资源悬停预览、右键编辑封面/动态及 JPG、Eagle `.livp`、iPhone 实况、短视频分流入口；全部仍为本地流程演示，不写真实素材。
- 2026-07-20：修复搬运台 demo 右栏空白拉伸并补充“当前素材预览”；中间 Live 卡悬停或聚焦时，右侧同步显示播放状态和 JPG/MOV/LIVP 组件信息。
- 2026-07-26：完成第一组真实 iCloud Live 样本试点。样本
  `/Users/max/Downloads/iCloud 照片/IMG_9264.JPG + IMG_9264.MOV` 已被识别为 ready
  Live 组件组；临时生成 Eagle 兼容 `.livp`，包内 `image.jpeg + motion.mov +
  manifest.json`；经用户批准，用 PhotoKit 导入 macOS「照片」测试相簿
  `MAX Live Photo Import Test`，核验 Photos 资产 `isLivePhoto=true` 且资源为
  `photo + pairedVideo`。未写 NAS、未修改 Eagle `.library`、未启动 iCloud 下载。
- 2026-07-26：经用户批准完成 Eagle 端真实导入试点。通过 Eagle 本地 API 导入
  `MAX_LIVE_TEST_IMG_9264.livp`，item ID `MS0KTJSY3J9BF`，当前位于正式 NAS Library 的
  未分类/全部视图；Eagle 识别格式为 `LIVP`，缩略图正常，右侧详情正常，空格预览进入
  `eagle-extension-livp` 的 `LIVP Viewer` 并显示画面。排查过程中额外导入控制项
  `MAX_LIVE_TEST_CONTROL_JPG` 和一张截图测试项，后续清理需用户确认。

- 2026-07-19：完成 iCloud Photos 可靠搬运台方案，确认首选入口为“待下载相簿/批次 + 本地搬运台”，浏览器扩展仅作辅助；新增 `tools/icloud-intake-workbench` 最小台账骨架和测试，已覆盖重复素材、Live Photo 成组、下载状态与选择锚点分离、进度、同名冲突和首页渲染。未安装工具、未登录账号、未下载、未创建 NAS 目录。

- 2026-07-19：核对本机媒体智能整理安装版与正式源码一致，均为 2.4.1；安全桥接和插件菜单存在。实际打开“插件 → 媒体智能整理”后，多级拍摄时间排序、素材简介、文件夹级规则、临时拖动、防止全局覆盖和自动编号入口恢复；当前 NAS 资料库文件夹 17 个素材中 16 个读取到拍摄时间。确认本次不是交接包缺文件或版本装错，而是当前资料库界面未完成插件激活/注入。

- 2026-07-18：完成“iCloud 超过十万张工作素材 → NAS 长期存储 → Eagle 分类与索引”的只读调查和双架构设计；推荐 NAS Eagle 正式库方案，记录分批、去重、断点续传、恢复、增量、性能、权限和备份规则；未实际迁移任何素材。

- 2026-07-18：在新 Mac 校验交接包、恢复 Git bundle 源码并通过严格仓库完整性检查；正式源码提交为 `fb89ca534fe299d87c551fce773cd4cfc001f641`。
- 2026-07-23：Eagle 排序系统 3.0 独立测试插件 `3.0.0-alpha.4` 已安装，菜单入口为
  `插件 → Eagle 排序系统 3.0（测试版）`，与旧“媒体智能整理”并存。自动测试
  19/19 通过；“全部”视图受控拒绝并处理 0 项，普通叶子文件夹只读加载 6 个直属
  素材。未应用显示顺序、未拖动、未重命名，真实操作验收仍待隔离测试 Library 批准。
- 2026-07-23：用户指定真实“🔥🔥🔥作品集”为测试目录；3.0 已将其 24 个直属
  子文件夹从正向实际改为反向，Eagle 主界面确认生效，再恢复正向并确认 `1 → 24`。
  显示顺序真实往返测试通过，未重命名素材或操作 NAS 文件。
- 2026-07-18：补齐独立共享模块目录并通过 MORROW/Eagle 版本一致性验证；媒体整理六组测试、Instagram 语法检查和隐私编辑器构建通过。
- 2026-07-18：确认本机 Eagle 4.0.0 与桥接清单精确匹配，安装安全桥接并将原始 `app.asar` 备份到 Eagle 应用支持目录。
- 2026-07-18：安装 MAX Publisher 1.2.5 和媒体智能整理 2.4.1；两者均已从 Eagle 插件菜单成功打开，未修改资料库素材。
- 2026-07-18：用户在 Chrome 开发者模式加载 `extensions/instagram-post-importer`，Instagram 整帖保存至 Eagle 1.1.2 安装完成。

- 2026-07-18：确认 Eagle 扩展是独立产品体系，不属于 MORROW。
- 2026-07-18：定位 Eagle 线上展示源目录为旧 `朋友圈模拟器/Eagle线上展示`，已安装插件 ID 为 `com.max.eagle-online-showcase`，显示名为 `MAX Publisher`，已包含水印、隐私打码、字体管理、快速导出和线上发布能力。
- 2026-07-18：确认媒体智能整理项目包含排序、连续重编号、地域标签及 Eagle 主程序桥接；迁移时需保留原始 `app.asar` 备份和恢复脚本。
- 2026-07-18：媒体智能整理迁入 `extensions/media-organizer`；六组自动测试全部通过，关键源码与已安装插件一致，原始 `app.asar` 备份指纹通过校验。
- 2026-07-18：MAX Publisher 1.2.5 迁入 `extensions/online-publisher`；线上发布数据独立到 `/Users/max/引力环球/Eagle线上发布数据`，配置与安装插件默认路径同步更新。
- 2026-07-18：MAX Publisher 已脱离 MORROW 旧目录中的测试素材，73/73 项测试、隐私编辑器构建和插件打包全部通过；生成的 `.eagleplugin` 压缩包完整性通过。
- 2026-07-18：在产品根建立独立 Git `main` 基线，首个提交为 `668f9d2`；依赖、构建缓存、插件包和真实发布数据未进入版本库。
- 2026-07-18：将 MAX BRAIN 中的 `Instagram 整帖保存至 Eagle` 1.1.2 源码和安装包迁入 `extensions/instagram-post-importer`；代码语法、目录内容和安装包哈希均已核对。真实 Eagle 导入尚待验收，因此未标记为完整交付。
- 2026-07-18：完成“跨电脑安装与开发接力”专项的可重复构建与验证脚本；交接目录明确分为“一键可装”“需要一次手动加载”“因宿主版本需兼容安装”三类。
- 2026-07-18：审计 Eagle 4.0 build 23 原始与桥接 `app.asar`，确认桥接只改动两处插件通信文件；记录归档及关键文件 SHA-256，并建立未知版本/未知哈希拒绝、安装前备份、显式回退的安全流程。
- 2026-07-18：MAX Publisher 73/73、媒体整理六组测试、Instagram 语法检查、隐私构建、插件压缩包与 Git bundle 验证全部通过；未触碰当前 Eagle、已安装插件、资料库和线上发布数据。

- 2026-07-23：按用户批准继续修复并替换原生工作流的「媒体智能整理」2.5.21，
  不把本次故障引导到独立 3.0 界面。真实 `3-Seven Hills` 59 项中，打开插件、
  取消排序锁定、重新锁定后顺序与文件名指纹完全一致。已覆盖安装，
  未修改 `.library`、NAS 素材或 `app.asar`。

## 2026-07-23 排序与重命名全面治理第一阶段

- [x] 冻结当前安装版、API、源码哈希、API 75 回滚点和未通过的 R34 现场结果。
- [x] 完成 Eagle 三模块边界与 L0 原生主权契约。
- [x] 完成排序现状审计、L0-L8 目标架构和 R01-R34 永久 bug 台账。
- [x] 完成排序行为/测试矩阵与保留、提取、废弃、隔离迁移计划。
- [x] 把治理规则写入两级 AGENTS/PROJECT/TASKS/DECISIONS，并建立 npm 治理门禁。
- [ ] 经批准后实施批次 1：A 独立生命周期、Host/Event adapter 和事件 ownership。
- [ ] 结构改造和全部自动门禁完成后，再请求候选安装、完整重启及真实 UI 验收批准。

## 2026-07-23 项目总管只读交接

- [x] 完整读取根目录及各正式扩展的 `AGENTS.md`、`PROJECT.md`、`TASKS.md`、
  `DECISIONS.md`，并读取 Eagle 模块边界、排序冻结基线、审计、目标架构、R01-R34
  台账、行为矩阵、迁移计划和排序模块边界。
- [x] 建立 `PROJECT_MANAGER.md`，登记产品结构、安装/候选/回滚基线、活动任务、
  未解决风险、用户批准节点和总管派发/审核协议。
- [x] 只读核对 QA 候选证据：无插件物理鼠标基线已记录通过；候选现场的 Computer
  Use 跨应用拖动不可判定；`2.5.21 / API 77` 恢复状态和生产禁止发布结论保持。
- [x] 本轮未开发功能、未安装或重启 Eagle、未操作正式 Library/NAS/iCloud，也未修改
  业务代码；保留工作区已有未提交变更。

## 2026-07-23 媒体智能整理“排序与重命名”主任务状态登记

- [x] 只读同步 `PROJECT_MANAGER.md`、根 `AGENTS.md`、
  `extensions/media-organizer/docs/SORTING-*` 和
  `extensions/media-organizer/docs/PERMANENT-REGRESSION-CONTRACT.md`。
- [x] 当前状态固定为：`2.5.21 / API 77` 冻结；`2.5.22-qa.1 / API 78` 在独立
  QA Library 等待 R34 B 物理拖动；R34 未封板前不得生产部署。
- [x] 本轮只做状态登记；未修改排序源码、未打包、未安装、未重启 Eagle、未操作真实
  Library/NAS。
- [x] 2026-07-24 00:35 CST 复核：已通过可恢复 Local Storage LevelDB 处理取消
  `extensions/media-organizer` 开发源码加载登记；最新 Eagle 日志只初始化安装目录
  `com.max.eagle-photo-taken-sort` 候选 `2.5.22-qa.1 / API 78`，QA Library 已打开，
  R34 B Finder 目标目录为空，当前等待用户物理鼠标拖出。
- [x] R34 B 已通过；R21 自动编号异常置灰已真实复发并按失败测试门禁完成修复。

- [x] R21 修复已先失败测试再实现：自动编号开关权限与 rename busy 分离，队列拒绝/
  claim 失败会释放主窗口残留状态；完整自动门禁通过。新候选
  `2.5.22-qa.2 / API 79` 已生成、记录指纹并安装到单一安装目录；qa.1 可恢复备份
  已保留。仅在 QA Library 对 `MEUL73DQPC4ZS` 复验，自动编号不再置灰，切换集合后
  状态仍释放，用户报告场景真实通过。生产 Library/NAS 未操作。
- [x] `qa-fixtures-unique` 完成排序锁定开/关 10 个循环和手动拖动关/开 10 个循环；
  每次真实网格顺序、文件名和自动编号状态均未串改，无临时名或进度遮罩。
- [x] 2026-07-24 用户批准本轮快速验收例外：用户现场确认 4 次物理网格内拖动通过；
  实时监测未完整覆盖，因此只记本轮快速 QA 通过，不替代永久 R01 连续 20 次正式发布
  回归合同。
- [x] qa.2 至 qa.3 完成 R21 特殊文件夹状态释放、逐项编号、缩略图/预览、刷新/切换/
  完整重启、跨 collection、普通父/叶、全局受控不可用和智能集合范围真实复验。
- [x] qa.3 受控失败暴露自动重试，qa.4 先失败测试后取消自动恢复；qa.4 又暴露失败终态
  网格投影不一致，qa.5 先失败测试后定向恢复受影响 item 与选择。qa.5 真实受控失败
  终态一致、无自动二次执行，用户明确预览后的单次恢复成功；最终自动编号关闭。
- [x] `2.5.22-qa.5 / API 82` 具备本轮快速 QA 验收条件；生产发布仍缺永久 R01 20 次
  物理网格拖动及 R34 手动开/关/锁定三态物理 Finder 拖出。
- [x] 2026-07-25 用户将 R01 本次发布样本固定为已完成的 4 次，并取消 R34 三态重复
  物理拖出；以既有 A/B 物理拖出、SHA-256 和三态源码/自动回归接受残余风险。
- [x] R01-R34 在本次治理口径下全部关闭；qa.5/API82 已证明与当前安装静态载荷逐文件
  一致，避免无意义覆盖，并完成发布前完整备份、指纹和完整 Eagle 重启。
- [x] 重启后只加载本地 QA Library 和一个媒体智能整理来源；原生选择、完整预览、右键
  菜单正常，排序锁定/手动拖动/自动编号均关闭。
- [x] 生产 Library 确认为
  `/Volumes/团队文件-MAX线上协作中台/引力环球.library`，位于 `z4-b35a.local` SMB
  挂载。按最新授权禁止 NAS 写入，本轮未打开或操作生产 Library，不能宣称生产 NAS
  已完成真实写入验收。

## 2026-07-25 最新真实 NAS 覆盖结论

- [x] 专项测试库已准确枚举并在 Eagle 完全退出后可恢复移入
  `/Users/max/.Trash/Eagle QA Sort 2026-07-25-deleted-20260725-final.library`；源码、证据、备份和指纹清单保留。
- [x] 在真实 NAS Library 内通过 Eagle UI 创建隔离文件夹 `排序插件隔离验收-20260725`
  （folder ID `MS03COPQUCQYH`），导入 4 个非正式 PNG；未触碰既有正式素材。
- [x] 真实 NAS 隔离区的原生选择、预览、右键、自动编号、锁定权限、刷新和完整重启通过；最终
  `排序锁定=关`、`手动拖动=关`、`自动编号=关`、`待改=0`。
- [x] 本地唯一插件仍为 `2.5.22-qa.5 / API 82`，安装目录、可恢复备份及完整指纹保持不变。
- [ ] 最新真实库门禁仍未全部通过：R01 网格拖动未形成有效顺序变化，R34 跨应用 Finder 拖出未执行；其余未在本次真实 NAS 隔离区逐项重跑的 R-ID 继续沿用历史证据但不能据此宣称生产全通过。
- [ ] 本轮结论为“真实 NAS 部分通过”，不具备 R01-R34 全部生产验收条件；插件已安装可供最终软件验收，但在 R01/R34 关闭前不应宣称历史 bug 已全部完成生产验收。
- 证据：`qa-evidence/QA-REAL-NAS-FINAL-ACCEPTANCE-2026-07-25.md`。

## 2026-07-25 团队排序自动同步任务

- [x] 完成本地自动同步源码和失败测试，影响 `R15/R16/R18/R21/R22/R31`；仅写 Library 同级 sidecar，不写 `.library`、`app.asar` 或正式素材。
- [x] 本地 `npm test`、`node --check plugin.js`、`git diff --check` 通过；自动编号状态仅携带，不会在接收电脑自动开启或改名。
- [ ] 尚未安装候选、重启 Eagle 或写真实 NAS sidecar；当前安装 `2.5.22-qa.5 / API 82` 与回滚基线保持不变。
- [x] 生成并记录未安装候选 `2.5.22-qa.6 / API 83`；非 `node_modules` 文件清单 SHA-256 为 `e48057d7ecad46276f263cbf4491554699f4f9e9ddcdad19e9c59f6728ad742f`。
- [ ] 真实双电脑 NAS 验收和安装需后续明确批准；当前 qa.5 安装不变。
- 证据：`qa-evidence/QA-TEAM-AUTO-SYNC-2026-07-25.md`。

## 2026-07-25 顶层动态模型协议同步

- [x] 完整读取并采用
  `/Users/max/引力环球/00_总管中心/Codex协作操作系统与动态模型策略.md`；Eagle
  项目规则只能更严格，不得放宽角色边界、高风险批准、失败证据和模型策略。
- [x] Eagle 项目总管固定为 `gpt-5.6-sol/high`；跨项目/跨模块架构与最终发布审核同样
  使用高推理。
- [x] 执行任务改为动态选择最低够用模型：只读、简单文档和重复检查优先
  `minimal/low`，独立小模块可从 `medium` 起步；不写死高性价比模型型号。
- [x] 跨文件状态机、事件链、并发、真实 Eagle、生产 Library/NAS、安装、迁移和回滚
  固定使用 `gpt-5.6-sol/high`；首次失败后根因不清或证据冲突时立即升级，不盲目重复。
- [x] 新建或重新派发任务必须记录 `模型`、`推理等级`、`选择原因`、`升级条件`；所需
  模型不可用时停止派发并说明，不得静默降级。
- [x] 当前排序系统重建与稳定性验收续任务的续派基线登记为：模型
  `gpt-5.6-sol`；推理等级 `high`；原因是涉及真实 Eagle、生产 NAS Library、安装与
  回滚；升级条件为继续保持 `high`，若范围跨越排序业务边界则先回项目总管重新拆分。

## 2026-07-26 iCloud Live Photo 导出层试点

- [x] 在 `tools/icloud-intake-workbench` 增加 `.livp` 组件导出命令：
  `live-export <package.livp> --output <dir> [--mode all|image|movie]`。
- [x] 自动测试覆盖 `.livp -> JPG/MOV` 还原与重复导出拒绝覆盖；当前
  `node --test tools/icloud-intake-workbench/test/*.test.js` 为 10/10 通过。
- [x] 只读使用真实 Eagle 测试 item `MS0KTJSY3J9BF` 的 `.livp` 导出到
  `/tmp/eagle-live-export-test-20260726-001/`，还原为 `IMG_9264.JPG` 与
  `IMG_9264.MOV`；SHA-256 与用户 iCloud 下载原始组件一致。
- [x] 重复导出到同一目录已验证会报错 `Output already exists`，不会静默覆盖。
- [ ] Apple Photos/PhotoKit 导回 Live 已证明单张技术可行，但重复执行产生过重复资产；
  生产开放前必须补 Photos 导入去重锁、导出批次台账和失败恢复。
- [ ] Eagle 右键菜单、批量导出、批量导回 Photos 和水印/马赛克编辑器联动仍是下一阶段
  产品化工作；本轮只完成底层可逆导出能力。

## 2026-07-26 iCloud Live Photo 54 组批量 demo

- [x] 只读扫描 `/Users/max/Downloads/iCloud 照片 2/`：108 个文件识别为 54 组完整
  `JPG + MOV`，无缺失伴侣文件、无同名冲突。
- [x] 成功生成 54 个 Eagle `.livp` 包到 `/tmp/icloud-live-54-livp-20260726/`，总大小约
  439 MB；抽检包内为 `image.jpeg`、`motion.mov`、`manifest.json`。
- [x] 经用户批准，在 Eagle 创建测试文件夹 `MAX Live 54 Demo 2026-07-26`
  （folder ID `MS0NDHXFUZYG6`），并尝试通过 Eagle API 导入批量 `.livp`。
- [x] 发现并记录真实阻断：Eagle `addFromPath` 快速连发返回 54 个 success/ID；
  UI/列表曾观察到前 7 个名称，但最后逐 ID 快照只确认 6 个可重新读取。API success
  不是完成证据，后续补导继续超时。
- [x] 只读日志与插件源码定位：`eagle-extension-livp` 缩略图插件使用固定
  `temp/zip_temp` 目录，批量并发时出现 `zip_temp/image.jpeg` 缺失、缩略图超时和
  Eagle 后台 10/20 秒无响应。
- [ ] 暂停继续批量导入；生产前必须实现 Eagle 导入确认台账、限速队列、失败熔断、
  重启恢复，并优先开发自有 `MAX Live Photo 管家` 或可并发安全的缩略图/预览策略。
- [ ] 当前 Eagle 可能仍处于 NAS I/O 等待或后台缩略图恢复中；未经用户确认不重启 Eagle、
  不删除测试项、不继续导入。

## 2026-07-26 P0：LIVP 批量导入阻塞正式 Eagle/NAS

- [x] 立即冻结所有新导入、补导、Eagle API、Eagle UI 和 `.library` 扫描；本任务没有
  仍在运行的补导脚本。
- [x] 只读确认 Eagle 的 58 个队列请求由 54 个唯一 `.livp` 首轮请求和 4 个补导请求
  组成；补导未独立持久化，具体重复 stem/返回 ID 不得猜测。
- [x] 保存首轮 54 个 API 返回 ID、两轮逐 ID 复核快照和测试 Folder ID
  `MS0NDHXFUZYG6`；最后快照仅确认 6 个精确 ID 可重新读取，其中 4 个
  `noPreview=true`。
- [x] 登记严重故障：
  `docs/INCIDENT-2026-07-26-EAGLE-LIVP-BATCH-IMPORT.md`。
- [ ] 等待总管取得用户对正常取消、正常退出/重启和测试项清理的分别明确批准；批准前
  不执行任何一项。
- [ ] 恢复后仅用 Eagle 公开接口按精确 Folder ID、标签和已知 ID 有界清点；禁止全库
  扫描和手工修改 `.library`。
- [ ] 生产恢复前实现 `accepted -> confirmed` 状态机、幂等补导锁、单写入队列、逐项
  缩略图确认、超时熔断及宿主级 I/O 互斥。
- 模型：任务书要求 `gpt-5.6-sol/high`；原因：真实 Eagle/NAS 与恢复风险。升级条件：
  任何恢复需要强杀、手改 `.library`、范围不明删除或公开 API 之外的处理时，立即禁止
  并回报总管。

### 用户批准后的恢复

- [x] 接手时原生 8/58 队列已经消失，当前 Eagle 是新启动实例；未再次退出/重启，未
  强杀。
- [x] 有界确认本批实际形成 8 个可见 `.livp`（`img_3248` 到 `img_3255`），4 次补导
  没有形成额外可见副本。
- [x] 8 个精确测试 ID 已移入 Eagle 回收站，逐项验证 `isDeleted=true`；未清空回收站。
- [x] 空测试文件夹 `MS0NDHXFUZYG6` 已通过 Eagle UI 删除，文件夹总数 304 -> 303。
- [x] Eagle API、普通文件夹网格和缩略图恢复响应；进程复核不再存在 `U` 状态或
  `exif-metadata/exiv2` 子进程。
- [ ] `Shift+X` 配置仍存在，但 Computer Use 合成按键没有捕获到截图覆盖层，实际入口
  未能自动确认，不宣称通过。
- [x] 未创建新备份、未删除旧备份、未安装 qa.9、未处理单张基线 item
  `MS0KTJSY3J9BF`、未手改或遍历 `.library`。

## 2026-07-27 引力环球视频 Library 部分缓存恢复

- [x] 只读确认真实 Library 为
  `/Volumes/团队文件-MAX线上协作中台/引力环球视频.library`；回收站为空，未分类
  `103` 项不是欧洲站缺失素材的整体落点。
- [x] 发现磁盘存在 `10,949` 个 `.info` 目录，但 Eagle 旧缓存只显示 `1,945` 项；
  精确抽查的旧 item 仍保留原文件夹 ID，排除排序插件批量删除素材或归属。
- [x] 通过 Eagle 原生 `资源库 -> 清除缓存并重新加载` 强制重建本地 Library cache；
  未强杀、未安装、未手改 `.library`、未创建新备份。
- [x] Eagle 日志确认无缓存加载 `10,950` 个目录项、有效文件 `10,945`，耗时
  `75.114` 秒；侧栏总数恢复为 `10,945`。
- [x] 欧洲站 24 个子文件夹恢复合计 `2,767` 项；`day1 杭州到米兰` 的缩略图和
  `IMG_9619.mov` 原生预览已出现。
- [x] 精确识别 4 个缺少 Eagle 元数据的残留 `.info` 目录；对应名称在 `S5成片` 已有
  有效项目，本次不重复导入、不手工删除。
- 证据：`docs/INCIDENT-2026-07-27-EAGLE-VIDEO-LIBRARY-PARTIAL-CACHE.md`。
- 模型：`gpt-5.6-sol/high`；原因：真实 Eagle、生产 NAS Library 和恢复操作。升级
  条件：若原生强制重载后仍缺项，或需要修改 `.library`/删除残留，立即停止并升级。

## 2026-07-28 排序系统重建 qa.12 真实现场

- [x] `node --check plugin.js`、完整 `npm test`（全部契约、排序、重命名、团队状态和永久
  回归）以及 `git diff --check` 通过。
- [x] 候选 `2.5.22-qa.12 / API 89` 已安装到唯一正式插件目录
  `/Users/max/Library/Application Support/Eagle/Plugins/com.max.eagle-photo-taken-sort`；
  源码与安装目录 `plugin.js`、`order-coordinator-core.js` SHA-256 一致；活动目录中同
  ID 仅有一个 `manifest.json`。
- [x] 真实 Eagle 4.0.0 已正常启动并加载真实 NAS Library
  `/Volumes/团队文件-MAX线上协作中台/引力环球.library`；侧栏显示 24,180 项、117.16 GB；
  未发现导入队列、批量改名任务或测试文件夹。
- [x] 插件启动诊断记录排序、拍摄时间简介、重命名、保护、层级文件夹和手动拖动自检通过。
- [ ] 真实文件夹 `改造对比案例`（Folder ID `M837TMZXE0VTX`）当前已有 113 项持久化
  `manualViews`，且 `manualMode.enabled=true`；因此该现场按产品规则优先保持手动顺序，
  不能把当前 API 顺序直接判为拍摄时间自动排序通过。
- [ ] 未在真实库执行“恢复自动排序”，因为该动作会清除该文件夹现有手动顺序并改变真实
  Library 状态；待用户明确批准后，才可用该文件夹做拍摄时间规则的最终现场验收。
- 模型/推理：`gpt-5.6-sol / high`；原因：真实 Eagle、生产 NAS、安装与排序状态机；
  升级条件：真实界面与 sidecar/API 状态冲突、出现第二插件来源、需要改名/删除或触碰
  `.library` 内部结构时立即停止并升级。

## 2026-07-28 排序 qa.14/API91 相对位置重建交接

- [x] `2.5.22-qa.14 / API 91` 已通过 `npm test`、`node --check plugin.js` 和
  `git diff --check`，并安装到唯一正式插件目录。
- [x] 真实 NAS Library `/Volumes/团队文件-MAX线上协作中台/引力环球.library` 已加载；
  `改造对比案例` 113 项，当前规则 `PHOTO_TAKEN_AT`，82 项有拍摄时间、31 项缺失。
- [x] 相对位置手动关系、自动基础顺序、升降序保留关系、恢复自动排序清除活动覆盖、
  旧完整数组迁移兼容和排序锁定 guard 已进入候选。
- [x] 本轮未导入、未批量改名、未删除、未手改 `.library`。
- [ ] 真实方向切换和恢复按钮尚未宣称通过：当前文件夹已有历史 `manualViews`，清除它
  会改变真实 Library 状态；需用户明确选择后再执行。
- 模型/推理：`gpt-5.6-sol/high`；原因：真实 Eagle、生产 NAS、安装和排序状态机；
  升级条件：第二来源、状态覆盖、真实改名/删除或 `.library` 内部修改时立即停止并升级。

## 2026-07-28 智能文件夹排序边界收窄

- [x] 用户确认智能文件夹不需要自动编号，只需要改变当前智能结果的排序顺序。
- [x] 先写失败测试并定位历史缺口：智能集合已拒绝 `canAutoNumber`，但仍渲染自动编号区并可构造改名计划。
- [x] 源码修复已完成：智能集合隐藏自动编号区，计划构造和执行层均拒绝智能改名；普通文件夹排序/编号链保持冻结。
- [x] 新增永久回归 R42，交叉影响 R12/R15/R38-R41；自动门禁通过，未安装、未重启、未操作真实 Library/NAS。
- 模型/推理：`gpt-5.6-sol/high`；原因：智能虚拟集合与普通改名事务的跨层边界；升级条件：真实 Eagle 仍出现智能改名入口、来源普通文件夹被改写或需要 `.library`/`app.asar` 修改时立即停止并升级。

## 2026-07-28 qa.15/API92 安装

- [x] 候选 `qa-candidate/media-organizer-2.5.22-qa.15` 已生成，版本 `2.5.22-qa.15 / API 92`。
- [x] 安装前 `qa.14` 已完整备份到 `qa-evidence/install-backups/com.max.eagle-photo-taken-sort-qa.14-before-qa.15-20260728-063945`。
- [x] 唯一安装目录 `/Users/max/Library/Application Support/Eagle/Plugins/com.max.eagle-photo-taken-sort` 已替换为 qa.15；同 ID 活动目录数量为 1。
- [x] 安装指纹：`plugin.js` `dd3cef7420a46a88744edd91e846a3ed96d24d31aef451bd236da3808cbd2e3c`；`manifest.json` `124242a879c70c871a7a83ca1e4916594c866b51e4a89603864df66a0f7c22fa`。
- [x] 2026-07-28 已正常退出旧 `qa.14` 进程并由新进程加载 `qa.15/API92`；本项由下方
  P0 真实 NAS 启动性能验收覆盖。未改名、未改素材、未直接修改 `.library` 或 `app.asar`。
- 模型/推理：`gpt-5.6-sol/high`；原因：插件安装、唯一来源和真实 Eagle 验收门槛；升级条件：启动后出现第二来源、版本/API 不一致、智能改名入口仍出现或需要真实素材写入时立即停止并回滚。

## 2026-07-28 P0 真实 NAS Library 启动性能

- [x] 只读确认旧进程已完成加载但仍运行 `qa.14`；旧主库
  `Start to load -> Library loaded` 为 `596.712` 秒。
- [x] Eagle 经原生正常退出，进程自行完全结束；未强杀。
- [x] 新进程加载唯一 `qa.15/API92`，运行日志明确显示版本；安装目录与候选
  `plugin.js`、`manifest.json` SHA-256 一致。
- [x] 真实主库冷启动 `Eagle start -> Library loaded` 为 `102.483` 秒，
  `Library start -> loaded` 为 `101.926` 秒；相对旧进程主库加载缩短约 `82.8%`。
- [x] Eagle 汇总为 290 个文件夹、24398 个有效文件；UI 为全部 24128、回收站 270，
  计数闭合。缩略图、检查器和原生双击预览均可用，renderer 最终为 `S`，未见 `U`。
- [x] 加载期未出现整库 EXIF、改名、NAS sidecar 或高频插件写入；仅一次本机
  `photo-taken-cache.json` 原子替换。插件未进入整库关键路径，因此未修改源码。
- [x] `4dca4ea2.txt` 被 Eagle 判定 `Cache no changes`，未执行缓存清理；未遍历或
  直接修改 `.library`，未写 NAS 素材，未改 `app.asar`，未建测试库或额外备份。
- 证据：`qa-evidence/QA-P0-REAL-NAS-STARTUP-PERFORMANCE-2026-07-28.md`。
- 模型/推理：`gpt-5.6-sol/high`；原因：真实 Eagle、生产 NAS、缓存、重启和回滚；
  升级条件：正常退出失败、精确缓存重建后复发、真实缺失或需要强杀/NAS 后台/
  `.library` 修改时立即停止。

## 2026-07-28 媒体智能整理：排序与重命名长期维护 qa.17 宿主输入结论

- [x] `2.5.22-qa.17 / API94` 自动门禁通过、唯一安装并经正常重启加载；qa.16 回滚点
  和完整指纹清单已保留。
- [x] R42 真实通过：智能文件夹自动编号整行不存在，智能链零改名。
- [ ] R38/R39/R43 仍失败：真实智能文件夹有 6 次 `pointer-start`，但
  `pointer-commit` 为 0，画面和顺序均未改变。
- [x] 已按宿主硬限制停止，不拦截 Eagle 原生事件、不增加第二套业务鼠标层、不改
  `app.asar`，也未写 NAS 素材或 `.library`。
- 证据：`qa-evidence/QA-SMART-FOLDER-SORTING-QA17-2026-07-28.md`。

## 2026-07-28 媒体智能整理：排序与重命名长期维护 qa.18 首拖结论

- [x] qa.17 的四类真实取消序列已进入失败测试；qa.18/API95 使用单一 resolver 和
  同一 HostInputAdapter 被动观察原生 drag，普通文件夹稳定分支未改。
- [x] 自动门禁、候选指纹、qa.17 回滚点、唯一安装和正常重启完成。
- [x] 真实首拖已得到有效同网格 target 与唯一 commit，证明事件/落点不再完全缺失。
- [ ] 智能网格画面仍无变化，R38/R39/R43/R44/R45 保持红灯；首拖后已立即停止。
- [x] R42 继续真实通过，未改名、未写 NAS 素材或 `.library`，未触碰 `app.asar`。
- 证据：`qa-evidence/QA-SMART-FOLDER-SORTING-QA18-2026-07-28.md`。

## 2026-07-28 媒体智能整理：排序与重命名长期维护 qa.19 首拖结论

- [x] R45 红灯测试、纯应用编排、七阶段诊断和 smart-only ID presenter 已完成；
  普通文件夹排序/改名分支冻结，工作区与候选完整自动门禁通过。
- [x] `2.5.22-qa.19 / API96` 已备份 qa.18、替换唯一安装并经正常重启加载。
- [ ] 真实首拖在 `native-drag-start` 后以 `grid-outside` 取消，没有 MoveCommand 或
  `MOVE_STAGE`，画面不变；R38/R39/R43/R44/R45 保持红灯。
- [x] 按首拖失败门禁立即停止；R42 继续通过，零改名，未写 NAS 素材或 `.library`。
- 证据：`qa-evidence/QA-SMART-FOLDER-SORTING-QA19-2026-07-28.md`。

## 2026-07-28 智能文件夹手动排序 qa.21 最终结论

- [x] `2.5.22-qa.21 / API98` 已完成完整自动门禁、唯一安装和正常重启；当前同 ID
  活动插件来源只有一个，qa.20 完整回滚点已保留。
- [x] 智能文件夹自动编号整行不存在，手动排序全链零改名、零 `autoRename`，来源普通
  文件夹的文件名、编号状态和顺序不被改写。
- [x] `线上展示照片` 真实智能集合连续 3 次拖动均立即改变画面并到达唯一
  `VISIBLE_VERIFY_OK`，刷新后保持。
- [x] `MAX照片集` 真实智能集合拖动后立即改变画面；刷新、切换到其它智能/普通文件夹
  再返回后顺序保持，完成 R38/R39/R43-R46 真实闭环。
- [x] 智能拖动复用普通文件夹现有落点 helper、目标高亮和统一清理函数；不新增覆盖层、
  第二套鼠标业务链或 Eagle 原生事件拦截。瞬时拖动帧无法由自动化冻结截图，保留为用户
  最终视觉验收项，不影响已确认的排序和持久化结论。
- [x] 普通文件夹排序与改名分支保持冻结；未修改 NAS 素材、`.library` 或 `app.asar`。
- 证据：`qa-evidence/QA-SMART-FOLDER-SORTING-QA21-2026-07-28.md`。
- 模型/推理：`gpt-5.6-sol/high`；原因：真实 Eagle 智能虚拟网格、持久化重入、唯一安装
  与回滚；升级条件：顺序再次丢失、智能链触发改名、普通文件夹或 Eagle 原生能力回归。

## 2026-07-29 媒体智能整理：排序与重命名长期维护 R48 结构性修复

- [x] 先以行为测试复现设置面板 boolean shadow、普通/智能重复渲染和智能集合加载
  瞬态；新增 R48 永久门禁。
- [x] 普通/智能设置 DOM 渲染已分离；智能集合新增 generation/token 生命周期和
  fail-open presenter，移除智能路径对 Eagle `allData/filtereds` 的直接写入及固定
  160/180ms 恢复重试。
- [x] `2.5.22-qa.22 / API99` 工作区及候选完整 `npm test`、改动 JS
  `node --check`、`git diff --check` 全部通过，候选指纹清单已生成。
- [x] 续跑时 Eagle 已自然退出且不存在主/renderer；确认无活动导入、改名、删除或写
  任务后，以延迟更新替换唯一安装为 `2.5.22-qa.22 / API99`，五个关键哈希与候选一致。
- [x] `/usr/bin/open -a Eagle` 正常启动；主进程和 renderer 均为 `S`，公开 API 确认
  Eagle 4.0.0 build 20260401 及真实 `引力环球.library`，qa.22 生命周期日志到达 ready。
- [x] 真实 `MAX照片集`（511）与 `线上展示照片`（91）只读往返 4 次，均非空且响应；
  18 次 `VISIBLE_VERIFY_OK`、0 fail，8 秒空闲日志零增长，智能无自动编号/自动改名。
- [x] qa.21 候选继续作为回滚来源，未新建重复备份；未拖动、改序、改名，未写 NAS
  素材、`.library` 或 `app.asar`。最终自然业务操作由用户在当前真实 Library 验收。
- 证据：`qa-evidence/QA-SMART-FOLDER-STABILITY-QA22-2026-07-29.md`。

## 2026-07-29 排序稳定基线冻结

- [x] 按用户确认，将当前 `2.5.22-qa.26 / API103` 冻结为排序稳定基线。
- [x] 新增基线文档
  `extensions/media-organizer/docs/STABLE-SORTING-BASELINE-2026-07-29-QA26.md`，登记
  版本/API、关键 SHA-256、冻结行为、代码结构地图、结构风险和未来候选门禁。
- [x] 总管亲自复查自动门禁：`npm test`、`node --check plugin.js`、完整注入载荷编译
  和注入诊断合同均通过。
- [x] 本轮未修改业务代码、未安装、未重启 Eagle、未操作真实 Library/NAS；只更新治理
  文档和基线记录。
- [ ] R50 用户最终视觉验收仍保留：智能文件夹拖动时完整蓝色竖线、无空洞/跳位、松开
  顺序正确且刷新保持。
- 模型预算：T2；原因是单一排序模块多文件结构审计和文档冻结，无真实现场动作。

## 2026-08-01 媒体智能整理 GitHub 稳定发行审计

- [x] qa.26/API103 排序行为保持冻结；完成通信桥、官方 API、团队 sidecar 与跨电脑
  安装边界审计。
- [x] 生成干净插件包、默认只读检查器和 SHA-256；包内没有团队状态、Library/NAS
  路径、缓存、备份、恢复资料、测试库、`app.asar` 或桥载荷。
- [x] 包内逐文件与源码一致、重复构建哈希稳定；本轮未安装、未重启 Eagle、未操作
  正式 Library/NAS，也未修改排序业务行为。
- [ ] GitHub-only 新电脑 1:1 原生排序仍被宿主桥阻断；禁止以 sidecar 或普通插件 API
  冒充完整能力。证据：`qa-evidence/QA-GITHUB-STABLE-RELEASE-QA26-2026-08-01.md`。

## 2026-08-01 团队电脑完整安装解除阻断

- [x] 用户明确授权对精确匹配 Eagle 4.0.0 build 23 官方原版执行受控通信桥安装。
- [x] 新增本机 ASAR 最小生成器、宿主安装/回滚脚本、原版/目标双指纹、未知宿主拒绝和
  完整套件失败自动回滚；仓库不包含 Eagle 完整 `app.asar`。
- [x] 临时假 Eagle 完成 `原版 -> 桥接 -> 原版` 回滚闭环，完整套件完成桥接加两插件安装；
  两个目标通信文件 SHA-256 与既有审计值一致。
- [x] 发布公开 `v2026.08.01-baseline.2`，GitHub Release gates 通过；排序插件仍为
  `2.5.22-qa.27`，排序行为仍冻结于 qa.26/API103，MAX Publisher 仍为 `1.2.7`。
- [x] 团队成员已从 `main` 完成 baseline.2 安装：宿主桥 SHA-256 为
  `dbd90e0bf80ff13a01694f8bc84f43cffc93eecca8038894f901e5280ba2650d`，两个插件版本
  与发行清单一致且各只有一个 Eagle Plugins 来源；宿主与插件回滚目录均已创建。
- [ ] 团队成员正常启动真实 Eagle 后验证两个插件入口、普通/智能排序、NAS sidecar 顺序
  恢复和 Eagle 原生选择/预览/拖出；安装器不自动打开或操作真实 Library。
# 2026-08-01 媒体智能整理：GPS与元数据标签 qa.27 首次运行安全

- [x] T2 最小修复：干净插件状态默认不枚举 Library、不自动写标签；首次明确开启仅建立
  既有项目基线，后续新增项目才进入自动处理。
- [x] 视频缺失 `ffprobe` 时形成可审阅异常原因；图片 `exifr` 行为与离线地理解析不变。
- [x] 发行白名单构建器显式拒绝 GPS/标签运行态；排序 qa.26/API103 业务未修改。
- [x] 未安装干净包：`extensions/media-organizer/releases/媒体智能整理-v2.5.22-qa.27-github.eagleplugin`
  （44 文件，SHA-256 `3f529c4e288d843fa7f9b752f4a15f8f29fd0bf5714c55ec235735129ef25bd6`）。
- [ ] 待批准：干净 Eagle 测试 Library 的首次开启、视频缺少 ffprobe 的界面提示与回滚
  演练。本批未安装、未重启、未操作 Eagle、真实 Library 或 NAS。
# 2026-08-07：媒体智能整理 R52 qa.29/API106 Phase 1

- [x] 完成“全部”首帧上下文竞态的 collection ownership 修复与永久回归；普通/智能冻结行为未改变。
- [x] 完成完整 npm、注入编译、JS 语法、治理合同、发行包污染/唯一来源预检；未安装、未重启 Eagle、未操作真实 Library/NAS/app.asar。
- [ ] T3 安装阶段等待总管继续派发并取得批准；回滚点为 qa.28/API105 唯一安装目录备份。
- [x] T3 已完成：qa.29/API106 唯一来源安装并正常重启；最终普通→全部首帧由用户在真实 Eagle Library 验收。

# 2026-08-07：媒体智能整理 R53 qa.30/API107 Phase 1

- [x] 智能集合临时全库误排序的根因已收敛到 source ownership/readiness/overlay 算法；新增 R53 永久回归，关联 R38-R48、R52。
- [x] R53 候选仅修改排序模块快照/readiness、排序入口门禁和 order coordinator 性能路径；普通、global、改名与 GPS 业务冻结不变。
- [ ] 待 T3 总管执行：候选包通过完整开发门禁后才可按唯一来源流程安装；真实 Eagle 首帧视觉仍由用户最终验收。

# 2026-08-07：媒体智能整理 R53 qa.30/API107 T3 失败回滚

- [x] qa.30 唯一来源安装、运行时加载和 538 项智能 smoke 已执行；无 24,319 项 PRESENT、无 >10 秒无响应。
- [ ] qa.30 真实门禁失败：smart-query members 未进入 snapshot，生命周期持续 LOADING/count=0，且 LOADING 中执行 538 项 EXIF 读取。
- [x] 已正常退出并恢复 qa.29/API106 唯一来源，Eagle 正常启动；qa.30 不进入用户最终验收。
- 证据：`qa-evidence/QA-R53-QA30-T3-INSTALL-ROLLBACK-2026-08-07.md`。

# 2026-08-07：媒体智能整理 R53 qa.31/API108 Phase 2

- [x] qa.30 真实失败已写入永久回归：已完成的 538 项 smart `filtereds` 可与 `allData` 同引用；只读 `allData/raw` 仍不构成 smart source。
- [x] smart LOADING 现在不导出成员给 monitor，并在缓存注入、扫描和 metadata 需求判定处共享 READY 硬门禁；普通与 global R52 冻结不变。
- [ ] qa.31/API108 是未安装源码候选；当前唯一活动安装仍 qa.29/API106，等待独立 T3 安装/回滚流程。

# 2026-08-07：媒体智能整理 R53 qa.31/API108 T3 真实失败并回滚

- [x] 正常退出 Eagle、受控安装 qa.31/API108、核对包 SHA/manifest/API/唯一来源及
  `app.asar` 未变；安装器目录时间戳原样记录为 `20260808-163445`。
- [ ] 真实 smart smoke 未通过：Eagle UI 已显示 571 项 smart 成员，但诊断持续
  `HOST-PENDING count=0`，没有 READY/PRESENT；因此不能证明真实约 538 项只 present 一次。
- [x] 未见临时全库约 24k PRESENT 或 background process >10 秒无响应；失败后未继续第二场景，
  避免把失败候选留在生产现场。
- [x] 正常退出并用受控安装器恢复 qa.29/API106；当前同 ID 来源数 1，Eagle 已正常启动。
  qa.31 失败载荷回滚点目录时间戳原样记录为 `20260808-163943`，既有 qa.29 回滚点保留。
- 证据：`qa-evidence/QA-R53-QA31-T3-INSTALL-ROLLBACK-2026-08-07.md`。

# 2026-08-08：媒体智能整理 R53 qa.32/API109 Phase 3

- [x] 先红后绿补齐 live-like 571 项 current-view source 与 24,319 provisional allData/raw 反例；修复 smart host adapter/observation 接线，保留 LOADING 零 metadata 门禁。
- [x] `npm test`、注入编译、1773 JS、119 zsh、`git diff --check` 通过；普通/global/qa.26 冻结行为未改变。
- [x] 构建白名单候选 `2.5.22-qa.32 / API109`，包 SHA-256=`91bf9b0954e13680a80931d45ae8130568c5885316ca96697cd388eca0ffa2dc`。
- [ ] 未安装/未重启/未接触真实 Library/NAS；等待 T3 唯一来源安装与真实 571 项 smart smoke。

# 2026-08-08：媒体智能整理 R53 qa.32/API109 T3 失败回滚

- [x] qa.32 受控安装、运行时启动、manifest/API/包字节/唯一来源/app.asar 门禁通过。
- [ ] Eagle 启动后 NAS Library 长时间停留“即将完成 …”，未进入真实 smart folder；A/B READY、一次 PRESENT、
  首帧和 >10 秒性能门禁均不能宣称通过。
- [x] 已正常退出并恢复 qa.29/API106；证据：`qa-evidence/QA-R53-QA32-T3-INSTALL-ROLLBACK-2026-08-08.md`。

# 2026-08-08：R53 P0 qa.32 启动加载阻断只读调查

- [x] qa.32/qa.29 诊断与启动接线、Eagle Session 日志、SMB/.library 根目录 stat 已对比。
- [x] qa.29 回滚后同一 NAS Library 约 30 秒恢复完整树和网格；qa.32 无 injection/smart/EXIF/present 事件。
- [x] 结论 B/C，未发现可归因于 qa.32 业务代码的 Library loaded 前阻断证据。
- [ ] 等待 Eagle 原生阶段日志或隔离 QA Library 复现；不生成 qa.33。

# 2026-08-08：媒体智能整理 R54 qa.33/API110 启动隔离 Phase 1

- [x] R54 把插件 bootstrap 与排序服务分离：未收到当前 Library identity/主窗口可操作证据前，业务 runtime
  不注入、不读 cache/团队状态、不建 observer、不读 metadata/EXIF、不刷新/排序/改名。
- [x] 新 gate 支持 library generation、切库取消、停止和注入失败 fail-open；不使用固定 ready 延时或失败重试风暴。
- [x] 源码、自动回归、语法、发行白名单和只读安装器预检完成；候选包 SHA=`8461133cf2a6522d85d48e7db57f7de5b1dcdc7bb7acab6fcd9e416c210e6e2f`。
- [ ] 仅源码阶段：qa.33 未安装、未重启、未操作 Eagle/Library/NAS；待 T3 验证真实启动，不将自动测试
  表述为真实 Eagle 通过。证据：`qa-evidence/QA-R54-QA33-PHASE1-2026-08-08.md`。

# 2026-08-08：媒体智能整理 R54 qa.33 T3 正常退出阻断

- [x] 安装前身份、包 SHA、qa.29/API106 唯一来源、`app.asar` 和当前 Library 可操作状态通过。
- [ ] Eagle 正常退出提示后台任务尚未完成；禁止强杀门禁触发，未安装 qa.33，未执行 R54/R53 真实场景。
- [x] 现场保持 qa.29/API106 且 Eagle 正常运行。证据：
  `qa-evidence/QA-R54-QA33-T3-NORMAL-QUIT-BLOCKED-2026-08-08.md`。

# 2026-08-08：媒体智能整理 R54 T3 等待期间用户活动

- [x] 只读观察到 Eagle 视频预览进度约 `0:51 / 6:09`，触发并发用户活动停止门禁。
- [ ] 未继续退出或安装；qa.33、R54 启动和 R53 A/B 均保持未执行。
- [x] qa.29/API106 唯一来源和 Eagle 运行现场保持。证据：
  `qa-evidence/QA-R54-QA33-T3-WAIT-USER-ACTIVITY-2026-08-08.md`。

# 2026-08-08：媒体智能整理 R54 T3 恢复仍被视频预览阻断

- [ ] 只读检查仍见视频预览 `0:51 / 6:09`；未关闭用户内容，未退出、未安装 qa.33。
- [x] 现场保持 qa.29/API106；证据：
  `qa-evidence/QA-R54-QA33-T3-RESUME-PREVIEW-BLOCKED-2026-08-08.md`。

# 2026-08-08：媒体智能整理 R54 qa.33/API110 T3 注入失败并安全回滚

- [x] qa.33 已受控安装并通过包 SHA、manifest/API、安装载荷、同 ID 单来源与 `app.asar` 未变核验。
- [ ] R54 真实门禁失败：收到 `引力环球视频.library` identity 后仅一次 `INJECT_START`，但
  `main-library-readiness-not-confirmed` 被作为终态 `INJECT_FAIL`；Eagle 随后显示可操作完整 Library。
- [x] 未进入 R53 智能 A/B，未在 Library/NAS 上执行写操作；候选已正常退出并由受控 qa.29 安装器恢复。
- [x] 当前规范安装为 qa.29/API106、同 ID 来源 1，Eagle 正常启动且 Library 已加载；qa.33 失败载荷保留。
  证据：`qa-evidence/QA-R54-QA33-T3-INSTALL-ROLLBACK-2026-08-08.md`。

# 2026-08-08：R54.1 qa.34/API111 启动 readiness race Phase 1

- [x] 先红后绿：新增回归复现 qa.33 的 identity 已到达但 `mainLibraryReadiness()` 瞬态 false 时旧 gate
  立即注入/终态失败；绿灯要求进入 `BOOTSTRAP_MAIN_WAIT`，verified ready 后恰好一次注入。
- [x] 最小修复限于 startup gate、host-readiness waiter、plugin 接线与测试；waiter 只重观察 host readiness，
  有界、可取消、无 cache/team/metadata/EXIF/DOM/业务 poll；timeout 仅一次 `BOOTSTRAP_TIMEOUT` fail-open。
- [x] R53 smart 成员真源、LOADING 零 metadata、R52 global fail-open、普通/智能冻结行为未修改；qa.33
  真实失败证据永久保留。
- [x] `npm test`、注入编译、源码契约、治理合同、语法、`git diff --check` 和发行白名单门禁通过。
- [ ] qa.34/API111 仅为未安装源码候选；本阶段未操作 Eagle/UI、Library/NAS、`.library` 或 app.asar，待 T3
  按 qa.29 唯一来源回滚流程验证真实启动，再决定是否进入 R53 A/B。

# 2026-08-08：媒体智能整理 R54.2 qa.35 与 R55 qa.36 Phase 1

- [x] qa.34 真实 readiness false-negative 已安全回滚并形成永久证据；qa.35/API112 作为 R54.2 独立候选完成，不复用版本语义。
- [x] R55 建立 SMART FIRST VISIBLE FRAME、VERIFIED_COMPLETE+metadata+final-order READY proof、唯一 OrderCoordinator 与 HostOrderPresentationPort 双向事务。
- [x] A 模块 durable state 覆盖 cache/diagnostic/rename/team backup；`geo-tag-state.json` 保留为 C 独立债务。
- [x] qa.36/API113 白名单包和安装器完成，SHA 分别为 `6d8b186e738c987c594fbbe1d8d922578bb0773b5708be7443b253c639ffb2dd`、`07d5981fb02c5326482ee0821002fb9bc324800e6f2bd65e63c160f610f76b3b`。
- [ ] 本阶段未安装、未操作 Eagle/Library/NAS；当前唯一现场仍 qa.29/API106，真实验收进入下一 T3。

# 2026-08-08：媒体智能整理 R56 qa.37/API114 Phase 1

- [x] qa.36 真实 T3 首帧 loading 通过但 538 项永远不 READY，已安全回滚唯一 qa.29/API106。
- [x] 根因收敛为 filtered/current-view 共用单一 sourceReference；新增真实分离对象、分批成员和插件调用集成红灯。
- [x] 拆分 `filteredReference/currentViewReference`，partial 禁止 allData fallback，最终完整 538 才 READY；alias 兼容。
- [x] 完整 R01-R56、注入编译、88 JS/3 sh-zsh 语法、治理合同、diff、白名单污染与重复构建门禁通过。
- [x] qa.37/API114 包 SHA=`88f8e7c596c619e43fac3703d7b08f14cda21749918f968e77c82412108cf1c9`；安装器 SHA=`f0b543b4b5f02dd17b4aeb4e7644a5499db778b52ee51ad7cdfededeb85823f9`。
- [ ] qa.37 未安装；本阶段未操作 Eagle/NAS/Library/`.library`/app.asar，等待下一 T3 真实 538 READY 验证。
- 证据：`qa-evidence/QA-R56-QA37-PHASE1-2026-08-08.md`。

## 2026-08-09：R87-R88 智能虚拟网格排序验收

- [x] qa.71/API148 已完成完整自动门禁、确定性双构建和唯一来源安装；插件 ID `com.max.eagle-photo-taken-sort`，版本 `2.5.22-qa.71`，宿主 SHA 未变。
- [x] 真实 Eagle 的“高颜值”智能文件夹（571 项）完成权威结果、投影、渲染成员三重证明并进入 `PRESENT-READY`；观察 20 秒无二次跳变。
- [x] 本轮未操作真实拖动、改名、导入、删除、NAS 素材或 `.library`；旧插件回滚点由安装器保留。
- [ ] 用户真实视觉与交互验收待进行；Eagle 保持打开。
