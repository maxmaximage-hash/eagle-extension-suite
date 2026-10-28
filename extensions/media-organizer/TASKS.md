# 任务

## 正在进行

- [ ] `2.5.22-qa.14 / API91` 相对手动覆盖重构：L3 先按拍摄时间/多级规则生成基础
  顺序，L4 只保存 `before/after` 关系；旧 v2 完整数组迁移为 `legacyFullOrder`，
  恢复自动排序立即清除活动关系；升降序方向进入 `TAKEN_AT` 规则。源码门禁已通过，
  等待唯一安装目录真实 Eagle 现场验收。
- [ ] R40 真实验收目标固定为 `引力环球.library / 改造对比案例`
  （folder ID `M837TMZXE0VTX`）：自动拍摄时间模式必须逐项有序，缺失时间稳定在末尾；
  手动拖动后 authority 为 manual；恢复自动排序后重新有序；排序锁定时网格内拖动被
  拒绝但 Finder/聊天框等 Eagle 原生拖出不受影响。真实改名前必须另行预览确认。
- [ ] R41 现场目标：拍摄时间升序与降序必须实际改变基础方向；相同手动相对关系在
  两个方向下继续生效；恢复自动排序后立即显示当前方向，不执行改名。

- R34 A 无插件物理鼠标基线已通过：`1-传奇地貌1.jpg` 可拖到 Finder，目标文件出现且
  SHA-256 与 QA 基线一致。当前 `2.5.22-qa.1 / API 78` 只加载在独立
  `Eagle QA Sort 2026-07-23.library`，等待用户执行 R34 B 候选物理拖动；生产
  Library 未被候选操作。Computer Use 跨应用拖动因 ScreenCaptureKit 参数错误不可判定，
  不作为候选失败结论。

- A 线长期维护职责只覆盖排序与重命名台账、自动测试门禁、版本/回滚和真实 Eagle
  验收协调。当前 `2.5.21 / API 77` 冻结；未经项目总管派发和用户批准，不修改排序
  源码、不安装或重启 Eagle、不操作真实 Library/NAS。

- 按 `docs/PERMANENT-REGRESSION-CONTRACT.md` 验证 2.5 原生排序工作流。自动门禁覆盖
  R01-R31，但仅作开发预检；唯一验收是用户在真实 Eagle 界面看到的连续 20 次拖动、
  逐张连续编号、刷新、切换和完整重启结果，全部通过前不得通知用户验收。
- API 75 正在删除后台成员变化触发编号的整条链路。文件夹切换、分页、刷新、启动和
  列表补全不得创建改名任务；只允许明确有效拖动或用户明确确认执行。安装后先恢复并
  审计被中断的 `9-棕榈岛游艇`，再做跨文件夹零请求和真实拖动验收。
- 当前补充中断恢复：`restore-interrupted-batch` 只按精确 item ID 恢复仍处于
  `__eagle_number` 临时名阶段的项目；通过 Eagle 原生改名管线分批执行，不直接写
  `.library`。恢复完成前不得继续拖动或编号验收。

## 下一步

- 等待用户批准 `recovery/MGX48XAZ2TCAW-20260723.json` 中限定的 53 项原生管线恢复；
  当前请求保持 `approved: false`，不得安装或触发恢复。恢复后必须在真实 Eagle 界面
  确认 88 张缩略图、右侧预览、快速拖动和刷新全部正常。
- 为真实 `9-棕榈岛游艇` 生成并执行一次 `restore-interrupted-batch` 请求；完成后
  只读审计必须显示 169 项无 `__eagle_number`、metadata 与真实文件一致，再进入真实
  界面检查缩略图、右侧预览、刷新和跨文件夹零改名请求。
- 用户在真实资料上明确选择低风险目录后，继续验收文件夹编号预览/确认、排序锁定
  拦截和其它高层开关递归下发；验收前不自动执行这些写操作。

## 等待确认

- 新目录真实验收完成后，决定旧 `/Users/max/引力环球/eagle 插件功能` 的归档方式。

## 已完成

- 2026-07-23：完成真实 `9-棕榈岛游艇` 中断临时名恢复。新增
  `restore-interrupted-batch` 恢复模式和生成脚本，安装版 API 75 已替换并重启 Eagle；
  请求 `restore-interrupted-MGX48XB1N6Q8S-mrwont6w-24xtpzs` 通过 Eagle 原生改名管线
  分批恢复 147 项，18 项因未进入临时名阶段跳过。定向只读审计
  `/tmp/MGX48XB1N6Q8S-targeted-after-restore-audit.json` 显示同文件夹 165 个事故相关
  改名项中 `temp=0`、`mismatch=0`、`invalid=0`、`restoredOriginal=165`。真实 Eagle
  界面已刷新并点选单张照片，网格缩略图和右侧预览正常，未见 `__eagle_number`。
  本项只是事故恢复完成；连续 20 次真实拖动和自动编号仍需继续验收。
- 2026-07-23：执行排序系统唯一链路清洗。停止 `media-organizer-v3` 原型路线并移入
  废纸篓；当前只维护 `extensions/media-organizer`。API 72 将编号输入固定为完整
  可见卡片顺序优先，刷新/重启再由已保存手动顺序恢复画面；修复 `setRenameEnabled`
  中 `targetKind` 作用域错误，避免关闭自动编号时抛错或留下错误指纹。永久回归合同
  扩展到 R01-R29，`node --check plugin.js` 与 14 组 `npm test` 全部通过。尚未把
  本次源码替换安装到 Eagle，真实界面验收仍未完成。
- 2026-07-23：真实 `4-harrat餐厅` 继续验收时发现 API 72 仍把 DOM 插入顺序当成
  屏幕顺序，拖动后后台只改 2 项但第一、第二张可见编号仍反。API 73 改为按卡片
  `getBoundingClientRect()` 行列坐标生成完整可见顺序，预览显示
  `1-harrat餐厅2 -> 1-harrat餐厅1`、`1-harrat餐厅1 -> 1-harrat餐厅2`，执行后
  真实界面前排恢复连续，刷新后缩略图和右侧预览仍正常。后台日志为 1 个文件夹、
  2 个文件、0 失败；只读审计 `/tmp/MGX48XAZ2TCAW-api73-audit.json` 显示 88 项
  `mismatchCount=0`、`invalidCount=0`。完整重启已完成，自动门禁全部通过；因
  Computer Use 坐标批量拖动不稳定，连续 10/20 次真实拖动仍需继续跑。
- 2026-07-23：已备份并替换本机已安装 2.5 的 `plugin.js`，完成一次 Eagle 退出/重启；
  源码与安装文件 SHA-256 均为
  `23062999d7dd701203b30559bdaef5d2c96901a307b25e75d73c34fe3d5e390d`，旧安装备份为
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-before-native-rename-20260723-035830`。
  恢复请求未安装，重启后只读复核仍为 88 项中 53 项不一致，证明本次替换没有偷偷
  改动真实 Library；当前画面重新出现的缩略图只是缓存恢复，不能当作文件引用已修复。
- 2026-07-23：把所有已知排序故障固化为永久回归合同 R01-R26，新增自动证据索引、
  新故障登记规则和 `test/permanent-regression-contract.test.js`。以后缺少任一回归 ID、
  关键产品语义、证据文件或 npm 测试入口，完整测试必须失败。加入门禁后的 13 组
  `npm test` 与 `plugin.js`、重命名核心、门禁测试语法检查全部通过。
- 2026-07-23：用户明确规定真实 Eagle 界面是唯一验收标准。自动测试、源码断言、
  日志、内部数组和理论推导全部降级为开发预检；界面与内部证据冲突时一律判定失败。

- 2026-07-23：修复真实 `4-harrat餐厅` 中无拍摄时间素材手动拖动无效。根因是拖动
  仍按 Eagle 内部 `allData` 工作数组计算，而多级排序后的完整 DOM 卡片顺序与该
  数组不同；缺失拍摄时间段差异最大，放置会被算成原地或错误位置。API 66 统一
  复用完整渲染顺序，陈旧或不完整 DOM 受控回退，不再让拍摄时间决定拖动结果。
- 2026-07-23：将运行时拖动集成检查改为纯只读。旧检查会在每次拍摄时间扫描后
  调用真实 `performManualDrop`、持久化再清空内存手动顺序，现只验证无拍摄时间
  素材的 draggable、目标、处理器和纯移动结果，不再修改画面、存储或撤销历史。
  完整 12 组自动测试及语法检查通过；自动编号在现场拖动验证前保持关闭。
- 2026-07-23：自动编号与拍摄时间读取彻底解耦。当前文件夹编号优先按
  `#box-list` 完整渲染卡片的真实顺序映射项目；DOM 尚未完整时回退统一排序核心，
  不再把 Eagle 内部 `allData` 工作数组直接当成画面顺序。删除所有
  `pendingMetadata` 等待/禁用分支，拍摄时间为空也可预览和编号。
- 2026-07-23：删除手动拖动次数的保存、API 字段和界面文案，只保留按集合隔离的
  手动顺序与撤销历史。拍摄时间回填和普通菜单刷新不再调度自动编号；自动触发仅在
  项目 ID 集合增删或明确手动拖动时发生，避免打开插件扫描元数据后反复改名。
- 2026-07-23：真实 `4-harrat餐厅` 88 项验证。现场大量素材拍摄时间显示为 `—`，
  最终预览为人物 17、环境 71、忽略 0；执行当前可见顺序编号后，立即重复预览为
  0 改动，连续两次重新打开插件并完成扫描后均显示“当前名称已经连续，无需修改”。
  实测过程中先后暴露内部数组顺序错误和元数据刷新误触发，均在最终安装前修复；
  不把本项通过扩大宣称为全产品零缺陷。完整测试、语法、压缩校验通过，安装包
  `releases/媒体智能整理-v2.5.21.eagleplugin` SHA-256 为
  `876d71251b0b42dda380046bbfc77f402b9c25060e85b5c17aab12db32bcc6a0`；安装前备份为
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-before-api64-20260723-014049`。

- 2026-07-22：2.5.21 修复锁定记录“数据仍在但界面像被清空”。根因是 2.5.20
  将旧 `folderLocks.v1` 仅作为不可见诊断状态，并由测试固定为不升级。现改为一次性
  合入 `sortingLocks.v3` 最高级硬锁；保留原 17 条和现有 3 条记录，不导入旧 809 条
  项目顺序。用户明确解除旧锁时写入抑制标记，重启不会自动复活。
- 2026-07-22：最高级锁定范围确认为图片排列、升降序、多级规则、手动顺序、
  自动编号和文件名；显示简介及其它纯展示信息不受影响。手动拖动和自动编号的
  `应用到全部`恢复跳过锁定目录，并报告数量和名称。11 组测试与语法检查通过；
  候选包 `releases/媒体智能整理-v2.5.21.eagleplugin` SHA-256 为
  `ec566b5315bd7c93deadc2db4700402562da6c7f95e4154dca8a773d9e4929a8`。

- 2026-07-22：2.5.20 统一修复`应用到全部`的状态/执行混淆。手动拖动与显示简介
  现在写入当前文件夹及全部深层后代，包括旧配置保护目录；自动编号开关同样写入
  全树，但真实改名执行继续跳过受保护目录。批处理结果按`sourceContextId`隔离，
  不再跨父目录串台；全局`全部`视图不再每秒传输约2.4万条素材。
- 2026-07-22：11组测试、语法、安装包压缩与源码哈希一致性通过。2.5.20 安装包
  `releases/媒体智能整理-v2.5.20.eagleplugin` SHA-256 为
  `23551365c64bd5c1cf5aa3ee8115be91afa05ab696d64c4a34c712feacdf3b3a`；安装前备份
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin-before-2.5.20-20260722-224140`。
- 2026-07-22：真实`🔥🔥🔥作品集`验收：显示简介=相机拍摄时间同步216个文件夹，
  手动拖动同步216个文件夹；进入旧保护目录`土耳其/1-Sirkeci Lokantası 1912`
  读回简介为相机拍摄时间、手动拖动为已勾选。未重新触发216目录自动编号，避免
  未经单独确认修改真实文件名；其状态/执行拆分由自动测试覆盖。
- 2026-07-22：缩略图与Shift+X慢定位为独立NAS/SMB元数据瓶颈。NAS网络往返约
  0.5ms、已知文件`stat`约0.02秒，但约2.4万子目录的`images`冷枚举会长时间阻塞；
  Eagle历史日志中的Shift+X 60至80秒延迟早于2.5.20。插件侧整库轮询已删除，NAS
  目录性能仍需基础设施层处理。

- 2026-07-22：2.5.19 修复“手动拖动”的`应用到全部`只写各文件夹但不统一持久化、
  且执行后没有结果提示的问题。现在复用统一文件夹树批量运行时，确认后递归当前
  文件夹及全部后代，只持久化一次；写入失败会回滚内存状态，并明确报告成功、失败
  和保护跳过项。新增深层嵌套、保护跳过、部分失败和重复执行测试。
- 2026-07-22：已在真实 NAS Library 的`🔥🔥🔥作品集`执行手动拖动`应用到全部`：
  确认范围为 216 个文件夹，实际开启 197 个，跳过 19 个已保护文件夹；结果消息在
  操作行下方可见。一级子文件夹`中东`现场复查为开启，深层递归由自动测试覆盖。
  未触发自动编号，也未修改任何媒体文件名。
- 2026-07-22：Eagle“即将完成”定位为 SMB 重新挂载后的`images`目录枚举等待，
  不是 Library 损坏。重连后宿主日志确认枚举 24,194 个目录项、加载 24,191 个文件
  和 303 个文件夹，耗时 24.318 秒，随后`Library loaded`。2.5.19 暂停服务型启动，
  改为每次 Eagle 会话手动打开插件一次后常驻，避免在 Library 未就绪时抢先注入。
- 2026-07-22：2.5.19 已通过 11 组自动测试、`node --check`、安装包完整性与安装版
  源码哈希一致性校验。正式包`releases/媒体智能整理-v2.5.19.eagleplugin`的
  SHA-256 为`caefac528c8fb2fb183a00cf738e370440a376d3b94e47b457000608b5b011fd`。
