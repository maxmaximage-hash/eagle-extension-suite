# iCloud → NAS → Eagle 安全工作流评估

- 调查日期：2026-07-18
- 当前阶段：只读调查与方案设计；未下载、移动、删除或批量导入素材
- 适用基线：本机 Eagle 4.0.0 / build 23；NAS 通过 SMB 挂载

## 一句话结论

可以做到。推荐把 NAS 上的一座 Eagle `.library` 作为工作素材的唯一正式落地副本，iCloud Photos 暂时保留为来源与安全缓冲；素材按 500–1000 个一批直接导出到 NAS 的临时接收区，经哈希、数量、格式和抽样预览校验后再由 Eagle 纳入 NAS 资料库。确认整批已进入资料库后才清理临时接收区，且在完成独立备份前绝不从 iCloud 删除。

这能把长期占用控制为“iCloud 一份 + NAS Eagle 正式库一份”，避免再长期保留一套普通 NAS 原片目录。迁移过程中单批会短暂出现“NAS 接收区 + Eagle 库”两份，这是为了可恢复；接收区应按批清理，而不是一次堆积十万张。

可靠搬运台的补充方案见 `docs/iCloud-Photos可靠搬运台方案.md`。该方案把“继续上次”列为硬要求：不仅恢复下载队列，还要恢复用户上次挑选素材的相簿/月、锚点素材、拍摄日期、文件名、缩略图和前后范围。下载台账与浏览锚点必须分开记录。

## 1. 本机只读调查

### 素材来源判断

- 存在 `/Users/max/Pictures/Photos Library.photoslibrary`，Photos/iCloud 相关后台进程正在运行。
- iCloud Drive 根目录 `/Users/max/Library/Mobile Documents/com~apple~CloudDocs` 存在，但两层只读检查没有看到素材目录。
- Photos 偏好显示本机使用系统照片图库并曾启用 iCloud Photos。
- macOS 隐私权限阻止终端读取 Photos 图库内部数据库，因此没有绕过权限，也没有取得准确项目数、总容量或原片落地比例。

结论：素材高度可能位于 **iCloud Photos**，不是 iCloud Drive；正式试点前只需用户在“照片”应用中确认一次：设置 → iCloud 是否开启，以及当前选择“优化 Mac 储存空间”还是“下载原片到此 Mac”。

### NAS 与网络现状

- 当前存在 SMB 挂载：`/Volumes/共享文件` 与 `/Volumes/团队文件-引力环球`。
- Mac–NAS 项目记录当前有线协商速率为 `1000 Mbps`。
- 真实 SMB 大文件读写、持续吞吐、断线/睡眠恢复仍待验证。
- NAS 文件系统类型、快照能力、校验能力、剩余空间和备份目的地尚未记录。

因此不能直接开始十万级导入。先验证固定挂载路径、权限、持续在线和备份，再建正式 Eagle 库。

## 2. Eagle 官方能力与限制

截至调查日，Eagle 官方资料可确认：

- Eagle 资料库是本地文件体系，可以放在 NAS/LAN；官方也提供 NAS 初始化慢、Mac 打开 NAS 库较慢、睡眠后 SMB 路径丢失和缩略图加速等专门说明。
- Eagle 3.0 起明确优化了 NAS/LAN 导入与稳定性，以及“10 万+文件”资料库的列表、搜索和筛选性能。该历史说明证明十万级是产品考虑过的规模，但不是对任意 NAS、任意文件大小和任意网络条件的性能保证。
- Eagle 采用集中式资料库，普通导入会把文件纳入资料库；官方明确不支持像文件管理器那样直接引用本地外部文件，也不支持链接外部目录。
- 官方存在“Import Existing Files（导入现有文件）不会重复占用空间”的能力，但必须在 500–1000 个试点中验证它在当前 Eagle 4.0、macOS、SMB/NAS 上究竟采用移动、同卷复用还是其他处理方式；在验证前不得把它当成 NAS 硬链接承诺。
- Eagle 有重复文件提示和相似/重复扫描，但迁移工具仍需用内容哈希建立跨批次台账；文件名不能作为唯一去重依据。
- 官方已有百万级内部文件导致 OOM、首次索引慢和 NAS 初始化卡住的故障文档。十万张原片会产生缩略图、元数据等更多内部文件，因此库应按用途/年份合理分库，并通过试点测量，不能只看“照片张数”。
- Eagle 的自动导入监控不适合作为 NAS/云盘路径上的可靠迁移引擎；十万级迁移需要独立搬运台账和显式批次提交。

官方资料：

