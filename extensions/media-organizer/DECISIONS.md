# 决策记录

## 2026-11-14：无桥接时以公开 Item API 恢复人物图与环境图重命名

- 当前 Eagle 原始 `app.asar` 不能承载未签名的主窗口桥接候选，`eagle.photoTakenSort.execute()` 不可用，排序与主网格注入继续 fail-open。
- 公开 Plugin API 提供 `eagle.item.getSelected()`、可写 `item.name` 和 `item.save()`。决定在插件窗口增加受控 fallback，仅处理用户当前选中的媒体，先预览再确认，保存失败回滚已完成项。
- fallback 复用 `selected-rename-core` 的人物组 `1-`、环境组 `2-` 与场景名规则，不读取或写入 `.library` 内部文件，不改变 Eagle 原生排序、选择、预览和右键语义。
- 真实 Eagle 已验证一次人物图重命名和原名恢复。排序、手动拖动和多级主窗口入口仍需官方桥接或签名兼容宿主，不能用 fallback 代替。

## 2026-11-14：宿主签名、启动和右键入口必须形成发布门禁

- 2026-11-13 事故证明只核对 app.asar SHA-256 和桥接 marker 不足以证明 Eagle 可启动。今后桥接检查、安装、恢复和插件安装都必须执行 `codesign --verify --deep --strict /Applications/Eagle.app`。
- 候选 app.asar 必须在签名校验后启动。Helper 进程、本次新增日志 `Library loaded`、`mainWindow is ready` 和真实可操作界面缺一不可。旧日志、旧进程和旧窗口都不构成证据。
- 签名或启动门禁失败时自动恢复已校验的原始 app.asar，并再次核对原始 SHA-256 与签名。禁止 ad-hoc 重签、禁用系统校验或手工覆盖宿主。
- 直接修改 `app.bundle.js` 或未审计 IPC 的右键注入路径触发了 Eagle 篡改检查，作为不可交付方案停止。复制文件夹必须等待官方入口或经过签名、启动和真实原生菜单验收的桥接路径。
- 复制文件夹源码和自动测试可继续保留在正式根，真实 Eagle 右键、递归文件夹树、相同 item ID、多文件夹引用和原生 L0 回归未验收前，状态保持未完成。

## 2026-11-14：复制文件夹改走插件窗口官方 API

- Eagle 公开 Plugin API 没有把菜单项追加到主窗口文件夹右键的接口。`eagle.contextMenu.open()` 只能由插件自行弹出插件菜单，不能扩展 Eagle 原生 `openFolderContextMenu`。
- 复制入口改为媒体智能整理插件窗口内的可见按钮。按钮调用公开 `eagle.folder.getSelected()`，只接受单个普通文件夹，智能文件夹、多个选中项、没有选中项或 API 不可用时禁用并 fail-open。
- 复制执行继续复用 `createFolderCopy` 和 `folder-copy-core`，通过 `folder.create` 创建递归树，再按 `item.folders` 追加相同素材引用。该路径不修改 `app.asar`、`app.bundle.js`、IPC 或 Eagle 主窗口 DOM。
- 移除旧的主窗口 `openFolderContextMenu` 包装、`CONTEXTMENU.OPEN` 监听、`pluginModule.broadcast('library-changed', ...)` 和 bridge alias。原生主窗口右键保持 Eagle L0 语义。
- 实机窗口已确认普通 `BROLL` 选中后按钮可用。一次真实点击期间 Eagle 发生正常退出/重启且 CUA 窗口归属变化，Library 未生成副本，后续停止点击；未把未完成的写入操作标记为通过。

## 2026-11-15：恢复事故后永久封锁旧宿主安装器

- 事故复盘发现 `bridge/install-compatible-bridge.sh` 仍可直接把历史 payload 移入 `app.asar`，绕过签名和启动门禁；旧 `releases/install-*.sh` 也保留历史安装入口。
- 两类历史安装器现在无条件 fail-closed，只输出迁移到 plugin-only 的提示并退出。`scripts/install-github-release.sh` 在原始未桥接宿主上只接受 `--install-plugin-only`，`--install-plugin` 直接阻断。
- 新增 `test/host-install-safety-contract.test.js` 扫描全部安装脚本，禁止任何针对 `app.asar` 的复制、移动或覆盖路径。当前恢复后的宿主保持 b04a 且签名通过，后续不再安装或修改 bridge/app.asar。

## 2026-11-10：原生添加日期选择优先于旧插件排序意图（R140）

- 事实：真实日志出现 Eagle 回调 `orderBy=IMPORT/CREATEDATE`，但旧的
  `PHOTO_TAKEN` intent 仍被 `effectivePluginOrderBy` 选中，导致原生添加日期首帧被
  插件排序链改写。该问题与 R71 的宿主延迟回调保护相冲突。
- 决定：原生 `changeOrderBy` 在调用 Eagle 原始排序函数前清除当前 collection 的插件
  intent，确保其同步触发的 `sortData/sortRawData` 直接保留 `IMPORT/CREATEDATE`。空的
  宿主瞬态回调仍通过 `resolveHost` 保留已保存插件 intent，避免回归 R71；插件键仍由
  collection 持久化值优先。
- 现场补充：Eagle 原生 `IMPORT/CREATEDATE` 的 host 返回方向与右侧 `sortIncrease` UI
  语义互逆。新增纯 `host-native-order-core` adapter，在 `sortData` 与 `sortRawData`
  的原生分支各调用一次 reverse，仅覆盖这两个日期键；其它原生键、插件排序键和 Eagle
  原生选择/预览/右键事件保持原链路。
- 执行级注入复核发现：`Function#toString()` 发送给 Eagle 的 helper 不能读取模块外
  的 `INVERTED_NATIVE_DATE_KEYS`。该集合现位于 helper 函数体内，并由隔离函数执行测试
  覆盖，避免只通过语法编译而在真实载荷运行时报 `ReferenceError`。
- 修复包递增为 `2.5.22-qa.98 / API_VERSION=155`，重建包 SHA-256 为
  `ed16d5f19a90a4bab5d2aa33c8e8fd4c734d6c4f0f5e474810b3e25ae9db0b9e`，
  `SHA256SUMS` 为 `09960aaee41d728b2ebe2573fbccacc565c59823f026c597a6a6fd30d60e88f1`，
  最终 `plugin.js` SHA-256 为 `d4fe388ced388301a364b0435821763b97933a629f536e2a5ab1bf04c7c6e5de`。
  重建包已安装到当前 Eagle，尚待真实 Eagle 界面进入“网络样片”并完成 IMPORT 降序验收。
- 第二次现场复核确认普通文件夹的 `IMPORT/CREATEDATE` host callback 可能到达时，
  `currentOrder()` 已是原生但 `currentOrderBy` 与 DOM select 仍保留 `PHOTO_TAKEN`。
  `resolveEffective` 现按持久化 collection plugin key、显式 native host key、scoped
  plugin key、DOM select 的顺序解析，并在 native host 胜出时持久化清除旧 intent。
  即使 scoped/DOM 仍保留旧 plugin key，只要 collection 的持久化键已经是 native，
  也必须在 host 解析前执行清除，避免 resolveHost 只清内存而遗漏 localStorage。
- 影响范围：只改变 A 排序意图解析和原生排序回调时序，不改变手动 overlay、R40/R41
  的拍摄时间规则方向、R80 的规则呈现事务或 B/C 模块。
- 证据：`sort-intent-core` 新增原生 host 解析回归，`plugin-source` 增加
  `changeOrderBy` 清除顺序门禁；相关单测、注入载荷编译和永久回归合同均通过。真实
  Eagle 安装与“网络样片”文件夹的 IMPORT 降序验收仍待专项执行。


## 2026-10-30：排序助手安装身份以当前现场为准

- 当前电脑仅保留一个 `com.max.eagle-photo-taken-sort` 正式安装目录，版本为 `1.17.0`；旧目录先进入可恢复备份。
- Eagle 4.0.0 与已审计 bridge 指纹一致，安装过程不修改 `app.asar`，也不读写 `.library` 或 NAS 素材。
- 本轮真实证据只关闭“插件加载、当前集合识别、bridge 返回、无最近错误”；排序/拖拽/改名/锁定仍需独立的真实操作证据。

## 2026-10-30：Eagle 原生排序 owner 必须沿 `$parent` 解析

- Eagle 4.0 的 layout select 明确调用 `$parent.changeOrderBy` / `$parent.changeSortIncrease`；select 自身 child scope 不是回调 owner。
- adapter 只在最小 owner 解析层沿 `$parent` 查找方法并在该 owner 上安装/恢复 wrapper，保持 L0 原生事件和宿主排列面板主权。
- 受影响 R-ID：R40/R41、R71/R75、R98/R109/R131；不改变排序核心、Library identity、manual overlay、smart proof 或 rename owner。

## 2026-08-26：排序插件重建为可见实体 v1.0

- 产品目的收敛为排序且只有排序；GPS、地域标签、媒体发布和网页导入不得进入 v1.0 的安装包、启动链、状态或界面。自动编号/重命名仅是最终排序结果的可选动作。
- Eagle 原生功能是不可修改的 L0 底座。普通/智能差异由 adapter 吸收，用户获得同一种排序、手动、锁定和恢复体验。
- v1.0 必须提供实体检查中心，显示安装身份、当前集合、排序意图、手动 revision、锁/编号、host/supervisor/presenter、最近事务和 L0 原生保护状态；内部日志不能代替可见状态，绿色状态不能代替真实验收。
- 版本从 `v1.0` 开始，每实际安装一轮递增 `0.1`；开发中间态以构建 SHA 区分，不再使用 qa/API 双身份。同版本内容不得变化。
- 用户要求清掉旧插件，但排序记录属于必须保全的数据。决定采用“完整指纹与备份 → migration dry-run → v1.0 候选完成 → 正常退出 → 旧运行目录移入可恢复备份 → 同 ID 唯一安装”的安全替换；禁止先裸删旧数据。
- 重构影响全部 R01-R131。纯排序、collection、手动关系、锁、rename transaction 和 smart proof 中经重新测试成立的能力可保留；旧 12,449 行组合接线、global 缺口、normal lifecycle、DOM helper drop、GPS/标签共生命周期必须重写或移除。完整合同见 `docs/SORTING-V1-REBUILD-CONTRACT.md`。

## 2026-08-26：R132 先冻结文字需求，再进入实现

- 用户明确要求先把排序插件全部功能写成完整文字清单，再依据清单开发，以消除普通、智能、全局和历史兼容路径之间的语义漂移。
- 需求唯一基线为 `docs/SORTING-REQUIREMENTS-SPEC.md`。本文把全局设置定义为 Library 级配置档案与文件夹继承关系，而不是第四种排序模式；把“使用全局设置”与实际生效模式拆成两个显示层级。
- R132 明确普通/智能共同能力、父层/叶层边界、手动拖动的唯一 host 输入合同、Eagle L0 原生主权、自动编号事务、持久化分区、性能门禁和安装/真实验收完成定义。
- 当前 qa.114/API190 只保留为已安装但真实 UI 未完成的历史候选；在用户确认 R132 前，不继续修改、安装或重启排序插件。后续专项必须逐项引用需求 ID，先写失败测试，再修改最小所有权模块。

## 2026-08-26：R131 排序意图必须是事务提交状态，不再从界面与回调猜测

- 普通/智能的差异只允许存在于 collection/host adapter；排序模式、方向、revision、UI projection 和 supervisor generation 必须来自同一个 `SortControlPlane`。
- 明确用户选择采用 `begin → host persist/readback → commit`。宿主异常、持久化不一致或命令过期都不改变 committed state；adapter 恢复宿主字段并记录 `SORT_CONTROL_ROLLBACK`。这比“先写 Map/界面，再调用 Eagle”多一个真正的原子边界。
- DOM select、`currentOrderBy` 和 `sortData/sortRawData` callback 参数全部降为 observation。R75 曾允许未证明归属的可见 select 覆盖 legacy folder 值，该策略会把上一目录或迟到渲染状态误作当前用户意图，现由 R131 明确取代；legacy 插件模式只能由当前 collection 持久化值或新的明确用户选择恢复。
- 唯一 `SortingSupervisor` 同时接纳 normal/smart。它不实现第二排序器，只将有权 generation 分派给既有 normal presenter 或 smart lifecycle；host-array write、筛选、手动关系、L0 拖出和无 EXIF资格门禁保持在原所有权模块。
- 选择 `qa.114/API190` 作为源码候选，不覆盖已安装且已验收的 qa.113/API189。未经用户再次批准不安装、不重启 Eagle、不触碰真实 Library/NAS；自动测试只能证明候选资格，不能证明“工作花絮”现场已经修好。
- qa.114 完整自动门禁、静态检查、差异检查、双确定性构建和安装器只读预检通过；插件包 SHA-256 为 `c1d499e6d9e27b588fbd9bb96d57be1444b13145f78116c6890fc0738c0ed6d0`，安装器为 `2c995ec4c1fdbcf1425f1ff9a1ceae86f732af67abbf6301ab9ea6b79061bbf8`。
- 用户随后明确要求立即执行，排序专项已完成安装门禁：qa.113 唯一来源备份至 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260826-204357`，qa.114/API190 唯一安装；安装版与候选解包 `plugin.js` SHA-256 均为 `38c260da99d49eceaea72f6cdee8d17078db03fac86b990f90dc9977dc607e6a`，同 ID 来源仅一处，`app.asar` 安装前后均为 `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`。
- 正常启动已见 `BOOTSTRAP_READY → INJECT_START → INJECT_OK`、scope-route-ready，未见注入或 monitor 失败；但启动自检报告“界面布局诊断 ok:false（selectedOrder IMPORT，布局开关诊断失败）”。因此当前结论严格为“已安装，等待用户验收”，不能报告排序现场已修好。

## 2026-08-23：R130 以 Angular digest readiness 恢复 exact host owner

- smart URL route 已知但 `currentSmartFolder` scope/renderer 尚未水合时，不把首次 unresolved 当作永久 supervisor 终态；也不借用 stale body scope。route 只允许登记等待，host-array 写权限仍要求 exact scope + live renderer 同时成立。
- 重绑信号固定为稳定 Angular root 的 `$watch` digest observation，并绑定当前 supervisor identity。它只观察真实 renderer/scope identity，不引入固定延时、通用轮询、DOM observer/强排、refresh 或第二 lifecycle。
- 每个 identity 只允许一个 pending readiness；同引用重复 digest 不生成新 generation。Library/route/intent/前后台/stop 会 dispose，token 与 identity 双门禁保证旧通知迟到零提交。永不水合则永久 fail-open。
- qa.112 保留为正常重启后首次 unresolved 无法恢复的真实失败证据；修复候选身份递增为 qa.113/API189。
- qa.113 真实验收把 `HOST_SCOPE_UNRESOLVED → route-fail-open` 后的唯一 readiness 重绑作为通过真源：旧等待因 intent/route 变化可取消，exact owner 到齐只建立一个新 generation。MAX 最终为 539/527/12/0，视频 `高颜值` 为 571/571/0/0，均完成 DATA/VISIBLE/PRESENT-READY；60 秒内无第二次提交或跳序。
- 安装保持单一来源，qa.112 回滚点为 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260823-233044`；本轮没有修改 `.library`、NAS 素材或 `app.asar`。

## 2026-08-23：SortingSupervisor 是 lifecycle 的唯一入口

- `SortingSupervisor` 按 Library + route/collection + intent + scopeRef + rendererRef 管理唯一 active generation；启动、路由、Library、前后台、scope/renderer 重建都只通过 reconcile 进入，旧 lifecycle 入口只委托 supervisor。
- current smart 已出现在 route、但 `currentSmartFolder` 尚未 hydration 时，route collection ID 足以 attach；没有 scope/renderer 所有权才 fail-open。成员、顺序和持久化仍不从 DOM 推断。
- snapshot 可持有 live 引用供同进程所有权判断；diagnostic payload 永远不可携带这些引用，避免 Electron bridge structured-clone 卡死。qa.111 因该问题失效，qa.112/API188 为唯一候选。
- smart 暂态 route/intent hydration 可产生连续 generation，但每个旧 generation 必须先取消且零 presentation commit；最终身份稳定后只有最后 generation 可 READY。
- smart 中 rename/folder-level 自检为不适用，不应产生失败状态；这不放宽智能文件夹永不编号/改名的业务约束。
- 最终 UI 门禁确认 Library 切换会建立新的 runtime/supervisor：视频库 `高颜值` generation 1 以 571/0/0 完成原子提交，切回主库和最终正常重启后的 MAX 均以 generation 1 完成 539/527/12/0。最终冷启动 65 秒内只有一次 commit/PRESENT-READY，首序列保持不变。

## 2026-08-22：R121 以宿主挂载 ID 和唯一 host drop 入口修复回弹

- qa.105 在普通文件夹“签证资料”真实失败：JPG/PDF/DOC/DOCX 均出现蓝色落点，但松手后顺序回原位。
- 根因是混合高度瀑布流 geometry 被误当线性可见顺序真源，合法 drop 在 visible proof 阶段被回滚；另一个根因是 native IMPORT 时无条件 SKIP_NOT_PLUGIN，活动 manual relations 未重新呈现。
- 最小修复将手动来源、presenter proof、回滚和可见投影统一到 Eagle 当前挂载 card 的 immutable itemId 顺序；native base 仅在有手动关系时进入唯一 presenter。无 EXIF、preview、文件类型不参与资格判断。
- 恢复执行的最新真实证据又证明失败更早：蓝色落点已出现，但无 `HOST_INPUT`/`MOVE_RECEIVED`。源码审计确认 document capture 是唯一命令入口，而 Eagle 普通网格实际从 `window.onDropBoxItem` 回调交付 drop；旧启动链反而把该入口恢复为原函数。
- 决定 `window.onDropBoxItem` 是内部网格 drop 到 MoveCommand 的唯一入口；document `drop` 只作观察不提交。同物理会话的重复 host 回调复用第一结果；没有已证明 drag session 时原样委托 Eagle。不恢复 pointer、不用 dragend 补交、不新增延时/刷新/DOM 强排。
- qa.106 完整发布产物已存在，不得覆盖为新入口语义；候选身份递增为 `2.5.22-qa.107/API183`。安装与真实“签证资料”drop 仍是未完成的后续门禁。
- 接管后以 UI 顺序和 `diagnostic.log` 共同确认上一 JPG 手势没有提交；受控 JPG/PDF 自动化手势同样没有产生宿主 drop。项目既有合同已规定 Computer Use 缺少 `dragover/drop` 时只能记录工具边界，不能判候选失败或成功。因此保留 qa.107，不以延时、dragend、第二状态机或 DOM 强排修补，也不递增 qa.108。
- qa.107 的安装身份、全量自动门禁和 L0 选择/预览/右键入口已通过；四类物理内部 drop、持久化及 Finder 物理拖出继续作为未关闭真实门禁。没有合法 MoveCommand 时不重启并宣称“持久化通过”。完整现场记录见 `qa-evidence/QA-R121-QA107-REAL-UI-TAKEOVER-2026-08-22.md`。

## 2026-08-20：R120 原子 commit 证明不得被分页 readback 覆盖

- qa.104 的 UI 已正确，但 presenter 在 commit 后读取另一个分页/陈旧数组重新证明 data order，导致
  `DATA-VERIFY false` 和 `PRESENT-FAIL-OPEN`；清除原生筛选时 lifecycle 又被过早创建，最终
  `READY-COMMIT-FAILED`。正确画面不等于 transaction 已闭环。
- backing 与当前 projection 的原子 transaction 返回的 `dataOrderVerified` 是本次提交唯一权威证明；
  presenter 只消费该明确结果。可变全局 `smartCommittedHostArray` 被删除，任何无关 readback 都不能
  推翻或伪造 transaction proof。
- 标签/搜索筛选在 smart lifecycle/frame generation 之前 fail-open；筛选期间 lifecycle inactive，
  清除后新建 generation。R89 的原生筛选主权与 R113/R119 的事务、稳定窗口门禁均保持不变。
- qa.104 保留为真实画面转绿但 proof boundary 失败证据；唯一候选为 qa.105/API181。插件包 SHA-256
  `cd7ef72999a0e2b3906657d5384606c96bbb2aae72418636e619e260a5b8a85e`，安装器 SHA-256
  `ea2bd39a60748504066ad9d49b2824093677bd6a1ca1fd66d2b10541361b2181`。
- qa.105 已成为唯一正式安装来源并正常启动。真实 MAX照片集冷启动、升→降→升、A→B→A、
  人物图筛选与清除均完成现场闭环；所有最终 generation 均以 `DATA-VERIFY true`、
  `VISIBLE-VERIFY true`、`PRESENT-READY` 结束，当前运行实例没有 R120 三类失败日志。
- 无 EXIF 的 12 项仍保留在 539 成员集合内并使用稳定缺失值；筛选期间插件退出 projection，
  清除筛选后只允许新 generation 一次性提交。该结果同时满足“原生首帧立即可用”和“拍摄时间排序
  实际生效”，不得再用永久 fail-open 作为发布成功判据。