- 2026-07-22：2.5.12 修复智能文件夹打开卡顿。故障版每 500ms 将约 24,185 条
  `bodyScope.raw` 整库项作为当前智能结果重算、复制和传输，主渲染进程实测约
  99% CPU。新版本优先智能上下文，只取当前 `allData/filtereds`，按当前结果 ID
  分批补齐文件路径，并用稳定指纹过滤切换瞬间的旧视图。真实 `MAX照片集`554项、
  `董董`49项、`线上展示照片`96项均能正常打开；日志只处理对应 554/49 项，
  空闲/切换后 CPU 约 2%–5%。11 组测试、语法、压缩与安装哈希一致性通过。
  安装包 SHA-256 为 `39172292da947b740555505a2130fb700782c5578e37ddda40a15a5175138dbf`；
  2.5.11 备份为 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin-before-2.5.12-20260722-205900`。
- 2026-07-22：2.5.11 修复当前文件夹多级排序后自动编号仍读取 `bodyScope.raw`
  旧顺序的错误。`currentRenameItems()` 现在先以当前排列方式和规则调用统一
  比较器，再将最终顺序交给编号器。回归样本从 `1,3,5,4,9,13,11,8`
  输入证明最终命名为 `1..8`，11 组自动测试通过。已安装并重启 Eagle，
  宿主日志确认全部注入自检通过；未代替用户再次执行真实改名。安装前备份为
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin-before-2.5.11-20260722-020508`，
  安装包 SHA-256 为 `acf95c03493dcec2ce9c160fef2635b69b44e174bda0f765a423dbff97573cf2`。
- 2026-07-22：2.5.10 已直接覆盖安装并重启 Eagle。真实导航到`土耳其`父文件夹，
  现场为 15 个直接子文件夹、0 个直接媒体；布局面板确认`排序锁定 / 手动拖动 /
  自动编号`三行始终位于排列方式之上，每行各有中性小按钮`应用到全部`，手动拖动
  不再置灰，自动编号识别当前层 15 个子文件夹，多级规则和排列自己的批量按钮保留。
  本次只做可见性和状态验收，未切换开关、拖动、改名或批量写入。
- 2026-07-22：新增 `folder-level-core` 与测试，覆盖全/半角编号前缀、`2-名称`移到
  第一位后生成`1-名称`、三层后代作用域、三开关独立下发和硬锁优先级。旧 17 个
  `protection.v2` 配置保护保留且不自动升级为硬锁，809 条 legacy order 继续只作
  忽略诊断。完整 11 组测试、语法和压缩校验通过；2.5.10 SHA-256 为
  `d699264105386bb93cc902dda4f4cb2c1310e679945c18d846fe513df26ed563`。
- 2026-07-22：2.5.10 安装前备份为
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin-before-2.5.10-20260722-013119`。

- 2026-07-22：2.5.8 增加真实 DOM 状态验收：临时选择`多级排序`时必须同时满足规则
  区可见、规则行可见、规则区紧邻排列栏，随后无副作用恢复原选择。系统屏幕录制和
  辅助功能权限未开放，无法自动取得最终 Eagle 像素截图，未将黑屏截图计作验收证据。
  最终安装包 SHA-256 为
  `7a8f348e0b599d9f65ace50dcb989df146ee40a422954773b51f6f94063689d6`。
- 2026-07-22：修正重复启动后的保护迁移统计：`protectedCount`和
  `ignoredLegacyOrderCount`改为从当前 schema v2 状态总量计算，重复迁移仍报告
  17 个配置保护和 809 条忽略顺序，不再误报为 0。

- 2026-07-22：2.5.7 完整 10 组测试、语法和压缩校验通过；真实 Eagle 重启日志确认
  界面布局、排序、连续重命名、全局保护和临时拖动自检通过。当前 75 项文件夹现场
  多级比较器违规为 0；安装包 SHA-256 为
  `60379b75cddc68f3b76dd311f9e66dd8736b67c576d17dc18057daf253880348`。
- 2026-07-22：修正团队迁移日志统计时点；17 个 legacy 保护状态在 schema v3 迁移后
  计为配置保护，809 条旧 order 只计入忽略诊断，不进入手动顺序。

- 2026-07-20：完成排序系统底层重构。schema v3 将普通/智能集合统一接入纯函数
  比较器，拆分 `protection.v2` 与 `manualViews.v2`；17 个旧保护状态保留为配置
  保护，809 条 legacy order 仅作为忽略诊断，不进入手动顺序。
- 2026-07-20：用艺术展 `MKPBIEGNPKQR9` 的真实 48 项名称、ID 和拍摄时间建立
  回归；旧截图尾部顺序 visible 违规 7，新 raw/visible/刷新/自动编号后均为 0。
- 2026-07-20：新增智能文件夹混合来源、手动视图隔离、来源改名影响预览、自然
  文件名、缺失时间、重名、多级方向和注入运行时自包含测试；完整 `npm test` 通过。
- 2026-07-20：生成并验证 `releases/媒体智能整理-v2.5.0.eagleplugin`；manifest 为
  2.5.0，压缩内容无错误，关键源码与工作区逐文件哈希一致，SHA-256 为
  `fd56b42afa4dcaefe338b72f19cf3b59d1b9aadeb1b67687b47250a05c17484e`。

- 2026-07-20：2.4.8 团队状态接力已安装并在真实 NAS Library 完整重启验证；sidecar
  自动读取 303 个文件夹指纹，ID 匹配 100%，保留 99 个排序规则、17 个保护状态和
  85 个简介配置，自动编号继续保持暂停。
- 2026-07-20：将低频“团队排序与展示状态”区域从插件首屏移动到页面最底部；真实
  Eagle 重启后确认首屏从日常地点整理开始，交接区位于离线说明之后，状态和三个
  交接按钮均正常。最终候选包 SHA-256 为
  `f8253f728e56167cd0c197c5cc73d257d7547b629443ad22a8610560d641e44d`。
- 2026-07-19：2.4.8 将固定内置交接快照升级为 Library 同级团队状态 sidecar；新增
  显式发布、导出和导入，schema v2 包含 payload SHA-256、插件版本、完整文件夹 ID
  指纹和 Library 相容校验，接收端重新打开同一 Library 后自动读取。
- 2026-07-19：2.4.7 修复团队状态在 Eagle 启动早期被导入到 `default` 作用域的问题；现在等待真实 `.library` 路径出现后再导入，并合并保留其它资料库状态。
- 2026-07-19：清理 Eagle `Plugins` 目录中同 ID 的 2.4.5 重复实例；旧目录已移到 `~/Library/Application Support/Eagle/Codex Backups/media-organizer-20260719-193500/plugin-2.4.5-disabled-original`，未删除。
- 2026-07-19：本机真实 NAS Library 验证团队接力成功：日志报告规则 99 个文件夹、保护 17 个文件夹、简介 85 个文件夹，跳过自动编号风险键 1 个；`浴袍照` 显示“已保护 58 个项目”，`散组` 显示“下级已保护 17 个文件夹”。
- 2026-07-19：2.4.7 完整测试、语法检查、压缩包完整性和完整重启持久化验证通过；最终包 SHA-256 为 `b5671c7f5e9d39506e7d0914c879e8cacf4b3372bba8b37743e697a2f1b09f5a`。
- 2026-07-19：只读审计新交接包 `/Users/max/Downloads/团队排序状态接力-2026-07-19-v2.4.2/`；状态 JSON 与本机 2.4.6 候选内置状态逐字节一致，团队版 2.4.2 插件代码过期且不得覆盖安装。
- 2026-07-19：新交接包审计确认 `散组` 本身未锁定，但其 17 个直接子文件夹全部有锁定记录；17/17 锁定文件夹均能在当前 NAS Library 中按 ID 对应。
- 2026-07-19：审计发现状态中的 `MNOU2HHLLPGW6` 当前 NAS Library 未找到，影响 1 条规则、1 条简介和 1 条自动编号记录；不能按名称猜测导入。
- 2026-07-19：用户报告 Eagle 卡在“即将完成”后，已发生运行状态变更：退出并重启过 Eagle，且已将已安装媒体智能整理插件目录改名为 `~/Library/Application Support/Eagle/Plugins/com.max.eagle-photo-taken-sort.disabled-20260719-190140`；后续恢复或安装需等待用户批准。
- 2026-07-19：迁移缺失排查确认旧包 2.4.1 已有“防止全局覆盖”实现，状态键为 `eagle.photoTakenSort.folderLocks.v1`；交接 JSON 和本机安装目录均包含 17 个保护文件夹。
- 2026-07-19：只读核对 NAS Library `metadata.json`，确认 `9-杭州 / 散组` 的 ID 为 `MKPBHL373OFYO`，其 17 个直接子文件夹正好全部在交接锁定状态中；`散组` 父级本身没有旧锁定记录。
- 2026-07-19：2.4.6 将“防止全局覆盖”提升为排序设置高层级开关，不再嵌套于多级拍摄时间排序；父级会显示下级保护数量，递归排序、显示简介和自动编号会跳过已保护文件夹并在结果中列出名称。
- 2026-07-19：2.4.6 完整测试通过，`node --check plugin.js` 通过，生成并验证 `releases/媒体智能整理-v2.4.6.eagleplugin`，SHA-256 为 `0de975c9dd3a93adb58434bc1507d62cf5080c2288c94c7f4e671b3b3c7d1e42`；尚未覆盖当前 Eagle 安装，等待用户批准后验证真实 UI。
- 2026-07-19：2.4.5 新增团队排序状态接力导入；内置交接 JSON，启动时校验 payload SHA-256，并把源电脑 Library 路径键映射到当前打开资源库，默认跳过自动编号风险键。
- 2026-07-19：新增 `team-sort-state-core.test.js`，覆盖交接状态完整性校验、NAS Library 路径映射、99 个排序规则文件夹、17 个保护文件夹、85 个简介配置和自动编号跳过。
- 2026-07-19：2.4.5 完整测试通过，`node --check plugin.js` 通过，生成并验证 `releases/媒体智能整理-v2.4.5.eagleplugin`，SHA-256 为 `832fa3efacc7c003aac73fa14decec13bc132e16a6cec6a39a8bc4090cca2523`。
- 2026-07-19：已覆盖安装 2.4.5 到本机 Eagle，安装前备份到 `~/Library/Application Support/Eagle/Backups/media-organizer-plugin-before-2.4.5-20260719-181632`；真实启动日志确认“已导入团队排序状态：规则 99 个文件夹，保护 17 个文件夹，简介 85 个文件夹；跳过 1 个风险键”。
- 2026-07-19：发现并修复团队导入运行时函数在 Eagle 主窗口 `eval` 环境中缺少常量的问题；再次启动后菜单注入和排序自检通过，重复启动未再次导入同一 payload。
- 2026-07-19：用户在“作品集”大文件夹树误触自动编号后，已退出 Eagle 中断后台批量任务；日志停留在读取拍摄时间阶段，没有进入“正在同步文件名”，且未生成 `rename-batch-backup.json`，判断未开始实际改名保存。
- 2026-07-19：新增一次性启动取消机制，清空当前资源库自动编号开关并删除取消文件；Eagle 重启日志确认“已暂停并撤销自动编号开关”，后续无读取/同步任务继续运行。
- 2026-07-19：2.4.4 改为树级自动编号两步启动：父级当前层无媒体时，勾选“自动编号”只进入准备状态，必须再点击“应用到全部”才会开始递归处理；未勾选直接点击会提示先勾选。
- 2026-07-19：新增 `plugin-source.test.js` 防止自动编号 checkbox 分支再次直接调用树级批处理；八组自动测试通过，生成并验证 2.4.4 `.eagleplugin`。
- 2026-07-19：发现 2.4.2 对 `bodyScope.rootDir` 未先解码，导致 `/Volumes/%E5...` 被误判为不存在；2.4.3 改为先 `decodeURIComponent` 再检查，并让长失败提示自动换行。
- 2026-07-19：2.4.3 已覆盖安装并重启 Eagle；在真实 `散组` 文件夹树中验证排列方式“应用到全部”和显示简介“应用到全部”均成功应用到 18 个文件夹。
- 2026-07-19：确认源码、当前安装目录、跨电脑交接包 v2.4.1 的 `plugin.js` 哈希一致；旧长简介按钮不是漏装新版，而是当前版本真实缺口。
- 2026-07-19：新增统一文件夹树批量应用核心，排序、显示简介、自动编号共享递归目标收集与失败汇总；排序覆盖 Eagle 内置排列项、升降序和多级排序规则。
- 2026-07-19：七组自动测试通过，新增深层嵌套、多个排列选项、显示简介、部分失败和重复执行覆盖。
- 2026-07-19：生成并验证 2.4.2 `.eagleplugin`；已覆盖安装到本机 Eagle，安装前备份到 `~/Library/Application Support/Eagle/Backups/media-organizer-plugin-before-2.4.2-20260719-172738`。
- 2026-07-19：真实 Eagle 中确认 `头像库` 文件夹树显示短按钮文案“应用到全部”，排列方式和显示简介 tooltip 均显示作用到 3 个文件夹；点击后因 NAS Library 路径暂不可用而显示“资源库暂不可用”，未静默报成功。
- 2026-07-18：源码、离线地理数据、测试、桥接说明和恢复备份已复制到新标准目录；未复制可重建的 `node_modules`。
- 2026-07-18：六组自动测试通过，生成并验证 2.4.1 `.eagleplugin`。
- 2026-07-18：审计原始 `b04a2efd...` 与桥接 `4f56e0da...` 两份 `app.asar`，差异收敛到 `app/js/plugin/api.js` 和 `app/js/plugin/index.js`；新增精确版本/哈希校验、安全备份和回退脚本。

- 2026-07-23：修复 2.5.21 在「排序锁定」开/关时改变照片顺序的现场故障。
  根因是锁定状态进入监控上下文键，并在拍摄时间扫描后无条件调用
  `refreshMainList()`；打开插件也经过同一条刷新路径。API 63 将锁定从
  扫描键移除，并禁止受保护集合在元数据扫描后刷新列表。
- 2026-07-23：`npm test` 12 组全部通过，语法和压缩包完整性通过。真实
  Eagle `3-Seven Hills` 59 项现场验证中，打开插件、取消锁定、重新锁定后
  顺序与文件名指纹均为
  `a53d2ac8871c54591a2cc762ae8ac7aed40cc06ee3a4b121839aff0b405cdf8f`。
  已替换安装目录和同一份 2.5.21 安装包，包 SHA-256 为
  `0e350901d494fc4b5cfec8fb8f6aa730ca716ef8adab224aca97dafab6b263d0`；安装前备份为
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-before-api63-20260723-0130`。
- 2026-07-23：API 66 在真实 `4-harrat餐厅` 仍出现无拍摄时间素材只能选中、
  不能开始拖动。落点顺序计算已正确，但只依赖浏览器原生 `dragstart`，Eagle
  卡片现场没有稳定触发该事件。API 68 增加 7 像素阈值的鼠标备用链路：单击
  仍只选择，超过阈值后按屏幕卡片左右半区落点，并复用同一手动顺序持久化。