- [Eagle：导入采用复制而非外部索引](https://en.eagle.cool/support/article/does-eagle-import-files-by-copying-or-indexing)
- [Eagle：不支持直接引用本地文件](https://en.eagle.cool/support/article/why-doesnt-eagle-support-direct-local-file-referencing-like-billfish)
- [Eagle：不支持链接外部目录](https://en.eagle.cool/support/article/why-cant-eagle-link-to-external-folders)
- [Eagle：导入现有文件不会重复占用磁盘空间](https://en.eagle.cool/support/article/does-import-using-existing-files-occupy-additional-hard-disk-space-when-adding-duplicate-images)
- [Eagle 3.0：NAS 与 10 万+文件性能改进](https://en.eagle.cool/blog/post/eagle-3.0)
- [Eagle：NAS/LAN 资料库初始化慢](https://en.eagle.cool/support/article/why-is-my-resource-library-on-nas-lan-so-slow-to-initialize-and-how-can-i-solve-it)
- [Eagle：Mac 打开 NAS 库较慢](https://en.eagle.cool/support/article/why-is-opening-an-eagle-library-on-nas-slower-on-mac-compared-to-windows)
- [Eagle：SMB 睡眠唤醒后路径不存在](https://en.eagle.cool/support/article/why-does-my-resource-library-in-smb-shared-folder-show-path-not-found-after-waking-from-sleep-or-hibernation)
- [Eagle：百万级内部文件与 OOM](https://en.eagle.cool/support/article/why-does-eagle-freeze-or-crash-during-library-loading-when-you-have-over-1-million-files-oom-error)

Apple 官方资料可确认：iCloud Photos 是同步系统，任一启用同步的设备删除会同步删除；“优化 Mac 储存空间”只保留较小版本，需要时才下载原片；Photos 可把“未修改的原片”导出到 Finder 或外部存储。iCloud.com 每次最多选 1000 项，不适合作为十万级无人值守搬运主流程。

- [Apple：下载 iCloud 照片和视频](https://support.apple.com/en-ie/111762)
- [Apple：从 Photos 导出未修改原片](https://support.apple.com/en-mide/guide/photos/pht6e157c5f/mac)
- [Apple：iCloud Photos 的同步与删除行为](https://support.apple.com/en-la/108782)

## 3. 两种可行架构

### 架构 A（推荐）：NAS 上的 Eagle 资料库就是正式素材库

建议目录（最终共享名由用户确认）：

```text
/Volumes/共享文件/Eagle素材系统/
├── Libraries/
│   ├── 工作素材-2020-2023.library
│   └── 工作素材-2024-至今.library
├── Intake/                    # 临时接收区，按批次清理
│   └── 2026-07-试点-0001/
├── Manifests/                 # 只存清单、哈希、日志，不存凭据
└── Quarantine/                # 损坏、冲突、格式异常
```

工作流：Photos 导出未修改原片 → NAS `Intake/批次` → 生成只读清单与 SHA-256 → Eagle 导入 NAS 上对应 `.library` → 对照 Eagle 数量、格式、Live Photo 配对、哈希/大小与抽样预览 → NAS 快照/备份成功 → 清理该批 Intake。

关键设计：

- **下载路径**：直接选 NAS 的批次接收区，不先下载到 Mac 长期目录。若 Photos 导出到 SMB 在试点中不稳定，才用本机小型临时区做单批中转，并设严格容量上限。
- **Library 位置**：NAS `Libraries/`，与 Intake 位于同一 NAS 卷；不把 `.library` 放进 iCloud Drive、Dropbox 等按需云盘。
- **是否复制**：普通导入会产生一份 Eagle 库内文件；Intake 仅是临时安全缓冲，验证后清理。可在试点单独测试“导入现有文件”，但不得在未知语义下用于正式批量。
- **去重**：每个源项目记录来源标识、原始文件名、字节数、拍摄时间、内容 SHA-256、批次和 Eagle 项目 ID。完全相同哈希只入库一次；Live Photo 的图片与视频视为一组，不能误删其一。视觉相似图只报告，不自动删除。
- **断点续传**：按 500–1000 项批次；状态为 `待导出/已落盘/哈希完成/已入 Eagle/已核验/已备份/可清理`。重启只从未完成状态继续。
- **失败恢复**：导出使用临时扩展名或临时目录，完成后才提交；失败文件进入 Quarantine；不回滚已核验批次，不直接改 `.library`。Eagle 导入失败则保留 Intake 重试。
- **增量同步**：每周或每月从 Photos 选择“上次成功截止时间之后”的新增项目；搬运台账再按哈希兜底。iCloud 删除不传播到 NAS，NAS 也不反向删除 iCloud。
- **缩略图/性能**：先建单独试点库；记录首次索引、冷启动、滚动、搜索、视频预览和 1000 项导入时间。正式库建议按时间或业务域分成 2–5 座，避免单库内部文件逼近百万级。Mac 睡眠前退出 Eagle，唤醒后先确认 SMB 挂载再开库。
- **备份**：NAS RAID/存储池不是备份。至少需要 NAS 快照 + 另一块盘/另一台 NAS 的版本化备份；备份对象是整个 `.library` 和 `Manifests`。备份/快照一致性最好在 Eagle 退出时完成。
- **权限与并发**：专用 Eagle 共享目录；日常账户读写，备份账户只读源/写备份；凭据只进 macOS 钥匙串。Eagle 官方支持多台电脑经 LAN/NAS 同时访问并编辑同一资料库，但所有电脑必须使用相同 Eagle 版本，并应避免同时编辑同一个素材。大批量导入、重命名、移动、删除和全库插件任务仍采用“单一写入电脑”规则，另一台退出该库或只读等待；正式使用前完成两台电脑并发试点与 NAS 快照恢复。

优点：长期只有一份 NAS 正式原片；Eagle 分类、搜索、缩略图和原片处于同一管理单元；NAS 快照可覆盖元数据与文件一致性。

缺点：Eagle 日常体验依赖 NAS 和 SMB 长期在线；Mac 上冷启动、索引和缩略图可能慢；`.library` 是 Eagle 管理结构，不适合 Finder 人工整理。

### 架构 B：NAS 普通原片档案 + 本机 Eagle 精选工作库

目录：NAS 保存按年/月整理的原片档案；Mac SSD 上的 Eagle 库只导入近期、精选或代理文件。独立目录清单工具索引 NAS 全量，但 Eagle 不负责全量原片。

优点：Eagle 快、离线也能用；NAS 断线不会影响近期工作；NAS 原片保持普通文件目录，其他软件易用。

缺点：Eagle 官方不支持外部目录引用，所以不能同时满足“十万张全量只存 NAS 一份”和“Eagle 全量原片管理”。若把全部原片再导入 Eagle，就重新产生双份；若只导入代理，Eagle 看到的不是全分辨率正式原片。

适用：用户愿意让 Eagle 只管理活跃/精选集合，全量检索由独立素材目录工具承担。

### 不推荐：Photos 图库直接放 NAS 或让 Eagle 读取 Photos 内部文件

- 不直接操作 `.photoslibrary` 内部目录，也不从其中抓取 originals。
- 不把系统 Photos 图库直接放 SMB NAS 作为本方案基础。
- 不建立 iCloud ↔ NAS 的双向镜像删除规则。
- 不把 Eagle `.library` 放进 iCloud Drive 的按需下载目录。

## 4. 现成能力与需要开发的能力

### 现成可用

- Apple Photos：按选择导出未修改原片到外部存储；显示 iCloud 同步状态。
- Eagle 4.0：NAS 资料库、普通导入/导入现有文件、重复提示、分类、标签、搜索、缩略图、EaglePack/导出与库切换。
- 当前扩展：媒体整理可按拍摄时间排序、读取图片/视频时间与 GPS、按文件夹预览后写标签；但它不是 iCloud 搬运器，也不应承担库外文件迁移。
- Mac–NAS 项目：SMB 自动挂载与监控已有基础，但性能基准、长期历史和断线恢复验收尚未完成。

### 需要开发独立搬运工具（优先于 Eagle 扩展）

- 批次清单、SHA-256、去重、Live Photo 配对、失败隔离、断点状态机、重试、空间预检和核验报告。
- Apple Photos 的可靠批次选择/导出自动化需要另行验证可用接口和权限；不能靠解析 Photos 内部数据库实现。
- “只从 iCloud/Photos 向 NAS 增量追加、不传播删除”的单向规则。
- 导入 Eagle 后通过公开 API 记录项目 ID、批次标签和校验结果；若 API 不足，则保留人工导入与外部台账，绝不直接改 `.library`。
- NAS 挂载前置检查：固定卷名、可写性、剩余空间、延迟、连续失败熔断。
- 用户选择位置锚点：最后相簿/批次、素材标识、拍摄日期、文件名、缩略图、选择时间和前后范围。下载成功不能自动推进选择锚点。

### iCloud Photos 入口补充

推荐用户入口是“用户在 iCloud Photos 建立待下载相簿/批次，本地搬运台按相簿拉取”。网页手工下载按钮不承担可靠续传。优先试点 `icloudpd` 按相簿下载，外层搬运台负责台账、NAS 熔断、Live Photo 成组、去重、同名冲突和 Eagle 交接；备选是 `osxphotos` 基于本机 Photos 图库导出。

iCloud 网页目前不能承诺稳定单张深链接或滚动位置恢复。“继续上次”的正式承诺应是：优先打开对应 iCloud 相簿/批次，并显示上次停在的月份、拍摄日期、文件名、缩略图和前后素材范围；若浏览器扩展试点证明可稳定定位，再升级到高亮单张素材。

### 可能开发 Eagle 扩展

- 在 Eagle 内显示迁移批次、校验状态、缺失/冲突报告和“本批已备份”标记。
- 复用媒体整理的拍摄时间/GPS能力做导入后的辅助分类。

核心下载、哈希、重试和恢复应是宿主无关的独立工具；Eagle 差异只放 `adapters/`，符合本项目边界。

## 5. 分阶段实施

### 阶段 0：确认与基线（仍不迁移）

1. 用户在 Photos 设置确认 iCloud Photos 与储存选项，并在“所有照片”底部确认同步已完成。
2. 记录大致项目数、Photos 显示容量、iCloud 容量和 NAS 可用容量。
3. 确认 NAS 文件系统、快照、磁盘冗余、备份目的地和 UPS/长期在线策略。
4. 完成 Mac–NAS 项目中的真实 SMB 大文件读写、持续吞吐与睡眠恢复测试；固定挂载点。
5. 容量门槛：正式估算至少预留原片总量的 1.3 倍给 Eagle 库与缩略图，再额外预留一个最大批次和 NAS 运维余量；最终比例以试点实测修正。

### 阶段 1：500–1000 项小样本

选择包含 HEIC/JPEG/RAW/视频/Live Photo/编辑过照片/重复项的代表性样本。建立全新试点 `.library`，比较普通导入和少量“导入现有文件”的真实磁盘变化与失败行为。期间不删 iCloud，不清空 Photos“最近删除”。

验收至少包括：数量与文件配对、总字节、100% 哈希清单、20–50 个随机原片打开、视频播放、拍摄时间/GPS、Eagle 冷启动/搜索/滚动、SMB 断开恢复、NAS 快照和完整库恢复演练。

### 阶段 2：校验与定型

根据试点决定单库还是按年份/业务分库、每批大小、是否允许“导入现有文件”、缩略图策略和备份窗口。形成不可变的目录、批次命名、台账字段和失败处理规则。

### 阶段 3：批量迁移

每次只推进一个批次：导出 → 哈希 → Eagle 导入 → 校验 → 快照/备份 → 清理 Intake。设置每日传输和失败上限；NAS 掉线、空间不足、哈希不一致或 Eagle 异常时自动停止，不继续堆积。

### 阶段 4：增量维护

按周/月导入新增项目；每季度抽样复核哈希和恢复；每年检查 Eagle 版本、NAS SMART/文件系统、快照和异地备份。Eagle 升级后先在试点库验收，媒体整理桥接也必须继续遵守 build 23 指纹与回退规则。

## 6. 用户必须确认的关键决策

1. Photos 设置里现在是“优化 Mac 储存空间”还是“下载原片到此 Mac”？
2. Eagle 是否必须管理全部十万张原片，还是只管理近期/精选？前者选架构 A，后者可选 B。
3. 是否接受 Eagle 正式库是 NAS 上唯一普通工作副本，Finder 不再另留一套同内容原片目录？
4. NAS 的型号、文件系统/存储池、快照、可用空间、UPS 和第二备份目的地是什么？
5. 是否需要两台电脑同时使用；Eagle 官方支持同时访问和编辑，但是否接受“大批量任务期间只允许一台电脑写入、不得同时编辑同一素材”的安全规则？
6. 正式库如何分库：按年份、客户/项目还是媒体类型？建议先按年份或冷热层级，控制单库规模。
7. 在 NAS 已有第二份可靠备份并完成恢复演练之前，是否同意绝不删除 iCloud 内容？建议同意。

## 7. 安全红线

- 不批量修改 Eagle `.library` 内部文件。
- 不从 Photos 图库包内部搬文件。
- 不把“同步成功”当作“备份成功”。
- 不按文件名去重，不自动删除视觉相似图。
- 不在 NAS 未挂载、只读、空间不足或延迟异常时启动导入。
- 不在 Eagle 正在写库时复制一个不一致的 `.library` 当备份。
- 不在完成两套独立校验副本和恢复演练前删除 iCloud 原片。