- 安装身份闭环：repo/installed 均为 qa.105/API181，`plugin.js` SHA-256 一致且同 ID 单一来源；
  Eagle `app.asar` SHA-256 未变化，回滚点为
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260820-224120`。

## 2026-08-20：R119 剩余稳定预算只产生一个 generation-scoped follow-up

- qa.103 的真实冷启动证明 R118 的 150ms 门本身正确，但通用 180ms timer 可能早于完整投影窗口起点
  开始计时；该 timer 触发时若仍差几十毫秒且没有后续 DOM mutation，READY 会永久饿死。
- host snapshot adapter 负责返回 `stabilityPending + followUpAfterMs`；接入层只消费这份明确预算并安排
  一个当前 generation 的单次观察。loading、route/Library 切换或模块停止沿用现有取消栅栏。
- 不采用 setInterval、refresh、DOM 强排、第二 presenter 或延长首帧 deadline。qa.103 保留为 R118
  自动转绿但 R119 冷启动失败证据；唯一候选递增为 2.5.22-qa.104/API180。
- qa.104 双确定性插件包 SHA-256 为
  `18a327796b8593c083d8385938d3684c37c50797f7d2b33f50a926937347bed6`，安装脚本为
  `adb1c57c5be35be21bd359ebe3853f384276d96aa79922d33ba6a893ad1b9e32`；只读预检通过。

## 2026-08-20：R118 完整 smart 成员与宿主投影稳定分属两项 proof

- qa.102 的真实 A→B→A 证明：旧 generation 没有迟到提交，但新 A generation 在宿主只有
  60 张过渡卡时就完成了事务；同 generation 随后的 Eagle loading 和 120 张窗口补载重建了
  native projection，导致正确 backing 顺序未持续到真实网格。
- 完整性继续只由 route/source/query/member/advertised count/pagination 证明；投影稳定只是额外的
  presenter admission proof。安装接线固定为 150ms 连续稳定，loading 会重置；不恢复遮罩、轮询、
  refresh 或 DOM 重排。
- 唯一候选为 2.5.22-qa.103/API179；qa.102 保留为冷启动和单次升降序通过、快切后晚刷新覆盖的
  现场失败证据。

## 2026-08-20：R117 smart snapshot 稳定门拥有一次有界 monitor 复核权

- qa.101 的 fail-open 首帧已通过，但真实启动证明后台排序仍可永久饿死：第一次 READY snapshot 被
  稳定门暂存后，unchanged-heartbeat fast path 阻止第二次相同 snapshot 观察，metadata scan 从未开始。
- pending smart identity 是明确、当前 generation 的未完成证明，因此只允许它穿过一次 heartbeat
  fast path；第二次 identity 相同即确认并清空，identity 改变则替换 pending。没有 pending 时仍保持
  monitor 零读取，禁止恢复每次轮询的全量 context/metadata 工作。
- 此修复不改变 1500ms 首帧预算、metadata 后台化、generation cancel、presenter transaction 或 L0
  原生所有权；唯一候选递增为 `2.5.22-qa.102/API178`，qa.101 保留为 R116 自动通过但 R117 冷启动失败证据。

## 2026-08-20：smart ownership 必须端到端透传，presenter 禁止重捕获

- qa.99 证明 route/scope resolver 转绿并不等于 transaction 拥有 owner：生命周期已经在同一
  host observation 捕获精确 owner，但 presenter glue 漏传该对象，导致 authorization 收到 null 并返回
  `smart-owner-required`。qa.99 因此失去发布资格。
- owner 必须与被验证的 smart member snapshot 同时捕获，并原样经过 lifecycle → presenter →
  transaction boundary；presenter 不得在异步完成后重捕获 owner，也不得以 route、DOM 或成员数组替代。
- R115 仅补 `hostArrayOwner: request.hostArrayOwner`，所有既有 route/scope/generation/ref/page/member
  相等检查保持不变。唯一候选递增为 `2.5.22-qa.100/API176`。
- qa.100 双确定性插件包 SHA-256 为
  `47b959aa9597bd74836e132ea8c87a3ec19a46809a82e1da5017aa1897609191`，安装脚本为
  `1f66b7038da64e4f27e730c890de6e2422813617177dc6642f7bef27e0397316`；只读预检通过。

## 2026-08-20：R114 route/scope owner 以 lowercase smartfolder route 为真源

- qa.98 已证明 metadata late-ready 与 R113 双数组事务可以到达，但真实升序提交前被
  `smart-owner-required` 拒绝。`HOST_SCOPE_UNRESOLVED` 同时证明旧 adapter 没识别 Eagle 的小写
  `smartfolder=` 参数，因而继续借用上一 controller scope。
- scope 绑定身份固定为 route kind + collection ID；智能路由只能选择相同
  `currentSmartFolder.id` 的活跃 scope。文件名、DOM 卡片、旧 body scope 或数组内容都不能替代 owner。
- 未找到 live owner 时保持 Eagle 原生顺序；禁止 refresh、延时重试、DOM 强排或放宽 R113 transaction。
  qa.98 失去发布资格，唯一候选递增为 `2.5.22-qa.99/API175`。
- qa.99 双确定性插件包 SHA-256 为
  `9322f41d97ec86e418f233b010a742440e3c5f29ff8b6a00d69a340a11c7df20`，安装脚本为
  `50d5096a9fdcbec8daea670bf94fd3e4950334bb02da7f310f4309ac3e3de843`；只读预检通过。

## 2026-08-20：R113 backing order 与 Eagle 分页 projection 是一个原子提交

- Eagle 4.0 的智能网格真源链是完整 `allData` 加当前 `filtereds = allData.slice(0, len * page)`；
  只改 `allData` 可以通过数据校验却不会改变当前网格，qa.97 已用真实 539 项证实这一假成功。
- smart host adapter 必须在同一 Library/route/scope/generation、精确数组引用、完整成员集合、
  page/len 与无原生标签/搜索投影全部成立时，一次提交完整 backing 与分页前缀。两条数组都只重排
  Eagle 当前 live item 对象；任一写入或验证失败必须一起回滚。
- DOM 虚拟卡仍只证明成员归属，不作为提交输入；提交后由 host projection 证明顺序，真实 UI
  最终验收证明画面。禁止轮询、延长 timeout、通用 refresh 和 DOM 强排。
- qa.97 保留为 R113 现场失败证据；唯一候选递增为 `2.5.22-qa.98/API174`。
- qa.98 双确定性插件包 SHA-256 为
  `d9fec3b782ae57416b94c721b6e2c74a78a4b256a31f79365d0af5ccf726535b`，安装脚本为
  `3b113b5d9d95bc622037ccff9c793cb9d4cd508845f3b576667cd025b43b4e90`；只读预检通过。

## 2026-08-20：R112 虚拟 DOM 只证明成员，不拥有预提交顺序

- qa.96 已证明后台 late-ready 可达，但 Eagle 对 539 项只挂载 300 张卡；卡片可复用、环绕或非连续，
  因而 `visible-window-unproved` 不能作为完整 host-array transaction 的前置顺序门禁。
- 预提交只验证 rendered IDs 无重复且全部属于当前已证明的 smart member set。完整成员集合相等、
  Library/route/scope/array reference 仍由 host-array ownership gate 证明；提交后的 `allData/filtereds`
  完整 projection 才验证最终顺序，rendered cards 只防跨集合陈旧卡。
- qa.96 保留为 R111 转绿但 R112 现场失败证据；唯一候选递增为 `2.5.22-qa.97/API173`。
- qa.97 双确定性插件包 SHA-256 为
  `bb2fa3a95ce85909e6884ce8b17d32cd9ffeb9ddc26f0e5243a78fdccc34849f`，安装脚本为
  `ca9820133dd2251f38f0a4a0280c81d3ed47ab84d5038cb30bd54544b1276f21`；只读预检通过。

## 2026-08-20：R111 首帧预算与后台排序完成是两个独立生命周期

- 1500ms 只约束插件占用首帧验证预算；到期后必须保持 Eagle 原生网格可用，但不得 abort 当前
  generation、清 observation 队列或把 lifecycle 置为不可恢复终态。
- metadata/成员证明可在后台继续；同一 Library + smart collection + generation 后续准备完成时，
  presenter 只有一次 apply/verify/commit 权。路由、Library、query epoch 或排序意图变化立即取消旧权。
- 排序意图身份包含 orderBy、increase、多级 rules、lock 和 manual revision；文件名、DOM 顺序、旧
  item 对象和 metadata cache revision 均不得充当意图或成员身份。
- qa.95 只能证明不白屏，因永久 fail-open 未进入 presenter 而失去发布资格；唯一候选递增为
  `2.5.22-qa.96/API172`。完成真源仍是 539 项真实升降序、多级规则与时间证据。
- qa.96 双确定性插件包 SHA-256 为
  `6f1a57e655abe5372e49ca1cff0a8187dbd793df74904ef990e76fa591f03001`，安装脚本为
  `16ddf3ca78f2b70364c8ed03c36c8528328ac1e7d6e9be76ea74d7f43da1a75a`；安装器只读预检通过。

## 2026-08-20：R110 智能排序证明不得拥有 Eagle 首帧可见性

- R55 的“未验证帧必须遮蔽”被真实 539 项白屏否决。智能成员/顺序/metadata 证明只能后台
  运行；Eagle 原生网格从首帧开始始终可见、可选、可滚动并保留全部 L0 操作。
- 每个 smart route/query generation 只有 1500ms 验证预算和一个 AbortSignal。路由切换、查询
  epoch 变化、异常或超时立即取消旧任务并 native fail-open；旧 promise 的迟到结果没有提交权。
- `TAKEN_AT` 以新鲜 Eagle item 的 `takenAt/DateTimeOriginal/...` 为先，已验证 timestamp cache
  只作兜底。无 EXIF 是稳定缺失值并置尾，不得从成员、选择、拖动或导出集合剔除。
- qa.94/API170 因白屏和排序停用后只剩原生顺序失去发布资格；唯一候选递增为
  `2.5.22-qa.95/API171`。只有 539 项真实升降序与时间证据通过后才能关闭 R110。
- qa.95 双确定性插件包 SHA-256 为
  `0e56bb1d6e5b15761f7437cf382d005fde2565a9886117095afac57065a68882`，安装器为
  `8804ec9eba119731a73c1365c9225972cebb6e3852a81247cb73a86dfd665e47`；安装器只读预检通过。

## 2026-08-20：测试路径必须在用户指定根目录内 fail-closed

- 唯一允许的外部测试根目录为 `/Users/max/Downloads/测试/`；候选验证不得自行挂载，不得
  向 NAS 收藏/正式根目录、桌面或用户主目录创建测试库、helper、导出副本或临时目录。
- 已清理并移入废纸篓的目标全部以专项命名、创建时间及 39 张逐文件 SHA 证明归属；正式 NAS
  入口没有移动或修改。任何后续外部写入必须先解析真实路径并证明其位于允许根目录内。

## 2026-08-20：R109 host sorter 必须证明 route/scope/member 同一性

- qa.93 首进 1-GAGA 的 39→0 空网格不是文件丢失：相邻普通文件夹可见，返回后 39 项恢复；
  日志明确出现旧 587 项 scope 与新 route 并存，以及后续 visible 39→0。
- 普通文件夹 `sortData/sortRawData` 不能只看 `window.location.hash` 或持久化插件排序键；必须
  在读取插件意图前证明 active scope、实际 callback `this`、Library 和全部成员都属于 route。
- 证明失败的唯一行为是同步返回 Eagle 原生 sorter 结果；禁止 refresh、固定延时、缓存计划
  补写或导航重试。候选递增为 qa.94/API170，qa.93 不再是最终候选。
- qa.94 双确定性构建一致：插件包 SHA-256
  `d3b5330dc27974607e7e27924bf0419e02a63ebff4979fed60c8a394fdb1a751`，安装器
  `dca98b3725a2455ad33c135d492481f332af4e83760e5ef1d04bc7a63a9f76f2`；安装器 `--check`
  已通过 Eagle 4.0.0、审计桥、候选身份和唯一来源门禁。现场首进复验仍是独立发布门禁。

## 2026-08-20：R108 健康诊断不得复活已退役的 pointer 所有权

- qa.92 的“手动拖动自检失败”来自诊断合同与 R103 架构脱节：生产 handler 实际为七个，
  诊断仍要求包含 `pointerdown/move/up/cancel` 的旧 11-listener 状态机。
- 唯一正确修复是让启动健康和只读拖动集成检查共享 canonical handler name set；不得为了
  变绿重新注册 pointer listener、模拟 drop 或在真实网格做自测写入。
- 该诊断修复有独立行为语义，故最终候选递增为 `2.5.22-qa.93/API169`；qa.92 仍作为
  R106/R107、11/11 recovery 和原生 39/39 的已安装证据保留。

## 2026-08-20：R106/R107 恢复事务必须在已证明的 Library identity 上执行

- 注入载荷引用的任何 helper 都必须显式序列化并由完整 payload 编译门禁覆盖；模块导入成功
  不能证明 renderer 注入作用域可见。qa.90 关闭 `verifyNormalVisibleWindow` 运行时缺失。
- durable recovery request 不能在冷启动、`eagle.library.path` 尚为空时只尝试一次。恢复只在
  `onLibraryChanged` 的 runtime transition 成功且 identity 仍匹配后执行；任何新鲜对象、名称、
  可读性或 SHA 不一致都在第一笔 native host write 前整批拒绝。
- 11 项既有 reference drift 已通过 Eagle native rename pipeline 修复，未手改 `.library`、
  `app.asar` 或图片内容。完成状态为 11/11、零回滚失败。
- `1-GAGA` 原生 39/39 是本轮导出真源：39 唯一文件名、39 唯一内容 SHA、无子目录，且与
  已交付恢复目录内容完全一致。真实事务在 qa.91/API167 完成；因 qa.90 也曾使用 API167，
  最终候选必须递增为 `2.5.22-qa.92/API168`，避免同 API 两套行为。

## 2026-08-20：R105 插件不得进入 Eagle 导入、点击与 EXIF 主路径

- 无插件本地隔离库的 1/10/39 张无 EXIF 基线分别在约 0.19/1.10/4.80 秒完成最后项目，
  39 张约 7.19 秒完成刷新、8.35 秒完成备份，UI 约 10.8 秒确认 39 项；期间没有新增后台
  无响应、缩略图超时或 renderer 崩溃。该证据只排除“本地无插件稳定复现 61 秒”，不能
  排除生产 NAS 间歇性写库/缩略图链。
- 排序插件不拥有导入主路径。常驻任务只能读取轻量 revision；context/storage revision
  未变化时禁止 `api.current()`、团队完整快照、全网格 DOM 扫描、整库 GPS 枚举、EXIF
  读取或整份 metadata cache 序列化。
- 菜单只由 layout panel scoped observer 维护；完整网格 observer 只在活动智能文件夹中
  存在；GPS discovery 只来自用户显式动作；metadata cache 采用有界增量 journal，退出时
  才压缩。不得用延时、刷新或提高超时掩盖主路径阻塞。
- `qa.88/API165` 因 R105 性能阻断失去安装资格；下一唯一候选为
  `2.5.22-qa.89/API166`。启用插件后的另一组 1/10/39 基线不得比无插件增加超过 25%，
  且任何 spinner、thumbnail timeout、renderer unresponsive 都直接发布否决。

## 2026-08-19：R103/R104 以 drop 证明和 fresh reference transaction 取代历史补丁

- 主网格 pointer/click 永远属于 Eagle；排序模块不再注册 pointer handler。dragstart 只
  记录不可变身份，只有同 Library、collection、grid 的显式 drop 才读取当前 selection 并
  创建一次 MoveCommand。R100/R103 永久覆盖 R39/R44/R49 的 pointer/dragend 补交策略。
- 排序只写 ID sidecar，手动 drop 不得隐式进入编号。编号/引用修复只来自用户显式事务，
  必须重新读取 official item，并核对 metadata/raw name；已损坏项还必须匹配记录 SHA。
- `qa.87/API164` 因仍保留 pointer 第二状态机而失去候选资格。唯一候选递增为
  `2.5.22-qa.88/API165`；双构建 SHA 已确定，但自动门禁通过不等于真实 Eagle 已通过。

## 2026-08-18：R101/R102 EXIF 缺失不是 L0 资格，metadata 扫描没有刷新权

- EXIF/拍摄时间缺失只能成为 `TAKEN_AT` 的稳定缺失值；它无权改变 Eagle collection
  members、selection、dragstart、Finder 拖出、原生导出、右键、预览或手动排序资格。
- export source 永远由 Eagle 原生选择/文件夹成员拥有。排序插件不建立 export 枚举器，
  不从 metadata 完整数组、DOM 虚拟窗口、`.pinned` 或 helper 推导导出成员。
- metadata/EXIF hydration 只拥有 timestamp cache 与同 generation 的排序 proof；即使用户
  明确选择拍摄时间排序，也不得在扫描完成后调用 host refresh。排序变化只能通过唯一
  normal/smart presenter 事务呈现，selection/inspector 始终归 Eagle。
- `qa.86/API163` 因 R101/R102 新证据失去候选资格；新源码候选为
  `2.5.22-qa.87/API164`。自动门禁通过不等于真实 Eagle 通过，qa.87 在完整现场验收前
  继续不可发布。

## 2026-08-18：R100 L0 原生拖出、导出和改名高于 dragend 兼容补交

- 可见且可选中的 Eagle 素材始终保有原生 dragstart、拖出和导出资格；`.pinned`、helper、虚拟化、锁和拍摄时间都不是资格条件。
- 历史 R39/R44/R49 的 dragend 补交在真实跨应用导出证据下失效。native dragend 只清理；只有明确同网格有效 drop 才能提交手动关系。
- 排序只拥有 item ID 顺序，不拥有 item 对象字段。任何 host-array 计划必须使用当前宿主槽位的 live 对象，禁止旧名称/metadata 快照回写。
- 插件编号事务不得用全局 MutationObserver、检查器值或 selection 回写制造“已改名”投影；排序锁不得拦截 Eagle 原生素材改名入口。
- `qa.85/API162` 永久标记不可发布；`qa.86/API163` 仅为自动门禁通过的源码候选，真实安装与 39→28/IMG_7517/20 项改名验收仍需总管批准。

## 2026-08-18：R99 normal presenter 只有在完整可见窗口成立时才可逐卡呈现

- 普通文件夹 route 已切到目标 folder，不等于 Eagle `allData/filtereds` 已完成该 folder 的成员补水；`folders` 正向归属证明继续保留，作为 route-first stale source 的第一道门。
- 即使 source member 已属于当前 folder，只要 rendered visible set 不是该 source member set 的完整等集，就禁止 normal L3 逐卡 `moveElementsBefore()`；此时必须记录 `SKIP_PARTIAL_VISIBLE_WINDOW` 并 zero-write/fail-open，把当前投影 ownership 交还 Eagle 原生 refresh/sortData。
- 这次修复不改变多级规则、manual overlay、锁、自动编号、改名、team sidecar 或 native `IMPORT` 意图；也不新增第二排序器、第二拖动状态机或任何真实安装动作。
- `2.5.22-qa.85/API162` 仅为源码候选：API161 永久保留给 qa.84，本次 API 递增只是消除发布身份冲突，不改变业务行为；自动证据是新增 R99 红灯转绿与完整 `npm test` 通过。未安装、未重启 Eagle、未操作真实 Library/NAS。

## 2026-08-18：R34/R97 普通 helper 投影不得截获原生拖动命中

- 普通文件夹手动拖动继续复用 Eagle 原生 `.box-sortable-helper` 作为左右落点提示，但 helper 只是 L7 视觉投影，不得成为鼠标命中面；否则按在 helper 覆盖区域时，`dragstart` 会落到 helper 而不是 Eagle 的 draggable 源，表现为同一素材既不能内部改序，也不能拖到 Finder/聊天框。
- 最小修复只给普通模式的 helper 投影追加 `pointer-events:none!important`，不改 `dragstart` ownership、不改 `dataTransfer`、不新增第二状态机，也不改变现有 drop helper/半区解析。
- 这次只形成源码候选 `2.5.22-qa.85/API162`，未安装、未重启 Eagle、未操作真实 Library/NAS。自动证据是 `plugin-integration-contract.test.js` 新增红灯后转绿，且完整 `npm test` 与 `node --check plugin.js` 通过。

## 2026-08-18：普通文件夹自动编号以真实文件夹名为准，智能文件夹核心禁用编号

- `rename-core` 的场景名提取必须容错真实 folder 名中的编号前缀、空格、连字符和中文，不再依赖只覆盖单一短横线样式的旧正则。
- 自动编号的核心计划在 `collectionKind === "smart"` 时直接返回 `smart-collection-rename-disabled`，不生成 entries/changes，也不让智能文件夹在任何调用方路径里显示或执行自动编号。
- 这次修复只收敛到 `lib/rename-core.js` 与对应回归测试，不扩大到排序状态机、手动顺序、真实改名事务或 Eagle 运行时。

## 2026-08-17：R99 normal L3 呈现采用正向所有权与完整窗口门禁

- `location.hash/currentCollection` 只证明当前路由，不证明 Eagle `allData/filtereds` 已补水到该 folder。normal presenter 必须要求每个 source item 的 `folders` 包含当前叶子 folder ID；否则 `SKIP_ROUTE_UNHYDRATED`。
- 渲染集只是完整 source member set 的部分时，几何验证不能作为原子呈现真源；返回 `partial-visible-window` 并零写入，禁止逐卡移动后同步失败再逐卡回滚。
- R99 不修改用户多级规则、3 条手动关系、锁、改名、team sidecar 或 native `IMPORT` 意图；未授权安装/重启前只能标记为源码候选。
- qa.84/API161 已通过确定性构建和安装器 `--check`，但尚未安装；现场 qa.83/API160 与打开的 Eagle 必须保留到用户再次批准。

## 2026-08-16：R98 原生排序意图高于旧插件持久值

- Eagle 原生“添加日期”等单字段选择是 collection-scoped 的显式当前意图。插件必须在把事件交还 L0 前登记该意图，并让 normal/smart collection 的 `orderBy` 成为重载镜像；旧 `PHOTO_TAKEN` 配置不得凭持久存在重新夺权。
- 排列方式只能由一个权威投影决定。原生模式只显示 Eagle 原生标签并隐藏插件规则面板；插件多级或拍摄时间模式才允许显示对应虚拟标签，禁止同时出现“添加日期 + 多级排序”的叠加 UI。
- 原生切换只授权修改当前 collection 的 Eagle `orderBy`。规则、手动关系、排序锁、自动编号、改名和团队 sidecar 均不得写入；切回多级时必须恢复原规则而非重建默认值。
- qa.83/API160 已可回滚安装为唯一来源并出现 `BOOTSTRAP_READY → INJECT_START → INJECT_OK`。真实普通与智能文件夹均证明“添加日期”稳定 5 秒、无迟到覆盖，切回多级恢复既有规则；这仍不等同于用户最终验收。

## 2026-08-15：R97 手动拖动不得被宿主视图标记或后台呈现夺权

- `item.pinned` / `.box.pinned` 属 Eagle L0 原生视图状态，不是排序锁或拖动权限。插件手动拖动的唯一拒绝来源仍是 collection 资格、目标类型、protection guard、原生筛选/预览与上下文变化。
- normal presenter 在用户拖动会话活动期间必须返回 `manual-drag-active` 并零写入；不允许 menu/watch 重投影旧 overlay 与鼠标争抢网格。
- smart presenter 仍只有一个事务执行器。相同 key 与相同 final plan/revision 共享活动事务；旧 revision 不再覆盖，新 revision 只保留最后计划顺序执行。这不是第二排序器或第二拖动状态机。
- 本故障对素材扩展名与 Library 名称零特判；视频 Library 只是因已有 pinned/manual 状态和呈现时序更容易复现。
- qa.82/API159 已于 2026-08-15 安装为唯一来源并正常重启；qa.81 保留精确回滚。运行时出现 `manual-drag-active` 证明新 normal 互斥逻辑已加载，smart UI 也已现场证明不创建自动编号行。
- Computer Use 仅发出 `dragstart` 而缺少 `dragover/drop` 时，必须取消会话并记录工具边界，禁止据此判定候选失败或伪造真实改序通过。

## 2026-08-12：R96 只有完整 host-array ownership 才可呈现排序

- Eagle 的 `allData/filtereds` 是原生集合状态，不是插件缓存。任何异步排序提交必须同时证明当前 Library、collection/route、renderer scope/generation、数组引用及 member-ID 集合未变；缺任一证据均为零提交。
- global/“全部”禁止插件数组写入。smart 的集合成员必须来自当前完整 Eagle smart query，绝不能写入全局数组；旧回调只能失效，不能尝试“补偿”或回写。
- 这项门禁不触及手动关系、排序锁、自动编号、改名、GPS 或真实 Library 数据。手动顺序的唯一清除指令仍是用户主动选择恢复自动排序。

## 2026-08-12：R95 锁定视觉回归 Eagle 原生数量数字

- 用户已明确 qa.78/qa.79 的独立红点不是原始产品效果，拒绝该 UI。最终视觉只能是 Eagle 原生文件夹数量数字变红。
- qa.80/API157 不再创建、插入或删除任何 marker 节点。当前 verified `lockStore` 仅决定对应 folder row 是否携带插件 class；CSS 只着色 `.badge.self` 的文字。数字值、DOM 内容、布局、点击/双击、右键、折叠和所有原生数据保持 Eagle 所有权。
- 原生 count 缺失时不显示替代标记，计为未投影而非写锁。侧栏 observer 仍只在原生重绘后重算 class，零写 sidecar、Library 或素材。

## 2026-08-12：R94 锁数量以当前加载状态为准

- qa.78 的 `LOCK_PROJECTION.importedLocks=0` 是诊断字段错误：同一已验签 sidecar 已导入时返回 `already-imported`，该对象没有顶层导入计数；但同一日志 `markedRows=1 + unresolvedLocks=46` 已证明当前锁存储实际有 47 把锁。
- qa.79/API156 不把“本次是否执行导入”当作锁数量，而从当前 Library `lockLibrary(false)` 的 `locked:true` profiles 读取；日志必须满足 `markedRows + unresolvedLocks = importedLocks`。这只修复读取/显示统计，零写 sidecar、Library、素材或任何 Eagle 原生状态。
- collection store 允许 URL 编码/解码同一绝对路径查到同一个已有分区；不同路径和挂载名不做规范化合并，防止跨库继承手动状态或锁。

## 2026-08-11：R93 锁存储与侧栏红标严格分离

- 只读审计确认 R91 恢复前后的 `sortingLocks.v3` 与 `folderLocks.v1` 内容 SHA 完全相同：手动顺序恢复没有删除锁。当前经过完整性验证的引力环球 sidecar 有 47 个 hard lock。
- 红标消失属于显示投影故障，不能通过重写锁数据、按文件夹名称猜测或触碰 Eagle native badge 解决。qa.78/API155 只添加插件自有、幂等、ID 对齐的 marker 与侧栏重绘观察器；该观察器零写入 Eagle/sidecar，零触碰排序、原生筛选、预览、右键、拖放与其它 L0 功能。
- 历史快照唯一多出的 `MB3Y67Y8494GH` 在同 writer 后续 6 秒签名快照中已不存在，无法区分主动解锁与旧同步丢失；当前不恢复。截图杭州父目录及可见大多数子项在全部已登记历史状态中从未被锁定，也不新增。
- `LOCK_PROJECTION` 只记录导入锁数与已渲染 marker 数，是运行态诊断，不构成红标已在用户界面显示的验收。最终仍由用户在真实 Eagle 验收。

## 2026-08-11：R92 无手动档案时必须零恢复、零阻断

- `collectionRuntime.profile(..., false)` 返回 `null` 表示该 collection 没有用户手动排序意图；这在全局视图、空集合、首次进入普通/智能文件夹和切库启动都是正常状态。
- 不存在 profile 必须直接保留 automatic/fail-open；不得进入 R91 legacy recovery、读取 `.order`、创建空覆盖或阻断插件注入。
- qa.76 的 null dereference 已在真实启动日志确认，整包废弃。qa.77/API154 将该门禁写为先红后绿的永久 R92 回归；真实界面验证前仍只是候选。
- qa.77 已经正常安装并重启，当前启动记录为 `INJECT_OK`；这只证明插件未再因空 profile 阻断注入，不能替代用户对手动顺序和原生界面的最终验收。

## 2026-08-11：R91 用户手动顺序是不可降级的最高数据

- 用户明确手动排序属于最高优先级状态；自动排序、锁定、刷新、升级、重启、同步、切库及任何兼容迁移均无权覆盖、忽略、清除、重算或降级它。唯一清除入口是用户明确“恢复自动排序”。
- v2 完整顺序不是可丢弃的兼容字段。qa.75 错误地把 hard lock 和完整成员集合当成恢复前提，现已撤销。只需同一 Library identity、collection ID、已验证 sidecar integrity 与存储 ID 证明；锁定或未锁定均恢复。删除 ID 只跳过并连接两侧幸存 ID；新增 ID 不猜关系，保留基础顺序。
- `manual-order-recovery-core` 的 preview 与 commit/rollback 为唯一恢复事务；团队同步在检测到 `legacyFullOrder + empty relations` 过渡状态时必须熔断，禁止自动写 sidecar。
- 引力环球视频现有 sidecar identity 错配；在独立证明前，禁止复制、映射或迁移其中任何顺序。

## 2026-08-10：R89 原生筛选高于插件排序呈现

- Eagle 原生标签、格式、文件夹、颜色、评分等筛选以及关键词搜索先决定“哪些项目存在于当前结果”。插件只可排列这个结果，不能用完整智能文件夹快照覆盖成员集合。
- 当前实现采用安全 fail-open：`filterBadge > 0` 或 keyword 非空时，智能自动 PRESENT、宿主数组提交、READY 提交和手动拖动全部停止；清除筛选后自动恢复既有智能排序。
- 本修复不修改普通文件夹排序、比较器、手动关系存储、改名、GPS/标签写入或 NAS 素材。

## 2026-07-28：排序运行时只允许一个显式顺序权威

- 用户确认排序权限从高到低为：排序锁定 guard、用户手动顺序、插件自动排序、
  Eagle 原生排序；锁定只冻结当前最终顺序，不自行产生或恢复顺序。
- 手动拖动是普通/智能 collection 的默认能力，删除业务启停开关。旧
  `manualMode.v1` 只保留为迁移输入，不能继续决定拖动资格。
- 自动、手动和原生模式必须通过唯一顺序协调器输出显式 authority。自动模式不得
  悄悄叠加旧 manual view；手动模式必须如实报告。只有“恢复自动排序”可以清除
  当前 collection 的手动覆盖。
- 自动编号和安全重命名永远是最终顺序的下游动作，禁止重新读取 raw、DOM、拍摄时间
  或旧手动数组重新决定顺序。
- 真实 Eagle 最终可见 ID 顺序是发布真源。manual overlay 不得再让拍摄时间现场自检
  无条件通过；任何可见顺序违规都必须阻断安装与发布。

## 2026-07-23：排序只拥有有效网格内 drop

- 排序扩展无权取消照片卡片的 Eagle 原生 `dragstart`，也无权修改原生 `dataTransfer`。
  拖到 Finder、桌面、聊天框、上传框、其它应用或 Eagle 非排序目标必须保持原生行为。
- 手动排序只在一次原生拖动已经进入另一个有效网格卡片落点时接管 `dragover/drop`；
  网格外路径不阻止事件、不改顺序、不写手动状态、不编号。
- 此决定取代“捕获并取消原生 dragstart，再用 mousedown/mousemove/mouseup 排序”的实现。
  唯一拖动链现在是“原生 dragstart -> 有效网格 drop 才排序 / 其它目标继续原生拖放”。

## 2026-07-23：排序规则只允许一个规范来源

- `docs/SORTING-RULES.md` 是排序对象、范围、优先级、触发权限、编号、保护、失败和
  真实界面验收的唯一现行规范；README 只提供入口说明，永久回归合同只记录旧故障。
- 手动拖动输入开关与已保存手动顺序必须作为两个独立状态。关闭开关不能删除、停用、
  重算或刷新顺序；只有用户明确点击“重置顺序”有清除权限。
- 历史决策与现行规则冲突时保留历史记录但明确标为已取代，不得让旧说明继续指导代码。

## 2026-07-23：排序只保留唯一原生链路

- 用户明确拒绝独立 3.0 原型界面；当前唯一维护版本是 `extensions/media-organizer`
  的 Eagle 原生照片网格排序工作流。任何 v3 原型、候选包或第二套排序 UI 都不得再
  作为用户验收对象。
- 编号计划以完整真实可见卡片顺序为最高输入。手动拖动仍是用户意图最高优先级：
  拖动先改出可见顺序并保存用于刷新/重启恢复；编号不得从旧手动缓存、拍摄时间、
  `bodyScope.raw`、旧 `allData` 或陈旧 bulk selection 重新决定顺序。
- 自动编号执行只允许通过后台安全批任务进入 Eagle 原生 `ayncsImagesChange`，每批
  最多 3 项并做磁盘/元数据校验；当前文件夹完成后禁止整页刷新。真实界面仍是唯一
  验收标准，源码和自动测试只算开发预检。
- 若编号任务中断后留下 `__eagle_number` 内部临时名，恢复也必须走同一条原生改名
  管线：按 item ID 验证当前临时名、metadata 和唯一真实文件完全一致，再分批恢复到
  备份原名。状态不一致时拒绝执行；禁止直接写 `.library` 或按名称猜测。

## 2026-07-22：团队旧保护恢复为最高级硬锁

- 用户确认锁定是排序系统最高权限：开启后任何排列、升降序、多级规则、手动顺序、
  自动编号或文件名操作都不得修改该文件夹；只能先明确关闭锁定。
- `folderLocks.v1` / `protection.v2` 的 17 条真实团队保护不得只作为后台诊断。首次
  读取时合入 `sortingLocks.v3` 并在高层开关显示已勾选；现有 3 条新硬锁原样保留。
- 旧保护解除后保存显式抑制标记，避免下一次团队状态自动读取时复活；旧 809 条项目
  顺序仍只作诊断，绝不写入当前手动顺序。
- 锁定保护的是图片排序顺序和文件名，不保护显示简介等纯展示设置；展示设置仍可
  递归应用到锁定文件夹。所有会改排序或文件名的批量入口必须跳过并报告锁定项。

## 2026-07-22：应用到全部先同步状态，保护只拦截破坏性执行（锁定边界已被上方决策取代）

- 手动拖动、自动编号开关和显示简介是文件夹配置状态。父层点击`应用到全部`后，
  当前文件夹与每一级后代都必须保存并读回相同状态，旧配置保护或新排序锁不能让
  开关继续显示未勾选、简介继续显示旧选项。
- 排序保护仍拦截排列配置覆盖；自动编号必须把“开关同步”和“真实文件名修改”拆开：
  所有后代显示已开启，受保护文件夹不执行重命名，并在结果中列出跳过数量和名称。
- 批处理状态绑定发起时的`sourceContextId`。离开发起文件夹后不得显示其进度或结果，
  返回发起文件夹时才恢复显示；禁止在土耳其目录显示中东目录的旧批处理消息。
- 全局`全部`上下文不执行文件夹级功能，主窗口桥接不得指纹、克隆或传输整库素材。
  这条边界用于避免约2.4万项目每秒跨窗口复制，不能再依赖调用方事后忽略。

## 2026-07-22：NAS 缩略图与截图延迟作为 SMB 元数据问题独立处理

- Eagle 日志证明 Shift+X 在 2.5.20 之前已有约60至80秒的截图导入延迟；截图先在
  本机生成，随后添加到 NAS Library，不能把该历史故障归因于本次递归状态补丁。
- 当前 NAS 往返延迟约0.5ms，已知素材`stat`约0.02秒，但 Library 的`images`单目录
  约有2.4万子目录，SMB 冷枚举可长时间阻塞。缩略图空白、Eagle“即将完成”和截图
  导入慢共享这条元数据瓶颈。
- 插件必须移除自身整库轮询负担，但不得声称能修复 NAS 目录架构。长期方案应评估
  本地 Library、NAS 服务端目录性能或 Library 分库，且不得手工重组`.library`。

## 2026-07-22：手动拖动批量下发复用统一递归事务

- `手动拖动`的`应用到全部`必须与排列、简介等批量能力共用
  `folderTreeBatchRuntime.applyToFolderTree`，不能维护独立递归循环。
- 批量确认必须显示总范围与保护跳过项；完成后在原操作行下方持续显示成功、失败、
  跳过数量和代表性名称。任何写入失败都不能静默显示成功。
- 当前文件夹和全部深层后代写入内存后只持久化一次；持久化失败必须恢复批量前状态。
  重复执行同一开关必须幂等，不影响自动编号、排序方式或其它独立状态。

## 2026-07-22：插件启动先服从 Library 可用性

- Eagle 4.0 在 NAS Library 启动时会先枚举约 24,000 个`images`目录项；SMB 重连或
  目录响应慢时会长时间显示“即将完成”。插件不得在 Library 主界面未就绪时主动
  创建服务窗口或抢先注入。
- 2.5.19 采用`serviceMode=false`、`keepAlive=true`：用户每次 Eagle 会话从插件菜单
  打开一次后，本次会话保持注入。自动启动恢复前必须在隔离测试库证明不会阻塞宿主。
- NAS 启动故障先用 Eagle 日志区分`Library missing`、`Get /images folders...`和
  `Library loaded`，不得把 SMB 目录枚举等待误判为 Library 损坏或直接修改`.library`。

## 2026-07-23：排序自动启动，地点整理按需启动

- 上述 `serviceMode=false` 的临时启动策略结束。排序是 Eagle 原生排列面板的扩展，
  必须随 Eagle 自动加载，用户不得为了排序去打开“媒体智能整理”地点标签窗口。
- `serviceMode=true` 只启动轻量排序注入和当前集合监控；继续等待真实 Library 与主
  界面就绪，并保持“全部/未知上下文不扫描整库”的边界。
- GPS 读取、地点识别轮询、文件夹标签界面仍只在用户明确打开“媒体智能整理”后
  初始化。自动排序启动不得顺带启动标签业务或全库处理。

## 2026-07-22：智能集合禁止回退整库 raw

- `currentSmartFolder` 与残留 `currentFolder` 同时存在时，集合适配器必须选择智能
  集合；所有规则、简介、锁、手动视图和上下文 ID 均按智能集合隔离。
- `allData/filtereds` 是当前视图数据，`raw` 可能是完整 Library。智能结果为空时
  返回空数组，禁止以整库作为降级数据源。
- 后台轮询只传输当前结果；需要拍摄时间时以当前 ID 调用 `eagle.item.getByIds()`
  分批解析。切换瞬间必须等待集合 ID 与项目指纹稳定，不能扫描上一智能视图。

## 2026-07-22：当前层自动编号必须消费最终排列结果

- 自动编号是排序后的命名动作，不是另一套排序器。多级排序或拍摄时间排序
  激活时，编号输入固定为 `sortDesired(..., sortConfigFor(orderBy))` 的最终顺序。
- 显式手动拖动覆盖仍是最后一层；如果存在，编号按手动调整后的顺序执行。
- 原始 `bodyScope.raw` 只是素材集合，不能再被解释为当前可见顺序。

## 2026-07-22：当前层对象、递归后代与硬锁优先级

- 当前层开关只作用于当前容器的直接对象：有直接子文件夹时拖动/编号子文件夹；
  叶子层拖动/编号直接媒体。只有各行右侧`应用到全部`才递归下发到全部后代。
- 三个高层功能正式命名为`排序锁定`、`手动拖动`、`自动编号`，每行独立批量按钮；
  无后代时隐藏该行按钮，排列方式自己的批量按钮继续留在排列区域。
- `sortingLocks.v3` 是最高优先级硬锁。锁定后禁止修改排列、规则、手动顺序和执行
  媒体/文件夹编号；关闭锁定后才能继续操作。
- `manualMode.v1`只保存每个普通/智能集合是否允许手动拖动，`manualViews.v2`仍只在
  真实拖动后保存顺序。父层子文件夹拖动使用 Eagle 原生`currentFolder.children`和
  `saveFolder()`，不把`allData/raw`误当成文件夹卡片数据。
- 父层自动编号解析全/半角数字和多种连接符，统一生成`1-名称`；执行前逐项预览，
  使用临时名/最终名两阶段计划并保留撤销事务。不得直接改写`.library`内部结构。
- 旧`protection.v2`的17个状态自动升级为可见硬锁，809条旧顺序继续忽略。

## 2026-07-22：内联多级规则以排列下拉框为可见状态真源

- 决定：多级规则编辑器的显隐直接读取用户眼前的排列下拉框选中值，不再只依赖
  Eagle 文件夹模型的异步 `orderBy`。
- 决定：Eagle 重绘排列区域后，插件必须把现有规则区重新放回排列栏正下方；选择
  `多级排序`后立即展开，规则可原位反复修改，不需要切换到其他排列方式再切回。
- 验收：布局自检必须验证规则区真实可见性、与排列栏相邻，以及临时选择多级排序
  后规则区确实展开；只检查 DOM 存在不再算通过。
- 诊断：保护迁移统计必须报告迁移后当前总量，而不是本次新增数；重复启动仍应显示
  17 个配置保护和 809 条已忽略 legacy order。

## 2026-07-21：集合级功能与排列方式分层，拍摄时间与多级排序并列（开关文案与锁语义已由 2026-07-22 决策取代）

- 决定：界面优先级固定为“三个高层开关 → Eagle 排列方式 → 内联多级规则 →
  排列应用到全部”。顶部框只含防止全局覆盖、临时拖动、自动命名编号；三个开关
  始终显示，不因单级、多级或原生排列方式切换而隐藏。
- 决定：文件夹级“应用到全部”属于排列层，不是第四个高层开关；它复制当前排列
  方式、升降序和多级规则，并跳过受保护文件夹。
- 决定：`拍摄时间排序`是独立的单一排序键；`多级排序`是可自由组合文件名、
  拍摄时间、尺寸等键的组合机制。禁止继续使用“多级拍摄时间排序”混合名称。
- 兼容：历史 `PHOTO_TAKEN` 保留为多级排序持久化键；新单一拍摄时间入口使用
  `PHOTO_TAKEN_AT`，避免把既有多级规则误解释成单一时间排序。
- UI：三个开关的容器插入 Eagle 原生 `sortPanel` 之前；多级规则编辑器位于其后，
  选择多级排序时直接内联展开，不使用独立弹窗，且可随时修改。

## 2026-07-20：排序配置保护与手动视图彻底分离（关闭手动即清序已被 2026-07-23 决策取代）

- 决定：`protection.v2` 只阻止上级或批量“应用到全部”覆盖集合排序配置；它不保存
  或返回素材 ID 顺序。
- 决定：`manualViews.v2` 是普通/智能集合专属的可选视图覆盖，只有明确拖动后创建；
  关闭临时拖动或重置时回到 schema v3 比较器结果。
- 迁移：17 个 `folderLocks.v1` 状态迁为配置保护；809 个旧 `order` 项仅保留忽略
  计数，不能迁为手动顺序。旧 key 暂不删除，作为回滚输入。
- 原因：艺术展 48 项的比较器本身正确，错误来自保护快照经 `activeManualOrder()`
  覆盖比较器，导致旧 visible 违规 7。

## 2026-07-20：普通与智能文件夹共用 schema v3 排序引擎

- 决定：单级/多级只描述排序机制；拍摄时间是普通键，`1-/2-` 是文件名键的解析
  选项，不再保留含义重叠的独立排序世界。
- 决定：普通与智能集合共享比较器和结果模型，但规则、保护和 manual view 按集合
  类型隔离；智能视图拖动不污染来源普通文件夹。
- 决定：智能文件夹改名前必须显示逐项预览和来源文件夹影响数；智能“应用到全部”
  只指当前智能视图，不递归或改写来源目录。
- 安全边界：不为智能排序手工修改 `.library` 内部结构。

## 2026-07-20：团队交接工具固定放在页面最底部

- 决定：“团队排序与展示状态”整块固定在插件页面最底部，位于日常整理、全库统计
  和离线隐私说明之后；不能占用首屏。
- 原因：发布、导出和导入只在电脑或团队交接时使用，日常高频工作应直接从当前
  文件夹扫描和地点整理开始。
- 影响：移动只改变展示顺序，不改变 sidecar 自动读取、发布/导入语义、自动编号
  风险隔离或任何 Library 数据。
- 验收：必须在 Eagle 完整重启后同时检查首屏和页面底部，因为 `serviceMode` 会在
  关闭插件窗口后继续缓存旧页面。

## 2026-07-19：团队排序状态使用 Library 同级 sidecar

- 用户需要把完整 Library 与插件交给团队成员后，在另一台电脑看到相同的排序、
  保护和展示结果；仅把状态固定内置进某一个插件包无法覆盖后续继续整理的变化。
- 正式母版采用 `<Library>.eagle-team-state.json`，位置在 `.library` 同级，不进入
  Eagle 私有目录结构。发布是显式动作，接收端启动或切换 Library 时自动读取。
- 状态按 Eagle 文件夹 ID 和素材 ID 接力，不按名称猜测。schema v2 保存完整文件夹
  ID 清单与哈希；自动读取要求至少 80% 源 ID 命中且至少命中 3 个（不足 3 个时
  要求全部命中）。
- 接收端允许 Library 新增文件夹；源状态中已删除的文件夹作为缺失报告，不导致
  静默成功。明显不同的 Library 直接拒绝。
- 自动编号开关必须被导出以保证状态包完整，但不得在接收电脑自动启用，因为插件
  可能立即修改真实文件名。接收人必须在目标文件夹再次明确启动。
- 团队发布不会反向自动上传本机变更，避免普通成员覆盖母版。只有点击“发布团队
  状态”的电脑才写 sidecar；其他电脑默认读取。

## 2026-07-19：团队状态只在真实 Library 作用域就绪后导入

- 决定：`bodyScope.rootDir` 为 `default` 或不是 `.library` 路径时不导入团队状态；真实 Library 加载后再执行一次校验、合并和内存刷新。
- 决定：编码路径与解码路径按同一 Library 处理；导入时合并已有其它资料库状态，不用交接包整包替换 Local Storage。
- 原因：Eagle 启动早期主界面已可注入，但 NAS Library 路径尚未就绪，旧逻辑会把 17 条锁定记录写到 `default`，导致实际文件夹查询不到。
- 恢复边界：写入前继续保存 Local Storage 回退快照；自动编号键仍默认跳过，不修改 `.library` 内部结构。
- 安装约束：Eagle 会扫描 `Plugins` 下改名为 `.disabled-*` 的目录；同 ID 旧插件必须移出 `Plugins` 根目录，不能只改目录名。

## 2026-07-19：保护开关提升为排序系统高层级能力（顺序快照语义已被 2.5.0 取代）

- 决定：保留旧文案“防止全局覆盖”，并把开关从旧排序规则面板提升到集合级功能区；无论当前是标题、尺寸、名称、拍摄时间或多级排序都始终显示。
- 决定：保护快照包含原生 `orderBy`、`sortIncrease`、多级规则和当前顺序；切换排序方式不关闭、不隐藏、不重置保护状态。
- 决定：递归排序、显示简介和自动编号遇到锁定文件夹时跳过该文件夹自己的排序配置，并继续处理递归范围中其它未锁定文件夹；结果中列出跳过的文件夹名称。
- 原因：团队交接状态中 `9-杭州 / 散组` 的 17 个保护状态位于其直接子文件夹；父级隐藏开关会让用户误以为保护状态未迁移。
- 影响：锁定状态更容易在父级确认；保护能力不再被误解为多级排序的附属选项。
- 安全边界：只读取 Eagle `.library/metadata.json` 做 ID 对照，不直接修改 `.library` 内部结构；保护状态仍保存在插件 Local Storage 的 `eagle.photoTakenSort.folderLocks.v1`。

## 2026-07-19：团队排序状态按 Library 路径重映射导入

- 决定：团队排序接力使用内置 `.eagle-sort-state.json`，启动时校验格式、schema 和 payload SHA-256，再把源电脑 Library 路径键映射到当前 `bodyScope.rootDir`。
- 决定：导入排序规则、防止全局覆盖顺序、显示简介字段和升降序状态；默认跳过 `eagle.photoTakenSort.autoRename.v1`。
- 原因：同一个 `.library` 迁到 NAS 或其他电脑后，Eagle folder/item ID 保持一致，但 Local Storage 的 Library 路径键不同，必须在插件层重映射。
- 影响：团队电脑安装后可读取已完成的排序状态；自动编号不会因启动导入而立即修改 Eagle 名称或实际文件名。
- 安全边界：只写插件 Local Storage，并在写入前保存回退快照；不复制 Chromium LevelDB，不直接修改 `.library`。

## 2026-07-19：文件夹级“应用到全部”统一语义

- 决定：所有文件夹级批量按钮统一显示短文案“应用到全部”，真实范围通过确认弹窗、hover 提示和结果消息说明为当前文件夹及全部子文件夹。
- 决定：排列批量应用复制当前 Eagle 排列方式和升降序；当当前排列方式是“多级排序”时，额外复制插件多级规则。
- 决定：显示简介、内置排列、多级排序和自动编号复用统一的递归文件夹目标收集与失败汇总逻辑。
- 原因：避免不同选项各自实现递归，导致深层子文件夹、空文件夹、锁定跳过和部分失败语义不一致。
- 影响：批量操作仍是一次性复制，不建立持续继承；单个文件夹后续修改只影响该文件夹。
- 安全边界：插件只通过 Eagle 当前文件夹对象和 Eagle 保存流程写设置，不直接批量修改 `.library` 内部文件；资源库路径不可用或 NAS 离线时显示失败，不报成功。

## 2026-07-19：树级自动编号必须两步启动

- 决定：父级当前层没有可重命名媒体时，勾选“自动编号”只进入准备状态，不再自动启动整棵文件夹树处理。
- 决定：树级自动编号必须先勾选“自动编号”，再点击“应用到全部”；未勾选时点击批量按钮只提示先勾选。
- 原因：大集合文件夹可能包含上万媒体，单次误点会触发长时间读取和潜在大规模重命名。
- 影响：当前文件夹有可重命名媒体时，仍保留原来的预览确认流程；树级批量比本地单文件夹操作多一道明确启动动作。

## 2026-07-18：保留 Eagle 恢复备份

- 决定：迁移时保留 `backups/` 中的原始 `app.asar`、哈希和地域状态备份。
- 原因：本扩展包含 Eagle 主程序桥接，恢复能力是安全边界的一部分。
- 影响：备份文件虽不是源码，仍作为受控恢复资产保留；不得随意删除。
- 未来复查条件：Eagle 升级并建立新版本桥接和恢复基线后。

## 2026-07-18：不对未知 Eagle 复用桥接整包

- 决定：build 23 桥接载荷只匹配已知原始 `app.asar`，不提供跳过校验或强制安装模式。
- 原因：桥接位于宿主内部实现，Eagle 升级后即使显示版本相近，文件布局和代码也可能变化。
- 影响：另一台电脑先做只读兼容性检查；不匹配时保留插件包但停止桥接安装，等待针对该 build 重新审计。

## 2026-07-23：排序锁定是纯 guard

- 决定：勾选或取消「排序锁定」只保存保护状态，不排序、不刷新列表、
  不重命名、不重捕获手动顺序，也不应用任何历史快照。
- 决定：受保护集合可以读取拍摄时间用于显示，但扫描结束不得调用
  `refreshMainList()`；后台监控和「打开插件」必须共享这一限制。
- 决定：取消锁定时清除旧的自动编号计时器，只同步当前预览签名，
  禁止解锁动作补执行旧的重命名计划。
- 验收：真实 `3-Seven Hills` 59 项在打开插件、解锁、再锁定后的可见顺序
  和文件名指纹完全一致；不把这一项通过扩大宣称为其它场景「0 bug」。

## 2026-07-23：自动编号只消费最终画面顺序（成员变化触发已被后续决策取代）

- 决定：当前文件夹编号优先读取 `#box-list .box[data-box-id]` 的完整 DOM 顺序，
  再按 ID 映射回素材；不得直接把 Eagle 的 `allData` 工作数组冒充最终画面顺序。