- 2026-07-23：真实将无拍摄时间的 `1-harrat餐厅17` 从第三行第一张拖到
  `1-harrat餐厅12` 与 `1-harrat餐厅13` 之间成功；切换到其它文件夹再返回、
  完整退出并重启 Eagle 后位置均保持。文件名未改变，自动编号保持关闭，手动拖动
  保持开启，排序锁定保持关闭，多级排序保持不变。
- 2026-07-23：排序已改为 Eagle 启动后自动加载，现场日志仅出现“排序服务已自动
  启动”和排列面板注入，未打开“媒体智能整理”标签窗口。GPS/标签服务保留为用户
  主动打开窗口后才初始化。12 组自动测试、语法、差异、包完整性及源码/安装哈希
  一致性检查通过；最终包 SHA-256 为
  `d1a71e3a07cbf37a004c44af2670b850fbe66d2cd9dc5dbdcf50e85324b511d5`。
- 2026-07-23：新增 `docs/PERMANENT-REGRESSION-CONTRACT.md`，把用户已报告的
  20 类故障固定为发布门禁。任一项失败都不得打包、安装或请用户验收。
  当前必须完成的未结项是：单一拖动状态机、同版本重复注入防护、
  自动编号只读手动权威顺序、两阶段无冲突重命名、连续 20 次真实 Eagle 验证。
- 2026-07-23：真实 `4-harrat餐厅` 刷新后出现大面积空缩略图、右侧预览破图和拖动时
  “找不到文件”。只读核对 88 项后确认 53 项 `metadata.json` 名称与真实 JPG 文件名
  不一致；根因是 API 69 后台编号错误使用 `item.save()`，只写元数据而未走 Eagle
  原生文件改名管线。已登记永久回归 R25-R26；真实 Library 尚未恢复，禁止继续拖动
  或编号。已生成默认未批准、无歧义项的精确恢复清单
  `recovery/MGX48XAZ2TCAW-20260723.json`，恢复必须限定这 53 个明确 ID 并先取得用户批准。
# 2026-07-23 当前文件夹编号双刷新修复

- [x] 将真实界面中“拖动编号后缩略图成片变暗/空白”登记为永久回归 R27。
- [x] 当前文件夹编号完成后禁止 `api.refresh()`，并移除后台第二次 `refreshMainList()`。
- [ ] 安装新候选并完整重启 Eagle 后，从真实界面重新连续拖动 20 次，持续检查缩略图、
  右侧预览、最终连续编号、刷新、切换文件夹、锁定开关和再次重启。

# 2026-07-23 内部临时名界面隔离

- [x] 将真实界面出现 `__eagle_number` 登记为永久回归 R28。
- [x] 临时名和最终名阶段改为分别整批提交到 Eagle 原生改名管线。
- [x] 编号事务期间按 item ID 保持网格和右侧名称只显示最终业务名。
- [ ] 安装并完整重启后，从 0 开始完成 20 次真实拖动，确认全过程无临时名、
  断号、破图、预览消失或拖动失效。

# 2026-07-23 手动开关不得清除已排顺序

- [x] 将“关闭手动拖动立即回退自动排序”登记为永久回归 R33。
- [x] 手动开关只控制拖动输入，关闭时保留并继续应用按 Library ID + collection ID 存储的手动顺序。
- [x] 完成 `docs/SORTING-RULES.md` 分层总规范，并清除 README 中“关闭手动即回退”和“成员变化触发编号”的旧语义；文档一致性已加入自动门禁。
- [ ] 安装并重启 Eagle 后，真实界面关闭/开启 10 次，再验证刷新、切换和重启指纹不变。

# 2026-07-23 原生大进度层消除

- [x] 将“正在处理 N 个更改”登记为永久回归 R29。
- [x] 按 Eagle 原生阈值把每个改名阶段限制为最多 3 项，并逐组等待磁盘落定。
- [x] 最终名称提交当前模型后只更新选中项，禁止用全列表刷新修复右侧预览。
- [ ] 安装并完整重启后，在真实 `4-harrat餐厅` 连续拖动 20 次，确认无大进度层、
  临时名、破图、预览消失、断号或拖动失效。

# 2026-07-23 全面治理第一阶段

- [x] 停止真实拖动、排序、改名、安装、重启和 Library 操作，冻结 `2.5.21 / API 77`。
- [x] 盘点源码、发布包、已安装版、配置键、sidecar、桥接、监听器、计时器和改名入口。
- [x] 建立 `docs/SORTING-BUG-LEDGER.md`，恢复 R01-R34 的现象、根因、冲突和验收步骤。
- [x] 建立 L0-L8 唯一数据流、行为/测试矩阵及分批迁移计划。
- [x] 新增 `test/governance-contract.test.js` 并接入 `npm test`。
- [x] 批次 2 将旧 `plugin.js` 事件注册接入 A 生命周期和 `event-ownership`，未知落点
  不再由排序路径直接阻止。
- [x] 新增按 collection 隔离的 `rename-command-queue`，修复 R21 入队前签名吞任务；
  完整 npm 测试覆盖成功、失败、重试和跨集合并行。
- [x] R34 无插件 A 与候选 B 物理 Finder 拖出及 SHA-256 对照通过；完整发布仍保留
  手动开/关/锁定三态物理拖出合同。

# 2026-07-23 批次 1：排序模块隔离边界

- [x] 新增 `module-lifecycle.js`：A 独立开关、幂等启停、资源逆序清理和状态模型。
- [x] 新增 `host-adapter.js`：普通/智能集合统一 snapshot、父/叶 targetKind、受控不可用。
- [x] 新增 `event-ownership.js`：只有当前窗口当前 collection 的有效网格落点可拦截。
- [x] 新增 `sorting-module-facade.js`：旧实现只通过显式 start/stop bridge 接入。
- [x] 新增 fake host 和模块边界契约测试，接入 `npm test`。
- [ ] 旧 `plugin.js` 的真实事件监听器尚未迁入 facade；R34、R21、R24-R31 继续红灯。
- [ ] 待总管批准独立测试 Library 适配和真实界面验收；本批不安装、不重启、不操作 Library。

# 2026-07-23 批次 2：源码接入完成

- [x] `plugin.js` 通过 `sorting-module-facade` 驱动注入侧 `startSortingModule/stopSortingModule`；
  listener、window listener、菜单 timer、改名预览 observer 由 A 资源清理。
- [ ] 外层 HostPort 仍是显式 controlled-unavailable 装配；真实 Eagle CollectionSnapshot
  读写全部迁入 adapter 之前，不申请真实宿主验收。
- [x] `dragstart` 保持 Eagle 原生；`dragover/drop` 先经 ownership 分类，只有当前窗口、
  当前 collection、有效网格落点可调用 `applyEventOwnership`。
- [x] R21 固定为 `enqueue(defer) -> acknowledge -> start -> claim/process/complete`；
  失败释放 signature 并恢复请求，同集合串行、跨集合隔离。
- [x] `npm test`、`node --check plugin.js`、`git diff --check` 通过；未安装、未重启、
  未操作真实 Library。下一节点：待批准独立测试 Library 与候选安装/回滚演练。

# 2026-07-24 R21 自动编号异常置灰

- [x] QA Library 真实界面确认：`MEUL73DQPC4ZS` 未锁定且手动拖动可用，但自动编号
  checkbox 单独置灰；这不是 Eagle 权限或 `sortingLocks.v3` 硬锁。
- [x] 登记主影响 R21、交叉影响 R14/R26；首个失败后停止后续真实编号验收。
- [x] 先写失败测试，证明配置开关权限不受无匹配 collection 的 rename busy 状态影响。
- [x] 新增 `rename-lifecycle-core`，拆分开关权限与任务 busy，并为 enqueue/claim 拒绝
  增加主窗口状态结算；完整 `npm test`、语法和 diff 门禁通过。
- [x] 生成唯一候选 `2.5.22-qa.2 / API 79`，关键指纹记录在
  `qa-evidence/QA-R21-AUTO-NUMBER-DISABLED-2026-07-24.md`。
- [x] qa.2/API79 已在 QA Library 完成同一特殊文件夹复验，自动编号可操作且上下文
  切换后状态释放。

# 2026-07-25 qa.3 至 qa.5 受控失败恢复

- [x] qa.3 智能集合范围文案失败先登记 R12、先写失败测试；qa.3/API80 在 3 项智能
  集合真实复验通过。
- [x] qa.3 受控失败暴露同一请求被 monitor 自动重试，影响 R18/R21/R22/R30；先观察
  失败测试为红，qa.4/API81 取消失败命令自动恢复并通过完整自动门禁。
- [x] qa.4 真实失败终态暴露网格目标名与检查器/真实文件原名不一致，登记
  R24/R28/R30；先观察失败测试为红，qa.5/API82 在清 mask 后定向更新受影响 item 与
  当前选择，不做全列表刷新。
- [x] qa.5 真实受控失败终态四处名称一致、错误明确、旧重试窗口内无二次执行；失败后
  自动编号可关闭，用户明确预览后单次重试成功为 `1-qa-fixtures1`，缩略图、预览、
  metadata 和 `755` 权限完整，最终自动编号关闭。
- [x] 本轮快速 QA 可验收；永久发布仍需 R01 20 次物理网格拖动和 R34 手动开/关/锁定
  三态物理 Finder 拖出。

# 2026-07-25 本机发布闭环

- [x] 用户将 R01 本次样本收敛为已完成的 4 次，并取消 R34 三态重复物理拖出；A/B
  物理拖出及 SHA-256 加三态源码/自动回归作为风险验收，R01-R34 本次全部关闭。
- [x] 当前安装与 qa.5/API82 静态载荷逐文件一致；五个差异均为日志、地理状态、缓存、
  改名备份和窗口状态等运行时文件，避免无意义覆盖安装。
- [x] 创建完整可恢复备份
  `media-organizer-release-final-before-qa5-20260725-014315`，备份与安装指纹清单 SHA-256
  均为 `32c65a2dd962e93a096a434000595d812f9e5dceee5bcd7b27fc43341b4cbfff`。
- [x] 完整重启后日志仅初始化一个安装目录来源和 qa.5；只加载本地 QA Library，原生
  选择、预览、右键正常，排序锁定、手动拖动、自动编号最终均关闭。
- [x] 正式 Library 确认为 NAS SMB 路径；按最新授权没有打开、写入或修改，生产 NAS
  真实写入验收未执行。

# 2026-07-25 最新真实 NAS 验收覆盖

- [x] 专项测试库已准确枚举；Eagle 完全退出后将原 QA Library 可恢复移入
  `/Users/max/.Trash/Eagle QA Sort 2026-07-25-deleted-20260725-final.library`，未删除源码、证据、安装备份或指纹清单。
- [x] 真实 NAS Library 内通过 Eagle UI 创建隔离文件夹 `排序插件隔离验收-20260725`
  （`MS03COPQUCQYH`），导入 4 个非正式 PNG；既有正式素材未触碰。
- [x] 真实 NAS 隔离区原生选择、预览、右键、自动编号、排序锁定权限、刷新和完整重启通过；最终
  排序锁定、手动拖动、自动编号关闭，待改为 0。
- [ ] R01 在真实 NAS 的两次网格拖动未形成有效顺序变化，R34 真实 NAS 跨应用 Finder 拖出未执行；
  R01/R34 生产最终验收保持开放，其余未在本次真实 NAS 隔离区逐项重跑的 R-ID 不得标记为生产全通过。
- [ ] 本轮真实 NAS 结论为部分通过；`2.5.22-qa.5 / API 82` 已安装并保持本机唯一来源，但不具备
  “R01-R34 全部生产验收通过”条件。
- 证据：`qa-evidence/QA-REAL-NAS-FINAL-ACCEPTANCE-2026-07-25.md`。

# 2026-07-25 团队排序自动同步

- [x] 登记影响 `R15/R16/R18/R21/R22/R31`：团队状态写回、保护/排序持久化、失败恢复、上下文切换和成员变化均不得新增自动编号入口。
- [x] 先写失败测试再实现 `team-state-sync-core`：本地状态变化 debounce 后自动生成同级 sidecar；两次快速变化只写最后快照；导入不会循环写回。
- [x] 先写失败测试再实现 `team-state-file-core`：原子临时文件替换、同级 lock、mtime/大小/内容 SHA-256 检测、写前备份；并发变化拒绝静默覆盖。
- [x] 兼容现有 schema v2 和 payload SHA-256；增加可选 `revision`、`updatedAt`、`writerId`；自动编号继续携带但接收电脑不自动开启、不改名。
- [x] UI 日常流程改为“团队同步：自动”；旧发布/导入/导出入口保留为诊断用途。
- [x] `npm test`、`node --check plugin.js`、`git diff --check` 全部通过；真实 Eagle/NAS 尚未安装或验证。
- [x] 生成未安装候选 `qa-candidate/media-organizer-2.5.22-qa.6`（`2.5.22-qa.6 / API 83`）；非 `node_modules` 文件清单 SHA-256 为 `e48057d7ecad46276f263cbf4491554699f4f9e9ddcdad19e9c59f6728ad742f`。
- [ ] 待用户后续批准安装并进行双电脑真实 NAS sidecar 验收；当前 qa.5 安装和回滚基线不变。
- 证据：`qa-evidence/QA-TEAM-AUTO-SYNC-2026-07-25.md`。

# 2026-07-26 全部预览卡顿修复候选

- [x] 登记影响 R13（全部/智能视图扫描范围与预览性能）及 R22（监控不得隐式刷新或自检），并复查 R12/R31 的智能集合与成员变化约束。
- [x] 先写失败测试：后台元数据扫描不得刷新原生网格；只有用户明确切换到“拍摄时间排序”才允许一次刷新；保护集合即使显式切换也不得刷新。
- [x] `monitor()` 不再等待 NAS 元数据读取，扫描改为后台任务；当前视图已有项目时不再额外枚举完整普通文件夹，智能视图只在当前结果为空时才尝试补读。
- [x] 扫描结束默认不执行整页 `refresh()`、布局/拖动集成自检；保留明确排序切换的单次刷新与自检。
- [x] `npm test`、`node --check plugin.js`、`git diff --check` 通过；未安装、未重启、未操作真实 Library/NAS。
- [x] 生成唯一未安装候选 `2.5.22-qa.7 / API 84`，指纹记录于项目总管交接消息。
- [ ] 真实 Eagle 预览流畅性仍需用户批准安装后的现场观察；若仍卡顿，升级为 NAS/SMB Library 缩略图枚举专项，不再在排序插件中增加整库扫描。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：涉及插件监控状态机、NAS 元数据 I/O、Eagle 原生预览主权与候选回滚；升级条件：现场仍出现阻塞、后台任务并发/取消失效，或需要修改 `.library`/`app.asar` 时回总管拆分并保持 high。

# 2026-07-26 相机拍摄时间与多级排序回归修复

- [x] 现场日志确认当前画面有媒体 ID 但 `filePath` 为 0，导致 EXIF 和“相机拍摄时间”
  同时为空；这是性能修复误删定向路径补齐造成的回归，不是历史台账缺失。
- [x] 当前结果按可见项目 ID 分批调用 `eagle.item.getByIds` 补齐路径，禁止整库枚举。
- [x] `NAME_GROUP + TAKEN_AT` 加入永久回归测试，保证先按 `1-/2-` 前缀分组，再按相机
  拍摄时间排序。
- [x] 元数据补齐后允许一次受控刷新；后台扫描仍不阻塞 Eagle 原生预览。
- [x] `npm test`、`node --check plugin.js`、`git diff --check` 全部通过。
- [x] 已生成并安装 `2.5.22-qa.8 / API 85`；旧 `qa.7` 已备份。
- [ ] “同一个人”若指视觉人物归类，当前产品没有人脸识别；若指 `1-/2-` 文件名组，
  需关闭手动拖动或重置已有手动顺序后观察纯规则结果。

# 2026-07-26 单张素材无法拖动与名称分叉恢复

- [x] 真实 NAS 文件夹 `MGX48XB0P1BMH` 只读审计 85 项，确认唯一异常 item
  `MGX48XB5GM5CW`：Eagle/metadata 名为 `1-habitas峡谷泳池12`，真实原图仍为
  `1-habitas峡谷泳池5.jpg`，因此 Eagle 原生拖动找不到预期源文件。
- [x] 登记永久回归 R35；先写失败测试，证明恢复通道必须允许 metadata 当前名与磁盘
  旧名不同，而普通编号继续要求两者一致。
- [x] 最小修改 `dispatchNativeRenameBatch` 的恢复专用预期 metadata 名；第一次恢复因
  旧校验拒绝并自动回滚，未修改素材。
- [ ] 完整门禁、qa.9/API86 安装、单 item 原生恢复和恢复后 85 项完整性复核待完成。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：涉及真实 Eagle、NAS 单 item 文件引用、
  安装与回滚；升级条件：原生恢复再次失败、出现多 item 分叉或需改 `.library` 内部结构。

# 2026-07-26 R36 原生预览性能与 R37 最小改名区间

- [x] 先写失败测试并复现：179 项文件夹的 EXIF 扫描缺少原生预览等待、上下文取消、
  缓存预热和并发 2；旧当前视图键改变了团队状态指纹；拖动计划缺少最小序号区间。
- [x] 缓存时间戳先用 Eagle item `size/mtime` 快速校验并注入主窗口；未缓存项目等待
  原生卡片预览后以并发 2 读取，collection 切换立即使旧 generation 停止继续排队。
- [x] 团队指纹忽略 `eagle.list.meta.type`、`eagle.list.sortIncrease` 及同类旧当前视图
  兼容键；现代每文件夹规则、手动顺序、排序锁保持同步，debounce 改为 5000ms。
- [x] 拖动仍以完整最终顺序计算，但纯核心只保留同组 ordinal 真正变化的最小区间；
  `allowedChangeIds` 随请求进入后台并在 rename-batch 再过滤。
- [x] 登记永久回归 R36/R37；聚焦测试和 `node --check plugin.js` 已通过。
- [ ] 完整 `npm test`、`git diff --check`、qa.9/API86 构建安装、单项 R35 恢复及正式
  NAS 只读复核待完成。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：复杂状态、真实 Eagle、正式 NAS、
  安装、恢复与回滚；升级条件：原生事件冲突无法解释、恢复/回滚失败或出现 `.library`
  内部结构修改需求时停止重复并上报。

# 2026-07-26 R38 智能文件夹手动拖动

- [x] 复查 R12/R15/R18/R27/R34，定位 Eagle 切入智能集合时残留旧 `currentFolder`；
  原资格判断读取旧普通父夹的 children，把智能媒体误判为 `direct-folders`。
- [x] 先写失败测试并得到红灯：智能集合目标实际为 `direct-folders`，预期为
  `direct-media`。
- [x] 纯目标判定改为智能 collection 身份优先；插件资格只读取当前智能结果，手动
  顺序继续写入该 Library 的 `smartFolders[collectionId]`，不写来源普通文件夹。
- [x] 智能集合不得继承残留普通文件夹的自动编号状态，不创建普通文件夹改名任务。
- [x] 登记永久回归 R38，并补 `folder-level-core`、host adapter、plugin source 和
  文档完整性门禁。
- [ ] 完整自动门禁、qa.10/API87 构建安装和真实 Eagle 智能集合拖动/切换恢复待完成。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：智能集合身份、事件 ownership、手动
  overlay 持久化和普通文件夹改名隔离交叉；升级条件：真实 Eagle 仍无法形成有效
  grid drop、智能集合虚拟渲染无法稳定识别落点，或需要改变宿主/Library 内部结构。

# 2026-07-26 R39 智能文件夹漏发 drop 的同网格收尾

- [x] qa.10/API87 正式 Library 现场确认：智能集合身份、手动开关和自动编号状态均正确，
  但拖动结束只选中卡片，未形成顺序变化。
- [x] 先写失败测试并得到红灯：旧 `dragend` 无事件参数且只执行清理。
- [x] 最小补交只复用既有 `dragState`、`dropHelperAtPoint` 和 `performManualDrop`；记录
  拖动开始 collection，切换 collection、网格外、正常 drop 已清状态或手动关闭时拒绝。
- [x] 可执行自动分支覆盖同网格成功、无状态、无 helper、跨 collection 和手动关闭；
  `dragend` 不取消事件、不停止传播、不读取或修改 `dataTransfer`。
- [x] 登记永久回归 R39，候选递增为 `2.5.22-qa.11 / API 88`。
- [ ] 完整自动门禁、构建、唯一插件安装、重启和正式智能集合真实拖动/切换恢复待完成。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：真实 Eagle 原生事件链、智能集合手动
  overlay、安装与生产 NAS Library 交叉；升级条件：API88 仍无 `dragstart`、坐标无法
  稳定命中同网格卡片，或出现 R01/R34 原生拖动回归时停止叠加事件入口并回架构层。

# 2026-07-28 qa.12 排序协调器真实现场

- [x] `order-coordinator-core.js` 已成为 `native -> automatic -> manual` 的唯一顺序
  权威协调层；排序锁定作为最高 guard，自动编号只消费最终顺序。
- [x] `node --check plugin.js`、完整 `npm test` 和 `git diff --check` 通过；永久回归
  合同包含新增 R40。
- [x] `2.5.22-qa.12 / API 89` 已安装到唯一正式目录并由真实 Eagle 4.0.0 加载。
- [x] 真实启动诊断：排序、拍摄时间简介、重命名、保护、层级文件夹和手动拖动自检通过；
  未执行导入、批量改名或 `.library` 内部修改。
- [ ] 真实 `改造对比案例`（`M837TMZXE0VTX`）已有 113 项持久化手动顺序；
  在清除 manual view 前，不得把 API 顺序判为拍摄时间自动排序结果。
- [ ] “恢复自动排序”会改变真实文件夹持久状态，等待用户对该明确动作的批准后再完成
  最终拍摄时间/多级规则现场验收。

# 2026-07-28 qa.14 相对手动覆盖修复

- [x] 先写失败测试并固定：自动升序/降序重算基础顺序后仍应用同一 `B after C`
  关系；多条关系稳定合并；锚点缺失受控失效；锁定 guard 仍拒绝拖动、规则变更和恢复。
- [x] `order-coordinator-core.js` 实现 v3 稀疏 overlay、旧完整数组兼容与稳定拓扑应用；
  `sorting-system-core.js`、`rename-batch-core.js` 统一消费最终顺序。
- [x] `plugin.js` 拖动写相对关系，切换升降序不再进入 legacy manual mode；“恢复自动排序”
  只清活动 overlay，保留 `legacyFullOrder`；单独拍摄时间规则根据 `sortIncrease` 生成
  asc/desc。
- [x] `npm test`、`node --check plugin.js`、`git diff --check` 通过。
- [x] `2.5.22-qa.14 / API91` 已替换到唯一安装目录并由 Eagle 正常重启加载；
  真实 `引力环球.library / 改造对比案例` 只读现场显示 113 项，当前规则为
  `PHOTO_TAKEN_AT`，82 项有拍摄时间、31 项缺失。
- [ ] 方向升/降序和“恢复自动排序”仍未宣称现场通过：该文件夹已有历史手动覆盖，
  清除覆盖会改变真实 Library 状态，须用户明确选择后再验收。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：跨 L3/L4/L6、持久化迁移、真实
  Eagle 事件和 NAS Library 安装；升级条件：现场仍出现升降序不变、关系污染其它
  collection、原生拖出回归或需要修改 `.library`/`app.asar` 时停止并回架构层。

# 2026-07-28 智能文件夹只排序、不自动编号

- [x] 先写失败测试并复现：智能集合虽已被 `canAutoNumber=false` 拒绝，历史 UI 仍保留自动编号区，改名计划构造也未在集合边界提前终止。
- [x] 智能集合现在只保留自动排序和手动相对位置；自动编号区在界面隐藏，`buildCurrentRenamePlan` 返回 `smart-collection-rename-disabled`，执行层再次拒绝非普通集合。
- [x] 普通文件夹自动编号入口、最小改名区间、排序锁定和 R01-R41 回归链未改变；新增永久回归 R42，交叉影响 R12/R15/R38-R41。
- [x] `npm test`、`node --check plugin.js`、`git diff --check` 通过；未安装、未重启 Eagle、未操作真实 Library/NAS。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：智能集合虚拟视图与普通集合改名事务的 L2/L4/L6/L7 边界交叉；升级条件：真实 Eagle 仍出现智能改名入口、智能排序写入来源普通文件夹，或需要宿主/.library 修改时停止并升级。

# 2026-07-28 qa.15/API92 安装

- [x] 候选 `qa-candidate/media-organizer-2.5.22-qa.15` 已生成，版本 `2.5.22-qa.15 / API 92`。
- [x] 安装前 `qa.14` 已完整备份到 `qa-evidence/install-backups/com.max.eagle-photo-taken-sort-qa.14-before-qa.15-20260728-063945`。
- [x] 唯一安装目录已替换为 qa.15；同 ID 活动目录数量为 1，安装载荷与候选指纹一致。
- [x] 2026-07-28 已正常退出旧 `qa.14` 进程并由新进程加载 `qa.15/API92`；未改名、
  未改素材、未直接修改 `.library` 或 `app.asar`。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：插件安装、唯一来源和真实 Eagle 验收门槛；升级条件：启动后出现第二来源、版本/API 不一致、智能改名入口仍出现或需要真实素材写入时立即停止并回滚。

# 2026-07-28 P0 真实 NAS Library 启动性能

- [x] 旧 `qa.14` 进程主库 `Start to load -> Library loaded` 为 `596.712` 秒；Eagle
  随后经原生正常退出，未强杀。
- [x] 新进程运行唯一 `qa.15/API92`；候选与安装关键 SHA-256 一致，日志明确显示
  `媒体智能整理2.5.22-qa.15`。
- [x] 冷启动 `Eagle start -> Library loaded` 为 `102.483` 秒，缩短约 `82.8%`；
  290 个文件夹、24398 个有效文件与 UI 全部 24128 + 回收站 270 闭合。
- [x] 缩略图、检查器和非空原生预览通过；renderer 最终为 `S`，未见 `U`。
- [x] 加载期无整库 EXIF、改名、NAS sidecar 或高频插件写入；仅一次本机拍摄时间缓存
  原子替换，插件未进入整库关键路径，本轮不修改源码。
- [x] Eagle 报告 `Cache no changes`，未清缓存；未遍历/直改 `.library`，未写 NAS
  素材，未改 `app.asar`，未建测试库或额外备份。
- 证据：`qa-evidence/QA-P0-REAL-NAS-STARTUP-PERFORMANCE-2026-07-28.md`。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：真实 Eagle、生产 NAS、缓存、重启
  和回滚；升级条件：正常退出失败、精确缓存重建后复发、真实缺失或需要强杀/NAS
  后台/`.library` 修改时停止。

# 2026-07-28 qa.17 智能文件夹宿主输入验收

- [x] smart-only 被动 pointer adapter 已按失败测试实现，完整 `npm test`、
  `node --check plugin.js` 和 `git diff --check` 通过。
- [x] `2.5.22-qa.17 / API94` 已替换唯一安装并经正常重启加载；qa.16 已建立完整回滚点。
- [x] R42 继续真实通过：智能文件夹不存在自动编号整行，智能链不进入改名。
- [ ] R38/R39/R43 真实未通过：真实智能文件夹记录 6 次 `pointer-start`、0 次
  `pointer-commit`，全部会话取消且画面无顺序变化。
- [x] 按 L0 宿主硬限制停止，不拦截原生事件、不增加第二套业务鼠标层、不改
  `app.asar`、不继续盲拖；未改名、未写 NAS 素材或 `.library`。
- 证据：`qa-evidence/QA-SMART-FOLDER-SORTING-QA17-2026-07-28.md`。

# 2026-07-28 qa.18 智能原生 drag 观察与首拖