- 决定：拍摄时间是否存在、是否读取完成都不影响编号资格。DOM 尚未完整渲染时，
  使用统一排序核心生成完整顺序，不对局部页面静默编号。
- 决定：拍摄时间回填和普通界面刷新不得触发自动重命名。自动模式只响应项目集合
  增删和用户明确手动拖动，规则改变仍由用户看到当前画面后确认编号。
- 决定：手动顺序继续按 Library 与 collection ID 持久化，撤销历史继续保留；
  拖动次数不保存、不通过 API 暴露、也不在界面显示。
- 原因：真实 `4-harrat餐厅` 证明 `allData` 与 DOM 最终顺序可能不同，且元数据扫描
  会在插件打开后异步完成；旧逻辑因此会在一次正确编号后再次改动大量文件名。

## 2026-07-23：手动拖动只消费最终画面顺序

- 决定：媒体拖动和自动编号共享同一完整渲染卡片顺序来源；禁止拖动继续使用
  Eagle 的 `allData` 工作数组推断用户眼前的相邻位置。
- 决定：拖动资格、源素材、目标素材和结果均不检查拍摄时间。无时间素材与有时间
  素材具有完全相同的拖动能力；拍摄时间只参与用户显式选择的排序比较规则。
- 决定：后台自动集成检查必须只读，不得调用真实放置、写手动顺序、刷新列表、
  调度自动编号或清空撤销历史。真实拖动验证只能由明确的现场验收动作触发。