- [x] 先以 qa.17 四类真实取消序列写失败测试；新增单一
  `SmartDragTargetResolver` 和同一 HostInputAdapter 的被动 native drag 观察。
- [x] 普通文件夹原 handler/排序/改名分支冻结；智能分支不取消事件、不改
  `dataTransfer`、不捕获指针、不加覆盖层或模拟鼠标。
- [x] 完整自动门禁、qa.18/API95 候选、qa.17 回滚备份、唯一安装和正常重启完成。
- [x] 真实首拖捕获唯一
  `pointer-start -> native-drag-start -> native-drag-target -> pointer-commit`。
- [ ] R38/R39/R43/R44/R45 未通过：MoveCommand 已生成但智能网格画面仍未改变。
- [x] 首拖失败后立即停止，未做第二次拖动、持久化复验或普通文件夹操作；R42 继续
  真实通过，零改名。
- 证据：`qa-evidence/QA-SMART-FOLDER-SORTING-QA18-2026-07-28.md`。

# 2026-07-28 qa.19 智能 MoveCommand 应用链

- [x] 新增纯应用编排与 R45 失败测试；诊断拆为 Move 接收、reducer、持久化、呈现
  和可见校验，智能 presenter 只消费命令 ID，普通文件夹分支未改。
- [x] 工作区/候选自动门禁、qa.19/API96、qa.18 回滚备份、唯一安装和正常重启完成。
- [ ] 真实首拖在 `native-drag-start` 后以 `grid-outside` 取消，0 MoveCommand、
  0 `MOVE_STAGE`，画面无变化；R38/R39/R43/R44/R45 仍失败。
- [x] 首拖失败后停止；R42 继续真实通过，零改名，未写 NAS 素材或 `.library`。
- 证据：`qa-evidence/QA-SMART-FOLDER-SORTING-QA19-2026-07-28.md`。

# 2026-07-28 qa.21 智能文件夹手动排序真实闭环

- [x] qa.20 固定起始网格身份，修复虚拟网格把同集合目标误判为 `grid-outside`；真实
  `线上展示照片` 连续 3 次拖动均到 `VISIBLE_VERIFY_OK`，刷新后保持。
- [x] qa.21 修复 collection 重入时未重新呈现已持久化 manual overlay；真实
  `MAX照片集` 拖动、刷新、切换智能/普通文件夹再返回均保持。
- [x] 智能拖动复用普通文件夹的 `setDropTargetsVisible`、`markDropHelper` 和统一清理
  路径；不新增覆盖层、不拦截原生事件、不创建第二套业务状态机。
- [x] R42 继续通过：智能文件夹无自动编号整行，零改名；普通文件夹稳定分支未改。
- [x] `2.5.22-qa.21 / API98` 已唯一安装并正常运行，qa.20 回滚点已保留。
- [x] `npm test`、`node --check plugin.js`、`git diff --check` 通过。
- 证据：`qa-evidence/QA-SMART-FOLDER-SORTING-QA21-2026-07-28.md`。

# 2026-07-29 qa.22 R48 智能集合结构性修复

- [x] 新增真实调用 `renderSettings` 的 normal→smart→normal、smart→smart 和重复
  渲染红灯；新增智能生命周期、旧 token、`0→511`、稳定空集合、快速切换、
  presenter 失败和普通分支冻结测试。
- [x] 设置 DOM 由 `collection-settings-renderer.js` 幂等协调；智能集合由
  `smart-collection-lifecycle-core.js` 管理 generation 和稳定状态；
  `smart-collection-presenter.js` 只移动可见卡片并在失败时放行宿主。
- [x] 智能路径不再直接 splice `allData/filtereds`，不再使用固定 160/180ms 恢复重试；
  500ms `ensureMenu` 只保证入口和观察器存在，不执行排序、呈现或改名业务。
- [x] 工作区和 qa.22/API99 候选完整 `npm test`、改动 JS `node --check`、
  `git diff --check` 通过；候选文件清单及关键 SHA-256 已记录。
- [x] 续跑时 Eagle 已自然退出且无主/renderer 或活动写任务；qa.22/API99 已延迟更新
  替换到唯一正式目录，五个关键哈希与候选一致，qa.21 候选继续作为回滚来源。
- [x] Eagle 正常启动，qa.22 生命周期实际到达 ready；真实 `MAX照片集`（511）与
  `线上展示照片`（91）只读往返 4 次均非空、响应，18 次可见校验通过且无异常风暴。
- [x] 智能界面无自动编号/自动改名；未拖动、改序、改名，未写 NAS、`.library` 或
  `app.asar`。用户可在当前真实 Library 执行最终自然业务验收。
- 证据：`qa-evidence/QA-SMART-FOLDER-STABILITY-QA22-2026-07-29.md`。

# 2026-07-29 qa.23 R47 智能拖动蓝色落点

- [x] 用户在 qa.22/API99 真实智能文件夹确认拖动和持久化有效，但没有普通文件夹同款
  蓝色左右落点；因此重开 R47，撤销 qa.21 的视觉通过表述。
- [x] 先写可执行红灯复现真实事件序列：有效 target 后的未知 native surface 不得清掉
  蓝框；同时覆盖智能卡没有 `.box-sortable-helper` 但已有 targetBox/side 的现场。
- [x] 新增唯一 `drag-feedback-controller`；普通 dragover、智能 pointer 和 native drag
  只通过同一 start/update/clear 投影视觉，不增加覆盖层、事件拦截或第二套状态机。
- [x] 自动覆盖左右切换、换卡、选中项、网格外、drop、dragend、pointercancel、Esc、
  预览、集合切换和窗口失焦；普通排序、智能 MoveCommand、自动编号和改名规则未改。
- [x] 版本递增为 `2.5.22-qa.23 / API100`，工作区完整 `npm test` 首轮通过。
- [x] qa.23/API100 曾构建、唯一安装并正常启动，但用户真实录屏证明 HOST FAIL：
  智能拖动暴露全部 helper，瀑布流出现巨型空洞与卡片跳位；qa.23 禁止发布。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：跨 pointer/native drag 状态、真实
  Eagle、唯一安装和回滚；升级条件：宿主事件所有权异常、第二插件来源、真实 Library
  空白/卡死或正常退出失败时立即停下回总管，不盲目重复。

# 2026-07-29 qa.24 R49 智能拖动无布局视觉策略

- [x] 以用户录屏 `/Users/max/Desktop/录屏2026-07-29 19.16.09.mov` 为 HOST 失败真源：
  8-15 秒智能拖动出现绿色加号/原图 ghost、巨型空洞和连续卡片跳位；15.25 秒在原位
  松开，不能据此推断提交失败。
- [x] 先写失败测试，证明 qa.23 smart mode 会启用 normal body class、强制写所有
  `.box-sortable-helper` 的 display 并让 helper 获得 `drag-over`。
- [x] 唯一 controller 增加 normal/smart strategy：normal 保持 Eagle helper；smart
  永不遍历/写 helper display，永不启用 normal dragging class，只在目标卡片投影
  before/after box-shadow；未知 surface 保留，明确离开和结束清理。
- [x] 新增非原位目标 C 的
  `native dragstart -> valid target -> source/unknown -> dragend` 可执行序列，确认只生成
  一个 MoveCommand；重复 dragend 为 no-session；既有窗口外拖出继续放行。
- [x] 版本递增为 `2.5.22-qa.24 / API101`；针对性测试、`node --check` 和工作区完整
  `npm test` 通过。
- [x] qa.24 候选已构建并在候选目录完整 `npm test`/语法门禁通过；219 个文件的
  SHA-256 清单已固化。本轮未安装、未重启、未操作 Eagle 或真实 Library。
- [x] 安装前确认 qa.23/API100 是唯一插件来源，`MAX照片集` 511 项非空，Eagle 无
  导入、改名、EXIF 子进程或其它活动写任务，全部进程无 U。
- [x] 通过 Computer Use 正常 `Cmd+Q` 退出，应用状态为 `isRunning=false`，主进程、
  renderer 和 API 全部关闭；未强杀。
- [x] 以 `rsync --delay-updates` 从 qa.24 候选替换唯一正式目录，排除 diagnostic、
  拍摄时间缓存、GPS 状态、改名备份/恢复、团队备份和 graphify；没有创建新备份，
  qa.23 候选继续作为回滚点。
- [x] 安装版本 `2.5.22-qa.24 / API101`；plugin、manifest、controller 和两项关键测试
  与候选五个 SHA-256 全部一致；排序插件来源数为 1。
- [x] Computer Use 正常启动真实
  `/Volumes/团队文件-MAX线上协作中台/引力环球.library`；`MAX照片集` 511 项、当前
  网格 120 个可见投影非空，AX 连续读取响应；Eagle 4.0.0/build 20260401 API 正常，
  290 个普通文件夹，主/renderer 全部 S、无 U。
- [x] qa.24 启动日志到达 `SMART_LIFECYCLE_PRESENT-READY` 和
  `VISIBLE_VERIFY_OK`；插件日志及 macOS 统一日志未出现 `collectionActions.append`、
  uncaught/TypeError、后台无响应或硬盘过慢风暴。本任务没有自动拖动、改序、改名或
  操作 Library/NAS；蓝色落点与无空洞最终结果留给用户真实自然拖动验收。
- [ ] 用户在真实智能文件夹完成 qa.24 非原位拖动，只看到目标照片角上的小蓝点，
  没有普通文件夹同款完整竖向落点；R50 以 HOST FAIL 登记，qa.24 不得发布。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：真实 Eagle 宿主布局、native drag
  ownership、普通/智能策略隔离；升级条件：源码需要拦截 dragstart/dataTransfer、
  修改 app.asar/Library 或 qa.24 真实复验仍空洞/跳位时停止并回总管。

# 2026-07-29 qa.25 R50 单目标原生 helper 完整落点

- [x] 用户真实 qa.24 结果作为失败真源：卡片 inset box-shadow 被宿主卡片层裁成角点，
  “源码有蓝色样式”不等于用户能看到完整落点。
- [x] 先写失败测试：smart 目标必须恰好启用一个 resolver 返回的当前 helper；其它
  helper mutation 为 0；切换目标和全部结束原因必须恢复原 display/priority/position/
  top/bottom。
- [x] 唯一 controller 的 smart 策略只保存和启用当前 left/right helper，将其设为
  `position:absolute`、`top/bottom:0`、`height:auto` 并复用原生 `drag-over`；
  normal 策略及 MoveCommand、manual overlay、排序、编号和改名链均未改。
- [x] 当前 helper 缺失且宿主卡已经是非 static 定位时，才使用 `top:0; bottom:0;
  width:3px` 的完整纵线；static 时 fail-open。禁止 inset box-shadow、显示全部 helper、
  改写非当前 helper、改写 targetBox 的 position/overflow 或新增覆盖层。
- [x] 版本递增为 `2.5.22-qa.25 / API102`；针对性测试和语法门禁已通过。
- [x] 工作区与 qa.25 候选各自完整 `npm test`、plugin/controller `node --check` 通过；
  候选从源码排除运行态缓存、诊断、恢复状态、团队备份和 graphify 后独立构建，SHA-256
  清单已固化。
- [x] 安装前 qa.24/API101 为唯一来源；真实 `MAX照片集` 511 项、网格 120 个可见投影
  非空，diagnostic 已空闲约 15 分钟，无导入、改名、EXIF 或其它活动写任务。
- [x] Computer Use 正常 `Cmd+Q` 退出，主进程、renderer 和 API 全部关闭；未强杀。
  以候选 `rsync --delete --delay-updates` 原子替换唯一正式目录，排除并保留运行态
  diagnostic、拍摄时间缓存、GPS 状态、改名恢复、团队备份和 graphify。
- [x] 正式安装为 `2.5.22-qa.25 / API102`，插件来源数为 1；plugin、manifest、
  controller 和两项关键测试的 SHA-256 全部与候选一致。
- [x] 正常启动真实引力环球 Library；启动前 39 秒一度停在“即将完成”且首 renderer
  为 U，按门禁停止一切 UI/重启/强杀。约 64 秒后 API 与 renderer 自然恢复，最终所有
  renderer 为 S/R、无 U；`全部 24,136`、`MAX照片集 511`、网格 120 个可见投影非空，
  Accessibility 响应，Eagle API 4.0.0/build 20260401 正常。
- [x] 插件日志确认“排序服务已自动启动”；插件和 Eagle 增量日志未出现
  `collectionActions.append`、uncaught、TypeError、后台无响应或硬盘过慢错误风暴。
  本任务未自动拖动、改序、改名、导入、删除或操作 Library/NAS 内容。
- [ ] qa.25 最终用户结果待真实智能文件夹自然非原位拖动确认：必须看到完整蓝色竖线，
  无空洞/跳位，松开顺序正确且刷新保持；普通文件夹视觉和 Eagle 外部拖出不退化。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：真实 Eagle 瀑布流 DOM、native drag
  ownership、原生 helper 生命周期及普通/智能隔离；升级条件：需要遍历/显示全部 helper、
  拦截 dragstart/dataTransfer、修改 app.asar/Library，或真实 qa.25 仍不是完整竖线时
  立即停止并回总管，不用补丁式重试。

# 2026-07-29 qa.26 R51 完整注入脚本发布门禁

- [x] 以当前 qa.25 完整 `injectionSource` 产物执行 `new Function`，稳定红灯
  `SyntaxError: Unexpected string`；确认不是 Eagle、NAS 或智能集合数据丢失。
- [x] 只修智能蓝线 CSS 的动态模板引号，版本递增为
  `2.5.22-qa.26 / API103`；普通文件夹排序、排序核心、手动关系、编号和改名均未改。
- [x] 新增完整注入载荷编译门禁，不再以 `node --check plugin.js` 或 regex 代替；
  新增 inject/monitor 完整 stack 持久化及 60 秒同错限流门禁。
- [x] 工作区与 qa.26 候选完整 `npm test`、`node --check plugin.js`、
  `git diff --check` 通过；关键文件 SHA-256 与候选一致。
- [x] Eagle 正常退出后以 `rsync --delete --delay-updates` 覆盖唯一安装目录，保留
  diagnostic、拍摄时间/GPS 缓存、改名恢复、团队备份、graphify 和 window state。
- [x] qa.26/API103 已正常启动真实引力环球 Library；API 4.0.0/build 20260401 正常，
  `MAX照片集` 511 项、网格 120 个可见投影非空，renderer 最终无 U。