- 回退：只有完整 DOM 卡片 ID 与当前集合项目一一对应时才采用画面顺序；虚拟渲染、
  重复 ID 或集合切换残留时回退当前集合数组，不读取整库。

## 2026-07-23：手动拖动必须有鼠标事件备用入口（双入口已被后续单状态机决策取代）

- 决定：保留 Eagle 卡片已有的 HTML5 拖放入口，同时增加 `mousedown/mousemove/mouseup`
  备用链路；移动不足 7 像素只按普通点击处理，超过阈值才进入手动排序。
- 决定：备用链路按鼠标所在卡片的左右半区选择前插或后插，最终仍调用统一的
  `performManualDrop()`，不得另建一套拍摄时间或数组顺序逻辑。
- 原因：真实 `4-harrat餐厅` 中无拍摄时间素材具备 `draggable=true`，但宿主未稳定
  触发原生 `dragstart`，导致落点算法修复后用户仍只能选中卡片。
- 安全边界：排序锁定继续拦截两种入口；全局视图、表单控件和固定素材不启动备用
  拖动；自动编号是否开启与拖动资格无关。
## 2026-07-23：用户已报故障成为永久发布门禁

- 决定：`docs/PERMANENT-REGRESSION-CONTRACT.md` 是本插件的强制发布契约。
- 决定：手动拖动验收从“一次成功”提升为“同一真实文件夹连续 20 次成功”，
  同时覆盖无拍摄时间素材、自动编号预览、刷新、切换文件夹和重启持久化。
- 决定：此前“保留 HTML5 拖放入口，再增加鼠标备用入口”的决定被现场证据推翻。
  两条链路会竞争并清理对方状态；今后只允许一条鼠标拖动状态机，HTML5 `dragstart`
  只负责取消宿主原生拖放，不得执行放置。
- 决定：手动顺序一旦存在，就是当前 collection 的唯一顺序真值。拖动、显示、
  持久化和自动编号不得再优先读取 DOM、`allData`、拍摄时间或原始数组。
- 决定：同一 API 版本的重复注入必须直接复用第一次已完成的主窗口实例，
  不得重置 handler、拖动状态、自动编号计时器或手动顺序。
- 决定：主窗口单例不足以阻止两个插件后台竞争。只有目录名为
  `com.max.eagle-photo-taken-sort` 的正式安装实例可以启动监控、扫描和编号；开发源码
  路径即使仍在 Eagle 开发插件列表中也必须完全静默。
- 决定：永久合同采用只增不减的回归 ID。新故障必须先登记唯一正确行为和复现门禁，
  再完成代码修复；自动测试会检查 R01-R26、关键语义和证据文件仍然存在。
- 决定：一次修复只有同时具备代码、自动测试、真实 Eagle 现场和安装指纹四类证据，
  才能标记为已完成。只通过自动测试时只能称为候选，不能请用户验收。
- 决定：手动拖动后自动编号是独立永久场景。每次有效放置先保存手动权威顺序，再只
  调度一次当前 collection 的安全后台编号；元数据回填、打开插件、普通菜单刷新和
  锁定开关都不得调度编号。
- 决定：真实 Eagle 界面的最终显示是唯一验收真源。自动测试、源码断言、模拟适配器、
  日志、API 返回和理论推导只用于开发排错，不能单独或组合宣布通过。
- 决定：任何内部证据与真实界面冲突时，以界面为准并直接判定版本失败。编号验收必须
  从左到右、从上到下逐张确认真实名称连续，不能用“已完成”提示代替结果检查。
## 2026-07-23：编号必须使用 Eagle 原生文件改名管线

- 决定：自动编号路径永久禁止使用 `item.save()` 改名称；每个临时名和最终名都必须
  通过主窗口 `ayncsImagesChange` 提交给 Eagle 原生 `images-change` 管线。
- 决定：每一步提交前检查源文件存在且目标不存在，提交后检查新真实文件存在、旧文件
  消失且 `metadata.json` 名称一致。任一条件失败立即停止，不得显示成功，并使用同一
  原生管线回滚。
- 决定：快速连续拖动使用 1200ms 静默期，只保留最新手动权威顺序；已有编号批任务
  运行时记录后续请求，当前任务完成后再按最新画面串行处理，禁止重叠编号。
- 现场证据：`4-harrat餐厅` 88 项中有 53 项元数据名与真实 JPG 名不一致，刷新后大面积
  空缩略图并在拖动时弹出“找不到文件”。真实 Library 恢复必须单独批准，不能把源码
  修复或自动测试冒充恢复完成。

## 2026-07-23：当前文件夹编号禁止完成后全量刷新

- 决定：当前文件夹自动编号已经通过 Eagle 原生 `ayncsImagesChange` 更新活动卡片，批次
  完成后不得再调用 `api.refresh()` 或 `refreshMainList()`。跨文件夹树批处理最多保留一次
  完成刷新。
- 原因：真实 `4-harrat餐厅` 快速拖动后，编号完成链路连续执行两次全量刷新，造成网格
  缩略图成片变暗或空白，数秒后才恢复；这属于用户可见失败，不能按“最终恢复”放行。
- 门禁：永久回归新增 R27；连续 20 次真实拖动期间必须从放置到编号完成持续观察网格和
  右侧预览，任何短暂空白、破图或预览消失都判失败。

## 2026-07-23：安全编号内部阶段不得进入真实界面

- 决定：`__eagle_number` 只允许存在于后台文件事务，永远不得显示在网格名称、右侧
  名称框或任何用户可见位置。
- 决定：临时名阶段和最终名阶段分别整批提交给 Eagle 原生 `ayncsImagesChange`，每批
  仍须完成真实文件、旧路径和 `metadata.json` 一致性验证后才进入下一阶段。
- 决定：事务期间以 item ID 隔离可见业务名，保持缩略图和预览继续使用 Eagle 当下真实
  路径；批次成功后才把最终名称提交给当前集合模型，失败则让原生回滚结果恢复显示。
- 门禁：永久回归新增 R28；任何一帧出现内部临时名、空名或错误业务名都直接判失败。

## 2026-07-23：自动编号不得触发 Eagle 原生大进度层

- 事实：Eagle 主窗口在后台 `metadataQueueLength > 3` 时打开“正在处理 N 个更改”进度层。
- 决定：安全编号的临时阶段和最终阶段仍严格分离，但每阶段最多提交 3 项；每组完成
  真实文件、旧路径和 `metadata.json` 验证后才提交下一组，禁止一次压入整个集合。
- 决定：最终名称落定后调用当前选中项更新以修正右侧检查器和预览路径，不调用全列表
  刷新。永久回归新增 R29；真实界面出现大进度层或右侧预览丢失即判失败。
# 2026-07-23：拖动编号必须即时反馈，安全落盘不得重复串行预检

- 事实：真实 `4-harrat餐厅` 中只交换 2 个编号，后台安全改名耗时曾分别达到约 20 秒和
  25 秒；同一链路也有约 3 秒完成的记录，证明主要抖动来自 NAS 原生改名与重复串行
  校验，不是排序比较计算。
- 决定：手动放置完成后立即按该次最终手动顺序生成编号计划并在原生网格显示最终业务名；
  两阶段原生改名继续后台串行，失败时恢复真实结果并明确报错。
- 决定：每个原生批次内，各项目的源路径、目标路径和 `metadata.json` 校验并行执行；
  第一临时名阶段已经包含完整旧名、身份和目标冲突校验，禁止在它之前再逐项重复一轮
  相同磁盘预检。静默期固定为 400ms，只合并连续快速拖动，不得制造秒级空等。
- 门禁：永久回归新增 R30。真实界面必须记录放置到可见编号、放置到安全落盘完成两段
  时间；任何 10 秒无界面反馈都直接失败，后台安全性仍须同时满足 R24-R29。

## 2026-07-23：集合成员变化永远不是编号触发器

- 事实：真实 `9-棕榈岛游艇` 在切换进入、分页或列表逐批补全时，被每秒成员指纹监听
  误判成用户改序，未经拖动就创建 165 项、两个阶段共 330 步的整夹编号任务。
- 决定：彻底删除成员指纹监听器及其状态，不再尝试区分“真实增删”和“分页补全”。
  文件夹切换、分页、刷新、启动和列表补全全部是只读上下文事件，无权调度自动编号。
- 决定：编号任务只允许两个入口：用户完成一次明确有效的手动放置，或用户在编号预览中
  明确确认执行。任何新的后台推断入口均违反永久回归 R31。
- 解释：不同文件夹此前反应不同来自项目数和加载节奏差异，不是产品语义差异；所有普通
  文件夹、智能集合和不同层级必须遵守同一触发权限。

## 2026-07-23：手动拖动开关只控制输入权限

- 决定：用户完成一次手动拖动后，该顺序就成为集合的持久顺序；关闭“手动拖动”只禁止新的拖动，不得删除、停用或重算已保存顺序。
- 决定：已保存手动顺序无论开关开或关，都是显示、刷新、文件夹切换、重启和自动编号的唯一权威。
- 决定：只有用户明确执行“重置顺序”才能清除手动顺序，任何二元开关、刷新、恢复或保护动作都无此权限。

## 2026-07-23：排序模块进入结构化迁移冻结期

- 事实：`plugin.js` 同时拥有 A/C 生命周期、宿主注入、监控、状态和 UI；排序内部仍有
  两条拖动路径、两条改名路径及 DOM/raw/manual/保护/文件名多事实源。
- 决定：冻结 `2.5.21 / API 77`，保留 API 75 完整目录回滚点；R01-R33 均未封板，
  R34 最新现场明确未通过，当前版本不得发布。
- 决定：任何新修复必须先查 `docs/SORTING-BUG-LEDGER.md`，登记受影响和冲突 R-ID，
  先写失败测试，再只修改目标 L 层。旧回归测试不得删除或弱化。
- 决定：自动编号只有有效网格内 MoveCommand 和用户确认预览两个计划入口；保护只做
  allow/deny；关闭手动输入不得改变已有 ManualView；网格外拖放完全归 Eagle。
- 决定：按 `docs/SORTING-MIGRATION-PLAN.md` 分批迁移。第一批只建立 A 独立生命周期、
  Host/Event adapter 和事件 ownership 契约，不迁移改名、不安装、不操作真实 Library。

## 2026-07-23：批次 1 边界 facade 已建立

- 决定：A 通过 `module-lifecycle.js` 管理自己的启停、开关和资源清理；关闭 A 只能释放
  A 资源，不得触碰 B/C 或 Eagle 原生状态。
- 决定：普通/智能集合通过同一 `HostPort` 进入 `host-adapter.js`，输出带 Library ID、
  collection ID、revision、members 和 targetKind 的 snapshot；全部/未知上下文受控拒绝。
- 决定：`event-ownership.js` 默认交还 Eagle；只有当前窗口、当前 collection、有效网格
  `dragover/drop` 才允许 A 取得 ownership。`dragstart`、跨应用、侧栏、跨窗口、取消和
  离开窗口永远不调用阻止方法。
- 决定：本批只提供旧实现兼容 facade 和 fake host 证明，不把 facade 假装成真实 Eagle
  已接入；R21 自动编号执行链和 R34 原生拖出继续红灯。

## 2026-07-23：批次 2 接入排序生命周期与唯一编号队列

- 决定：注入侧所有排序监听器由 `startSortingModule/stopSortingModule` 管理；资源必须
  通过 disposer 逆序释放。外层 `sorting-module-facade` 只用显式 bridge 驱动，不接管
  B/C 生命周期。
- 决定：`dragstart` 永远归 Eagle；`dragover/drop` 先经过同一 ownership 判定，未知、
  网格外、跨窗口、跨应用和离开窗口不调用任何阻止方法。`performManualDrop` 不再拥有
  `preventDefault/stopPropagation` 权限。
- 决定：R21 只有一条命令链：有效 drop 生成带 collection/snapshot/signature 的命令，
  先 `enqueue(defer)`，收到成功确认后才提交签名并 `start`。失败、上下文变化和部分
  失败释放签名并恢复请求；同集合串行、跨集合隔离。
- 证据：`test/rename-command-queue.test.js`、`test/plugin-integration-contract.test.js`
  和更新后的 `test/plugin-source.test.js` 已接入 `npm test` 全绿。以上仅是源码/fake
  门禁，R34 真实 Eagle 界面仍未验收，不得安装或宣称 0 bug。

## 2026-07-24：编号任务忙碌不是配置权限

- 事实：QA 文件夹 `MEUL73DQPC4ZS` 未锁定且手动拖动可用，但自动编号 checkbox 因
  `api.rename.running` 单独置灰；用户没有执行任何能授予这种“权限锁”的动作。
- 决定：自动编号开关只受 collection 类型、目标数量和排序锁定控制。编号任务 queued、
  accepted 或 running 只能限制事务执行动作，不得禁用配置开关。
- 决定：rename active 状态必须匹配 `sourceContextId`；enqueue duplicate、异常、
  context changed、start failed 或 claim failed 都必须显式结算主窗口请求，不能留下
  永久 busy。
- 影响：主 R-ID 为 R21，交叉影响 R14/R26。先增加失败测试，再新增
  `rename-lifecycle-core` 并接入 bridge；真实通过仍须新候选在 QA Library 复验。

## 2026-07-25：改名失败不得自动重试，失败投影必须回到 Eagle 真值

- 决定：`executeRenameCommand()` 失败后必须通过 `completeMainRenameBatch()` 结算；不得
  调用恢复协议把同一请求交还 monitor。重试只能来自用户再次预览和确认。
- 决定：`finishVisibleRenameMask(false)` 清除 mask 后，只调用宿主的当前 item 更新和
  当前选择更新，恢复网格与检查器；不得改变文件事务或触发全列表刷新。
- 影响：R18/R21/R22/R24/R28/R30。qa.4 和 qa.5 均先新增失败测试再做最小修改。
- 真实证据：qa.5 受控失败四处名称一致、无自动二次执行、控件释放；明确重试后四处
  统一为 `1-qa-fixtures1`，缩略图和右侧预览完整，目录权限保持 `755`。

## 2026-07-25：qa.5 作为本机唯一发布安装

- 决定：用户接受 R01 四次样本和 R34 三态重复物理拖出的残余风险，R01-R34 在本次
  发布治理口径下全部关闭，不再要求用户参与测试。
- 决定：安装静态载荷与 qa.5 候选一致时不覆盖运行时状态；先做完整备份和指纹，再以
  完整重启、唯一来源日志、版本/API 和宿主原生能力完成安装验收。
- 结果：qa.5/API82 是唯一安装来源；重启后选择、预览、右键正常，三个安全开关关闭。
- 边界：生产 Library 是 NAS SMB 路径，禁止写入；本轮发布结论不包含生产 NAS 的真实
  排序或自动编号写入验收。

## 2026-07-26：元数据扫描不得阻塞 Eagle 原生预览

- 事实：`monitor()` 原先等待当前集合的拍摄时间读取，普通文件夹还会再次调用
  `eagle.item.get` 枚举完整目录，扫描结束执行整页刷新和集成自检；NAS 上“全部”视图
  因此可能出现长时间空白或预览延迟。
- 决定：拍摄时间扫描默认是后台缓存预热，不得阻塞监控循环、不得在结束时刷新原生网格、
  不得运行集成自检；当前视图已经提供项目时禁止额外整目录枚举。只有用户明确从其它
  排序切换到“拍摄时间排序”时允许一次刷新和自检，保护集合仍禁止刷新。
- 影响：R13、R22；交叉约束 R12（智能结果不可回退整库）和 R31（成员变化不得触发编号）。
- 回滚：仅恢复 `monitor-core.js`、`plugin.js` 和对应测试/候选，不触碰 `.library`、
  `app.asar`、NAS sidecar 或素材。若真实现场仍卡顿，转交 NAS/SMB 缩略图枚举专项。

## 2026-07-26：名称分叉只能经精确 Eagle 原生恢复

- 事实：item `MGX48XB5GM5CW` 的 Eagle/metadata 名为 `1-habitas峡谷泳池12`，唯一真实
  原图仍为 `1-habitas峡谷泳池5.jpg`；这会让该单项的原生拖动和导出找不到预期路径。
- 决定：精确恢复请求必须同时验证 item ID、唯一磁盘旧名、metadata 当前名和目标路径
  不存在，再通过 Eagle `ayncsImagesChange` 把磁盘旧名同步到 metadata 当前名。
- 决定：普通编号不得继承这项放宽，仍要求 item、metadata 与磁盘源名一致；任何范围
  扩大、目标冲突或多原图场景均拒绝。禁止手工改写 `.library`。
- 影响：新增 R35，交叉 R07/R18/R24/R25/R32/R34；回滚为恢复专用 metadata 预期字段。

## 2026-07-25 最新真实 NAS 验收覆盖

- 决定：本节覆盖此前“生产 NAS 未操作”及“R01-R34 全部关闭”的当前状态表述，历史记录保留，不删除时间线证据。
- 事实：专项 QA Library 已在 Eagle 完全退出后移入可恢复废纸篓
  `/Users/max/.Trash/Eagle QA Sort 2026-07-25-deleted-20260725-final.library`；源码、证据、备份和指纹清单保留。
- 事实：真实 NAS 隔离文件夹 `排序插件隔离验收-20260725`（`MS03COPQUCQYH`）已通过 Eagle UI 创建并导入 4 个非正式 PNG，未触碰既有正式素材。
- 事实：真实 NAS 隔离区的原生选择/预览/右键、自动编号、锁定权限、刷新、完整重启通过，最终三个排序相关开关均关闭，待改为 0。
- 决定：R01 真实 NAS 网格拖动未形成有效顺序变化，R34 真实 NAS 跨应用 Finder 拖出未执行；二者生产最终验收保持开放。未在本次真实 NAS 隔离区逐项重跑的其他 R-ID 只能沿用历史修复证据，不能标记为生产现场全通过。
- 结论：本轮真实 NAS 验收部分通过；`2.5.22-qa.5 / API 82` 仍为唯一安装来源，但当前不具备 R01-R34 全部生产验收条件。用户无需再参与测试。
- 证据：`qa-evidence/QA-REAL-NAS-FINAL-ACCEPTANCE-2026-07-25.md`。

## 2026-07-26：性能修复不得牺牲当前结果的路径补齐

- 事实：qa.7 现场日志出现“有媒体但 0 个具有文件路径”，导致相机拍摄时间读取和
  显示简介同时失效。
- 根因：为阻止整目录枚举，误把当前结果按 ID 定向补齐 `filePath` 一并禁止，形成
  R13 修复对 R19/R20 的回归。
- 决定：当前结果只允许按可见项目 ID 分批 `eagle.item.getByIds` 补齐路径；不得默认
  使用整库 `eagle.item.get`。
- 决定：多级规则含 `TAKEN_AT` 时，元数据补齐后可进行一次受控重排刷新；后台扫描不
  得持续刷新或阻塞原生预览。
- 决定：`NAME_GROUP` 表示文件名前缀分组，不是人物识别；手动视图存在时，手动顺序
  依既有决策优先于规则排序。
- 影响：主影响 R19/R20，交叉 R13/R22/R27；先写失败测试后生成 qa.8/API85。

## 2026-07-26：原生预览优先与拖动最小改名边界

- 决定：Eagle 原生缩略图和右侧预览拥有 L0 优先级。插件先注入经 item `size/mtime`
  校验的已有拍摄时间缓存；未缓存 EXIF 只能在原生卡片可见后并发 2 读取，collection
  改变后旧扫描最多允许正在执行的两个 I/O 收尾，不得继续领取新项目。
- 决定：团队 sidecar 只同步现代每 Library/collection 状态。旧的当前视图显示键仍可
  保留作兼容导入导出，但不进入变化指纹；自动同步静默期固定为 5 秒。
- 决定：一次有效拖动可以读取完整最终顺序来保证编号正确，但只允许同组序号实际变化
  的最小连续区间进入 `changes`。该允许列表必须进入后台请求并二次过滤，禁止后台重建
  时扩成整文件夹事务。
- 影响：新增 R36/R37；R36 影响 R13/R22/R27/R31，交叉 R15/R18；R37 交叉
  R04/R07/R18/R24/R29/R30。回滚只恢复本轮核心、bridge 和同步指纹实现，不触碰
  `.library`、NAS 素材或 `app.asar`。

## 2026-07-26：智能集合身份覆盖残留普通文件夹

- 事实：Eagle 切入智能文件夹后可能短暂保留上一个 `currentFolder`；原资格判断用该
  普通文件夹的 children 决定目标种类，导致智能媒体被误判为 `direct-folders`。
- 决定：只要当前智能 collection ID 明确，L2/L7 一律以智能集合身份为准；当前结果
  是 `direct-media`，不得读取残留普通文件夹的父/子层语义。
- 决定：智能集合的有效手动 drop 保存完整顺序到当前 Library + smart collection ID，
  不修改来源普通文件夹成员、顺序或配置。
- 决定：智能集合是虚拟结果，不继承残留普通文件夹的自动编号状态，也不因智能拖动
  创建普通文件夹改名任务。Eagle 原生 `dragstart` 和网格外拖放继续完全放行。
- 影响：新增 R38；主影响 R12/R15，交叉 R18/R27/R34。回滚只恢复目标判定、插件资格
  和对应合同，不触碰 `.library`、NAS 素材或 Eagle 原生数据。

## 2026-07-26：宿主漏发 drop 时只允许同网格 dragend 补交

- 事实：qa.10/API87 已修复智能 collection 身份和拖动资格，但正式 Library 现场拖动
  仍只产生选择，没有顺序变化；现有 `dragend` 无条件清空唯一拖动会话。
- 决定：不恢复历史鼠标/指针备用状态机。只有已经存在原生 `dragState`、开始和结束的
  collection ID 一致、结束坐标命中同网格另一卡片且正常 drop 未先清理状态时，
  `dragend` 才能调用现有 `performManualDrop` 一次。
- 决定：该补交完全观察式，不得调用事件取消/停止传播，不得读取或修改 `dataTransfer`；
  网格外、Finder、跨窗口和未知落点继续完全归 Eagle。
- 影响：新增 R39，交叉 R01/R15/R34/R38。回滚只删除 `dragend` 补交和对应 collection
  快照，不触碰手动顺序存储、普通文件夹、素材名称、`.library` 或 NAS 文件。

## 2026-07-28：qa.12 统一顺序权威与真实现场判定

- 决定：排序顺序只能由 `order-coordinator-core.js` 计算，权威优先级固定为
  `sorting lock guard > manual view > automatic rule > Eagle native`；重命名不再参与排序。
- 事实：真实 `改造对比案例`（`M837TMZXE0VTX`）存在 113 项 `manualViews` 且
  `manualMode.enabled=true`，当前 API 非 `TAKEN_AT` 单调是手动覆盖的预期结果。
- 决定：真实验收必须区分手动覆盖和自动规则；未获用户明确批准前不得清除真实 manual
  view 以制造自动排序测试现场。
- 影响：新增 R40；交叉 R15/R16/R18/R21/R31/R34。当前源码/安装预检通过，自动排序
  真实现场保持待批准。

## 2026-07-28：qa.13 相对位置手动覆盖与拍摄时间方向

- 决定：手动拖动不再把完整数组作为自动排序的最终覆盖；每次有效拖动只写入当前
  Library + collection 的稀疏 `before/after` 关系。插件自动规则先计算基础顺序，再
  稳定应用这些关系。
- 决定：旧 `manualViews.v2.order` 永久保留为 `legacyFullOrder` 和兼容 `order` 字段，
  但迁移后不再参与新自动排序；“恢复自动排序”只清活动关系并立即刷新，不删除历史记录。
- 决定：删除相对关系锚点时受控失效并记录 stale relation，不猜测新位置；排序锁定继续
  是最高 guard，拒绝拖动、规则变更、恢复和改名。
- 决定：单独拍摄时间排序把宿主 `sortIncrease` 映射为 `TAKEN_AT asc/desc`，升降序
  都重新计算基础顺序，再复用同一相对覆盖。
- 影响：新增 R41，主交叉 R02/R15/R19/R33/R40；源码候选为 `2.5.22-qa.14 / API91`。
  已通过失败测试、全量自动门禁和 diff 检查，真实 Eagle 现场仍是唯一最终真源。
- 模型/推理：`gpt-5.6-sol/high`；选择原因：跨 L3/L4/L6、持久化迁移、原生事件链和
  NAS Library 安装；升级条件：真实现场出现方向不变、跨集合污染、原生拖出回归或需要
  改写 `.library`/`app.asar` 时停止并回架构层。

## 2026-07-28：智能文件夹只提供排序，不提供自动编号

- 决定：智能文件夹是虚拟查询结果，只允许当前结果的自动排序和手动相对位置；
  不显示自动编号入口，不构造改名计划，也不进入安全改名事务。
- 决定：普通文件夹继续保留自动编号和安全改名；智能集合的来源普通文件夹顺序、
  文件名和编号状态不得被智能视图改写。
- 影响：新增永久回归 `R42`，交叉影响 `R12/R15/R38/R39/R40/R41`；普通文件夹
  基准和已有手动关系不迁移、不清除。
- 模型/推理：`gpt-5.6-sol/high`；原因：虚拟集合渲染、手动 overlay 与改名事务
  的边界交叉；升级条件：真实 Eagle 仍渲染智能改名入口、智能排序污染来源集合或
  需要修改 `.library`/`app.asar` 时立即停止并升级。

## 2026-07-28：qa.15/API92 安装边界

- 事实：`qa.15/API92` 已替换唯一插件目录，安装前 `qa.14` 已完整备份；同 ID 活动来源
  只有一个，候选与安装指纹一致。
- 决定：本轮只完成插件安装，不自动启动 Eagle、不切换 Library、不执行真实排序、拖动、
  改名或 NAS 写入；运行态验收由用户在 Eagle 打开后进行。
- 回滚：使用安装备份目录恢复 qa.14 插件文件；不改 `app.asar`、`.library` 或用户素材。
- 模型/推理：`gpt-5.6-sol/high`；原因：安装与真实 Eagle 验收属于高风险边界；
  升级条件：出现第二来源、载荷不一致、宿主版本/API 不匹配或真实现场要求破坏性写入时立即停止并回滚。

## 2026-07-28：P0 真实 NAS 启动性能不进入插件修复链

- 最新授权允许正常退出/重启 Eagle，并在真实
  `/Volumes/团队文件-MAX线上协作中台/引力环球.library` 做加载和原生只读验收。
- 事实：旧 `qa.14` 进程主库加载为 `596.712` 秒；新 `qa.15/API92` 进程冷启动
  `Eagle start -> Library loaded` 为 `102.483` 秒，290 个文件夹和 24398 个有效
  文件与 UI 计数闭合。
- 决定：加载等待位于 Eagle 原生 `Get /images folders...`；排序插件只做一次本机
  拍摄时间缓存原子替换，无整库 EXIF、改名、NAS sidecar 或高频写入，不满足新增失败
  测试和源码修复的触发条件。
- 决定：精确缓存 `4dca4ea2.txt` 为 `Cache no changes`，不清缓存；不遍历/直改
  `.library`，不写 NAS 素材，不改 `app.asar`，不建测试库或额外备份。
- 残余风险：24K NAS 库冷启动仍约 102 秒，并出现一次 Eagle 原生硬盘性能警告；
  renderer、缩略图、检查器和非空原生预览最终正常。
- 证据：`qa-evidence/QA-P0-REAL-NAS-STARTUP-PERFORMANCE-2026-07-28.md`。
- 模型/推理：`gpt-5.6-sol/high`；原因：真实 Eagle、生产 NAS、缓存、重启和回滚；
  升级条件：正常退出失败、精确缓存重建后复发、真实缺失或需要强杀/NAS 后台/
  `.library` 修改时立即停止。

## 2026-07-28：qa.17 被动 pointer 仍受 Eagle 宿主边界限制

- 事实：qa.17/API94 在真实智能文件夹捕获 6 次 `pointer-start`，证明 pointer 起点
  并非完全不可见；但 `pointer-commit` 为 0，会话全部以阈值不足、目标无效、会话
  替换或窗口失焦取消，画面没有顺序变化。
- 决定：R42 保持真实通过；R38/R39/R43 保持未通过，qa.17 不得作为“智能文件夹
  手动排序已修复”封板。
- 决定：不通过 `preventDefault`、`stopPropagation`、第二套业务鼠标层或
  `app.asar` 争夺 L0 所有权；停止继续盲拖和事件入口叠加。
- 安装：qa.17/API94 保持唯一安装；qa.16 回滚点和指纹清单完整保留。
- 证据：`qa-evidence/QA-SMART-FOLDER-SORTING-QA17-2026-07-28.md`。

## 2026-07-28：qa.18 证明事件可见，但命令生成不等于画面应用

- 事实：qa.18/API95 真实首拖得到 pointer 起点、native drag 起点、有效同网格 target
  和唯一 commit；Eagle 已向被动观察通道暴露足够事件。
- 事实：首拖前后可见顺序完全相同，因此 commit 只能解释为 MoveCommand 已生成，
  不能解释为 reducer、持久化或网格已应用。
- 决定：新增 R45，后续必须拆分 command-created 与 move-applied 结果；只有真实画面
  变化且持久化后才可记录成功。R38/R39/R43/R44/R45 保持未通过。
- 决定：首拖失败立即停止，不再盲拖；普通文件夹排序/改名分支继续冻结，不用事件拦截、
  指针捕获、覆盖层、模拟鼠标或 `app.asar` 绕过。
- 安装：qa.18/API95 保持唯一安装；qa.17 回滚点完整保留。
- 证据：`qa-evidence/QA-SMART-FOLDER-SORTING-QA18-2026-07-28.md`。

## 2026-07-28：qa.19 只有可见校验通过才算应用成功

- 决定：智能 MoveCommand 直接按命令 ID 进入现有 reducer、collection persistence
  和唯一 L7 presenter；dragend 后 DOM helper 不再是应用前置条件。
- 决定：pointer commit 仍只是命令生成证据；完整阶段必须到
  `VISIBLE_VERIFY_OK`，否则不得增加成功计数或宣称排序已改变。
- 事实：qa.19/API96 唯一安装后的真实首拖在输入阶段以 `grid-outside` 取消，未生成
  MoveCommand，因而没有获得 L4/L7 真实判定。R38/R39/R43/R44/R45 保持未通过。
- 决定：按首拖失败门禁停止，不重复拖动，不改普通文件夹、`app.asar` 或 `.library`。
- 证据：`qa-evidence/QA-SMART-FOLDER-SORTING-QA19-2026-07-28.md`。

## 2026-07-28：qa.21 冻结智能文件夹手动排序语义

- 智能集合以自己的 collection ID 保存稀疏手动 overlay；刷新和重新进入集合时，由唯一
  order coordinator 解析，smart presenter 只负责呈现，不复制排序规则。
- 智能集合只排序、不编号、不改名；来源普通文件夹状态不得被智能视图改写。
- 智能拖动从按下、移动、左右落点提示、目标高亮到取消清理，必须复用普通文件夹现有
  helper；禁止另造视觉覆盖层、第二套鼠标状态机或原生事件拦截。
- `2.5.22-qa.21 / API98` 是首个完成真实拖动、刷新和切换返回持久化的智能排序基线；
  普通文件夹稳定分支继续冻结。

## 2026-07-29：qa.22 将智能集合恢复改为可取消生命周期

- R48 的所有权分为三个纯边界：`collection-settings-renderer` 只协调设置 DOM，
  `smart-collection-lifecycle-core` 只管理 token/稳定状态，`smart-collection-presenter`
  只做宿主可见呈现；排序继续复用唯一 order coordinator 和 manual move reducer。
- 临时空结果保持宿主当前画面；只有当前 token 的明确稳定空结果才进入 empty。宿主
  查询、集合身份或可见指纹变化触发一次幂等恢复，定时入口轮询不得重算列表。