- [x] 真实智能布局面板存在拍摄时间、多级排序和手动拖动入口；不存在自动编号或
  自动改名入口。diagnostic 到达菜单注入、布局自检和 smart ready，零注入失败。
- [ ] R50 最终视觉仍由用户在真实库自然非原位拖动确认：完整蓝色竖线、无空洞/跳位、
  松开顺序正确且刷新保持。本任务没有自动拖动、改序、改名或写 NAS 素材。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：真实 Eagle 唯一安装、动态注入、
  智能文件夹 UI 与回滚风险；升级条件：第二来源、正常退出失败、注入仍失败或需要
  修改 `.library`/`app.asar` 时立即停止。

# 2026-07-29 qa.26 排序稳定基线冻结

- [x] 当前排序体验经用户确认“较为满意”，`2.5.22-qa.26 / API103` 冻结为后续排序开发
  的稳定基线。
- [x] 新增
  `docs/STABLE-SORTING-BASELINE-2026-07-29-QA26.md`，登记版本身份、关键哈希、
  冻结行为、代码结构地图、结构风险和未来安装候选必须通过的门禁。
- [x] 本轮复查门禁通过：完整 `npm test`、`node --check plugin.js`、
  `test/injection-source-compilation.test.js`、`test/injection-diagnostic-contract.test.js`。
- [x] 本轮只做治理冻结和只读代码结构审计；未修改业务代码、未重新安装、未重启 Eagle、
  未拖动、未改序、未改名、未写 NAS 或 `.library`。
- [ ] R50 用户视觉验收继续保留：智能拖动必须看到完整蓝色竖线、无空洞/跳位、松开顺序
  正确且刷新保持。
- 模型预算：T2；原因是单一排序模块多文件审计和文档冻结，无真实现场动作。

# 2026-08-01 qa.26 GitHub 稳定发行审计

- [x] 四重身份、qa.26 冻结基线、排序治理和全部未提交现场已核对；普通/智能排序业务
  行为零改动。
- [x] 运行链审计确认主网格注入、排序 UI、手动呈现、改名调度和团队状态导入均依赖
  `eagle.photoTakenSort.execute`；无桥时只放行 Eagle 原生结果，不能 1:1 排序。
- [x] Eagle 4 官方插件/事件/Item/Folder/Library API 审计未发现设置主网格任意顺序、
  注入原生排序模式、访问主窗口 DOM 或复用原生拖动视觉的公开能力。
- [x] 团队 sidecar 可在同一 NAS Library、ID 兼容、qa.26 和审计桥齐全时自动读取；
  sidecar 单独不足以投影主网格，状态数据未进入发行包。
- [x] 新增发布合同测试、白名单可重复构建器和 host-safe 检查器。默认只检查 Eagle
  4.0.0、桥哈希、包 SHA-256、插件身份及同 ID 来源；无桥/未知桥拒绝且不写 host。
- [x] 生成 44 文件干净包，逐文件与源码一致，重复构建哈希一致，压缩完整性和污染
  扫描通过。插件 SHA-256：`9647241bae17fb5d867e1fc32cf6411776fb034c20a92fd7b327a5cd0171953a`。
- [ ] GitHub-only 新电脑完整 1:1 安装保持阻断：在禁止修改/分发 `app.asar` 和使用
  私有宿主接口的约束下没有可行技术路径，不得宣称完整可安装。
- 证据：`qa-evidence/QA-GITHUB-STABLE-RELEASE-QA26-2026-08-01.md`。
# 2026-08-01 媒体智能整理：GPS与元数据标签 qa.27 首次运行安全

- [x] 先写失败测试：干净状态初始化不枚举、首次开启不自动写、基线项目不视为新增、
  `ffprobe` 缺失可审阅、发行构建显式拒绝 GPS 状态。
- [x] 默认自动标签改为关闭；首次开启只记录基线，后续真正新增项目保持原有自动标签。
- [x] `ffprobe` 缺失进入“未识别”审阅流并显示安装说明；图片 GPS `exifr` 路径不变。
- [x] 完整 `npm test`、语法检查、压缩完整性与运行态污染扫描通过；未安装候选包为
  `releases/媒体智能整理-v2.5.22-qa.27-github.eagleplugin`，SHA-256：
  `3f529c4e288d843fa7f9b752f4a15f8f29fd0bf5714c55ec235735129ef25bd6`。
- [ ] 未做：安装、重启 Eagle、真实 Library/NAS、真实视频和干净电脑界面验收；qa.27
  仍为未安装候选。

# 2026-08-07 qa.28 Eagle 原生文件夹重命名主权修复

- [x] 用户报告 Eagle 文件夹卡片右键“重命名”无效；现场只读确认菜单仍存在，属于原生
  文件夹操作而非插件自动编号。
- [x] 根因确认：排序注入层包装 `bodyScope.changeFolderName`，在目标或当前父文件夹
  处于排序锁定时返回 `false`，越权阻断 Eagle 原生菜单。
- [x] 新增永久源码回归：排序代码不得再包装或拒绝 `changeFolderName`；删除该包装层，
  排序锁只继续约束插件排序、手动拖动和自动编号，不改变 Eagle 原生文件夹重命名。
- [x] 版本递增为 `2.5.22-qa.28 / API105`；完整 `npm test`、注入编译、语法、干净包
  压缩与安装器 `--check` 全部通过。候选包 SHA-256：
  `c143373fb05b53cc81778b8b94284e441f264cee7b6762829672a4a49724d921`。
- [x] 已正常退出 Eagle、以安装器替换唯一来源并正常打开原 NAS Library；安装版
  `plugin.js` SHA-256 与工作区一致，旧版仅移入本机回滚目录。
- [x] 真实 Eagle 无写入验收：当前文件夹右键菜单存在“重命名”，点击后出现原生文本
  输入框；按 Esc 取消后原名称保持。未提交新名称，未触发排序、手动顺序、自动编号或媒体改名。
- 模型：`gpt-5.6-sol`；推理等级：`high`；原因：真实宿主原生能力/L0 与排序锁定
  边界冲突、唯一安装及回滚风险；升级条件：第二来源、审计桥不匹配、正常退出失败、
  任何 `.library`/`app.asar` 修改需求则立即停止。

# 2026-08-07 qa.29 R52 “全部”视图首帧上下文竞态修复（Phase 1）

- [x] 四重门禁已复核：projectId `8cbf6727-09e7-4918-9b8f-30165b75a45b`、CWD/事实根正确、插件 ID `com.max.eagle-photo-taken-sort` 唯一；未安装、未重启、未操作 Eagle UI/真实 Library/NAS/app.asar。
- [x] 先补失败回归再修复：R52 关联 R13/R15/R19/R31/R48，覆盖显式 `view=all/global`、残留 `currentFolder`、未知路由、空/大列表和原生输入顺序。
- [x] 最小修复限于 collection ownership：smart 明确优先；global/all/unknown 明确高于残留 folder；global/unknown sort 与 raw 包装 fail-open，原样返回 Eagle 输入，不读取旧 overlay/锁/文件夹规则，不扫 EXIF/N+1，不刷新，不生成改名/编号计划。
- [x] 普通/智能冻结行为未改变；版本单调递增为 `2.5.22-qa.29 / API106`，qa.28/API105 保持唯一安装与回滚点。
- [x] T3 已执行：正常退出 Eagle、受控安装 qa.29/API106、正常启动完成。安装器创建唯一回滚点
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260808-020339`。
- [x] 安装后 manifest、API106、包内 `plugin.js` SHA 和唯一同 ID 来源预检通过；Eagle 诊断日志出现本次启动的排序服务注入与 `global:global` 上下文记录。
- [ ] 等待用户真实 Eagle 最终验收：已观察启动后 `view=all`、普通文件夹树和智能文件夹入口存在；Computer Use 坐标/AX 漂移使普通→全部过渡首帧无法自动可靠判定，未做任何排序、拖动、改名、导入、删除或 NAS 写入。

# 2026-08-07 qa.30 R53 智能集合启动二次排序与长卡顿（Phase 1）

- [x] 先写红灯：受信任 smart query 快照拒绝 `allData/raw` 临时 24,319 项；连续稳定后仅允许真实成员进入 READY；临时空、旧 collection generation 与合法“全库匹配”均有回归。
- [x] 新增 `SmartCollectionHostSnapshot` 为唯一智能成员真源：快照含 phase、generation、queryEpoch、libraryId、collectionId、members、visibleIds、memberFingerprint、sourceIdentity；LOADING/临时 EMPTY 全部 fail-open。
- [x] `sortData/sortRawData` 共用 `resolveHostOrder` 的 smart gate；非 READY 原样返回宿主输入，不读取 overlay、锁、规则或 timestamps，不发起刷新/扫描/改名计划。
- [x] 手动 overlay 改为稳定优先队列拓扑序，24,319 项确定性比较次数门禁通过；既有 overlay 语义保持。
- [x] 候选单调升级至 `2.5.22-qa.30 / API107`；Phase 1 仅源码、测试和白名单发行，不操作 Eagle、安装、重启、真实 Library/NAS 或 `app.asar`。
- [ ] T3：仅在总管派发后，先核对 qa.29/API106 唯一来源及回滚点，再执行受控安装与真实 Eagle 最小 smoke；自动测试不能替代用户的真实视觉验收。

# 2026-08-07 qa.30 R53 T3 真实 Eagle 失败并回滚

- [x] 正常退出 Eagle，受控安装 qa.30/API107；包 SHA、45 文件逐字节、ID/版本/API、唯一活动来源均通过。安装器仅创建一个 qa.29 回滚点，目录时间戳为本机跨日值 `20260808-034129`。
- [x] 真实 538 项 `MAX照片集` 未出现 `PRESENT-START count=24319`，操作窗口没有 >10 秒无响应系统日志，UI 能显示宿主原生智能结果。
- [ ] T3 未通过：qa.30 只产生 `HOST-PENDING count=0`，从未进入 READY/PRESENT；LOADING 中仍读取 538 项拍摄时间约 12.58 秒，违反 R53 readiness 与零 EXIF 门禁。
- [x] 失败后未继续第二次 qa.30 重启场景；正常退出并从唯一 qa.29 回滚点恢复。当前规范目录为 qa.29/API106、活动来源数 1，Eagle 已正常启动并恢复 538 项智能文件夹。
- [x] 失败 qa.30 载荷与诊断保留于 `com.max.eagle-photo-taken-sort-qa30-failed-r53-20260807-1944`；未触碰 app.asar/.library/NAS 素材，未拖动、改名、导入或删除。
- 证据：`qa-evidence/QA-R53-QA30-T3-INSTALL-ROLLBACK-2026-08-07.md`。

# 2026-08-07 qa.31 R53 Phase 2：真实成员 READY 与 LOADING 零元数据

- [x] 先补 qa.30 真实失败红灯：显式 `filtereds` 与 `allData` 同引用的 live 538 项仍是 smart-query 真源；仅 `allData/raw` 24,319 项仍拒绝；连续两次同 generation/source-reference/member-fingerprint observation 后恰好 READY。
- [x] `SmartCollectionHostSnapshot` 新增唯一 host source contract：只读取显式 `filtereds` 槽位，不从 `allData/raw` 回退；query epoch 合并 route generation、source reference 与成员指纹，保留 qa.30 临时全库零 present 和旧 generation 取消。
- [x] `api.current()` 在 smart LOADING 不再导出 `currentItems()` 或 source counts；`pushCachedTimestamps`、`scanCurrentItems`、`contextNeedsTakenAt` 共享 `canWarmTakenAtMetadata` 硬门禁，零 member/path/EXIF/cache/refresh 触发。普通文件夹与 global R52 fail-open 冻结不变。
- [x] qa.31/API108 源码候选已完成 T3 受控安装与真实验证；真实 smart READY 门禁失败后已回滚，当前不在生产插件目录。
- [x] qa.31 白名单包为 `releases/媒体智能整理-v2.5.22-qa.31-github.eagleplugin`，SHA-256=`7c20b5065764793dcfa8931cc100f7b06e4f8399548ea818bf1676343712a230`；包内 ID/版本/API、污染检查与 qa.29 唯一活动来源只读预检通过。

# 2026-08-07 qa.31 R53 T3 真实 smart smoke 失败并回滚

- [x] qa.31/API108 已按唯一来源流程安装；正常退出/启动、manifest/API、包 SHA、来源数
  和 `app.asar` 不变均通过。安装回滚点目录时间戳为本机原值 `20260808-163445`。
- [ ] 真实 smart 入口失败：UI 显示 571 项宿主成员，插件仍为 `HOST-PENDING count=0`，
  无 READY/PRESENT；R53 真实成员门禁未通过。
- [x] 未见约 24k provisional PRESENT 或 >10 秒无响应；未进行第二场景或任何写入操作。
- [x] 按门禁正常退出并恢复 qa.29/API106；当前唯一来源已恢复，qa.31 失败载荷保留在
  受控回滚目录 `...-20260808-163943`，未修改 Library/NAS/app.asar。
- 证据：`qa-evidence/QA-R53-QA31-T3-INSTALL-ROLLBACK-2026-08-07.md`。

# 2026-08-08 qa.32 R53 Phase 3：live host 571 项适配修复（源码候选）

- [x] 先写失败回归：`filtereds=[]` 时，带 smart route、collection identity、current-view
  source reference 与 visible consistency 的 live-like host 必须得到 571 项；纯
  `allData/raw` 24,319 临时别名继续 `untrusted`/LOADING。
- [x] 修复限于 `SmartCollectionHostSnapshot` 与 smart host observation 接线：显式
  `filtereds` 优先；宿主完成查询后若结果仅出现在当前 `allData`，仅凭完整 smart-route
  证据接纳，不恢复通用 allData/raw fallback；诊断输出 sourceIdentity、queryEpoch、
  memberCount、visibleCount、phase、readinessReason。
- [x] 保留 qa.30/31 的 LOADING 零排序、零 overlay、零 refresh、零 EXIF/路径 hydrate、
  零 cache write 门禁；普通文件夹与 global/R52 fail-open 行为冻结不变。
- [x] 完整 `npm test`、注入编译、1773 个 JS 语法、119 个 zsh 语法、`git diff --check`
  通过。版本递增为 `2.5.22-qa.32 / API109`。
- [x] 白名单发行包已构建并完成 ID/版本/API/污染核对：
  `releases/媒体智能整理-v2.5.22-qa.32-github.eagleplugin`，SHA-256=
  `91bf9b0954e13680a80931d45ae8130568c5885316ca96697cd388eca0ffa2dc`。
- [ ] 未安装、未重启 Eagle、未操作真实 Library/NAS；等待 T3 按受控安装器执行唯一来源
  安装与真实 smart 571 场景验收。qa.31 失败证据永久保留。

# 2026-08-08 qa.32 R53 T3 安装失败并回滚

- [x] qa.32/API109 受控安装成功；manifest/API、包内 `plugin.js` 字节、唯一来源及
  `app.asar` 哈希均通过。唯一 qa.29 回滚点：
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260808-174936`。
- [ ] 真实门禁失败：Eagle 正常启动后宿主 NAS Library 在约 5 分钟观察窗口持续“即将完成 …”，
  未进入可操作 smart folder，因而 A/B 两场景均不能证明 READY、一次 PRESENT 或视觉首帧。