- presenter 禁止改写 Eagle `allData/filtereds`，任何异常都 fail-open 到 Eagle 原生
  结果；普通文件夹的排序、锁定、编号和安全改名路径保持冻结。
- 首次 ScreenCaptureKit `-3811` 阻塞后按门禁停止；续跑时 Eagle 已自然退出，因此
  不再触发 Quit。确认无活动写任务和第二来源后，qa.22/API99 已替换唯一正式安装并
  正常启动，五个关键载荷哈希与候选一致，qa.21 候选保留为回滚来源。
- 真实主库只读往返 `MAX照片集`（511）与 `线上展示照片`（91）4 次，全部非空并到达
  ready/`VISIBLE_VERIFY_OK`；空闲日志零增长，智能界面无自动编号或自动改名。
- 本轮不拖动、不改序、不改名、不清关系，不写 NAS 素材、`.library` 或 `app.asar`；
  最终自然业务操作由用户在当前 qa.22/API99 中验收。

## 2026-07-29：拖动视觉只有一个状态所有者

- 事实：qa.22/API99 中智能 MoveCommand 和可见顺序已经生效，但用户真实拖动看不到
  蓝色左右落点。qa.21 仅证明了调用同名 helper 函数，不能证明瞬时视觉真实存在。
- 根因：普通 helper、智能 pointer 和 native drag 三个调用点直接改 DOM；有效 target
  后的源卡/未知 native surface 会用 `helper=null` 立即清掉刚显示的蓝框。智能虚拟卡
  还可能只提供 targetBox 和左右侧而没有宿主 helper。
- 决定：`drag-feedback-controller` 成为普通与智能拖动唯一的视觉状态所有者，统一
  start/update/clear。未知 surface 保留最后有效目标；明确选中项或离开网格才清目标。
- 决定：宿主 helper 存在时继续使用 Eagle 原生 `drag-over`；helper 缺失时仅在现有
  targetBox 加同色左右边框类。禁止 overlay、模拟鼠标、指针捕获、事件取消、
  `dataTransfer` 修改、第二视觉状态机或第二拖动业务链。
- 清理合同覆盖 drop、dragend、pointercancel、Esc、预览、collection 切换、窗口失焦
  和模块停止；视觉不得改变 MoveCommand、manual overlay、普通文件夹排序/改名或智能
  只排序不改名的业务语义。
- 候选：`2.5.22-qa.23 / API100`。模型/推理为 `gpt-5.6-sol/high`；出现宿主事件
  ownership 异常、真实 Library 空白/卡死、第二来源或正常退出失败时停止并回总管。

## 2026-07-29：智能视觉不得复用普通文件夹的布局投影

- qa.23 的“单一 controller”只解决状态所有权，没有解决宿主布局差异。用户真实录屏
  证明 smart 模式显示所有 `.box-sortable-helper` 会让这些 helper 参与瀑布流布局，
  产生巨型空洞和卡片跳位；因此 qa.23 是 HOST FAIL，不得发布。
- 单一 controller 不等于单一 DOM 投影。以后必须显式声明 `mode=normal|smart`：
  normal 保持 Eagle 原生 helper 反馈；smart 永不遍历、显示或改写 helper，永不启用
  normal dragging body class，只在当前 targetBox 投影不改变布局的左右 box-shadow。
- 绿色加号和原图 ghost 是 Eagle 原生 native drag 外观。为保证 R34 拖到 Finder、
  聊天框和上传框，扩展继续不取消 dragstart、不改 `dataTransfer`；不得用事件拦截来
  “美化”内部拖动。
- smart 的未知 source/native surface 只保留最近有效目标；明确网格外、drop、
  dragend、pointercancel、Esc、预览、collection 切换、窗口失焦和模块停止统一清理。
- 非原位目标的 native 事件序列必须 exactly-once 生成既有 MoveCommand；在用户录屏
  最终落回原位时，不得仅凭原序臆断提交失败。
- 候选为 `2.5.22-qa.24 / API101`；源码候选门禁完成前不安装、不操作 Eagle。

## 2026-07-29：qa.24 作为唯一安装进入用户真实验收

- 安装前 qa.23/API100 是唯一来源，真实智能网格非空且无导入、改名或活动写任务；
  Computer Use 正常 `Cmd+Q` 退出后，主/renderer/API 全部关闭，未强杀。
- qa.24 使用延迟更新替换唯一正式插件目录；运行态 diagnostic、拍摄时间缓存、GPS
  状态、改名备份/恢复和团队备份全部保留。没有创建新备份，qa.23 候选是回滚来源。
- 安装的 qa.24/API101 五个关键文件与候选 SHA-256 一致，插件来源数为 1。
- 正常启动后真实 `引力环球.library` 的 `MAX照片集` 为 511 项，网格非空、界面响应，
  生命周期到 ready/`VISIBLE_VERIFY_OK`，进程无 U；插件和统一日志没有
  `collectionActions.append`、uncaught/TypeError、后台无响应或错误风暴。
- 上述只证明“已正确安装且现场健康”，不证明 R47/R49 用户结果通过。本任务不自动
  拖动、不改序、不改名；用户必须在真实智能文件夹做非原位拖动，直接确认蓝色左右
  落点、无空洞/跳位、松开顺序正确及刷新保持。

## 2026-07-29：qa.24 小蓝点证明卡片 box-shadow 不是原生落点等价物

- 用户在真实智能文件夹拖动时只看到目标照片角上的小蓝点，没有普通文件夹同款完整
  竖向落点；因此 qa.24 是 R50 HOST FAIL，不得作为发布版本。
- 根因是 smart 把蓝线画在可能被裁切的卡片 box 层，而 resolver 实际已经给出了当前
  Eagle left/right helper。以后不能用“样式存在”代替真实可见结果。
- qa.25 决定只复用 resolver 返回的当前一个 helper：先保存其 inline style 值和优先级，
  再临时设为绝对定位、top/bottom 0、完整高度并启用原生 `drag-over`；换边、换卡或
  clear 时逐项恢复原样。
- smart 仍禁止遍历/显示全部 helper，禁止改写任何非当前 helper，也不启用 normal
  dragging body class。任何路径都禁止改写 targetBox 的 position/overflow；当前 helper
  真正缺失且宿主卡已经是非 static 定位时，才允许使用 top/bottom 0、3px 宽的完整
  纵向伪元素，static 时 fail-open；禁止继续使用 inset box-shadow。
- normal 拖动反馈、MoveCommand、manual overlay、自动排序、锁定、普通文件夹编号和
  改名语义全部冻结不变。`2.5.22-qa.25 / API102` 只作为源码候选；完整门禁前不安装、
  不重启、不操作 Eagle 或真实 Library。

## 2026-07-29：qa.25 唯一安装进入用户真实竖线验收

- 安装前 qa.24/API101 是唯一来源，真实智能网格 511 项非空，diagnostic 已空闲约
  15 分钟，无导入、改名、EXIF 或其它活动写任务；正常 `Cmd+Q` 后进程/API 全部退出。
- qa.25 候选以延迟更新原子替换唯一正式目录，运行态缓存、诊断和恢复状态继续保留；
  没有新建备份。安装版本/API 及五个关键文件 SHA-256 均与候选一致，来源数为 1。
- 正常启动真实引力环球 Library 时，约 39 秒处首次只读检查见“即将完成”、API 未起和
  一个 renderer 为 U。按异常门禁停止操作，没有点击、重启或强杀；约 64 秒后宿主自然
  恢复，API 正常、所有 renderer 为 S/R、MAX照片集 511 项和网格非空。
- 上述自然恢复说明启动暂态更符合 NAS/宿主读取等待，不作为 qa.25 视觉成功证据。
  插件日志只有正常自动启动，未见持续异常风暴。本任务不自动拖动；只有用户真实自然
  拖动看到完整竖线、无空洞/跳位且顺序持久化，才能关闭 R50。

## 2026-07-29：动态注入产物本身成为发布门禁

- qa.25 新增的智能蓝线 CSS 在外层模板展开后破坏了整段 JavaScript；这类故障发生在
  Eagle 执行前，所以所有排序 UI 会同时消失，不能归因于某个智能集合或 NAS 数据。
- 以后每个候选必须从真实 `plugin.js` 构造完整 `injectionSource`，再用 JavaScript
  编译器验证最终载荷；外层 `node --check`、局部函数测试和 regex 只能作为补充。
- inject 失败必须把完整 stack 写入既有 diagnostic 通道；monitor 只补记未记录的错误，
  同一错误 60 秒限流，避免每秒重试再次制造日志和性能风暴。
- qa.26/API103 只修 R51 和诊断门禁，不改普通文件夹、排序规则、手动关系、编号或改名。
  真实智能面板已恢复拍摄时间、多级和手动入口，并继续完全隐藏自动编号/改名。
- qa.26 已唯一安装并等待用户真实拖动验收 R50；本轮只读确认不代表蓝色竖线视觉已通过。
- 模型/推理：`gpt-5.6-sol/high`；原因：动态注入、真实 Eagle 唯一安装和回滚风险；
  升级条件：注入失败、第二来源、需要强杀或修改 `.library`/`app.asar` 时立即停止。

## 2026-07-29：qa.26/API103 作为当前排序稳定基线

- 用户确认当前排序较为满意，决定冻结 `2.5.22-qa.26 / API103` 作为后续排序开发的
  基本基线。
- 普通文件夹排序、锁定、手动拖动、自动编号和安全改名作为稳定主线保护；智能文件夹
  只排序和手动顺序，继续禁止自动编号/改名。
- 当前代码结构判定为“可冻结的稳定基线，但不是理想最终结构”：`plugin.js` 仍是约
  9,769 行高风险聚合点，未来结构整理必须单独立项，先保护 qa.26 行为，再迁移。
- 基线文件：
  `extensions/media-organizer/docs/STABLE-SORTING-BASELINE-2026-07-29-QA26.md`。

## 2026-08-01：GitHub 只发布干净插件，不伪装分发宿主桥

- 决定：qa.26 排序行为继续冻结；GitHub 发行采用运行文件白名单，不包含 sidecar、
  内置历史状态、缓存、备份、恢复资料、Library 路径、测试库、`app.asar` 或桥载荷。
- 决定：检查器默认只做只读兼容性检查。只接受 Eagle 4.0.0 和已审计桥精确哈希；
  无桥、未知桥或多个同 ID 插件来源均拒绝，不提供安装/修改 host 的入口。
- 事实：qa.26 的主网格排序、普通/智能手动呈现、原生交互反馈和团队状态投影依赖
  `eagle.photoTakenSort.execute`。Eagle 4 官方公开 API 没有 1:1 替代通道。
- 事实：同 NAS Library 的 v2 sidecar 在审计桥、qa.26 和文件夹 ID 兼容时可零操作
  自动读取；sidecar 自身不能执行主窗口注入，因此不能解除 GitHub-only 阻断。
- 结论：新电脑仅凭 GitHub 内容完整安装为技术上不可达，不得报告“可 1:1 使用”；
  当前可交付物是干净插件包、只读检查器、SHA-256 和明确阻断说明。
- 证据：`qa-evidence/QA-GITHUB-STABLE-RELEASE-QA26-2026-08-01.md`。
# 2026-08-01：GPS/元数据标签首次运行安全与 qa.27

- qa.27/API104 仅拥有 GPS/元数据标签的首次状态安全和视频诊断；普通/智能排序、手动
  关系、蓝线、编号、改名与团队 sidecar 保持 qa.26/API103 冻结基线。
- 新状态默认关闭自动标签；首次用户明确开启只建立 Library 基线，不扫描元数据或写标签。
  既有项目只能通过明确整库操作或当前文件夹确认流程进入标签写入。
- 缺失 `ffprobe` 是视频元数据依赖故障，必须进入可审阅异常原因，不能伪装成“没有 GPS”。
- GitHub 构建继续白名单复制，并在构建中显式断言 `geo-tag-state.json` 等运行态不存在。

## 2026-08-07：文件夹右键重命名属于 Eagle L0，排序锁不得拦截

- 决定：Eagle 文件夹的右键“重命名”、双击或其它原生改名入口均归 Eagle L0。排序模块
  不得包装、取消、拒绝或以排序锁状态替代该原生命令。
- 根因：历史 `bodyScope.changeFolderName` wrapper 把“排序锁定”扩展到了当前父文件夹和
  子文件夹名称，点击菜单后直接返回 `false`。这既不属于排序/自动编号职责，也违反
  Eagle 原生功能最高主权。
- 边界：`sortingLocks.v3` 仍只保护插件拥有的排列、手动拖动和自动编号/自动媒体改名；
  用户手动修改文件夹名称后，Eagle 原生保存结果为准，插件不写入或修正该名称。
- 回滚：qa.28 安装器替换前保留完整唯一安装目录备份；若真实 Eagle 原生改名异常，
  只恢复该备份，不修改 `.library` 或 `app.asar`。
- 现场结果：qa.28/API105 已安装为唯一同 ID 插件来源。真实 Eagle 中当前文件夹的右键
  菜单能够打开“重命名”原生输入框；本次按 Esc 取消，未提交任何文件夹名称变更。

## 2026-08-07：R52 “全部”视图首帧必须由明确路由拥有

- 决定：`view=all/global` 和未知路由在 collection ownership 层高于 Eagle 切换瞬态残留的
  `currentFolder`；smart 路由继续最高优先。global/unknown 一律 fail-open，原样保留 Eagle
  输入顺序，不读取旧 manual overlay、锁或文件夹规则，不扫描 EXIF/整库，不主动刷新或创建
  改名/编号计划。
- 原因：首帧上下文竞态会把新“全部”列表短暂解释为旧普通文件夹，数秒后宿主清空
  `currentFolder` 才恢复，造成用户可见的首屏错序。
- 影响：永久回归 R52，关联 R13/R15/R19/R31/R48；普通/智能排序与改名语义冻结不变。
- 候选：`2.5.22-qa.29 / API106`；qa.28/API105 继续作为唯一安装版和回滚点。Phase 1 不安装、
  不重启 Eagle、不接触真实 Library/NAS/app.asar。

## 2026-08-07：R52 qa.29/API106 已安装，视觉结论交由用户验收

- 安装器在 Eagle 正常退出后完成唯一来源替换；manifest=`2.5.22-qa.29`、API=`106`，
  包内与安装版 `plugin.js` SHA 一致，Eagle 正常启动，诊断日志出现排序注入和 global context。
- 唯一回滚点：`/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260808-020339`（安装器记录的本机时间戳）。
- 无法可靠自动判定普通→全部过渡的首帧/稳定帧，故不宣称真实视觉通过；用户需在真实 Library
  观察首帧与稳定帧。期间未改名、拖动、导入、删除、写 NAS、修改 `.library` 或 `app.asar`。

## 2026-08-07：R53 智能成员必须经 source-identified snapshot 才能排序

- 决定：智能集合不再通过通用 `currentItems()` 获得成员。唯一成员真源为
  `SmartCollectionHostSnapshot`：只有当前 library/collection 的 `eagle-smart-query` sourceIdentity、
  queryEpoch、成员与可见 ID 连续稳定后才进入 READY；不能以固定等待或“成员数等于整库”判断。
- 决定：LOADING 与临时 EMPTY 时，`sortData/sortRawData` 必须原样放行当前 Eagle 输入。此门禁位于
  collection/readiness ownership 和排序入口，不向 DOM/MutationObserver 增加业务排序规则。
- 决定：smart A→B、smart→global、退出/重进均产生新 generation；任何旧异步 present 由现有 token
  机制失效。合法的智能查询即使匹配全库，只要 sourceIdentity/queryEpoch 正确，仍可在 READY 排序。
- 决定：手动 relations 的拓扑恢复保持既有稳定和冲突回退语义，但 ready 集合改用 base-index 二叉堆，
  避免临时大集合上反复 `ready.sort()` 放大主线程工作。
- 影响：新增永久 R53，关联 R38-R48、R52；普通文件夹、全局 R52 fail-open、智能禁止自动编号/改名
  与 qa.26/API103 冻结行为未改变。候选为 `2.5.22-qa.30 / API107`，Phase 1 未安装。

## 2026-08-07：qa.30/API107 T3 拒绝发布并回滚 qa.29

- 真实 Eagle 证明 qa.30 已阻止临时 24,319 项进入 PRESENT，且未再出现 >10 秒无响应；但 host snapshot 只收到 count=0，538 项真实查询未进入 READY/PRESENT。
- LOADING 中仍启动 538 项拍摄时间读取并持续约 12.58 秒，违反 R53“加载中零 EXIF、READY 后才使用同一成员快照”的不可变语义。因此 qa.30 不能作为安装候选继续留在生产插件目录，也不能请用户做最终通过验收。
- 决定：停止第二次 qa.30 重启测试，正常退出并恢复唯一 qa.29/API106；qa.30 仅保留为失败诊断载荷。下一候选必须修复真实 host adapter 成员来源和 observation 触发，并把 metadata scan 置于 READY 之后。
- 当前安全状态：qa.29/API106 唯一活动来源，Eagle 正常启动；未修改 app.asar、Library 或 NAS 素材。

## 2026-08-07：qa.31/API108 以显式 filtered source 修复 R53 Phase 2

- qa.30 的 `filtereds !== allData` 不是有效的成员所有权规则：真实 Eagle 完成 538 项智能查询时，显式 `filtereds` 可与 `allData` 同引用。qa.31 只认 `filtereds` 这个宿主查询槽位而非引用不等式；`allData/raw` 从未成为 fallback。
- 当宿主没有 queryEpoch 字段时，adapter 用当前 collection generation、filtered source reference 与 member fingerprint 组合 epoch，并要求连续 observation；因此没有固定等待，也不会用“数量等于整库”判断。
- metadata 监控的 smart LOADING 门禁前移到 `api.current()` 与 `pushCachedTimestamps`/`scanCurrentItems`/`contextNeedsTakenAt`：未 READY 不导出成员或 source counts，不 hydrate 路径、不读 EXIF/ffprobe、不写 cache、不 refresh。
- 普通文件夹、智能 READY 行为、qa.30 临时 24,319 零 present、全局 R52 fail-open 与 qa.26/API103 冻结行为未改变。qa.31 是源码候选，不得表述为真实 Eagle 通过；当前活动安装仍为 qa.29/API106。

## 2026-08-07：qa.31/API108 T3 live host READY 失败并回滚

- 真实 smart UI 能显示宿主成员，但插件 adapter 未获得可受信的成员数组，持续
  `HOST-PENDING count=0`；R53 的 live source contract 仍未满足。
- 依硬门禁拒绝发布并恢复 qa.29/API106。不得放宽为 allData/raw fallback、固定延迟或仅按
  UI 数量推断 READY；下一候选需在 host adapter 层补齐真实引用/快照证据。

## 2026-08-08：qa.32/API109 R53 Phase 3 live host source contract

- 事实：qa.31 真实 UI 已显示 571 项，但 adapter 仅收到 `filtereds` 空数组并持续
  `HOST-PENDING count=0`；qa.29 同现场曾成功 READY，故问题属于 host adapter 接线而非
  Eagle/NAS 成员缺失。
- 决定：显式 `filtereds` 仍是最高优先 smart-query 槽位；当宿主完成结果仅暴露在当前
  `allData` 时，只有 `routeKind=smart`、当前 smart collection ID 匹配、source reference
  指向该 current-view、visible IDs 一致等联合证据才可建立 `eagle-smart-query:current-view`
  真源。无该证据的 allData/raw（包括 24,319 临时别名）继续 fail-open。
- 决定：query epoch 由 collection generation、source reference 和 member fingerprint
  组合；连续两次稳定 observation 才 READY，不使用固定延迟或按数量拒绝合法全库匹配。
- 决定：qa.30/31 的 LOADING 零 metadata 与高效 overlay 语义保持；普通/global/qa.26
  冻结行为不变。qa.31 作为失败候选永久保留，qa.32 仅为源码/发行候选，未安装。

## 2026-08-08：qa.32/API109 T3 拒绝发布并恢复 qa.29

- qa.32 安装身份、包载荷、唯一来源和 `app.asar` 哈希均通过；但真实 Eagle 启动后 NAS
  Library 长时间停在宿主“即将完成 …”，未进入可操作 smart folder，A/B READY/PRESENT
  与视觉首帧均无法确认。
- 决定：未见明确 `background process >10s` 文本不等于性能通过；宿主持续加载即判定本轮
  真实门禁失败。正常退出并恢复 qa.29/API106，qa.32 失败包与回滚证据永久保留。

## 2026-08-08：R53 P0 qa.32 启动阻断调查结论

- qa.32 失败窗口没有进入注入、smart snapshot、扫描或 EXIF 路径；`mainLibraryReadiness()` 仍先于
  injection 判断宿主 scope/rootDir/hash，smart 新逻辑只在注入后当前 smart context 生效。
- qa.29 回滚后同一 NAS Library 可恢复完整树和网格，SMB/.library 根目录 stat 为 0.00 秒；因此暂不把
  阻断归因到 qa.32 业务代码，结论标记 B/C（Eagle/NAS 原生启动时序或现场并发状态未完全确定）。
- 在获得 Eagle 原生 `Start → enumeration → Library loaded` 阶段日志或隔离 QA Library 复现前，不生成
  qa.33，不改源码、不安装、不重启。