- [x] 未见 24k provisional PRESENT；未观察到 LOADING metadata/EXIF 读取；日志未出现明确
  background process >10s 文本，但宿主长时间未完成，不能算性能通过。
- [x] 正常退出并恢复 qa.29/API106；恢复回滚点：
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260808-175725`。
- 证据：`qa-evidence/QA-R53-QA32-T3-INSTALL-ROLLBACK-2026-08-08.md`。

# 2026-08-08 R53 P0 qa.32 启动加载阻断只读调查

- [x] 对比 qa.32 失败候选、qa.29 回滚诊断、源码启动接线、Eagle Session 日志与 SMB/.library
  根目录只读 stat。
- [x] qa.32 仅有排序服务启动日志，未进入 injection/smart snapshot/metadata/EXIF/present；qa.29
  同一 NAS Library 回滚后约 30 秒恢复完整文件夹树和网格，SMB stat 连续 0.00 秒。
- [x] 结论暂定 B/C：无证据证明 qa.32 业务路径在 Library loaded 前阻断；宿主/NAS 原生启动时序仍需
  Eagle 阶段日志或隔离 QA Library 复现确认。
- [ ] 不生成 qa.33，不修改源码，不安装；证据：
  `qa-evidence/QA-R53-P0-QA32-STARTUP-BLOCK-INVESTIGATION-2026-08-08.md`。

# 2026-08-08：R54 qa.33/API110 启动隔离 Phase 1

- [x] 新增 R54 红灯后实现独立 `startup-readiness-gate-core`；它以 Library identity/generation 管理
  `BOOTING → WAITING_LIBRARY → READY_TO_INJECT → ACTIVE / STOPPED`，无固定 sleep，失败不重试风暴。
- [x] bootstrap 前移除 cache 读取、monitor 轮询、GPS library 切换和插件面板直连 inject；这些路径均等待
  `onLibraryChanged` identity 与 `mainLibraryReadiness` 共同确认后才 ACTIVE。
- [x] R53 LOADING 零 metadata、普通/智能 qa.26 冻结和 R52 global fail-open 未改；本阶段未安装、未重启、
  未操作 Eagle/Library/NAS/app.asar。
- [x] 完整 `npm test`、74 个 JS 语法、11 个 zsh 语法、`git diff --check`、注入编译和治理合同通过；
  白名单包 ID/API/污染/唯一来源只读预检通过。
- [x] 候选包：`releases/媒体智能整理-v2.5.22-qa.33-github.eagleplugin`；包 SHA-256=
  `8461133cf2a6522d85d48e7db57f7de5b1dcdc7bb7acab6fcd9e416c210e6e2f`；安装器 SHA-256=
  `c3e5f0ca5a17e7f77d321db38baa6c667174d3787a538b809862cf577ec23d3a`。
- [ ] qa.33 未安装、未重启、未操作 Eagle/Library/NAS；待 T3 按正常退出、单一 qa.29 回滚点和启动隔离
  门禁进行真实验证。证据：`qa-evidence/QA-R54-QA33-PHASE1-2026-08-08.md`。

# 2026-08-08：R54 qa.33/API110 T3 正常退出阻断

- [x] 安装前复核 qa.29/API106、同 ID 来源 1、目标包 SHA、`app.asar` 哈希和当前 `引力环球视频`
  Library 完整树/网格；智能入口“高颜值”显示 571 项。
- [ ] Eagle 正常 `Cmd+Q` 时提示后台任务尚未完成，只允许“强制退出/取消”；依禁止强杀门禁停止，
  qa.33 未安装、未创建新回滚点，R54 启动和 R53 A/B 均未执行。
- [x] 取消退出提示后 Eagle 保持正常运行，现场仍为唯一 qa.29/API106；证据：
  `qa-evidence/QA-R54-QA33-T3-NORMAL-QUIT-BLOCKED-2026-08-08.md`。

# 2026-08-08：R54 T3 等待恢复检测到用户活动

- [x] 进入只读观察，没有再次点击退出、安装或修改 Library/NAS。
- [ ] 观察到 Eagle 打开视频预览并显示约 `0:51 / 6:09`，判定为用户活动/并发界面改变；依硬门禁立即停止
  UI 操作，未安装 qa.33，未执行 R54/R53 场景。
- [x] 现场仍为 qa.29/API106 唯一来源，Eagle 正常运行；证据：
  `qa-evidence/QA-R54-QA33-T3-WAIT-USER-ACTIVITY-2026-08-08.md`。

# 2026-08-08：R54 T3 恢复时视频预览仍在

- [ ] 用户要求继续后，只读检查仍见视频预览“为什么闫浩能让全网女生上头”，进度 `0:51 / 6:09`；
  未满足无视频预览/无并发活动前置条件，故未退出或安装。
- [x] qa.29/API106 与 Eagle 运行现场保持；证据：
  `qa-evidence/QA-R54-QA33-T3-RESUME-PREVIEW-BLOCKED-2026-08-08.md`。

# 2026-08-08：R54 qa.33/API110 T3 安装后 INJECT_FAIL，已回滚

- [x] qa.33 的受控安装身份、SHA、manifest/API110、安装载荷单来源与 `app.asar` 未变均通过。
- [ ] R54 未通过：`BOOTSTRAP_READY/INJECT_START` 后出现
  `main-library-readiness-not-confirmed`，gate 记录终态 `INJECT_FAIL`；随后 Eagle Library 完整可操作。
- [x] 未继续 R53 smart A/B；正常退出并使用 qa.29 受控安装器恢复。当前安装为 qa.29/API106、同 ID
  来源数 1，Eagle 正常启动。失败 qa.33 载荷回滚点为
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260808-185533`。
- 证据：`qa-evidence/QA-R54-QA33-T3-INSTALL-ROLLBACK-2026-08-08.md`。

# 2026-08-08：R54.1 qa.34/API111 主窗口 readiness race Phase 1

- [x] 先红后绿新增 `main-library-readiness-waiter-core` 与 startup gate deferred/timeout/cancel 回归；
  qa.33 的 identity→瞬态 false 不再立即注入或永久失败。
- [x] waiter 只执行 host readiness re-observation，具有 40 次/10 秒有界上限（上限是 fail-open 安全边界，
  不是 ready 证据），支持 generation/STOPPED 取消；cache/team/metadata/EXIF/DOM/业务 monitor 仍在 ACTIVE 后。
- [x] R53 smart、R52 global、qa.26 普通/智能冻结不变；qa.33 T3 真实失败和回滚证据永久保留。
- [x] 完整 npm test、注入编译、治理合同、语法与发行预检通过；候选 qa.34/API111 未安装。

# 2026-08-08：R54.1 qa.34 T3 false-negative 与 R54.2 qa.35/API112

- [x] qa.34 真实安装后，Eagle Library 已 loaded/可操作但 readiness evaluator 仍 false；正常回滚 qa.29/API106，qa.34 失败载荷与回滚点永久保留。
- [x] R54.2 先红后绿重构 canonical Library identity 与多正向证据 evaluator；waiter 输出每项证据/缺失原因，同 generation ready 后只注入一次。
- [x] qa.35/API112 完整源码门禁和发行通过，包 SHA=`18aedb823ccc96660654129284bac96ef3b807495bc0261fa23c0203abb65296`；qa.35 未安装且版本语义不得复用。
- 证据：`qa-evidence/QA-R54.1-QA34-T3-INSTALL-ROLLBACK-2026-08-08.md`、`qa-evidence/QA-R54.2-QA35-PHASE1-2026-08-08.md`。

# 2026-08-08：R55 qa.36/API113 SMART FIRST VISIBLE FRAME Phase 1

- [x] 建立成员完整、metadata identity、final data/visible order 三重 READY proof；智能首帧未验证时只显示 loading/兼容稳定投影，禁止已知错误 native 顺序闪现。
- [x] OrderCoordinator 单一实现；HostOrderPresentationPort 双向事务；普通拖动 DOM/arrays/manualStore/localStorage 三方事务；A→B→A、partial、empty、分页、停止和 observer 风暴故障注入通过。
- [x] A 模块 cache/diagnostic/rename recovery/`team-state-backups` 迁移至 durable PluginData；发行包零运行态。`geo-tag-state.json` 明确保留为 C 模块独立状态债务。
- [x] 完整 npm、注入编译、88 JS、5 zsh、治理合同、diff、重复构建和污染门禁通过；qa.36 包 SHA=`6d8b186e738c987c594fbbe1d8d922578bb0773b5708be7443b253c639ffb2dd`，安装器 SHA=`07d5981fb02c5326482ee0821002fb9bc324800e6f2bd65e63c160f610f76b3b`。
- [ ] 未安装/未操作 Eagle 或真实 Library/NAS；当前唯一安装仍 qa.29/API106，等待下一 T3 真实首帧与启动验收。
- 证据：`qa-evidence/QA-R55-QA36-PHASE1-2026-08-08.md`。

# 2026-08-08：R56 qa.36 T3 红灯与 qa.37/API114 Phase 1

- [x] qa.36 真实首帧 loading 正确，已消除错误 native 顺序闪现；但 `MAX照片集(MJCRT7F81VVTJ, 538)` 永远不 READY，候选正常回滚 qa.29/API106。
- [x] 红灯复现真实 `filtereds`/`allData` 分离、100→300→538 分批、visible 0/120 虚拟化；旧单一 `sourceReference` 无法表达两条 ownership。
- [x] source evidence 拆为 `filteredReference/currentViewReference`；非空 partial filtered 阻止 allData fallback，最终完整 538 才 READY；alias 场景保持。
- [x] R01-R56、完整 npm、注入编译、88 JS/3 sh-zsh、治理合同、diff、白名单污染和重复构建门禁通过。
- [x] qa.37/API114 包 SHA=`88f8e7c596c619e43fac3703d7b08f14cda21749918f968e77c82412108cf1c9`；安装器 SHA=`f0b543b4b5f02dd17b4aeb4e7644a5499db778b52ee51ad7cdfededeb85823f9`。
- [ ] qa.37 未安装；当前唯一 qa.29/API106，等待下一 T3 验证真实 538 READY/一次 PRESENT。
- 真实失败证据：`qa-evidence/QA-R56-QA36-T3-INSTALL-ROLLBACK-2026-08-08.md`。
- Phase 1 证据：`qa-evidence/QA-R56-QA37-PHASE1-2026-08-08.md`。

# 2026-08-08：R57 qa.37 T3 红灯与 qa.38/API115

- [x] qa.37 唯一安装并真实启动；R54 在主库 `BOOTSTRAP_MAIN_WAIT` 后 786ms READY，且只有一次 `INJECT_START → INJECT_OK`。
- [x] `MAX照片集` 首帧只显示“正在验证智能文件夹成员与最终顺序…”，未出现已知错误 native 顺序。
- [x] 真实红灯定位：URL/collection ID 与 538 项已就绪，但 `bodyScope.currentSmartFolder` 尚未 hydration，host observation 再次依赖该对象，永久 `no-smart-query-source`。
- [x] qa.38/API115 改为同 ID `currentSmartFolder` 优先、缺失时读取 Eagle `smartFolderMappings[collection.id]`；route ID 持有当前 smart identity，映射 `imageCount` 提供独立完整性计数。
- [ ] 完整回归、发行构建、唯一安装及真实 538 READY/PRESENT 待本轮继续完成。

# 2026-08-08：R58 qa.38 T3 红灯与 qa.39/API116

- [x] qa.38 唯一安装并真实启动；R54 830ms READY、单次注入，首帧继续只有 loading。
- [x] qa.38 仍 `no-smart-query-source`，未把失败候选交给用户；Eagle 已正常退出。
- [x] 只读核对 Eagle 4.0 宿主代码：`allData` 是完整 smart 结果，`filtereds = allData.slice(0, len * page)` 是分页投影，`currentSmartFolder.imageCount = allData.length` 是独立计数。
- [x] qa.39/API116 改为事实组合 ownership：强完整 allData 优先于 partial filtereds；raw alias 不再单独拒绝；24k provisional 因 advertised 538 不匹配继续拒绝。
- [ ] 完整回归、发行构建、唯一安装与真实稳定性验收继续执行。

# 2026-08-08：R59 qa.39 T3 红灯与 qa.40/API117

- [x] qa.39 在真实 `MAX照片集(MJCRT7F81VVTJ)` 已证明 538 项成员完整、`verifiedComplete=true`，R58 成员真源关闭。
- [x] 新红灯定位为第三套身份门禁：排序使用 route collection ID，但 metadata context 仍依赖未 hydration 的 `currentSmartFolder`，因此 538 IDs 未进入路径补全并永久 0/0。
- [x] qa.40/API117 统一 metadata identity；新增路径 hydration 合并、成功无路径/非媒体会话哨兵、失败 5 秒退避重试、smart generation scan identity 和旧 in-flight 丢弃。
- [x] 删除 `sourceItems.length===0` 时再次从空数组取 ID 的无效 smart hydration 分支；普通文件夹、global、原生预览和 NAS 数据路径不变。
- [ ] 完整回归、确定性发行、唯一安装和真实 538 metadata READY/PRESENT 验收继续执行。

# 2026-08-08：R60 qa.40 T3 红灯与 qa.41/API118