## 2026-08-08：R54 qa.33/API110 启动业务隔离

- qa.32 的 P0 结论仍是 B/C：没有证据证明 R53 smart 业务路径在 `Library loaded` 前运行或阻断宿主；R54
  因此不改变 R53 成员真源与 READY 语义，而是独立收紧插件 bootstrap 的所有权。
- 唯一 gate 先等待 `onLibraryChanged` 提供当前 library identity，再以原有 `mainLibraryReadiness()` 复核可操作
  主窗口。identity/generation 不匹配、切库、STOPPED 或注入失败均使旧任务失效；不以固定延时重试。
- 在 ACTIVE 前禁止 cache/team sidecar 读取、主窗口注入/observer、collection/smart snapshot、metadata/EXIF/path
  hydrate、refresh、排序、改名与 GPS library 切换。控制面板可显示等待状态，但不得旁路 `inject()`。
- `2.5.22-qa.33 / API110` 仅为源码候选；真实 Eagle 启动的因果与视觉结论留给后续 T3，不得把自动测试称为
  启动验收通过。

## 2026-08-08：R54 qa.33 T3 因正常退出失败停止

- Eagle 对正常 `Cmd+Q` 返回“后台任务尚未完成”，继续路径为“强制退出”。该状态满足 T3 硬停止条件，
  不得为了安装绕过为强杀，也不得在宿主运行时替换插件。
- qa.33 未安装、R54/R53 真实门禁均未开始；现场保持 qa.29/API106 唯一来源和可操作 Library。
  后续仅在宿主后台任务自然结束、能够无强制退出警告正常退出后继续同一 T3。

## 2026-08-08：R54 等待阶段不与用户争用 Eagle

- 受控等待期间检测到视频预览/播放状态变化，按用户活动处理；停止所有 UI 轮询和退出尝试。
- 不以用户界面活动期间的观察推断后台任务已经结束，也不趁窗口变化安装插件。qa.33 继续保持未安装状态。
- 用户回复继续不授权关闭其当前视频预览；恢复时若预览仍存在，继续按用户活动现场处理，直到用户自行
  退出预览后才重新尝试正常退出。

## 2026-08-08：R54 qa.33/API110 真实启动仅失败于暂态 main readiness

- qa.33 诊断表明 Library identity 出现前严格处于 `BOOTSTRAP_WAIT`，没有 R53、metadata、cache 或 DOM
  业务路径；不能把这次失败归为启动前 I/O 阻断。
- Library identity/generation=1 到达后 `mainLibraryReadiness()` 一次未确认被 gate 当作终态
  `INJECT_FAIL`；紧随其后 Eagle 已显示完整可操作 Library。这是 startup gate 把暂态 host observation
  误当不可恢复注入失败的候选缺陷。
- 决定拒绝 qa.33，并正常恢复 qa.29/API106。下一 T2 仅允许将该错误改为由新的 readiness observation
  推进的等待态，保持 identity 前零注入、R53 LOADING 零 metadata、R52 global fail-open 和普通/智能
  冻结行为；不得引入固定延迟或轮询风暴。

## 2026-08-08：R54.1 qa.34/API111 readiness waiter 边界

- 采用独立 `main-library-readiness-waiter-core`，只观察 `mainLibraryReadiness()` 返回的 scope/hash/library
  identity；不读取插件 cache/team sidecar，不枚举 items，不触发 smart snapshot、metadata/EXIF、DOM observer
  或业务 monitor。
- gate 在 identity 后先进入 `BOOTSTRAP_MAIN_WAIT`；只有 verified main identity/ready 才进入
  `BOOTSTRAP_READY → INJECT_START`。40 次/10 秒只是可取消的上限，超时记录 `BOOTSTRAP_TIMEOUT` 并 fail-open，
  不能用固定睡眠替代 host 证据。
- qa.34/API111 仅是源码候选，真实 Eagle 安装与 R53 A/B 由下一 T3 按 qa.29 唯一来源/回滚门禁执行。

## 2026-08-08：R54.2 多正向 readiness 证据与 qa.35 版本语义

- qa.34 真实失败证明“identity 已到达 + 多等几次”仍不够；readiness 必须由 canonical Library identity
  与多个可解释正向证据组合确认，任一旧 UI/其它 Library 证据不得授权注入。
- `matchedBy/evidence/missingReasons/observedLibraryIds` 是启动诊断合同；路径或固定 sleep 永远不是 ready 证据。
- qa.35/API112 是 R54.2 独立候选，禁止被 R55 覆盖。qa.34/qa.35 均不得表述为真实 R53 通过。

## 2026-08-08：R55 SMART FIRST VISIBLE FRAME 与单一提交所有权

- 验收定义从“最终排对”提升为 **SMART FIRST VISIBLE FRAME**：插件拥有 smart 排序时，从首个可见帧起
  不得展示已知错误 Eagle native 顺序，随后不得跳变；证据不足时显示明确 loading 或成员兼容稳定投影。
- READY 是三重 proof：`VERIFIED_COMPLETE` members、同 snapshot `metadata proof`、final order 的 host-data 与
  visible verification。`onReady` 是 post-await commit；presenter 不提交 lifecycle/stable projection。
- 只有 OrderCoordinator 决定顺序。HostOrderPresentationPort 独占 `allData/filtereds` 快照、apply/verify/rollback；
  presenter 和 DOM observer 不得直接改宿主数组或重算业务顺序。
- 任一异步结果必须绑定 library generation、collection generation、query epoch、snapshot fingerprint 和 frame
  generation；A→B→A、切库、停止、退出、新 fingerprint 均丢弃迟到结果。
- 普通 manual drop 也必须原子：DOM、宿主 arrays、manualStore/localStorage 同旧或同新；持久化失败立即双向
  rollback，不得依赖 refresh。
- `IMMUTABLE CODE / DURABLE STATE` 只覆盖 A：cache、diagnostic、rename recovery、team sidecar backup 位于
  PluginData，迁移不覆盖且发行包零运行态。`geo-tag-state.json` 属 C，仍是独立债务，禁止误宣称全部状态完成。
- qa.36/API113 是 R55 首个候选；当前真实安装保持 qa.29/API106，自动测试不能替代下一 T3/用户视觉验收。

## 2026-08-08：R56 filtered/current-view 引用必须分离

- qa.36 证明首帧 loading 策略正确，但 loading 永久不结束同样属于失败；不能用“没有错误闪屏”替代 READY。
- filtered-query 与 current-view ownership 必须分别携带 `filteredReference`、`currentViewReference`；禁止一个
  `sourceReference` 字段在两条来源间复用。
- 非空 partial filtereds 拥有查询进行中的优先权，不能因 visible 不一致转吃 allData；只有最终完整成员证据
  才 READY。`filtereds===allData` alias 仍由 filtered 分支优先兼容。
- R56 必须同时有纯流水线和 `observeSmartCollectionHost()` 真实调用集成合同；只测 selector 不足以发布。
- qa.36 已拒绝并回滚；qa.37/API114 已通过完整源码/发行门禁，包 SHA 为
  `88f8e7c596c619e43fac3703d7b08f14cda21749918f968e77c82412108cf1c9`。真实安装继续使用
  qa.29/API106 唯一来源与失败回滚门禁，自动测试不得写成真实 READY 已通过。

## 2026-08-08：R57 路由身份不得再次依赖 currentSmartFolder hydration

- `collectionRuntime.fromContext()` 已从 URL 证明当前 smart collection 后，host observation 不得再要求
  `bodyScope.currentSmartFolder` 同步出现，否则同一身份形成两个不同步的门禁。
- 宿主记录只允许按 ID 从 `currentSmartFolder` 或 Eagle 自有 `smartFolderMappings` 解析；禁止按名称、可见文案或
  DOM 位置猜测。
- 完整性计数优先使用同一宿主记录的 `imageCount`；禁止用待验证的 `allData.length` 自证完整。映射记录缺失时继续
  loading/fail-open，不能放宽 R55/R56。
- qa.37/API114 的真实首帧通过但 READY 失败，版本语义冻结；修复进入 qa.38/API115。

## 2026-08-08：R58 不再以宿主变量名推断所有权

- Eagle 4.0 的实际数据流是完整 smart 结果进入 `allData`，`filtereds` 只是当前分页切片；历史“filtereds 优先”
  结论属于基于命名的错误假设，必须由真实宿主证据纠正。
- current-view allData 只有在 route ID、同 ID mapping `imageCount`、query finished、exact reference、visible membership、
  unique count 全部一致时才可信；因此允许 `allData===raw` 不等于恢复 raw fallback。
- 24k provisional 仍因独立 advertised count 不匹配受控拒绝。不得用固定 sleep、可见数或 `allData.length` 单独证明完整。
- qa.38/API115 真实失败版本冻结；修复进入 qa.39/API116，R01-R58 永久回归只增不减。

## 2026-08-08：R59 成员、metadata 与 PRESENT 必须共用同一 route identity

- `currentCollection()` 已证明 smart route 后，后台 metadata context 必须直接使用 `collection.id`；禁止再次依赖 `bodyScope.currentSmartFolder` hydration 形成第三身份门禁。
- READY snapshot 中缺少 `filePath` 的成员只通过公开 `eagle.item.getByIds` 按精确 ID 补全；不扫描或编辑 `.library`，不按名称/DOM/NAS 路径猜测。
- API 成功但仍无路径或非媒体的成员使用本次注入会话 missing sentinel，使 metadata proof 有明确终态；该 sentinel 不写磁盘缓存，后续新 snapshot/重启可重新解析。API 失败/超时不得伪完成，清除 scan claim 并 5 秒退避重试。
- metadata scan identity 必须包含 smart collection、snapshot generation、member fingerprint 与排序规则；同 context 的新 generation 不得复用旧 in-flight promise。
- qa.39/API116 真实失败语义冻结；修复进入 qa.40/API117，R01-R59 永久回归只增不减。

## 2026-08-08：R60 成员身份与文件资源是两个独立宿主契约

- `eagle.item.getByIds()` 只可用于成员/项目身份读取，不能假设返回对象携带 `filePath`；排序成员完整不等于原文件资源可读。
- 文件资源解析只有一个入口 `ItemResourceResolver`，只调用公开 `eagle.item.get({ ids, fields })` 并明确请求 `filePath`；禁止 `.library/images/*.info`、绝对 NAS 路径推导、全库扫描或通过选择态 API间接取路径。
- 精确请求漏 ID、响应非数组或一整批媒体全部没有路径，语义是“宿主资源契约不可用”，必须 retryable fail-open；不得把集成失败伪装成 538 个 missing sentinel 或完成 metadata proof。
- 只有同一批已经证明至少存在有效媒体资源时，个别合法项目仍无路径才可写本次注入会话 sentinel；sentinel 不写磁盘缓存。
- resolver 内建 ID 去重、200 项批次、并发 3 和 generation 取消；迟到结果不得进入新 snapshot。qa.40/API117 真实失败冻结，修复进入 qa.41/API118，R01-R60 永久回归只增不减。

## 2026-08-08：R61/R62 宿主查询背压与 Library 分区 cache

- qa.41/API118 的真实 538 READY 后永久 `FINAL-ORDER-PENDING` 已证明：公开 API 合法不等于大批调用安全。资源解析必须先做单 ID capability probe，默认 `batchSize=1/concurrency=1`，批间 yield；不得再次使用 200 项×并发 3 的历史失败策略。
- `withTimeout` 必须接收 thunk，先创建 timer 再调用可能同步阻塞的 Eagle API，并在返回后复核 elapsed。资源、诊断或调度辅助失败必须 fail-open；metadata retry 使用 5/10/20/40/60 秒指数退避，禁止固定频率重试风暴。
- metadata cache schema v3 按 Library identity 分区。切库只激活目标分区，不删除其它 Library；bootstrap 读取磁盘后必须重新激活当前宿主 Library，不能让旧磁盘 active identity 覆盖现场。
- metadata 流程永久冻结为 cache-first：先以 `size + modifiedAt` 查询当前 Library 分区，只对 miss 解析 `filePath` 和读取原图。`mtime/modificationTime` 只作为旧宿主兼容输入，不再作为首选身份字段。
- 每个异步 scan 捕获发起时的 Library identity；迟到结果只能写原 Library 分区，不能写“当下 active cache”。诊断或 yield 本身异常不得阻断排序业务。
- qa.42/API119 是 R61/R62 首个候选；R01-R62 永久回归只增不减。自动门禁通过不代表真实 Eagle 通过，必须继续唯一来源安装、真实 `MAX照片集` 首帧/metadata/PRESENT 和同库冷重启 cache-first 验收。

## 2026-08-08：R63 资源 adapter 必须协商已安装宿主能力

- qa.42/API119 真实运行证明 Eagle 4.0.0/build 20260401 会快速返回 `item.get({ids,fields})` 数组，但不保证包含精确请求 ID。返回成功、类型正确仍不代表查询条件被宿主执行。
- 资源 adapter 必须逐项验证请求 ID；query 非数组或遗漏 ID 时，不得接收无关对象，只允许一次切换到公开 `eagle.item.getById(id)` 单项契约，并在 resolver 生命周期内记忆已证明模式。
- capability negotiation 属 L2 宿主兼容层，排序核心、metadata proof 和 PRESENT 不得知道宿主版本分支。无论哪种模式都保持单项串行、调用前 timeout、generation 取消和 R60 零路径熔断。
- qa.43/API120 是 R63 首个候选；R01-R63 永久回归只增不减，仍需完整门禁、唯一安装和真实 538 验收。

## 2026-08-08：R64 宿主对象不得按 JSON/普通对象复制

- qa.43/API120 已证明 `getById` 能返回精确宿主 Item，但 adapter 的 `{...response}` 会丢弃 Item prototype 上的只读 getter，因此把真实资源误报为 0 路径。
- 唯一资源 normalizer 只允许逐项直接读取 `RESOURCE_FIELDS`，将 getter 值物化到新的 plain adapter item；不得修改或长期持有宿主对象，不得把未知私有字段传入排序核心。
- `filePath`、`size`、`modifiedAt` 必须共同通过 getter fixture，避免路径修好后 cache identity 仍静默丢失。getter 自身异常只隔离该字段，不能拖垮业务。
- qa.44/API121 是 R64 首个候选；R01-R64 永久回归只增不减，继续真实 538 与冷重启 cache-first 验收。

## 2026-08-08：R65 智能自动恢复必须 data-first

- qa.44 完成 538 路径和 metadata 后，最终提交仍失败；自动恢复不能复用手动拖拽的逐张 DOM move。
- loading 内先原子提交 `allData` 完整顺序与等长 `filtereds` 分页投影，再由 Eagle 原生 rerender；最终可见前缀有界验证成功后才撤 loading。失败必须同时回滚宿主数组和可见画面。
- 手动拖拽保持原有单交互事务，不与自动恢复合并。qa.45/API122 为首个候选，R01-R65 永久保留。

## 2026-08-08：R66/R67 窗口证明与两阶段 cache-first

- 自动智能排序不得假设虚拟网格永远位于首屏；提交前以原 host data + 当前可见连续 ID 证明 offset/count，证明失败时只能保守 fail-open。
- Angular 通知是可等待的宿主提交边界；未完成 rerender 之前读取 DOM 不构成 visible proof。
- lifecycle 不得把异常统一压成 `presenter-failed`；诊断至少保留有界 reason、errorName、errorMessage。
- metadata cache-first 固定为两阶段：快照首次 lookup → 仅 miss 做轻量身份/路径 hydrate → 二次 lookup → 仅真实 miss 读取原文件。
- qa.46/API123 为 R66/R67 首个候选；R01-R67 永久保留。

## 2026-08-09：R68-R70 的智能查询身份与注入命名规则

- Eagle 注入载荷是共享函数作用域。纯排序 core 与 host adapter 的函数名必须不同；任何可能被 core 调用的宿主包装不得复用 core 名称。R68 将 host wrapper 固定为 `applyHostManualOverlay`。
- smart member fingerprint、lifecycle presentation signature 和 query epoch 的成员部分一律表达无序 ID 集合，不表达当前排列。排序提交、手动相对关系恢复或 host rerender 不得制造新 snapshot/generation。
- `allData/filtereds` 的引用可以因 Eagle rerender 改变，不能作为 query epoch 条件；新 epoch 只允许由来源语义或成员集合的真实变化触发。reference 仍可作为本轮读取证据，但不拥有业务身份。
- qa.51/API128 在真实 `MAX照片集` 一次 PRESENT 成功且 25 秒无迟到第二次提交；该结果只证明本轮只读启动与排序呈现链，用户真实视觉与交互验收仍是最终标准。

## 2026-08-09：R71-R72 的普通文件夹排序意图与锁状态

- Eagle 的 `sortData/sortRawData` 回调参数是宿主渲染细节，不是用户当前排列选择。只要当前 collection 持久化的是插件键 `PHOTO_TAKEN` 或 `PHOTO_TAKEN_AT`，该键就是唯一自动排序意图；宿主回调或 native select 延迟一帧都不得让网格、规则区或编号读取原生排序。
- “多级排序”显示、规则编辑区显示和实际 coordinator 输入必须共用同一个有效排列键；不得各自读取 select、callback 与 folder 对象而形成三套状态。
- 排序锁定仍是零排序、零刷新、零改名的 guard，不捕获或回放顺序快照；已保存的自动规则与手动相对关系分别负责重进恢复。侧栏红点只是该 guard 的投影，必须与当前面板 checkbox 和实际 guard 由同一 Library+collection 状态实时重算，不能保留旧 UI 标记。

## 2026-08-09：R73 原生 pinned 不得越过插件排序

- Eagle 的 `item.pinned[collectionId]` 是宿主原生手动布局历史，不是插件的显式手动排序命令。它不能进入 L3 自动比较器，也不能因为历史遗留而打散已配置的多级分组。
- 本项目唯一合法优先级固定为：Eagle 原生基础输入 < 插件当前自动规则 < 插件明确持久化的手动相对关系 < 排序锁定 guard。排序锁定拒绝新变更，但不创造第二份顺序真源。

## 2026-08-09：R74 正常文件夹首帧必须主动呈现

- 不能把 `sortData/sortRawData` 包装当成“已排序”的充分条件。普通文件夹可能在插件注入前已经被 Eagle 的原生排序完成，之后没有新的回调；此时包装永远没有执行，旧画面会长期保留。
- 正常文件夹首帧只允许通过既有 `presentOrderTransaction` 提交：先完成可见网格移动，再原子提交经过成员证明的宿主数组，最后双向核验；任一条件不成立即 fail-open。它不写手动关系、不触发改名、不改变 collection 配置，也不是第二套排序器。

## 2026-08-09：R80 规则编辑的结果真实性

- “规则编辑器显示新值”不构成排序完成；普通文件夹只有完成同一 collection、同一规则版本的可验证 L3 呈现，才可向用户显示为已生效。
- Eagle `rebindRefresh` 不被视为排序回调保证。刷新完成后的呈现请求必须绑定 collection ID 和完整规则签名；任一身份改变即 fail-open，不进行跨文件夹写入。

## 2026-08-09：智能文件夹不以几何 DOM 顺序验收

- Eagle 自适应虚拟网格的 DOM 坐标/挂载顺序只是布局事实。排序验收只认可完整 `allData`、`filtereds` 当前投影和当前集合渲染成员的三重一致。
- 几何异常只诊断，不得覆盖权威排序或制造原生回退；投影异常、重复或跨集合卡仍一律 fail-open。

## 2026-08-10：R89 的安装完成不替代真实筛选验收

- 事实：经用户明确批准，`2.5.22-qa.72 / API149` 已在 Eagle 正常退出后安装至唯一正式插件目录；qa.71 保留可恢复回滚点，受控 `app.asar` 哈希未变化。
- 事实：Eagle 正常重启后，真实 NAS Library 持续处于“即将完成”初始化状态，项目数为 `0`；本轮未能打开“服务花絮”选择“妆造”。
- 决定：R89 保持真实验收开放。只有在 Library 正常加载后，确认筛选结果数量小于完整 `1,380`、网格只显示匹配项、等待后不回写全量，且清除筛选恢复原有 `1,380` 顺序，才可关闭；安装成功、源码和自动测试一律不能替代该现场证据。

## 2026-08-27：排序状态文档不是同步服务

- 用户定义的“排序记录”是可携带的插件层排序状态文档，而非团队服务、后台同步器或 Eagle 原生状态副本。
- 文档只保存插件排序规则、手动关系、锁、自动编号配置、显示配置及全局继承/覆盖；它不得改写 Eagle 原生排序主权、素材、元数据或 `.library` 文件。
- 导出与加载均须显式操作。加载只在 `libraryId`、collection 身份与引用 item ID 都一致时形成可回滚事务；不兼容时拒绝，不按文件名、路径或缩略图猜测匹配。
- 运行时权威状态仍保留于本机 PluginData；导出 JSON 的去向由用户选择，插件不得自动向 NAS 或 Library 目录写入或轮询。

## 2026-08-27：可见插件窗口必须自行完成幂等生命周期自举

- 真实正式安装证明，不能假设每个可见渲染器都观察到更早的 `onPluginCreate`；只在该回调里绑定 UI 和安装宿主 runtime，会留下外观可见但永远“等待 Eagle…”的静态窗口。
- 唯一正式入口在 end-of-body 模块加载时立即幂等绑定控件并尝试连接宿主；`onPluginCreate`、`onPluginRun` 和 `onLibraryChanged` 只复用同一自举函数，不创建第二状态机或第二排序入口。
- 用户主动打开插件时必须显式显示窗口并重新读取状态；任何连接失败都写入可见自检中心，不能让静态初值冒充正常运行。