- [x] qa.40 在真实 `MAX照片集(MJCRT7F81VVTJ)` 已收到 538 个精确成员 ID，但 `eagle.item.getByIds()` 返回对象仍无 `filePath`；“已补全 0 / 稳定缺失 538”后 PRESENT fail-open，候选不得交付。
- [x] 第一性原理拆分成员身份与文件资源：新增唯一 `ItemResourceResolver`，只通过公开 `eagle.item.get({ids, fields})` 明确请求 `filePath`，不扫描 `.library`、不猜绝对 NAS 路径、不改变选择。
- [x] 新增精确去重、200 项有界批次、并发 3、generation 取消、部分成功、漏 ID、非数组和整批 0 路径熔断测试；整批 0 路径不得写 missing sentinel 或伪造 metadata COMPLETE。
- [x] R60 已加入 Bug Ledger、行为矩阵和 R01-R60 永久回归合同；qa.40/API117 真实失败语义冻结。
- [ ] qa.41/API118 完整回归、确定性发行、唯一安装和真实 538 资源/metadata/PRESENT/首帧稳定验收继续执行。

# 2026-08-08：R61/R62 qa.41 T3 红灯与 qa.42/API119

- [x] qa.41 在真实 `MAX照片集(MJCRT7F81VVTJ)` 已得到 538 项 READY，但资源查询后永久停在 `FINAL-ORDER-PENDING`；没有合法的 timeout/fail/complete 终态，候选不得交付。
- [x] R61 根因：`eagle.item.get({ids, fields})` 的大批并发调用可同步阻塞插件事件循环，而旧 `withTimeout(eagleCall())` 在宿主调用之后才创建 timer；200 项×并发 3 放大宿主/NAS 争用。
- [x] R62 根因：metadata cache 只有单 Library 槽位，切库清空、bootstrap 旧盘覆盖新 active、签名未优先使用 `modifiedAt`、先 hydrate 后 cache，并允许旧 scan 存在跨库污染风险。
- [x] 新增 schema v3 Library 分区 cache、v2 迁移、cache-first、`size+modifiedAt`、显式 scan Library ownership；新增单 ID 串行资源 probe、调用前 timeout、批间 yield、诊断隔离和 5/10/20/40/60 秒指数退避。
- [x] 红灯后完成 `metadata-cache-core`、`item-resource-resolver-core`、monitor 和 plugin source 回归；补充 active B/迟到写 A、diagnose/yield 抛错等对抗测试。
- [x] R61/R62 已加入 Bug Ledger、行为矩阵、永久合同和治理决策；历史 qa.41/API118 失败语义保留。
- [ ] qa.42/API119 完整语法/发行/确定性/安装器门禁、唯一来源安装和真实 538 + 同库重启 cache-first 验收继续执行。

# 2026-08-08：R63 qa.42 T3 红灯与 qa.43/API120

- [x] qa.42 完整回归、确定性发行、安装器预检、正常退出和唯一来源安装通过；`app.asar` 未改，qa.41 回滚点保留。
- [x] 真实主库原生启动约 55 秒期间 qa.42 仅 `BOOTSTRAP_WAIT`，没有注入/资源/cache/排序 I/O；宿主 loaded 后 538 项约 61ms 达到 VERIFIED_COMPLETE。
- [x] 真实红灯：第一个单 ID `item.get({ids,fields})` 快速返回数组却遗漏请求 ID，连续按 5/10/20/40 秒退避并保持 loading；没有卡死、没有错误 PRESENT，但资源契约仍不兼容。
- [x] 新增运行时 capability negotiation：query 条件被忽略时只探测一次，切换并记忆公开 `item.getById(id)` singular 模式；所有结果继续精确 ID 校验、串行背压和 generation 隔离。
- [x] 先红后绿覆盖 ignored IDs、当前批 fallback、后续 scan 模式记忆，以及新宿主 query 正常路径。
- [ ] qa.43/API120 完整回归、发行、唯一安装与真实 538/metadata/PRESENT/cache-first 重启验收继续执行。

# 2026-08-08：R64 qa.43 T3 红灯与 qa.44/API121

- [x] qa.43 完整门禁、确定性发行、正常退出、唯一安装通过；真实运行只出现一次 query→getById fallback，能力记忆生效。
- [x] 真实红灯：精确 `getById` item 返回后 `resolvedPathCount` 仍为 0；根因是 adapter spread 丢失宿主 Item 原型 getter，不是 NAS 没有文件。
- [x] 先红后绿新增 `EagleHostItem` prototype getter fixture，覆盖 `filePath/size/modifiedAt`；旧实现明确触发 R60 熔断。
- [x] 新增白名单 normalizer，逐项读取允许字段并物化为 plain item；getter 异常隔离，原宿主对象不修改。
- [ ] qa.44/API121 完整回归、发行、唯一安装与真实 538/metadata/PRESENT/cache-first 重启验收继续执行。

# 2026-08-08：R65 qa.44 T3 红灯与 qa.45/API122

- [x] qa.44 真实完成 538/538 路径、526 有时间/12 缺失、约 17.4 秒冷读并写入 schema v3 当前库缓存。
- [x] 最终 `PRESENT-START` 后 fail-open；根因是自动恢复逐张搬运旧 DOM 可见集合，无法代表虚拟化最终前缀。
- [x] 先红后绿改为 data-first：原子 host order、保长分页投影、Eagle rerender、最终前缀有界验证、失败双回滚；自动恢复零手动 DOM move。
- [ ] qa.45/API122 全门禁、唯一安装、真实 PRESENT 与冷重启 cache-first 验收继续执行。

# 2026-08-08：R66/R67 qa.46/API123 根因修复

- [x] R66 红灯证明：虚拟窗口 offset 非零、Angular 异步 rerender 与 present throw 均未被旧门禁覆盖；qa.45 的 `presenter-failed` 不能作为可诊断结果。
- [x] R67 红灯证明：已有 cache 的 item 在快照缺身份时首次 miss，资源 hydrate 后必须二次命中，禁止进入原文件读取。
- [x] 实现窗口 offset/count 证明、可等待 `$evalAsync`、分页窗口投影和有界异常诊断；手动拖拽路径未改。
- [x] 实现 hydrate 后二次 cache classify；只有真实 miss 才进入 `getTakenAt`。
- [ ] qa.46/API123 全门禁、确定性构建、唯一来源安装及真实 `MAX照片集` PRESENT/cache-first/快切/原生 smoke 待执行。

# 2026-08-09：R68-R70 智能 PRESENT 注入与身份链根因修复

- [x] qa.46 真实红灯定位为注入作用域同名遮蔽：纯 `applyManualOverlay` 被宿主包装劫持，递归进入 `resolveHostOrder` 并触发栈溢出。
- [x] 新增 R68：宿主包装改名 `applyHostManualOverlay`，完整注入编译门禁只允许一个纯 overlay 声明；present 异常保留阶段和有限 stack。
- [x] qa.48/qa.50 真实红灯继续证明：成员排序变化和 Eagle 内部数组引用更换不能被当作新 smart query。
- [x] 新增 R69/R70：member/lifecycle identity 使用无序成员集合；query epoch 使用来源语义 + 无序成员集合，数组 reference 只作读取入口。
- [x] qa.51/API128 已唯一安装并在真实 `MAX照片集(MJCRT7F81VVTJ)` 只读启动：538 项，530 cache/稳定结果、8 原文件读取；一次 `PRESENT-START → PRESENT-READY`，数据和可见顺序均验证成功，25 秒内无第二次 PRESENT 或 fail-open。
- [x] `npm test`、语法、完整注入编译、确定性两次构建和 `git diff --check` 通过；`app.asar` SHA 保持 `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`。
- [ ] 保留用户真实界面最终验收：本轮未做拖动、改名、导入、删除或 NAS 素材写入。

# 2026-08-09：R71-R72 普通文件夹多级排序与锁标记一致性

- [x] 用户截图真实红灯：`1-网球` 面板显示“多级排序”，网格却出现 `2-` 组在前、`1-` 组被拆散，且多级规则区未显示；侧栏红点与面板未勾选锁定互相矛盾。
- [x] 根因不是旧排序/手动记录被删除：Eagle 的排序回调可滞后一帧仍给原生键，旧包装直接按该键降级；规则区也把原生 select 优先于持久化插件键。锁标记则未在当前 Library 状态重载后重新投影。
- [x] R71：唯一有效排列键优先采用 collection 已保存的插件键；`sortData`、`sortRawData` 和规则区共享该判定，宿主原生键仅在非插件排列时后备。
- [x] R72：每次保护面板渲染都重新投影侧栏锁标记，确保 red dot、checkbox 与实际 guard 使用同一当前 Library 状态。
- [ ] qa.52/API129：完整回归、确定性发行、唯一来源安装及真实 `1-网球` 只读验证待执行；禁止拖动、改名、导入、删除或 NAS 素材写入。

# 2026-08-09：R73 原生 pinned 越权修复

- [x] qa.52 安装后真实 `1-网球(MSJ8R2S6QBAFR)` 面板确认多级规则已显示为“文件名（自然排序）升序 → 拍摄时间升序”，但网格仍按历史 `2-`、`1-` 分段；因此 R71/R72 只是 UI/宿主键一致性修复，不能冒充顺序问题已经完成。
- [x] 真实根因定位：排序核心把 Eagle 原生 `item.pinned[collectionId]` 放在所有插件规则之前，违反用户确定的原生 < 插件自动 < 插件手动 < 排序锁定层级。
- [x] R73：删除原生 pinned 对插件自动比较器的影响；只保留插件显式 L4 手动相对关系作为自动结果之上的覆盖层。先红后绿回归已覆盖相反 pinned 的 `1-`/`2-` 组。
- [ ] qa.53/API130：完整回归、确定性发行、唯一来源安装及真实 `1-网球` 只读验证待执行；禁止拖动、改名、导入、删除或 NAS 素材写入。

# 2026-08-09：R74 正常文件夹首帧主动呈现

- [x] qa.53/API130 已唯一来源安装并只读打开真实 `1-网球(MSJ8R2S6QBAFR)`；网格仍是 `2-` 在前且 `1-` 被分段，故 R73 的 core 修复没有覆盖“注入发生在原生初始排序之后、后续不再触发 host callback”的独立链路。
- [x] R74：新增 normal 首帧唯一 L3 presentation transaction。它只在当前 normal collection、完整成员和可验证完整可见窗口成立时，原子更新已有 host arrays 与网格；任何缺网格、成员不完整或可见验证失败都不写入。
- [x] qa.54/API131 真实复核仍失败：插件注入时 Eagle scope 尚处全局，随后路由恢复普通文件夹没有发出 Angular watch 通知，所以首帧 transaction 未被调度；没有产生照片、改名或 NAS 写入。
- [x] 补足 R74 的启动触发：插件自身 500ms UI 就绪巡检只调度带身份/成员/可见证明的单次首帧 transaction，不承担规则、扫描、改名或轮询业务。
- [ ] qa.55/API132：待完整回归、确定性发行、唯一来源安装和真实 `1-网球` 只读验证；禁止拖动、改名、导入、删除或 NAS 素材写入。

# 2026-08-09：R75 有效插件排序意图

- [x] qa.55/API132 仍失败：真实布局 select 为“多级排序”，但 legacy folder object 仍返回 native key；R74 因此安全跳过，未产生任何媒体写入。
- [x] R75：统一有效排序意图为“持久化插件键 → 已显示插件 select → native 后备”，所有规则区、wrapper、metadata 和 normal 首帧 transaction 使用同一解析。
- [ ] qa.56/API133：待完整回归、确定性发行、唯一来源安装和真实 `1-网球` 只读验证；禁止拖动、改名、导入、删除或 NAS 素材写入。

# 2026-08-09：R80 普通文件夹规则变更实际呈现

- [x] 用户真实截图确认：多级排序的首级由“文件名升序”切为“文件名降序”后，网格没有变化，不能以界面选择值当作成功。
- [x] 新增 R80 自动门禁：`api.refresh` 必须记录刷新时的 collection 与规则签名，并在 Eagle `rebindRefresh` 后的 Angular turn 对身份仍一致的普通文件夹请求唯一 L3 呈现。
- [x] `npm test`、`node --check plugin.js`、`git diff --check` 通过。
- [ ] qa.62/API139：确定性发行、唯一来源安装，并在真实普通文件夹只读证明文件名升/降序会改变可见网格；失败不得宣称完成。

# 2026-08-09：qa.71/API148 智能虚拟网格排序修复

- [x] R87 真实定位：虚拟卡几何次序不是排序真源，旧 proof 导致错误回退。
- [x] R88 已固定权威结果→当前投影→渲染成员的唯一验证链，并新增永久回归。
- [x] qa.71/API148 已唯一安装；真实“高颜值”智能文件夹 571 项 `PRESENT-READY`，20 秒无二次跳变；未拖动、改名、导入、删除或写 NAS 素材。
- [ ] 等待用户最终真实视觉与交互验收；Eagle 保持打开。

# 2026-08-29：R89 普通大文件夹虚拟网格重排风暴

- [x] 真实“工作花絮”日志定位：1177 项完整成员、1173 项 NAS 原文件冷读，Eagle 可见卡在提交期间从 360 回收为 180，产生连续 `visible-order-mismatch` 和重新呈现。
- [x] 确认 NAS 已挂载、Library 于 16:24:11 完成 `Library loaded`；不把网络断开或素材损坏当成根因。
- [x] 先红后绿增加 1177 项虚拟窗口变小和失败 plan 熔断回归；修复只在 L3 host presentation/stability ownership，无文件夹名或 DOM 事件特例。
- [x] qa.72/API149 完整自动门禁、语法、完整注入编译、确定性双构建、压缩包完整性和安装器预检通过；双构建 SHA-256 均为 `bc4822e4f7264c64b1087c7fbe9ed674cdb995484b34ea16e693ca749635298a`。
- [x] 用户已明确批准退出与重开；安装前确认 Eagle 进程已退出。
- [ ] 真实安装被当前任务文件系统权限拒绝：无法在 `/Users/max/Library/Application Support/Eagle/Plugins` 创建安装暂存目录；已安装 qa.71 未被替换，`app.asar` SHA-256 仍为 `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`。
- [ ] 同一权限边界拒绝从 `/Applications/Eagle.app` 重新启动；当前任务无法完成启动计时和真实界面验收。
- [ ] 安装后必须真实复验“工作花絮”缩略图、连续稳定观察、一个原正常文件夹及 Eagle 原生选择/预览。