## 2026-08-27：生命周期修复以 v1.1 作为下一轮唯一正式安装身份

- v1.0 已真实正式安装，不能让不同代码再次沿用相同用户版本；生命周期修复后的唯一可安装身份为 `v1.1 / 1.1.0`。
- 核心常量、package/lock、manifest、面板、构建器、安装器和永久身份门禁必须同时一致；唯一产物名固定为 `Eagle排序助手-v1.1.0.eagleplugin`。
- v1.0 历史记录保留为事实，但 v1.0 可交付包不得与 v1.1 并存；清除旧包不等同于安装，生产构建与唯一安装仍由项目总管执行。

## 2026-08-27：renderer 运行环境修复以 v1.2 作为下一轮唯一正式安装身份

- v1.1 已真实正式安装并暴露 renderer 首行 CommonJS `require` 在浏览器环境不可用；修复后不能再次沿用 v1.1。
- 下一次唯一可安装身份为 `v1.2 / 1.2.0`；核心、package/lock、manifest、面板、构建器、安装器和身份门禁必须一致，产物名固定为 `Eagle排序助手-v1.2.0.eagleplugin`。
- v1.1 发布包在总管重新构建前精确清理，不与 v1.2 并存；当前正式安装仍由总管原位替换，专项不自行安装。

## 2026-08-28：file:// renderer 资源加载修复递增为 v1.3

- v1.2 实机打开插件仍停在“等待 Eagle...”，面板未取得真实 Library/集合/成员；可见断点位于 renderer 资源加载/bootstrap 之前，真实数据动作保持停止。
- file:// renderer 不能假设 fetch 一定可用或会及时拒绝。运行资源加载改为 file:// 优先异步 XMLHttpRequest、fetch 回退，并为两条路径设置有限失败边界；任何失败统一写入面板并放行 Eagle 原生行为，不新增轮询。
- v1.2 已真实安装，修复后的下一次唯一正式身份必须为用户版本 v1.3、package/manifest 1.3.0，产物名固定为 `Eagle排序助手-v1.3.0.eagleplugin`；生产构建和安装仍由项目总管执行。

## 2026-08-28：v1.3 静默启动失败的 v1.4 诊断策略

- v1.3 真实 file:// renderer 仍停在“等待 Eagle...”，未出现资源超时或 fail-open 文字；该现象不能证明入口脚本、资源加载或宿主 bridge 任一阶段已执行。
- 启动链必须按阶段写入同一面板诊断，并捕获 window error/unhandledrejection；静态 HTML 的初始占位文本不得当作入口执行证据。阶段历史仅用于诊断，不新增业务规则或轮询。
- v1.3 已真实安装，下一次唯一正式身份递增为 v1.4、package/manifest 1.4.0，产物名固定为 `Eagle排序助手-v1.4.0.eagleplugin`；生产构建和安装仍由项目总管执行。

## 2026-08-28：v1.4 外部入口静默失败的 v1.5 HTML 级启动闭环

- v1.4 实机只显示静态 HTML 初值，不能证明 `sorting-assistant.js` 执行；下一轮先在 HTML 最早可执行位置建立可见启动标记和全局错误捕获，禁止继续猜测 bridge 或排序层。
- 外部入口使用明确相对路径 `./sorting-assistant.js`，由 onload/onerror 和 DOM 就绪标记区分 HTML 脚本被禁、路径/加载失败、外部加载成功但后续执行失败；静态版本文字不算入口执行证据。
- v1.4 已真实安装，下一次唯一正式身份递增为 v1.5、package/manifest 1.5.0，产物名固定为 `Eagle排序助手-v1.5.0.eagleplugin`；生产构建和安装仍由项目总管执行。

## 2026-08-28：v1.5 file:// renderer 全局 require 失败的 v1.6 依赖加载闭环

- v1.5 实机证据显示 HTML 内联和外部入口均已执行，但 Eagle `plugin/api.js` 提供的全局 `require` 将插件相对路径解析到 app.asar，导致入口在读取 Library 前失败。
- file:// renderer 必须忽略全局 CommonJS `require`，改用插件目录相对资源的 XHR/fetch；只有 Node 真环境允许 CommonJS。该边界由永久门禁直接注入带错误解析根的 renderer 验证，并在阶段诊断中显示已禁用 require。
- v1.5 已真实安装，下一次唯一正式身份递增为 v1.6、package/manifest 1.6.0，产物名固定为 `Eagle排序助手-v1.6.0.eagleplugin`；生产构建和安装仍由项目总管执行。

## 2026-08-10：R89-R90 qa.74/API151 原生筛选刷新与跨 Library runtime 隔离（已安装，等待用户真实验收）

- 根因修正：qa.72 已能识别 Eagle 原生筛选，却只停掉插件 PRESENT；当 Eagle 异步
  `rebindRefresh` 与旧智能投影竞态时，旧的全量 1,380 项仍可能留在画面。
- 方案：筛选状态激活且当前 collection 为 smart 时，先取消旧 smart generation/拖动会话，再按 `reason + filterBadge + keyword + filterRules`
  签名最多调用一次 Eagle 原生 `filterContent()`；插件不计算标签、不改写 `allData/filtereds`，且 `sortData/sortRawData` 直接放行 Eagle 原生实现。
  普通文件夹、清除筛选和非智能上下文不触发该握手。
- R90 同时收紧：相同 API 不再是 runtime 复用资格；只有 Library ID 和 renderer scope 都相同才可返回旧 `integrationResult`。切库必须 await 完整 stop，并创建新 API scope、拖动 adapter、handlers 和 generation。
- 正式安装：用户明确批准后，qa.74 已在 Eagle 正常退出后安装至唯一正式插件目录并正常重开；安装器只替换插件、保留 qa.72 可恢复回滚目录，未改 `app.asar`、`.library` 或 NAS 素材。安装后已再次核对 manifest/API151、单一活动来源和受控宿主桥哈希。
- 真实关闭条件：用户需在真实 Eagle 验证选择“妆造”后数量小于 1,380、网格只含匹配项且等待 10–20 秒不回全量；清除后恢复 1,380 和既有排序。另须验证“引力环球 → 引力环球视频 → 引力环球”两库均可手动拖动并各自恢复自己的状态。安装或自动测试不能替代该验收。

## 2026-08-30：v1.8 原生排列方式改为单列下拉集成

- v1.7 的第二列详情块不符合用户截图的原生排列方式体验；正式 adapter 不得再向 `.panel-item:last-of-type` 追加，也不得使用横向换行撑宽布局。
- 插件只向 Eagle 原生排列 select 增加“拍摄时间排序”和“多级排序”两个自有 option；仅自有 option 的 change 事件可阻止未知值进入 Eagle，所有原生 option 必须原样放行。
- 细节区是原生排序行的直接同级、正下方单列块，最大宽度受原生面板约束；普通/智能能力差异和更多操作均在此区域通过 runtime command 呈现，业务规则仍归唯一 runtime。
- v1.8 身份统一为 package/manifest `1.8.0`、面板 `v1.8`，生产构建与安装仍由项目总管执行；计数 P0（1188 与用户记忆 1300+ 差额）独立保持开放。

## 2026-08-31：v1.9 拍摄时间来源与真实显示结果必须同次闭环

- v1.8 正式 runtime 只读取顶层 `DateTimeOriginal`，无法证明它与 Eagle 当前 item 的可见“拍摄时间”语义一致；将有值误判成缺失会触发合法但错误的固定槽位，因此规则文字正确不等于排序已执行。
- 拍摄时间改由唯一 `eagle-item-taken-at-provider` 负责。它只接受 Eagle item 的同语义表示或经 Library + item ID 核验的同语义缓存，逐项报告值、来源和状态；导入、创建、修改时间永远不能作为替代。
- 唯一 runtime 写入宿主数组后，只通过一次宿主网格重置请求刷新显示，不搬运 DOM、不轮询；随后分别核对完整数组、完整筛选投影和当前可见网格。出现首个顺序反例时显示 item ID/位置并不保存本次记录。
- v1.8 已真实安装并暴露本轮失败，修复后的下一次唯一正式身份为 `v1.9 / 1.9.0`，产物名固定 `Eagle排序助手-v1.9.0.eagleplugin`；构建与安装仍由项目总管执行。

## 2026-08-31：v1.10 采用 Eagle item.filePath→EXIF.DateTimeDigitized 的唯一拍摄时间载体

- 事实：v1.9 在普通文件夹 `4-英国站🇬🇧` 报告有值 0/缺失 1,188，但 Eagle 官方 EXIF 检查器对选中 item 显示拍摄日期；只读源码核对证明检查器以 `eagle.item.getSelected()` 取得 item，再以 `item.filePath` 交给 exiv2，显示值来自 `DateTimeDigitized`。
- 决定：排序助手的拍摄时间 provider 只能通过当前已核对的 Library、集合和 item ID 对应的 `filePath/fileURL` 读取 EXIF `DateTimeDigitized`。不得使用 `takenAt`、`DateTimeOriginal`、`importedAt`、创建/修改时间或文件名尾号替代；读取失败必须显式报告。
- 决定：补水任务绑定 Library、集合、成员指纹、规则和 generation，最多 2 个并发并可取消；只在规则包含拍摄时间时启动。切库、成员/规则变化、总开关关闭或停止后，迟到结果零写入；补水完成前不应用排序，完成后由唯一运行位置一次性核对并提交。
- 决定：本轮唯一身份递增为 `v1.10 / 1.10.0`，正式白名单包含自包含 `lib/exifr-mini.umd.js`，预期产物 `Eagle排序助手-v1.10.0.eagleplugin`；项目总管负责构建/安装，本专项只提供安装前代码检查，不能宣称真实功能通过。

## 2026-08-31：v1.10 file:// 读取失败改由 v1.11 宿主字节桥接

- 事实：真实 `4-英国站🇬🇧` 已取得 Library、集合 ID、完整 1,188 项成员和宿主数组，但 v1.10 对所有项目报告 `taken-at-read-failed`（有值 0、缺失 0、失败 1,188）。官方 EXIF 检查器的可见拍摄时间来自 item `filePath` 读取文件后的 `DateTimeDigitized`。
- 决定：正式读取 owner 必须在受支持的宿主 Node/bridge 中以 `fs.promises.readFile(item.filePath)` 取得字节，再交给内置 EXIF 解析器；renderer 不得直接解析 `file://` URL，不得恢复旧 `plugin.js` 或创建第二读取器/缓存。缺少桥接能力时保留 item ID、路径形状、错误码/消息并 fail-open。
- 决定：补水仍绑定 Library、集合、成员指纹、规则和 generation，最多 2 个并发且可取消；切库、成员/规则变化、总开关关闭或停止后迟到结果零写入，任何失败不应用排序。
- 决定：v1.10 已正式安装并暴露真实失败，下一次唯一安装身份递增为 `v1.11 / 1.11.0`，预期产物 `Eagle排序助手-v1.11.0.eagleplugin`；本专项仅提供安装前代码检查，项目总管负责构建、原位替换和安装，不能把自动检查当作功能通过。

# 2026-08-31：v1.12 读取能力探针

- 事实：v1.11 在真实 `4-英国站🇬🇧` 已取得正确 Library/集合/完整成员身份，但 1,188 项拍摄时间读取全部失败；当前证据不足以区分 require/fs 能力、路径形状、权限或宿主执行环境。
- 决定：新增只读 `probe-taken-at-reader`，必须经正式 `executeInMain` 进入唯一 runtime，选取一个 item 并逐字报告 require/fs/readFile 能力、item ID、filePath 形状、`filePath-bytes` 输入、执行环境、原始 code/message 和字节/解析结果；不得读取 `.library` 或写真实数据。
- 决定：探针与正式读取共用 `filePath → fs.promises.readFile → EXIF` owner；不增加第二 reader/cache，不以导入/创建/修改时间替代。能力缺失或读取错误必须可见并 fail-open，保持最多 2 并发、取消、身份/generation 隔离和迟到零写入。
- 决定：v1.11 真实失败保持开放。v1.12 仅完成安装前代码检查，预期唯一产物 `Eagle排序助手-v1.12.0.eagleplugin`；项目总管负责生产构建和安装，本专项不得自行构建/安装。

# 2026-08-31：v1.13 采用唯一 ItemPathResolver

- 事实：v1.12 真实探针取得了正确 Library/集合/成员身份，但批量 `item.get({ids, fields})` 没有 `filePath`，错误逐字为 `item.filePath missing`；这不是拍摄时间缺失结论。
- 决定：唯一 resolver 先按官方批量 API 请求资源字段，缺路径时按 item ID 精确回退 `item.getById`；显式读取原型 getter，不以对象展开代替字段访问。禁止路径猜测、`.library`、app.asar 和旧入口。
- 决定：探针与正式补水共用 resolver 和 `filePath → fs.promises.readFile → EXIF.DateTimeDigitized`；解析失败逐项可见并 fail-open，最多 2 并发、可取消、身份/generation 隔离，迟到零写入。
- 决定：下一次唯一正式安装递增为 `v1.13 / 1.13.0`，预期 `Eagle排序助手-v1.13.0.eagleplugin`；本专项只提供安装前代码检查，项目总管负责构建/安装。

# 2026-08-31：v1.14 支持 getById-only 宿主

- 事实：v1.13 真实 executeInMain 没有 `eagle.item.get`，但该失败不能证明缺少文件路径或拍摄时间。
- 决定：唯一 resolver 在批量 API 缺失时按已核对 item ID 直接调用 `eagle.item.getById`，显式读取原型 getter；仅两种官方能力都不可用才返回 `E_TAKEN_AT_ITEM_GET_UNAVAILABLE`。
- 决定：探针与正式补水继续共用 resolver、`filePath → fs.promises.readFile → EXIF.DateTimeDigitized`、取消/身份隔离和 fail-open 规则。
- 决定：下一次唯一正式安装递增为 `v1.14 / 1.14.0`，预期 `Eagle排序助手-v1.14.0.eagleplugin`；本专项不构建/安装。

# 2026-09-01：v1.15 以无值响应形状诊断取代 getById 返回结构猜测

- 事实：正式 v1.14 的 `getById` 链报 `ITEM_RESOURCE_RESPONSE_INCOMPLETE`；这不是无路径或无 EXIF 的证据。
- 决定：只在唯一 `ItemResourceResolver` 增加 shape-only 诊断与 Map/wrapper/prototype getter 归一化，诊断仅含类型、容量、key 名和 getter 名，禁止路径值或媒体内容；保持 exact ID、并发 1、可取消和 fail-open。
- 受影响 R-ID 与冲突：直接 R59–R64、R101、R102、R105；保留 R34/R100/R103 的 L0 原生放行、R89 原生筛选、R90 跨 Library 隔离、R96 宿主数组所有权、R122–R131 的 generation/单一 supervisor。不得在 native-layout 或 DOM 事件增加资源读取或排序规则。
- 决定：下一次唯一正式安装身份为 `v1.15 / 1.15.0`。本专项不构建、不安装、不重启 Eagle、不读写 `.library`、NAS 或真实素材；自动检查仅是总管安装审核证据。

# 2026-09-01：v1.15 原生排列面板静态收口

- 视觉事实：用户截图证明旧 `Eagle 排序助手` 大块在原生排列面板内形成了第二业务区，包含技术化按钮，违背 Eagle 原生单列布局。
- 决定：`native-layout-adapter` 降为纯挂载/转发层：只注入原生 select 的两个 option，且只将选中的 plugin option 转发至唯一 `set-layout-mode` runtime command；不拦截任何 Eagle 事件，不移动网格，不读取/写入原生计数。
- 决定：只在“缩略图”原生行下挂载“排序锁”“自动重命名”两条同宽原生样式行。锁命令已有唯一 owner，自动重命名尚无可证明的 runtime preference contract，安全禁用而非猜测命令。该点与产品要求存在待闭环差异，安装后真实 UI/命令证据前不得宣布完整功能。
- 受影响 R-ID：R08、R21–R24、R33–R34、R40–R41、R71/R75、R80、R89、R96、R98、R102/R105、R131；冲突裁决固定为 L0 原生事件优先，adapter 不得重新引入 DOM 业务规则。

## 2026-09-04：v1.15 原生重命名行动链与排列语言收口

- 决定：自动重命名是一次受控行动而非持久偏好。原生行只请求 `preview-rename`；唯一插件窗口必须显示全量计划，取消必须清除计划且零写入，确认后才允许同一 owner 运行两阶段原子改名、失败回滚与逐项结果核验。
- 决定：原生排列下拉的插件项固定使用用户语言“文件名、拍摄时间、多级排序、手动排序、恢复自动排序”。每个项目静态接入唯一 `set-layout-mode` 或 `restore-automatic` command；adapter 不拥有规则、计数、轮询、观察器、网格移动或事件取消。Eagle 原生升降序及非插件项继续放行。
- 受影响 R-ID：R07、R08、R18、R21–R24、R33–R34、R40–R41、R71/R75、R80、R89、R96、R98、R102/R105、R131；冲突裁决为锁定高于插件排序/改名、智能集合无锁/改名入口、L0 原生事件优先。
- 安装前证据：精确标签红绿测试、重命名行契约、v1.15 resolver 形状门禁、`npm run check:v1`、`npm test` 和 `git diff --check` 已通过。真实 UI、改名、EXIF、计数与 L0 验收仍待项目总管安装 v1.15 后由专项执行。


## 2026-09-11：当前用户标准和执行例外

- 用户明确标准1-英国6、2-London15，末尾连续数字是照片序号。统一解析，编号只改已有尾号，旧横杠格式兼容但不生成第二横杠。
- 用户明确授权必要时本总管对话直接修改；专项恢复后仍429失败，本轮按这一最新明确授权接手，禁止并行写相同文件。
- Graphify旧图无当前V1节点，仅导航未作为实现真源；真实当前生产源码为依据。EXIF字典及标签别名是两处独立读取缺口，代码检查通过不能代替实际读取值。
- 原生DOM事件不取消；宿主排序方法仅识别插件枚举，其余原样调用原方法，卸载不覆盖后继owner。锁与状态查询不引发重排。
- 本轮未安装、未真实验收，不沿用历史全绿结论。

## 2026-09-11：v1.16 唯一安装与父级视图 fail-open

- v1.16.0 仅从唯一正式根构建并覆盖唯一安装目录；不保留并行包或第二安装来源。
- Eagle“全部/父级”视图无法唯一解释普通/智能集合时，排序助手必须保持原生排列，不注入业务排序；该现场证据不能代替目标文件夹验收。
- 侧栏筛选显示 `4-英国站🇬🇧` 为 1,188；在同一 Library、同一集合身份下才允许与插件快照比较，禁止据此猜测照片丢失。

## 2026-09-12：v1.17 当前层目标、编号与原生入口唯一契约

- 决定：普通父级有直属子文件夹时，排序、拖动和编号的目标固定为 `direct-folders`；普通叶子才使用 `direct-media`。folder 计划不得出现 item ID，item 计划不得出现 folder ID；两类确认分别进入自己的唯一写入 owner。
- 决定：文件编号只替换已有末尾连续数字，`1-英国6.jpg → 1-英国1.jpg`、`2-London15.mov → 2-London2.mov`，不新增横杠、不补零、不改变前缀/场景/扩展名。文件夹编号只编号直属 folder，绝不改其内部文件。
- 决定：原生排列弹窗是唯一日常入口；adapter 只投影状态、晚开幂等挂载并发 command。紧凑行显示规则来源、锁定、手动拖动/恢复自动和目标对应编号；智能集合无锁定和编号。总开关关闭或 stop 立即卸载所有节点、option、wrapper 和监听器，旧控件引用零命令。
- 决定：Library 全局默认、当前集合覆盖、当前集合恢复全局是三条独立命令；adapter 发命令前拒绝重复排序字段，不改变 Eagle 原生“使用全局设置”的含义。
- 决定：`应用到全部` 只复制用户明确点击的一个配置到当前文件夹和全部后代，计划禁止任何 rename 字段，失败恢复完整状态并固定 `renamed:false`。编号及状态导入只能在唯一插件窗口完成全量预览与确认；取消零写入，状态导出必须下载 JSON。
- 版本与边界：v1.16 已正式安装，因此下一安装轮统一 v1.17/1.17.0，预期 `Eagle排序助手-v1.17.0.eagleplugin`。专项只完成唯一正式根修改和安装前代码检查；构建/安装由项目总管执行，真实 Eagle 验收仍是最终真源。

## 2026-09-12：v1.17 原生主区与次级设置分层

- 总管 UI 复核确认：规则来源的三个操作按钮与状态文件导入导出不是高频排序动作，不得在原生排列弹窗主区常驻。
- 原生主区只保留锁定、手动拖动/恢复自动和当前目标编号；其后只有一个默认关闭的 `details`。摘要持续显示当前规则来源，展开后才显示全局默认、本集合覆盖、恢复全局、导出和加载。
- 门禁必须构造实际节点并验证折叠状态和后代关系；字符串存在只能作为静态补充，不能证明按钮没有常驻或状态文件已经收纳。
- 该修正不改变 v1.17 身份和业务命令 owner；未构建、未安装，仍需总管审核后唯一安装并由专项完成真实 Eagle 复验。
