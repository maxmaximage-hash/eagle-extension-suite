# 任务

## 2026-11-14：无桥接宿主的人物图与环境图重命名恢复

- [x] 先写 `public-rename-fallback-core.test.js` 红灯，覆盖公开 Item API 保存成功与失败回滚，再实现最小 fallback 核心。
- [x] 插件窗口在缺少 `eagle.photoTakenSort.execute()` 时显示人物图/环境图预览和确认入口，复用 `selected-rename-core`，只调用公开 `eagle.item.getSelected()`、`item.name` 和 `item.save()`。
- [x] 全量 `npm test`、`node --check plugin.js`、plugin source contract 通过，qa.98 包重建并安装到真实 Eagle。
- [x] 真实 Eagle 选择 BROLL 中一张图片，预览显示 `️家人们喜欢看这种朋友圈吗 - 小红书 → 1-BROLL1`，确认后主网格显示 `1-BROLL1.jpg`，随后用 Eagle 原生 inspector 恢复原名。
- [ ] 主网格多级排序、手动拖动及桥接注入仍受当前 Eagle 4.0.0 签名宿主限制，未宣称排序功能恢复。

## 2026-11-14：Eagle 宿主签名与启动预防门禁

- [x] 记录 2026-11-13 `app.asar` 签名封条失效事故，确认直接改 `app.bundle.js`/未审计 IPC 会触发 Eagle 篡改检查。
- [x] `bridge/rebuild-compatible-bridge.js` 增加 `codesign --verify --deep --strict` 前后门禁、候选签名失败自动恢复、Helper 与本次新增 `Library loaded`/`mainWindow is ready` 启动探测。
- [x] `bridge/restore-compatible-bridge.sh` 恢复后增加签名校验，插件安装器增加安装前后签名校验。
- [x] 自动测试覆盖签名成功/失败、Helper 状态、启动证据和候选失败恢复。全量 `npm test`、bridge contract、Node 和 zsh 语法检查通过。
- [ ] 当前仅恢复原始宿主并确认签名通过。Mac 现场曾出现 V8 初始化长时间挂起，复制文件夹右键仍未完成真实 Eagle 验收，禁止宣称已交付。

## 2026-11-14：复制文件夹安全替代入口

- [x] 先写失败测试，证明 Eagle 公开 API 只能从插件窗口取得选中普通文件夹，主窗口原生右键不允许扩展；失败后已转绿。
- [x] 在插件窗口增加“复制当前选中文件夹（含内容）”按钮，复用 `createFolderCopy`，智能文件夹、多个选中项、无选中项和 API 缺失均禁用并 fail-open。
- [x] 删除旧主窗口右键包装、`CONTEXTMENU.OPEN` 监听、`library-changed` 复制广播和 app.asar folder-copy alias；排序桥自身代码未被本入口改动。
- [x] 自动门禁、包构建和插件-only 安装通过；真实 Eagle 窗口已显示按钮，选中普通文件夹 `BROLL` 后按钮启用，宿主保持原始 b04a 指纹且签名通过。
- [ ] 已在用户授权的 `BROLL` 上尝试一次真实复制，但 CUA 窗口切换期间 Eagle 发生正常退出/重启，未生成副本；树、成员引用和资源总数未变化。期间出现一条非复制的 `Save item` 日志，已停止继续点击，真实递归副本和共享 item ID 验收仍未通过。

## 2026-11-15：宿主恢复后封锁旧 bridge 安装入口

- [x] 正常退出 Eagle 后确认恢复前 `app.asar` 为 `4f56e0da…` 且 codesign 失败；现有恢复脚本第一次因 `uchg` 文件标志失败，清除该标志后重跑成功恢复原始 b04a，codesign 通过，Eagle 未重启。
- [x] `bridge/install-compatible-bridge.sh` 已改为无条件 fail-closed；旧 qa.94–qa.97 release installer 同样永久阻断，qa.98/current installer 只允许原始未桥接宿主的 `--install-plugin-only`。
- [x] 新增 `test/host-install-safety-contract.test.js`，扫描所有安装脚本禁止 `app.asar` 的 cp/mv/ditto/覆盖路径；Node 测试和 shell 语法门禁通过。
- [ ] 后续不安装、不重启、不修改 bridge/app.asar；复制文件夹仍等待稳定宿主和可归属的真实点击验收。

## 2026-11-10：原生添加日期选择优先于旧插件排序意图（R140）

- [ ] 2026-11-10：R140（关联 R40/R41/R71/R80）原生“添加日期”方向回归。真实日志显示
  Eagle 在显式选择 `IMPORT/CREATEDATE` 时仍同步回调旧原生键，排序意图残留会把
  `sortData/sortRawData` 的首帧映射回 `PHOTO_TAKEN`。已先写失败门禁并修复为原生
  `changeOrderBy` 调用 Eagle 前清除旧插件 intent；空宿主瞬态仍保留插件 intent，避免
  破坏 R71 的延迟回调保护。自动测试通过，当前版本已安装，尚未完成真实 Eagle 界面验收。
  当前 macOS 会话处于 `CGSSessionScreenIsLocked=1`，Eagle 仅有主进程和 crashpad、没有 renderer，
  因此“网络样片”界面验收等待解锁后继续。
  `npm test` 全量通过；`./scripts/build-github-release.sh` 已生成当前版本
  `2.5.22-qa.98` 包，包 SHA-256 为
  `ed16d5f19a90a4bab5d2aa33c8e8fd4c734d6c4f0f5e474810b3e25ae9db0b9e`，最终
  `plugin.js` SHA-256 为 `d4fe388ced388301a364b0435821763b97933a629f536e2a5ab1bf04c7c6e5de`。已安装的
  旧 qa.98 曾为 `e0828ae2ce651209f772a61dca78bc26b5e01fdf6f52e6149e0073aeb9f812a1`，当前已替换为重建包，待真实界面验收。
  真实对照又确认 Eagle 原生 `IMPORT/CREATEDATE` 返回方向与 UI 语义相反，已在
  `host-native-order-core` 固化仅针对这两个日期键的一次 reverse；`NAME` 等其它原生
  键保持宿主结果，R71 插件键与 L0 选择/预览/右键链不进入该 helper。补充执行级注入
  回归后发现 helper 原先依赖模块外 `Set` 常量，真实载荷会 `ReferenceError`，已把
  日期键集合移入函数体。当前包 API_VERSION=155，已安装。补充失败测试确认普通文件夹的原生 host callback 会先于 stale scoped/DOM plugin key 生效，且已持久化清除旧 intent。


## 2026-10-30：v1.17.0 当前电脑安装与真实窗口验收

- [x] 正式安装目录 `/Users/max/Library/Application Support/Eagle/Plugins/com.max.eagle-photo-taken-sort` 已由 GitHub 同步后的 `Eagle排序助手-v1.17.0.eagleplugin` 替换；manifest 为 `1.17.0`。
- [x] 替换前备份至 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin-before-sync-20261030/plugin`；Eagle `app.asar` 未改动。
- [x] Eagle 4.0.0 重启后真实窗口显示 `v1.17`、当前 Library/集合和完整成员数；只读自检显示“宿主 bridge 已返回”、任务空闲、最近错误无。
- [ ] 尚未执行真实排序、手动拖拽、批量改名、锁定或任何 Library 写入；当前结论是“已安装并完成窗口/bridge 验收”。

## 2026-10-30：R131 原生 `$parent` scope 红灯修复

- [x] 真实 Eagle 4.0 原生排列面板初检只有 Eagle 自己的“使用全局设置”，没有排序助手入口；旧插件窗口的 bridge 绿灯是误导性健康信号。
- [x] 先红后绿覆盖真实 `select` child scope 与 `$parent.changeOrderBy` owner；adapter 现在沿 `$parent` 找到并包装真正的 `changeOrderBy/changeSortIncrease` owner。
- [x] 全量 `npm test` 与 `npm run check:v1` 通过；新包安装并重启后，原生面板真实出现排序锁定、手动拖动、文件自动编号和高级设置。
- [ ] 真实拍摄时间/多级排序结果、手动拖动和改名仍未写入正式 Library；只关闭了入口注入红灯。

## 2026-08-26：v1.0 排序实体插件结构重建

- [x] 用户明确产品边界：插件只有排序一个目的；普通/智能体验一致；Eagle 原生全部能力零限制；保留扩展排序维度、最高优先级手动排序、排序锁、既有自动编号/重命名和所有有效排序记录。
- [x] 用户明确交付形态：Eagle 中可见实体插件，具备逐项功能健康检查；版本从 `v1.0` 开始，每实际安装一轮递增 `0.1`。
- [x] 完成旧安装只读盘点：`2.5.22-qa.114`、同一正式插件 ID，主文件 12,449 行、57 个 lib 模块、约 3 MB 安装目录与 27 MB PluginData；排序与 GPS/标签仍共享生命周期。
- [x] 建立 [v1.0 重构合同](docs/SORTING-V1-REBUILD-CONTRACT.md)，列出 F001-F022、保留/重写/移除边界、数据保全、版本制度、安全清旧和安装顺序。
- [ ] 生成旧排序状态只读快照与 migration fixture，证明规则、手动关系、锁、编号、简介和团队 sidecar 可按 Library/collection 完整迁移。
- [ ] 先写 v1.0 红灯：实体检查中心、L0 原生零限制、普通/智能一致、全局继承、DOM 无关 host drop、单 supervisor、单 repository 和迁移审计。
- [ ] 实现排序专用 v1 模块及实体检查中心；从安装包和生命周期移除 GPS/标签/发布依赖。
- [ ] 完整自动门禁、确定性构建、回滚备份后，正常退出 Eagle，停用旧运行目录并唯一安装 `v1.0`。
- [ ] 正常启动并按 F001-F022 完成真实 Eagle 验收；失败不得标记完成，必要时恢复旧备份。

## 2026-08-26：R132 排序需求总表（开发前置基线）

- [x] 汇总 SORTING-RULES、目标架构、行为矩阵、永久回归合同、迁移计划、历史现场和当前安装版诊断，形成唯一文字需求：[SORTING-REQUIREMENTS-SPEC.md](docs/SORTING-REQUIREMENTS-SPEC.md)。
- [x] 明确普通/智能/全局继承、原生 L0、手动拖动、自动排序、自动编号、父叶层、批量配置、持久化、性能、安装和真实验收边界；未建模的“全局设置”继承语义已单独写明。
- [ ] 待用户确认 R132 需求总表后，才能按需求 ID 登记冲突、先写失败测试，再启动下一轮排序专项；确认前不得继续在 qa.114 上补丁式扩展、安装或重启。

## 2026-08-26：R131 普通/智能统一排序控制平面（qa.114/API190 源码候选）

- [x] 依据用户“整个排序插件全部重做”的要求，完成台账、目标架构、行为矩阵、迁移计划和当前接线审计；受影响范围为 R12/R19/R40-R41/R52/R71/R74-R75/R80/R98-R99/R109-R130，冲突门禁保留 R01-R03/R15/R33/R34/R89/R90/R96/R100-R105/R121。
- [x] 先写 `r131-unified-sort-control-plane.test.js` 红灯，证明旧代码不存在统一 control plane；覆盖 normal/smart 同状态机、native/taken/multi 身份、observation-only、prepare/commit/rollback、stale command、Library+collection 隔离与 global fail-open。
- [x] 新增 `sort-control-plane-core.js`：明确用户选择只生成 pending command；宿主 collection order/direction 保存并读回一致后才 commit，失败保留上一 committed state。DOM select、Angular 字段和 host callback 不再拥有排序意图。
- [x] renderer 的排序标签、规则区、比较器和 lifecycle signature 全部读取 control-plane projection；普通与智能适配器共用 `currentSortIdentity()`。`IMPORT → PHOTO_TAKEN_AT` 不再由多个观察值猜测。
- [x] `SortingSupervisor` 扩为 normal/smart 共用。normal attach 进入既有 normal presenter，smart attach 进入既有 lifecycle；route/intent/scope/renderer/Library/前后台变化继续取消旧 generation。
- [x] 候选身份递增为 `2.5.22-qa.114/API190`；首轮完整 `npm test` 已通过，注入载荷编译通过。
- [x] 版本变更后的全部 JS/zsh 语法、`git diff --check`、完整 `npm test`、双确定性构建和安装器 `--check` 通过；插件包 SHA-256 `c1d499e6d9e27b588fbd9bb96d57be1444b13145f78116c6890fc0738c0ed6d0`，安装器 SHA-256 `2c995ec4c1fdbcf1425f1ff9a1ceae86f732af67abbf6301ab9ea6b79061bbf8`。
- [x] 用户明确要求立即执行后，排序专项完成正式安装闭环：先确认唯一 qa.113 来源并记录 `plugin.js` SHA-256 `36b7a49afbe42fb18084f6a988d7e86097b467f3dc093613e664f920cf4099ac`，Eagle 4.0.0 / `app.asar` SHA-256 `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`；正常退出后唯一安装 qa.114/API190，安装版 `plugin.js` SHA-256 `38c260da99d49eceaea72f6cdee8d17078db03fac86b990f90dc9977dc607e6a` 与候选解包一致，同 ID 来源仅一处。
- [x] 安装器创建回滚点 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260826-204357`；正常启动 PID 5247，诊断有 `BOOTSTRAP_READY → INJECT_START → INJECT_OK` 与完整 scope-route-ready，未见 `INJECTION_FAILURE`/`MONITOR_FAILURE`。
- [ ] 真实界面验收仍待完成：普通与智能 `IMPORT → PHOTO_TAKEN_AT → PHOTO_TAKEN → IMPORT`、升降序镜像、刷新/重启、快速切换、失败回滚、筛选/选择/预览/右键/拖出和流畅性。启动自检另有“界面布局诊断 ok:false（selectedOrder IMPORT，布局开关诊断失败）”记录，必须在 UI 验收中单独复核，不能视为通过。

## 2026-08-23：R130 正常重启 host scope 后水合重绑（qa.113/API189）

- [x] 从 qa.112 正常重启现场继续：MAX route/UI 539 已恢复，但 generation 4 `HOST_SCOPE_UNRESOLVED → route-fail-open` 后没有 539/527/12/0、DATA/VISIBLE/PRESENT-READY。
- [x] 先写 R130 红灯，覆盖 route 已知、首次 unresolved、同 collection scope/renderer 后水合、新 generation READY、重复信号去 storm、身份变化取消、迟到零提交与永不水合零写入。
- [x] 最小修复限定在排序 supervisor/collection adapter/renderer glue：URL route 优先于 stale scope view；以 Angular digest one-shot observation 重绑 exact owner，不新增 timer、通用轮询、DOM 强排、refresh 或第二 lifecycle。
- [x] 完整 `npm test` 79 个测试文件、140 JS、123 shell、`git diff --check` 全绿；双构建插件包 SHA-256 `6c90efcdd79fd3388cd0e799825f80d6f48dd04af77be9e4a8dfc68e5c3cca84`，安装器 `a2ccdf4e6540c3b8bc001759739ba892972c72d19f2dd91e57353d4534f099a8`。
- [x] Eagle 正常退出后备份 qa.112 到 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260823-233044`，唯一安装 qa.113/API189 并正常启动；源码/安装 `plugin.js` SHA 相同，`app.asar` 未变。
- [x] 正常重启直接恢复 MAX 后 539/527/12/0、DATA/VISIBLE/PRESENT-READY；`MAX→线上展示照片→MAX` 真实触发 unresolved→single readiness→新 generation READY，60 秒无二次跳序。`引力环球→引力环球视频→引力环球` 后视频 `高颜值` 571/571/0/0 READY、最终 MAX 再次 539/527/12/0 READY；两库普通文件夹选择、预览、右键均保持原生。

## 2026-08-23：R122-R129 排序 v3 唯一 supervisor（qa.112/API188）

- [x] `sorting-supervisor-core` 与 renderer wiring 先红后绿：冷启动未 hydration、renderer/scope 重建、A↔B Library、smart A→B→MAX、前后台、missing lifecycle 自动重绑；旧 generation 迟到零提交。
- [x] MAX 539 fixture 验证 527/12/0；纯 TAKEN_AT asc/desc 严格相反，NAME+TAKEN_AT 多级保持独立；monitor header + 80 项分页避免桥接全量 context 阻塞。
- [x] R128 复现诊断循环引用导致 structured clone 卡死；跨桥诊断移除 raw scope/renderer，仅保留布尔所有权证据。R129 将 smart 不适用的 rename/folder-level 自检明确标为通过且 `applicable=false`。
- [x] 完整 78 文件 `npm test`、139 JS、90 shell、差异检查与两次确定性构建通过。包 SHA-256 `eca0d906f09bb12ac4964739525deeb9247ac176b2ccdd8ff180815d6fc5d072`，安装器 `e95768389a245778a06acd04506a8bd7f37009884af26ee799b557e85ee75848`。
- [x] qa.112 唯一安装，回滚点 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260823-210302`；MAX 冷启动 539/527/12/0、降→升→降及 11 项 smart 往返完成 DATA/VISIBLE/READY 闭环。
- [x] 系统解锁后完成两 Library 只读闭环：引力环球视频 `高颜值` 571 项 generation 1、571/0/0、DATA/VISIBLE/READY 全绿，并通过原生选择、空格预览、右键菜单；切回引力环球后 MAX 539/527/12/0 恢复。最终正常退出/启动后的新 runtime generation 1 仅一次 commit/PRESENT-READY，65 秒内首序列不变、无二次跳序。

## 2026-08-22：R121 qa.107/API183 混合类型普通文件夹手动 drop

- [x] qa.105 真实验收退回：混合 JPG/PDF/DOC/DOCX 蓝色落点后回弹。源码审计确认不是类型、EXIF、preview 或 path 资格过滤。
- [x] R121 红灯转绿：线性顺序以 Eagle 宿主挂载 itemId/data order 为真源；瀑布流 geometry 仅用于反馈，不再用于可见顺序证明或回滚；任意宿主可排序类型均可互为源/目标；Finder/native drag-out fail-open；锁态拒绝且无虚假成功。
- [x] native IMPORT/其它原生排序下，存在活动 manual relations 时由唯一 presenter 叠加恢复；无 relations 才 SKIP_NOT_PLUGIN。禁止 DOM 强排、全局 refresh、dragend 补提交、第二状态机。
- [x] 恢复任务新增入口级稳定红灯：先有普通蓝色落点，但 document capture `drop` 不可达，Eagle 只回调 `window.onDropBoxItem`；旧代码却把该回调恢复为原函数，因此零 MoveCommand。
- [x] 最小所有权修复：`onDropBoxItem` 是唯一命令入口；document `drop` 只保留健康观察；同物理会话重复回调只复用第一结果，未证明会话委托 Eagle，`dragend` 仍只清理。
- [x] R121 定向、手动移动/事务、host presenter、L0 ownership、plugin source、注入编译及完整 `npm test` 通过。因 qa.106 发布产物已存在，入口语义递增为 `2.5.22-qa.107/API183`，不覆盖旧产物。
- [x] qa.107 已唯一安装并运行；源码/安装版/发布包内 `plugin.js` SHA-256 均为 `8deca3d122e838dcac35e75798dee95cef745c358a8e3ba3d226b2af5e52534e`，发布包 SHA-256=`4b905d53f52f7311a14e5866df080afff92370a04dd3d52a7af14e19e2d13581`，`app.asar` 仍为已审计桥接 SHA `4f56e0da...2e067f3`。
- [x] 接管已确认第一次 JPG 手势未提交：网格不变，当前运行日志零 `HOST_INPUT/MOVE_RECEIVED/PERSIST_OK/MANUAL_DROP_COMMITTED`。排序锁关闭、手动拖动开启；三次受控复核仍未交付宿主 drop，符合既有 Computer Use 输入边界，不能据此升 qa.108。
- [x] 本轮完整 `npm test` 再次通过；真实 Eagle 原生选择、PDF 预览、右键菜单及导出/重命名入口可用，未改名、未删除、未导出。
- [ ] JPG/PDF/DOC/DOCX 各一次物理内部 drop、离开返回/正常重启持久化与 Finder 物理拖出仍未验收；当前输入工具不能生成可判定的宿主 drag/drop，禁止伪造通过。证据见 `qa-evidence/QA-R121-QA107-REAL-UI-TAKEOVER-2026-08-22.md`。

## 2026-08-20：R120 qa.105/API181 smart READY 事务证明边界

- [x] qa.104 真实 MAX照片集已呈现正确升降序，A→B→A 等待 7.5 秒无覆盖，人物图筛选
  539→394→539 画面与计数正确；但日志仍有 `DATA-VERIFY ok=false`/`PRESENT-FAIL-OPEN`，
  清除筛选后出现 `READY-COMMIT-FAILED`，qa.104 失去发布资格。
- [x] 新增 `r120-smart-ready-proof-boundary.test.js` 红→绿：原子 backing+projection commit 的
  transaction proof 是 data order 唯一真源；删除 `smartCommittedHostArray`，presenter 不再读取
  分页/陈旧 readback 覆盖明确的 `dataOrderVerified`。
- [x] native filter 检测提前到 `beginSmartCollectionLifecycle()` 之前；筛选期间不创建 lifecycle/frame
  generation，清除筛选后重建，保持 Eagle 原生筛选主权。
- [x] 全量测试、全部 JS/shell 静态检查、`git diff --check`、注入编译、双确定性构建和安装器只读
  预检通过。qa.105 包 SHA-256=`cd7ef72999a0e2b3906657d5384606c96bbb2aae72418636e619e260a5b8a85e`；
  安装器 SHA-256=`ea2bd39a60748504066ad9d49b2824093677bd6a1ca1fd66d2b10541361b2181`。
- [x] qa.105 正常退出/回滚备份/唯一安装/正常启动完成。MAX照片集 539 项冷启动升序首五项为
  `IMG_9755-编辑 / IMG_9840-编辑 / IMG_9864-编辑 / IMG_9933-编辑 / IMG_0127`；
  降序首五项为 `1-网球10 / 1-网球5 / DSC07080 / DSC07051 / IMG_6820`，再切升序恢复。
- [x] metadata 证据为 527 项有拍摄时间、12 项稳定缺失、0 项解析失败；升降序各自进入独立
  `PRESENT-READY`。A(539)→B(线上展示照片 91)→A 等待 8 秒无迟到覆盖。
- [x] 人物图原生筛选 539→394 时记录 `SMART_NATIVE_PROJECTION_BYPASS reason=native-filter-active`；
  清除后恢复 539，token 8 再次 `DATA-VERIFY ok=true`、`VISIBLE-VERIFY ok=true`、
  `PRESENT-READY`。当前 qa.105 运行实例无 `DATA-VERIFY false`、`PRESENT-FAIL-OPEN`、
  `READY-COMMIT-FAILED`。
- [x] 最终安装身份：repo/installed manifest=`2.5.22-qa.105`，API181；两份 `plugin.js` SHA-256
  `2bd77f4d4e5a175447c8c1d7d638132a61d0be93547c051b483f697d1f2a8f9c`；同 ID 单一来源；
  `app.asar` SHA-256 保持 `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`。

## 2026-08-20：R119 qa.104/API180 smart 稳定窗口末次确认

- [x] qa.103 冷启动真实复现：MAX照片集 539 项首帧正常，但 5 秒后仍是原生顺序，日志停在
  `SMART_LIFECYCLE_HOST-PENDING`，未进入 presenter。
- [x] `r119-smart-host-stability-follow-up.test.js` 先红后绿：adapter 返回精确剩余稳定预算，接入层
  只安排一个绑定 `smartObservationGeneration` 的单次 follow-up；路由/模块变化取消旧观察。
- [x] 最小修复不增加轮询、refresh、DOM 重排、遮罩或素材写入；候选递增为 qa.104/API180。
- [x] 完整 `npm test`、全部 JS/zsh 静态检查、`git diff --check`、双确定性构建及安装器只读
  预检通过；插件 SHA-256 `18a327796b8593c083d8385938d3684c37c50797f7d2b33f50a926937347bed6`，
  安装脚本 SHA-256 `adb1c57c5be35be21bd359ebe3853f384276d96aa79922d33ba6a893ad1b9e32`。
- [ ] 唯一覆盖安装、正常重启以及 MAX照片集冷启动升降序、快速 A→B→A、539 计数/筛选真实验收。

## 2026-08-20：R118 qa.103/API179 smart host 投影稳定边界

- [x] qa.102 真实验收通过 MAX照片集 539 项冷启动升序，并验证降序首五项
  1-网球10 / 1-网球5 / DSC07080 / DSC07051 / IMG_6820 与再切回升序。
- [x] 快速 A→B→A 暴露新失败：A 返回后 60 张虚拟窗口过早 PRESENT-READY，紧随的 Eagle
  loading/120 张补载把网格覆盖回原生顺序，6.5 秒后仍未恢复。
- [x] r118-smart-host-projection-settle.test.js 先红后绿；只在 host snapshot adapter 启用
  150ms 连续投影稳定门，loading/窗口补载重置该门。成员完整性、metadata proof、L0 原生事件、
  无 EXIF 成员和 presenter 事务契约不改。
- [x] qa.103/API179 完整 npm test、全部 JS/zsh 静态检查、diff gate、双确定性构建和安装器
  只读预检通过；插件 SHA-256
  `de2f5c46ed7964036b67d5d5cb71e7ddbc98586517f1e855c273f4ee477a1632`，安装脚本 SHA-256
  `d736f2736ef2e9dbfc46a8bb06e0f9f1e9c439708987454fc683caa0c2266757`。
- [ ] 唯一安装、正常重启与真实快切/筛选计数验收。

## 2026-08-20：R117 qa.102/API178 smart metadata 第二次稳定观察不得被 heartbeat 快速返回吞掉

- [x] qa.101 正常启动真实复现：MAX照片集 539 项首帧可用，但日志在
  `FINAL-ORDER-PENDING metadataReady=false` 与 1500ms deadline 后永久停止；十多分钟无 scan、
  `SMART_TAKEN_AT_EVIDENCE`、present 或 commit，网格保持 `IMG_7907…` 原生临时顺序。
- [x] 根因收敛：smart scan 为防 A→B 旧成员错读而要求同一 snapshot 连续观察两次；第一次把
  identity 写入 `pendingSmartScanIdentity`，但 monitor 已先保存相同 heartbeat，下一轮直接返回，
  第二次确认永远无法发生，metadata 扫描从未启动。
- [x] `monitor-core.test.js` 先红后绿并新增
  `r117-smart-monitor-late-metadata-admission.test.js`：pending proof 可穿过一次 unchanged heartbeat；
  相同 identity 确认后立即清空，之后恢复零工作快速路径；切换 identity 重新两次确认。
- [x] 最小修复只改 monitor admission/stability gate，不增加刷新、DOM 重排、EXIF 同步读取或高频轮询。
- [x] qa.102/API178 全量 `npm test`、JS/zsh 静态检查、diff gate、双确定性构建与发行安装器
  只读预检通过；插件 SHA-256 `71d54db2eb398b5a5f13a191ee0138a9ce477d62e4e5f21bfb021b5cafe4d6e4`，
  安装脚本 SHA-256 `1c56b898e9b64bb4f40df0ad4a3e3511a603c66e6d032c1dd536d7d042409bfb`。
- [ ] 唯一覆盖安装和 MAX照片集升降序/A→B→A 真实验收。

## 2026-08-20：R115 qa.100/API176 smart presenter 必须保留 host owner

- [x] qa.99 真实日志复现：539 项、527 有拍摄时间、12 稳定缺失均已完成，但提交仍返回
  `SMART_NATIVE_MEMBERSHIP_BYPASS reason=smart-owner-required`，qa.99 失去发布资格。
- [x] 根因收敛为生命周期接入断链：`observe()` 已把 `captureHostArrayOwner()` 与成员快照一起传入
  lifecycle，但 lifecycle 调用方在进入 `smartCollectionPresenter.presentVerified()` 时遗漏了
  `request.hostArrayOwner`，transaction boundary 因收到 null owner 正确拒绝提交。
- [x] `r115-smart-presenter-ownership-forwarding.test.js` 先红后绿；只透传同一 owner 对象，不在
  presenter 内重捕获，不放宽 Library/route/scope/generation/ref/page/member 任一门禁。
- [x] 候选递增为 `2.5.22-qa.100/API176`；全量 `npm test`、全部 JS/zsh 静态检查、diff gate、
  注入源码编译、双确定性构建及安装器只读预检通过。
- [x] 双构建 SHA-256：插件
  `47b959aa9597bd74836e132ea8c87a3ec19a46809a82e1da5017aa1897609191`；安装脚本
  `1f66b7038da64e4f27e730c890de6e2422813617177dc6642f7bef27e0397316`。
- [ ] 唯一安装、正常重启及 MAX照片集 539 项升降序/多级规则/快速切换/筛选计数真实验收。

## 2026-08-20：R114 qa.99/API175 smart route 必须绑定真实活跃 scope

- [x] qa.98 真实升序操作触发 539 项后台 metadata（527 有时间、12 稳定缺失），随后
  `SMART_NATIVE_MEMBERSHIP_BYPASS reason=smart-owner-required`，网格保持旧顺序，qa.98 失去发布资格。
- [x] 根因是 Eagle URL 使用小写 `smartfolder=`，旧 `refreshHostScope()` 只匹配驼峰
  `smartFolder=`，未能从存活的 Angular scope 树绑定当前 smart controller。
- [x] `r114-smart-route-scope-ownership.test.js` 先红后绿；新增纯 `host-route-scope-core`，只按
  route kind + immutable collection ID 选择 live scope，旧普通 scope、其他智能 scope 与缺失 owner 均零提交。
- [x] 候选递增为 `2.5.22-qa.99/API175`；全量 `npm test` 通过。
- [x] JS/zsh/diff 静态门禁、双确定性构建和安装器只读预检通过；插件 SHA-256
  `9322f41d97ec86e418f233b010a742440e3c5f29ff8b6a00d69a340a11c7df20`，安装脚本
  `50d5096a9fdcbec8daea670bf94fd3e4950334bb02da7f310f4309ac3e3de843`。
- [ ] 唯一安装/重启以及 539 项升降序、多级规则、快速切换和筛选计数验收。

## 2026-08-20：R113 qa.98/API174 完整顺序与分页投影必须同一事务

- [x] qa.97 真实日志复现：539 项 `allData` commit/data verify 成功，但 Eagle 当前
  `filtereds` 仍是 100 项旧分页，300 张虚拟卡保持原生旧顺序；qa.97 失去发布资格。
- [x] `r113-smart-pagination-projection.test.js` 先红后绿：539 backing + 100 projection 原子计划、
  live item 对象保鲜、原生标签/搜索零写入、route/generation/ref/page 漂移零提交、双数组原子回滚。
- [x] smart adapter 删除 40×50ms 轮询；一次 Angular render boundary 后只验证完整 backing 与
  `filtereds = desired.slice(0, len * page)`，不得 refresh、延长 timeout 或重排 DOM。
- [x] 候选递增为 `2.5.22-qa.98/API174`；定向回归与首轮全量 `npm test` 通过。
- [x] JS/zsh/diff 静态门禁、双确定性构建和安装器只读预检通过；插件 SHA-256
  `d9fec3b782ae57416b94c721b6e2c74a78a4b256a31f79365d0af5ccf726535b`，安装脚本
  `3b113b5d9d95bc622037ccff9c793cb9d4cd508845f3b576667cd025b43b4e90`。
- [ ] 唯一安装与 MAX照片集 539 项真实升降序/多级规则验收。

## 2026-08-20：R112 qa.97/API173 虚拟窗口不得阻断完整 smart host 提交

- [x] qa.96 真实日志证明 R111 已生效：deadline 后 metadata 完成并进入 presenter，527 项有时间、
  12 项稳定缺失；随后因 539 项只挂载 300 张虚拟卡而返回 `visible-window-unproved`，未提交顺序。
- [x] `smart-projection-proof-core.test.js` 先红后绿：预提交 DOM 只证明 rendered IDs 唯一且属于当前
  539 项 member set，不再要求虚拟卡按 backing array 连续；跨集合卡和重复卡仍在第一笔 host write 前拒绝。
- [x] 提交后继续由完整 `allData/filtereds` projection 精确验证 desired order，rendered cards 只证明
  无陈旧成员泄漏；不得把 DOM 几何、文件名或部分窗口当排序真源。
- [x] qa.97/API173 全量门禁、双构建与安装器只读预检通过；插件 SHA-256
  `bb2fa3a95ce85909e6884ce8b17d32cd9ffeb9ddc26f0e5243a78fdccc34849f`，安装脚本
  `ca9820133dd2251f38f0a4a0280c81d3ed47ab84d5038cb30bd54544b1276f21`。
- [ ] 正常安装重启及 539 项真实升降序/多级规则验收。

## 2026-08-20：R111 qa.96/API172 首帧 fail-open 后仍完成真实智能排序

- [x] 验收退回 qa.95：`MAX照片集` 539 项首帧可见，但 1500ms 后进入终态并清除 observation，
  metadata 后续就绪永远不能进入 presenter；不白屏不等于拍摄时间排序已生效。
- [x] `r111-smart-late-ready-commit.test.js` 先红后绿：首帧 deadline 只恢复 Eagle 原生交互，
  generation 保持可恢复；metadata proof 后续完整时同 generation 只 present/commit 一次；路由切换
  仍同步取消旧 token。
- [x] 排序意图签名纳入 orderBy、升降序、多级 rules、锁态和 manual revision；意图变化创建新
  generation，旧 generation 零提交，成员/metadata cache 更新本身不重启意图 generation。
- [x] 候选递增为 `2.5.22-qa.96/API172`；全量 `npm test` 已通过。
- [x] JS/zsh/diff 静态门禁、双确定性构建与安装器只读预检通过；插件包 SHA-256
  `6f1a57e655abe5372e49ca1cff0a8187dbd793df74904ef990e76fa591f03001`，安装脚本
  `16ddf3ca78f2b70364c8ed03c36c8528328ac1e7d6e9be76ea74d7f43da1a75a`。
- [ ] 正常安装与重启后，在 `MAX照片集` 539 项记录至少五项 itemId/takenAt/source/升降序位置，
  多级规则、快速 A→B→A、筛选/计数均真实通过。

## 2026-08-20：R110 qa.95/API171 智能验证后台化与拍摄时间真源

- [x] 现场确认 qa.94 在 `MAX照片集` 539 项创建全屏验证层并隐藏 `#box-list`；停用排序模块后
  原生缩略图、选择、滚动和 EXIF 恢复，但该状态不等于拍摄时间排序恢复。
- [x] `test/r110-smart-background-verification.test.js` 先红后绿：永久禁止全屏 surface、隐藏
  网格和阻塞性 `aria-busy`；pending/0 项/虚拟窗口/NAS 慢/异常/路由离开/A→B→A 均原生
  可见，验证 1500ms 超时并携带 AbortSignal，迟到结果不得提交。
- [x] 拍摄时间真源改为新鲜 Eagle item metadata 优先于旧 timestamp cache；自动证据记录
  present/missing/failed/total 和 5 个 itemId/takenAt/source/position。升降序已证明五个有时间
  成员精确镜像，无 EXIF 完整保留并稳定置尾，手动关系叠加且锁仍最高优先级。
- [x] 候选递增为 `2.5.22-qa.95/API171`；全量 `npm test` 已通过。
- [x] 全仓静态检查、双确定性构建、唯一来源审计和安装器只读预检通过；插件包 SHA-256
  `0e56bb1d6e5b15761f7437cf382d005fde2565a9886117095afac57065a68882`，安装器
  `8804ec9eba119731a73c1365c9225972cebb6e3852a81247cb73a86dfd665e47`。
- [ ] 正常退出、备份、唯一安装和正常重启后，在 `MAX照片集` 真实验证 539 项首帧、升降序
  时间证据、无 EXIF、手动关系/锁、筛选、选择、拖动、导出、右键和预览；自动门禁不替代现场。

## 2026-08-20：外部测试产物只允许位于用户指定目录

- [x] 测试根目录固定为 `/Users/max/Downloads/测试/`；禁止自行挂载、禁止向 NAS 收藏根目录、
  正式 NAS 根目录、桌面或用户主目录写测试库、辅助目录和测试导出。
- [x] 已清理 R105 测试库、`GravitySharedSources`、`Eagle-Test-Libraries`、桌面 `1-GAGA-*`
  目录和 NAS 收藏根目录 39 张误放副本；正式入口 `团队文件-MAX线上协作中台` 保持不变。
- [x] `/Users/max/Downloads/测试/1-GAGA-39` 已核验 39 文件、39 唯一名称、39 唯一 SHA、
  227,188,953 bytes、0 子目录。

## 2026-08-20：R109 qa.94/API170 首次路由空网格 fail-open

- [x] qa.93 正常安装与重启后，R108 日志已由“手动拖动自检失败”转为通过；但从 587 项
  “海外素材”首次进入 1-GAGA 时，右侧 39 项而网格 0 项。相邻 2-OOTD 45 项正常，返回
  1-GAGA 后 39 项恢复，证明是 route/scope transition 竞态而不是文件丢失。
- [x] `test/r109-host-sort-route-ownership.test.js` 先红后绿；新增纯 ownership core，正常
  host sorter 只有 route、active/callback scope、Library 和每项 membership 全部一致时才
  使用插件排序，否则直接 Eagle native fail-open，零刷新、零延时补写。
- [x] 候选递增为 `2.5.22-qa.94/API170`；qa.93 作为 R108 转绿但 R109 现场失败证据保留。
- [x] 全量自动/静态门禁、双确定性构建和安装器只读预检通过；插件包 SHA-256
  `d3b5330dc27974607e7e27924bf0419e02a63ebff4979fed60c8a394fdb1a751`，安装器
  `dca98b3725a2455ad33c135d492481f332af4e83760e5ef1d04bc7a63a9f76f2`。
- [ ] 唯一安装并真实复验首次直接进入 1-GAGA 即显示 39 项；不得用二次导航或刷新掩盖。

## 2026-08-20：R108 qa.93/API169 拖动健康诊断与运行时所有权一致

- [x] 只读代码/日志对照证明 qa.92 的“手动拖动自检失败”为确定性误报：运行时已按 R103
  删除四个 pointer listener，只保留七个 fail-open 监听器，但两处诊断仍要求旧 11-listener
  实现；该误报本身不证明真实拖动失败。
- [x] `test/r108-drag-diagnostic-contract.test.js` 先红后绿；注入 runtime 现在以一个 canonical
  handler set 同时驱动启动健康和只读 integration check，且永久禁止 pointer 状态机回流。
- [x] 候选递增为 `2.5.22-qa.93/API169`，qa.92 保留 R106/R107 与 39/39 现场基线。
- [x] 全量 `npm test`、全仓 JS/zsh 语法、`git diff --check` 和双确定性构建通过；插件包
  SHA-256 `ef254a27cd83f65490e965453535294428988129619b93b91a6e4f3e17e58d33`，安装器
  `4ab4e007d903c104ee814278a1c0678b239506193e45db4d202d14502445ad6c`，安装器预检通过。
- [x] qa.93 唯一安装并正常重启；16:00:45 日志 `BOOTSTRAP_READY` 857ms、`INJECT_OK`、
  “手动拖动自检通过”，R108 真实关闭。回滚点：
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260820-160003`。
- [ ] qa.93 因 R109 首次进入 1-GAGA 空网格失去最终候选资格；真实内部 drop、Finder 拖出和
  原生批量改名仍须各自证据。

## 2026-08-20：R106/R107 qa.92/API168 引用修复与原生 39/39

- [x] R106 先红后绿修复 qa.89/qa.90 注入载荷漏序列化 `verifyNormalVisibleWindow()` 的
  `ReferenceError`；qa.90 完整自动门禁、确定性构建、唯一安装和生产库启动通过。
- [x] R107 先红后绿证明 approved recovery 在冷启动空 Library 路径阶段只执行一次会永久
  保持 pending；最小修复把 recovery 移到 `onLibraryChanged` 完成 runtime transition、确认
  当前 Library identity 后执行，冷启动 `start()` 不再提前消费请求。
- [x] qa.92/API168 全量 `npm test`、全仓 JS/zsh 语法、`git diff --check` 和双确定性构建
  通过；插件包 SHA-256 `073a21da7e9253b22fc8c6d107be15bb896fa8b3f53b9fd76250202a85dd0ce9`，
  安装器 `a4f6a55ddc9359a1410eb897a032a2f56e4fd574136bc8dad16b89637d82f9ca`。
- [x] qa.91/API167 已保留 qa.90 回滚点、唯一安装并执行真实修复；qa.92 递增 API 身份，
  防止 qa.90/qa.91 同 API 双语义，业务行为不再变化。
- [x] 11 项 fresh item/metadata/raw name/SHA 预检后只经 Eagle native rename pipeline 修复；
  request 状态 `completed`、completedCount=11、rollbackFailures=0。
- [x] `1-GAGA` 原生全选显示 39 项，原生导出到全新空目录
  结果现统一位于 `/Users/max/Downloads/测试/1-GAGA-39`；39 文件、39 唯一名、39 唯一
  SHA-256、0 子目录、227,188,953 bytes，并与恢复交付目录逐文件名/逐 SHA 完全一致。
- [x] `IMG_7504` 单击到检查器完成 1.131 秒；EXIF、原图路径、右键菜单和原生预览均现场可用，
  没有持续 spinner。
- [ ] Finder 物理拖出、同网格内部 drop、原生批量改名和普通/智能锁/手动顺序矩阵继续作为
  用户最终验收项；自动门禁和 39/39 不替代这些独立交互证据。

## 2026-08-20：R105 导入/点击/EXIF 主路径性能隔离（qa.89/API166）

- [x] 先红后绿加入 `test/r105-critical-path-ownership.test.js`：禁止每秒重型上下文快照、
  500ms 菜单 DOM 巡检、普通文件夹全网格 observer、每 8 秒整库 GPS 枚举，以及 metadata
  变更时整份 cache 序列化。
- [x] 最小接入修复：monitor 改为 2 秒 revision heartbeat，只有 context/storage revision
  变化才读取上下文或团队快照；菜单 observer 限 layout panel；网格 observer 仅在活动智能
  文件夹连接；GPS `poll()` 零枚举；metadata 只追加增量 journal，退出时才压缩完整 cache。
- [x] 排序插件未加载时在本地隔离库完成无 EXIF 1/10/39 张基线：最后项目完成约
  0.19/1.10/4.80 秒，39 张刷新约 7.19 秒、备份约 8.35 秒、UI 约 10.8 秒确认 39 项；
  三轮均无新增 background unresponsive、thumbnail timeout 或 renderer crash。
- [x] 基线证明本地无插件路径未复现约 61 秒后处理；生产 NAS 的间歇性写库/缩略图问题
  尚不能排除，也不能归因于当时未加载的排序插件。误创建的 NAS 空测试库保持 0 项，
  未继续写入且不得未经批准删除。
- [x] 永久合同、候选记录、全量 `npm test`、全仓 JS/zsh 语法、`git diff --check`、
  安装器 `--check`、包内身份/污染与唯一来源审计通过；确定性双构建插件 SHA-256
  `f81b07009246ff1bc415441be90d1a5bf1437e91eabfdf0baa22c3912f6ce7cc`，安装器 SHA-256
  `35d5ab4d995ade066b4f70f24a826c4686ef4f925bd4dad6e6967009b19ce724`。
- [ ] 自动门禁全绿后按既有授权备份、唯一安装 `2.5.22-qa.89/API166` 并正常重启；在新的
  本地隔离库用另一组 1/10/39 无 EXIF 样本对比，耗时不得比无插件基线增加超过 25%，且
  不得出现超时、持续 spinner 或 renderer unresponsive。
- [ ] 性能通过后继续 R100-R104 L0 真实验收；源码门禁通过不等于 Eagle 现场通过。

## 2026-08-19：R103/R104 L0 接入边界根治与 11 项引用修复候选

- [x] 删除主网格全局 pointer 第二状态机和运行时 HostInputAdapter 接入；dragstart 只记录
  immutable ID/context/grid，selection 延迟到同网格显式 drop 当下读取一次，dragend/blur/
  Escape 仅清理。排序 drop 不再触发任何延迟或自动编号。
- [x] 新增 fresh official item + metadata/raw reference 预检；11 项 repair 额外核对只读
  SHA-256，只允许 Eagle 项目级原生改名管线提交，失败停止并回滚，不刷新列表掩盖结果。
- [x] R101-R104 定向测试、完整 `npm test`、全仓 JS `node --check`、zsh 静态检查与
  `git diff --check` 通过。候选递增为 `2.5.22-qa.88/API165`。
- [x] 确定性双构建一致：插件包 SHA-256
  `d0ab0a6fbf6c60459a9e5eebc66470ead4e22d9737401430d58ff5d5e7a5c689`，安装脚本
  `652f4959feb2a39512104f2d8b5a76ffe20e8c0fbcc142223655f9b4e8618a62`；安装器 `--check`
  通过 Eagle 4.0.0、审计桥与候选身份门禁。
- [x] qa.88/API165 已由 R105 性能阻断取代，永久不再安装；后续只允许唯一 qa.89/API166。
- [ ] 按用户授权创建回滚点、唯一安装 qa.89/API166 并正常重启；随后真实修复 11 项并
  验收 1-GAGA 原生导出 39/39、无 EXIF拖动、检查器响应、原生批量改名和普通/智能 L0。

## 2026-08-18：R101/R102 P0 无 EXIF L0 资格与 metadata 刷新竞态

- [x] 用户现场将 `IMG_7504/7507/7516/7517/7518/7524` 等加入异常样本；确定性候选为
  “无 EXIF/拍摄时间的可见可选素材不能拖动、排序或导出”，并新增点击持续 spinner、
  EXIF/检查器不显示、普通操作超过 5 秒的同级发布否决项。
- [x] 先红后绿确认源码越权：`scanCurrentItems()` 完成后台 metadata hydration 后，会因
  `sortNeedsMetadata` 调用 `refreshMainList()`，从而重建 Eagle 网格/selection/inspector。
  最小修复限定在 monitor/metadata ownership：扫描只 push timestamp/稳定缺失哨兵，零
  host refresh、零 `updateItemsView`、零 `updateSelection`。
- [x] 新增 R101 成对自动合同：普通/智能成员集合不按 EXIF 过滤；有/无 EXIF单项及混合
  native dragend 均零 MoveCommand；拍摄时间升降序缺失值稳定兜底，手动移动与 metadata
  无关。候选递增为 `2.5.22-qa.87/API164`。
- [x] 经授权可逆停用 qa.85 并正常重启 Eagle；恢复目录：
  `/Users/max/Library/Application Support/Eagle/Plugins-disabled-20260818-zxJya7/com.max.eagle-photo-taken-sort`。
  第一次 39 项导出证据为 28/39；第二个全新目录因菜单索引刷新导致选择收缩为单项，只
  输出 `2-GAGA9.jpg`（1/39），按门禁停止且未补导/删除/覆盖，不能作为停用插件 A/B 结论。
- [x] qa.87 已由 R103/R104 取代并永久不可发布；qa.88/API165 随后又由 R105 取代，
  当前唯一源码候选为 qa.89/API166，
  仍须真实 Eagle 对 IMG_7504/7517、异常+正常混选、39/39 导出、原生批量改名、单击
  响应与 EXIF 检查器逐项验收。

## 2026-08-18：R100 P0 原生改名、拖出与导出主权

- [x] `qa.85/API162` 因原生批量改名名称混杂、`1-GAGA` 39→28、`IMG_7517.jpg` 单张无法导出及多项“冻结”现场证据直接发布否决。
- [x] 先红后绿证明四条源码根因：`dragend` 复用 helper 提交排序；host-array 写回字段过期 item；全局名称 DOM mask/selection 回写；排序锁 capture 拦截原生素材改名。
- [x] 最小修复：只有显式同网格 drop 能提交；dragend 只清理；host-array 按目标 ID 重排当前 live 对象；名称 mask 变为零写入并移除原生改名 handler；保留 qa.85 已完成的 `.pinned` 放行和 helper hit-test transparent。
- [x] 跨扩展静态审计确认只有 media-organizer 注入 Eagle 主网格 drag/pointer/onDropBoxItem；其它扩展的事件取消位于自有插件窗口或 Chrome 页面。
- [x] 定向回归、完整 `npm test`、注入编译、`node --check plugin.js` 和 `git diff --check` 通过；源码候选递增为 `2.5.22-qa.86/API163`。两次构建插件包 SHA-256 均为 `e93d24d82cede2b97b3807546539cf3250ae7148a96674edc88cf7cf278d0d14`，安装脚本均为 `cece0d716ffc04a88d756ca812048f605d10a73b853c3287165da563c26f9aed`。
- [ ] 未安装、未重启 Eagle、未真实改名/导出、未操作 Library/NAS。39→28 逐项对账和 `IMG_7517.jpg` A/B 只读证据须等总管恢复安装门禁。

## 2026-08-18：R99 普通文件夹切换快闪/空白/假0项/延迟恢复结构修复

- [x] 复读治理、模块边界、排序台账与 R74/R97/R98/R99 合同；确认只允许改 normal presenter 的所有权/完整窗口门禁，保持 Eagle 原生选择、预览、右键、拖出、导入导出 fail-open。
- [x] 先红后绿：`normal-order-stability-core.test.js` 新增“source member set 大于可见窗口即 `partial-visible-window`”红灯；`plugin-source.test.js` 新增 normal presenter 在逐卡 move 前必须调用完整可见窗口证明的合同。
- [x] 最小修复：`lib/normal-order-stability-core.js` 增加 `verifyNormalVisibleWindow()`；`plugin.js` 在 normal L3 presentation 中先验证当前 source member set 与 rendered visible set 完整一致，不足即 `SKIP_PARTIAL_VISIBLE_WINDOW` 并零 DOM move/零 host-array commit。
- [x] 自动证据：定向 `node test/normal-order-stability-core.test.js`、`node test/plugin-source.test.js`、`node test/host-order-presentation-core.test.js`、`node test/manual-drop-transaction-core.test.js` 通过；完整 `npm test` 通过。
- [x] 候选发布身份对齐到 `2.5.22-qa.85/API162`：同步 `package-lock.json`、README、运行时 API、源码合同与 GitHub release build/install 脚本；API161 永久保留给 qa.84，避免同一 API 对应两套行为。
- [ ] 当前仅形成源码候选 `2.5.22-qa.85/API162`；未安装、未重启 Eagle、未操作真实 Library/NAS。真实普通/智能切换、虚拟化、迟到 callback、错误/取消/重进、手动顺序/锁定/重命名不变仍待总管批准后在 Eagle 现场验收。

## 2026-08-18：R34/R97 个别卡片内部拖动与原生拖出同时失效

- [x] 复读治理与相关台账：R01/R03/R34/R38/R39/R43-R47/R97、`event-ownership.js`、迁移计划、行为矩阵与目标架构。
- [x] 先红后绿：`test/plugin-integration-contract.test.js` 新增普通模式 helper 必须保持 hit-test transparent 的合同；红灯证明现状可能抢占 Eagle 原生 `dragstart`。
- [x] 最小修复：普通模式 `.box-sortable-helper` 投影仅追加 `pointer-events:none!important`，保留现有落点视觉与 drop 解析，不改 `dragstart/dataTransfer`、排序核心、改名链或智能路径。
- [x] 自动证据：`node test/plugin-integration-contract.test.js && node test/drag-feedback-controller.test.js && node test/host-input-adapter.test.js`、完整 `npm test` 与 `node --check plugin.js` 通过。
- [ ] 当前仅形成源码候选 `2.5.22-qa.85/API162`；未安装、未重启 Eagle、未操作真实 Library/NAS。真实普通/智能、多选、锁定/解锁、无拍摄时间、Finder/聊天框拖出验收仍待用户后续批准。

## 2026-08-18：普通文件夹场景名提取与智能文件夹自动编号门禁

- [x] `rename-core` 先红后绿：增强场景名提取对真实文件夹名的容错，覆盖中文、编号、空格、连字符和带空白的前缀格式。
- [x] `rename-core.test.js` 增加失败回归：普通文件夹真实名称提取、按组连续编号，以及智能文件夹不生成/不显示自动编号计划。
- [x] 最小实现只落在 `extensions/media-organizer/lib/rename-core.js`，未触碰排序状态机或真实 Eagle 改名链路。
- [x] 仅跑核心自动测试与相关契约测试通过；未安装、未重启 Eagle、未操作真实 Library/NAS。

## 2026-08-17：R99 普通文件夹路由补水/虚拟窗口重排风暴

- [x] 将录屏对象纠正为普通文件夹“设计完成稿”（`MB3Y67Y8494GH`）；智能“线上展示照片”的真实 ID 为 `MRDMCKFE47WO1`。
- [x] 日志证明路由切换时先对上一文件夹 89 项误呈现，再对目标 166 项/可见 120 项部分窗口逐卡移动与回滚；当前 native 状态 30 秒零写入且画面稳定。
- [x] `collection-core.test.js` 和 `normal-order-stability-core.test.js` 先红；最小修复只增加当前 folder 成员正向证明与完整可见 member-set 门禁，聚焦测试已绿。
- [x] 全量 `npm test`、语法/注入/差异检查与 qa.84/API161 确定性构建通过；候选包 SHA-256 `1146bc40570fc4252b63d04f6d809a3a7a0c1c0ea3b2d0f1aa986736f56dc812`，安装器 SHA-256 `4ff9bf99e8c143e336cd5f1403af157fda2bba32aaac1439469a608ab1d780d0`。
- [ ] qa.84 仍未安装；当前 Eagle 保持 qa.83/API160 运行现场。未获再次授权前不正常 Quit、不替换插件、不重启 Eagle。

## 2026-08-16：R98 原生添加日期不得被旧多级意图覆盖（qa.83/API160）

- [x] 根因确认并先红后绿：旧 `PHOTO_TAKEN` 持久值无条件压过 Eagle 当前原生选择；新增 collection-scoped 显式排序意图，原生选择先登记后交还 L0，迟到回调不得恢复插件 overlay。
- [x] 普通/智能、迟到回调、重载、多级规则恢复、单拍摄时间及 R71/R75 兼容测试进入 `sort-intent-core.test.js`；完整 `npm test`、注入编译、JS/zsh 语法、确定性双构建与 `git diff --check` 均通过。
- [x] `2.5.22-qa.83/API160` 已在 Eagle 正常退出后安装为唯一活动来源；qa.82 回滚点为 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260817-001928`，`app.asar` SHA-256 保持 `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`。
- [x] 真实普通文件夹 `BROLL`：两条原规则（文件名自然升序、拍摄时间升序）可恢复；选择原生“添加日期”后只显示 Eagle 原生标签，规则面板消失，等待 5 秒未被回调改回；规则/锁/手动/改名状态逐字段及 sidecar 整体 SHA 均未变化。
- [x] 真实智能文件夹 `线上展示照片`：原拍摄时间升序规则和 3 条手动相对调整均保留；原生“添加日期”显示稳定且无插件 overlay，等待 5 秒未回跳；恢复多级后原规则重新出现，sidecar SHA 仍为 `12803a8741015e99bbe0a24335bee5e33da2e063b1a9ed5cb1d1583a3cfc3fb2`。
- [ ] 已完成安装身份与本轮真实 UI 代验，不冒充用户最终验收；额外 Eagle 重启持久性复核需按治理门禁另获用户批准。

## 2026-08-15：R97 视频 Library 普通/智能手动拖动竞态

- [x] 对齐两段真实录屏与 qa.81/API158 诊断；确认不是视频格式或视频 Library 特判。
- [x] 先红后绿：同 smart key 重入合并到最新 revision、normal 拖动期 presenter 让路、Eagle `.pinned` 卡片仍可作拖动源/落点。
- [x] `2.5.22-qa.82/API159` 完整 `npm test`、注入编译、`node --check`、`git diff --check` 通过；双构建 SHA-256 均为 `3704c995b06cd46a620bb064b2609bfecdd2e53c241b43dd322cc0d179a15b91`。
- [x] 用户明确授权立即修复；Eagle 正常 Quit 后将 qa.81 保留为精确回滚，qa.82/API159 已原子替换为唯一活动来源，安装 `plugin.js`/manifest SHA-256 与候选一致并正常重启。
- [x] 真实视频库运行时证据：normal 拖动会话触发 `manual-drag-active`，smart `高颜值` 不存在自动编号整行且能识别拖动源/落点；零 rename/delete/auto-number 事件。
- [ ] Computer Use 合成拖动未生成 `dragover/drop`，不能代替物理最终改序；不得把仅有 `dragstart` 和视觉落点反馈登记为完整真实 UI 通过。

## 2026-08-12：R96 P0 宿主集合污染与手动顺序保护（qa.81/API158）

- [x] 先红后绿：建立全局24,483与smart538不得互相写入的 R96 测试；新增唯一 `hostArrayWriteOwnership` 纯核心。
- [x] 普通排序、普通手动拖拽、智能 presenter 的全部 host-array 写入均经过 Library/route/collection/scope/generation/array-reference/member-set 门禁；证据不足为 zero-commit/fail-open。
- [x] 手动关系、47锁、改名队列和原生筛选均不在 R96 中写入或清除；分页前缀不再被插件重写。
- [x] qa.81/API158：完整 `npm test`、注入编译、语法、永久合同和 `git diff --check` 通过；双确定性构建包 SHA-256 均为 `1a20bae496ac8213c932df66139e4919038c2b50b37221e016893912869c65ae`。
- [x] 经本轮授权正常退出后安装唯一 qa.81，旧 qa.80 回滚点为 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260812-032149`；正常启动有 `INJECT_OK`，安装包与实际 `plugin.js` SHA-256 均为 `40483b8e04d6f98ba8824e8fb53042448ab8ab7854f6ec1cdd6782bc236adc2f`，`app.asar` SHA 不变。
- [x] 真实 Eagle 只读核验：进入 `MAX照片集 (538)` 再回到“全部”，全局始终是本次启动前后相同的 `24,490` 项，未被改为538。历史 24,483 与当前24,490相差7项，作为既有新增素材差异登记，不能归因 qa.81。
- [ ] 用户最终验收：检查原有手动顺序、普通/智能排序和锁均按预期显示；不需要重新拖拽建立顺序。自动/日志/只读切换不替代用户目视验收。

## 2026-08-12：R95 P0 锁态视觉精确恢复（qa.80/API157，已安装，待用户真实验收）

- [x] 用户明确拒绝 qa.78/qa.79 的独立红点：正确效果为 Eagle 原生文件夹数量数字本身变红。
- [x] R95 先红后绿：删除 dot marker，保留当前 verified lockStore/ID 校验和重绘 observer；只给已锁的原生 `.badge.self` 数量文本上色，不新增 DOM、不改数值/布局/原生数据。
- [x] qa.80/API157：完整 `npm test`、注入编译、永久合同、发行合同与 `git diff --check` 通过；双确定性构建 SHA-256 均为 `c0821b96fe0cc9ed60db7d2a42fac74ecf21c9f1f50c6eb17696d86b83fd1e7b`。
- [x] 经本轮授权正常退出后安装唯一 qa.80 并正常重启；qa.79 回滚点为 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260812-012703`。当前启动有 `INJECT_OK`；`LOCK_PROJECTION` 为 `47=18 current native-count rows+29 未渲染/无count rows`，sidecar/app.asar 未变。
- [ ] 用户真实 Eagle 验收：已锁文件夹的原生数量数字为红色、未锁不红；展开/折叠/滚动/切库/重启后保持，且无独立红点。日志不能替代这一目视验收。

## 2026-08-12：R94 P0 锁统计与路径 identity（qa.79/API156，已安装，待用户真实验收）

- [x] qa.78 正常安装重启后实机日志发现 `importedLocks=0`，但 `markedRows=1 + unresolvedLocks=46`；只读核对 sidecar revision 222/完整性与 47把锁均未改变，确认是统计字段错误而非锁数据丢失。
- [x] R94 先红后绿：URL编码/解码的同一中文NAS路径能读同一锁分区，不同Library保持隔离；`LOCK_PROJECTION` 从当前已加载锁存储计数，不从 `already-imported` 导入动作字段取数。
- [x] qa.79/API156：完整 `npm test`、注入编译、永久合同、发行合同与 `git diff --check` 通过；双确定性构建 SHA-256 均为 `3af62e5ef0b02e003ea5135c2891df505eade64db0c5d50b609bc21e34b3a91c`。
- [x] 经本轮授权正常退出后安装唯一 qa.79 并正常重启；qa.78 回滚点为 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260812-001022`。最新实机日志为 `INJECT_OK` + `LOCK_PROJECTION importedLocks=47, visibleRows=144, markedRows=1, unresolvedLocks=46`，统计自洽；Eagle 4.0.0、API156、单一来源、app.asar SHA 与 sidecar SHA 未变。
- [ ] 用户真实 Eagle 验收：展开已证实锁定目录、折叠/滚动/切换/重启后确认插件自有红标持续；未锁的杭州目录不应凭名称出现红标。日志不能替代这一步。

## 2026-08-11：R93 P0 排序锁红标投影（qa.79/API156，已安装，待用户真实验收）

- [x] 只读扫描 435 份安全 JSON 状态/回滚文件：当前已验签引力环球 sidecar 有 47 个 hard lock；R91 恢复前后锁存储 SHA 未变化，手动顺序恢复未删除锁。
- [x] 截图杭州 4 个父目录及其可见子项按 folder ID 核验；它们在所有已登记快照中从未记录锁，禁止按名称或视觉猜测写锁。历史唯一多出的 `MB3Y67Y8494GH` 在同 writer 的后续签名快照已被移除，当前只报告，不恢复。
- [x] R93 先红后绿：停用对 Eagle native `.badge` 的依赖，改为插件自有 marker；侧栏 child-list/subtree 变化只幂等重投影已验证锁存储，零写 Eagle/sidecar/Library，零改动排序、手动顺序或原生 L0 行为。
- [x] qa.78/API155 已完成完整自动门禁、确定性构建、正常退出/安装/重启；实机随后发现 R94 统计字段错误，qa.78 不作为最终候选，保留回滚。
- [x] qa.79/API156 已替代 qa.78 正常安装；单一来源、宿主 SHA、sidecar revision/integrity 不变，最新日志含 `INJECT_OK` 和正确的 `LOCK_PROJECTION`。真实红标/顺序仍只由用户最终验收。

## 2026-08-11：R91-R92 P0 手动排序顺序恢复候选（qa.77/API154，已安装，待用户真实验收）

- [x] 只读事故审计确认：引力环球 sidecar 中仍有 10 份 v2 完整手动顺序与 14 份 v3 关系；未发现 NAS、Eagle 或用户删除证据。引力环球视频 sidecar Library identity 错配，未迁移。
- [x] qa.75 的 hard-lock/完整成员前提已撤销；先红后绿升级 `manual-order-recovery-core`：同 Library identity、同 collection ID、完整 sidecar integrity 与存储 ID 证明成立后，锁定或未锁定都恢复。幸存 ID 恢复精确相对关系，删除 ID 桥接，新 ID 不猜关系；preview 逐 profile 报告 exact/restored/surviving/new/missing。
- [x] qa.71–qa.74 的 transitional v3 空关系记录按同一单调规则恢复；已有 v3 relations（含显式空状态）不改写。恢复相同成员指纹时幂等，不重复写入。
- [x] 团队同步新增 `manual-recovery-required` 熔断，禁止把待恢复的空关系发布覆盖原完整顺序。
- [x] 获授权后的精确恢复 preview 已通过公开 API 完成：引力环球 10 个 legacy profile 中 9 个可证明并转换为 153 条关系；1 个 `M7TDBVP0I40LF` 当前无成员，保留旧记录且零写入。sidecar 由 CAS 原子写为 revision 222，完整性 SHA 验证通过；14 份既有 v3 关系保持不变，回滚副本与清单已保存。
- [x] qa.76 正常退出、安装、重启后，启动日志发现 `syncManualContext` 对不存在 profile 读取 `legacySource.order` 而注入失败。qa.76 已废弃，登记 R92；qa.77 以 null profile/global/空集合 fail-open 为唯一修复，不触发遗留恢复。
- [x] qa.77/API154 完整 `npm test`、注入编译、语法、永久合同与 `git diff --check` 均通过；确定性双构建插件 SHA-256 均为 `3b7a5c67c26006163e14aa14d429010102d499b33a9abbb63f505dac13cbfe60`。
- [x] 经本轮授权，Eagle 正常退出后唯一安装 qa.77，旧 qa.76 回滚点为 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260811-231917`，并正常重启。安装后核对单一来源、manifest `2.5.22-qa.77`、API154、Eagle 4.0.0 和未变的 app.asar SHA `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`；启动日志为 `INJECT_OK`，本次启动无 `INJECTION_FAILURE`。
- [ ] 仅待用户真实 Eagle 验收：逐一进入 9 个已恢复普通文件夹，确认原手动相对位置、刷新/重启保持；确认 `M7TDBVP0I40LF` 仍未被猜测性恢复；确认 global、空集合、普通/智能切换和筛选均保持 Eagle 原生。此前不称恢复完成。

## 2026-08-10：R89-R90 qa.74/API151 原生筛选与跨 Library 生命周期修复

- [x] 用户截图证明“服务花絮”已选择“妆造”、筛选徽标为 2，但搜索结果仍为完整 1,380 项。
- [x] 只读核对 Eagle 4.0 宿主：原生 `rebindRefresh` 先计算筛选结果并设置 `allData/filtereds`，`filterBadge > 0` 或 keyword 时原生也禁用 sortable。
- [x] 先红后绿新增 native filter guard；智能 observation、PRESENT、host commit、READY 和 manual drag 在原生筛选期间全部 fail-open。
- [x] 筛选签名变化先作取消栅栏：旧 smart generation、拖动会话和迟到 PRESENT 全部失效；之后至多一次调用 Eagle 原生 `filterContent()`，并让 `sortData/sortRawData` 直接回到 Eagle 原生逻辑。
- [x] 新增当前 native membership 精确排列门禁：智能排序或拖动若试图增删/混入成员，立即拒绝；不再让旧 1,380 项投影越过“交流 11 项”。
- [x] 新增 R90：同版本 Library A→B→A 必须 await 旧 runtime stop，再创建新 scope、adapter、handlers 和 generation；不再跨 Library 复用 `integrationResult`。
- [x] `2.5.22-qa.74 / API151` 完整 `npm test`、注入编译、语法和 `git diff --check` 通过。
- [x] 经用户明确批准，安装前预检确认 Eagle `4.0.0`、受控桥 SHA-256 `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`、发行包 SHA-256 `f84246fe5bf3a4b9ab57a51b27a0b4c60bfed618dacd9657cfc1835aff0dae61` 和同 ID 单一来源；Eagle 正常退出后安装 qa.74/API151，并正常重新打开。旧 qa.72 保留于安装器创建且已在磁盘复核的可恢复回滚目录；安装后再次核对 manifest/API、单一正式来源和宿主哈希均正确。
- [ ] 仅待用户在真实 Eagle 最终验收：验证“服务花絮 → 妆造”网格只显示匹配项且等待后不回全量，以及“引力环球 → 引力环球视频 → 引力环球”两库往返后均可手动排序。未通过前不得关闭 R89/R90，也不得称为真实功能验收通过。

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

# 2026-08-10：R89 qa.72/API149 安装与真实验收阻断（历史）

- [x] 用户明确批准后，安装器预检通过：Eagle `4.0.0`、受控宿主桥和 qa.72 发行包身份/校验和一致。
- [x] Eagle 通过正常退出后，唯一正式安装目录替换为 `2.5.22-qa.72 / API149`；旧 qa.71 回滚点为
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin/com.max.eagle-photo-taken-sort-20260810-212821`。
- [x] 安装后复核同 ID 只有一个活动来源
  `/Users/max/Library/Application Support/Eagle/Plugins/com.max.eagle-photo-taken-sort`，宿主 `app.asar` SHA-256 仍为
  `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`；没有改动 `.library`、NAS 素材或宿主。
- [ ] Eagle 已正常重启，但真实 NAS Library 在约两分钟观察窗口持续显示“即将完成”、项目数 `0`，无法进入
  智能文件夹“服务花絮”执行“妆造”筛选。因此 R89 的真实界面验收被 Library 初始化阻断，不能以自动测试或安装成功宣称通过；未在加载中点击、筛选、拖动、改名、导入、删除或强制退出。

# 2026-08-27：v1.0 排序状态文档定义

- [x] 将旧“团队状态/接力”重新定义为显式的“排序状态文档”：只导出和加载插件叠加层，不是后台同步服务。
- [x] 已规定导入门禁：必须验证同一 Library、collection 身份和 item ID；不兼容时拒绝写入，不得按文件名或路径猜测合并。
- [ ] v1 实现阶段完成 JSON schema、导出/加载事务、回滚、兼容性报告和对应失败测试；未开始业务代码、安装或真实 Eagle 操作。

# 2026-08-27：v1.0 正式安装后的可见窗口生命周期断链

- [x] 唯一正式安装可打开并显示 `Eagle 排序助手 v1.0`，但真实窗口持续停在“等待 Eagle…”，总开关只改变复选框外观，证明可见渲染器未绑定命令或连接宿主。
- [x] 新增失败门禁 `eagle-sorting-assistant-v1-lifecycle.test.js`，先复现“可见渲染器未收到 create/run 回调时控件未绑定”的红灯，再修正唯一生命周期 owner。
- [x] 正式入口改为模块加载即幂等绑定 UI、连接宿主；create/run/Library change 复用同一自举路径，用户主动打开时显式显示窗口。
- [x] `npm run check:v1` 与完整 `npm test` 安装前代码检查通过；这不代表实机功能通过。
- [ ] 待项目总管从唯一正式根重新生产构建、唯一安装并恢复本专项，继续真实普通/智能/L0 全量回归。

# 2026-08-27：生命周期修复的正式安装身份递增为 v1.1

- [x] v1.0 已完成一次真实正式安装并暴露生命周期断链；依据“每轮正式安装递增 0.1”，下一次可安装身份统一为用户版本 `v1.1`、package/manifest `1.1.0`。
- [x] 先将永久身份门禁更新为 `v1.1 / 1.1.0` 并取得当前 `1.0.0` 红灯，再统一核心、package/lock、manifest、面板和构建/安装脚本身份。
- [ ] 仅项目总管可从唯一正式根构建 `Eagle排序助手-v1.1.0.eagleplugin` 并执行唯一安装；专项不得自行构建或安装。

# 2026-08-27：renderer 运行环境修复的正式安装身份递增为 v1.2

- [x] v1.1 已完成真实正式安装并复现可见窗口停在“等待 Eagle”；根因门禁确认浏览器 renderer 不提供 CommonJS `require`，入口在绑定 UI 前即退出。
- [x] 入口改为可选 Node 依赖并在浏览器 renderer 中读取正式源码资源；新增 renderer-runtime 永久门禁，并纳入 `check:v1`。
- [x] 依据每轮正式安装递增 `0.1`，本轮唯一身份统一为用户版本 `v1.2`、package/manifest `1.2.0`。
- [ ] 仅项目总管可构建 `Eagle排序助手-v1.2.0.eagleplugin` 并原位安装；专项不得自行构建或安装。

# 2026-08-28：v1.2 file:// renderer 资源加载红灯，v1.3 修复收口

- [x] v1.2 唯一正式安装后，真实 renderer 仍显示“等待 Eagle...”，未取得 Library/集合/成员身份；未执行真实排序、拖拽、改名或锁定。
- [x] 新增 file:// 资源加载错误可见性门禁：fetch 挂起时先红；修复后通过有限超时、XHR 优先（file://）与 fetch 回退，失败统一放行 Eagle 原生并写入面板错误。
- [x] 下一次正式安装身份按已安装 v1.2 递增为用户版本 v1.3、package/manifest 1.3.0；唯一产物名 `Eagle排序助手-v1.3.0.eagleplugin`。
- [ ] 仅项目总管可构建 `Eagle排序助手-v1.3.0.eagleplugin` 并原位安装；专项不得自行构建/安装。

# 2026-08-28：v1.3 静默启动失败，v1.4 分阶段诊断收口

- [x] v1.3 实机面板仍停在“等待 Eagle...”，4 秒后没有资源超时或 fail-open 证据；真实数据动作保持停止。
- [x] 新增启动诊断门禁，要求入口脚本、面板绑定、资源加载开始/完成、宿主 bridge 开始/返回/失败及 window error/unhandledrejection 留在同一可见诊断链。
- [x] 下一次正式安装身份按已安装 v1.3 递增为用户版本 v1.4、package/manifest 1.4.0；唯一产物名 `Eagle排序助手-v1.4.0.eagleplugin`。
- [ ] 仅项目总管可构建并原位安装 v1.4；本专项不得自行构建/安装；安装后先复验启动诊断再进入真实排序回归。

# 2026-08-28：v1.4 外部入口静默失败，v1.5 HTML 级启动闭环

- [x] v1.4 真实窗口只显示静态面板初值，未出现入口阶段、资源失败或 fail-open 诊断；未执行任何真实排序或数据动作。
- [x] 在唯一 `index.html` 最早可执行位置加入内联启动状态、DOM 就绪标记和 `window` error/unhandledrejection 可见捕获；外部入口固定为 `./sorting-assistant.js`，通过 onload/onerror 区分未加载、加载失败与已加载。
- [x] 新增 HTML 入口安装前门禁：直接读取正式 `index.html` 和 `sorting-assistant.js`，确认真实启动代码与顺序，不以静态版本文字冒充入口执行。
- [x] 下一次正式安装身份按已安装 v1.4 递增为用户版本 `v1.5`、package/manifest `1.5.0`；预期唯一产物名 `Eagle排序助手-v1.5.0.eagleplugin`。
- [ ] 仅项目总管可构建并原位安装 v1.5；本专项不得自行构建/安装；安装后先读取 HTML 启动阶段证据再进入真实排序回归。

# 2026-08-28：v1.5 file:// 全局 require 解析失败，v1.6 依赖加载闭环

- [x] v1.5 实机已证明 HTML 内联与外部入口加载成功，但入口顶层使用 Eagle renderer 暴露的全局 `require('./lib/eagle-sorting-assistant-v1-core.js')`，按 app.asar 基准解析失败；Library/集合/成员未读取，真实数据动作保持停止。
- [x] 新增 file:// renderer 永久门禁：即使存在全局 `require` 也不得调用它解析插件相对模块；浏览器 renderer 统一通过插件目录 XHR/fetch 读取资源，Node 真环境才保留 CommonJS。门禁要求禁用阶段可见并保留既有 HTML/阶段诊断。
- [x] 下一次正式安装身份按已安装 v1.5 递增为用户版本 `v1.6`、package/manifest `1.6.0`；预期唯一产物名 `Eagle排序助手-v1.6.0.eagleplugin`。
- [ ] 仅项目总管可构建并原位安装 v1.6；本专项不得自行构建/安装；安装后先复验 require 禁用阶段、Library/集合/成员状态，再进入真实排序回归。

# 2026-08-30：v1.7 原生排列横向扩展退回，v1.8 单列下拉集成

- [x] v1.7 实机确认原生布局弹窗被插件第二列撑宽；根因是 native-layout-adapter 将详情根追加到 `.panel-item:last-of-type` 并使用横向换行布局。
- [x] 新增 v1.8 结构门禁：插件选项必须进入 Eagle 原生排列 select；详情区必须是排序行正下方同级块，单列、固定最大宽度且无水平溢出；原生选项事件放行，插件选项才发送 runtime 命令。
- [x] v1.8 adapter 将“拍摄时间排序/多级排序”作为原生下拉选项；细节控件改为紧凑纵向区并收进“更多操作”，总开关关闭时由既有生命周期卸载。
- [ ] 项目总管审核后构建并原位安装 `Eagle排序助手-v1.8.0.eagleplugin`；安装后在真实 Eagle 截图位置复验宽度、下拉选择和普通/智能差异。

# 2026-08-31：v1.8 拍摄时间未兑现，v1.9 统一来源与显示核验

- [x] 实机红灯：普通文件夹 `4-英国站🇬🇧` 选择拍摄时间升序后，网格未按拍摄时间变化；未继续排序、拖拽、改名、锁定或状态应用。
- [x] 新增永久失败门禁，真实运行时 item 只有 `takenAt` 而没有顶层 `DateTimeOriginal` 时必须正确升序；导入、创建、修改时间不得伪装成拍摄时间。
- [x] 新增唯一拍摄时间读取模块，按 Library + item ID 记录同语义字段的取值、来源和有值/缺失/失败状态；保留已批准的两类缺失槽位规则。
- [x] 排序应用后逐项核对宿主完整数组、完整筛选投影和当前可见网格；首个不一致进入可见诊断，核对完成前不保存本次排序记录。
- [x] 唯一可安装身份统一为 `v1.9 / 1.9.0`，预期产物 `Eagle排序助手-v1.9.0.eagleplugin`；拍摄时间 provider 进入生产白名单。
- [x] 完整安装前代码检查与唯一来源审计已通过并主动回报项目总管；仅总管可生产构建和原位安装。

# 2026-08-31：v1.9 拍摄时间载体根因闭环，v1.10 安装前收口

- [x] 只读核对真实 Eagle：官方 EXIF 检查器从 `eagle.item.getSelected()` 取得 item，以 `item.filePath` 交给 exiv2；可见拍摄时间对应 `DateTimeDigitized`，不是导入/创建/修改时间。
- [x] v1.9 在 `4-英国站🇬🇧` 暴露首个红灯（Eagle 检查器有值、插件却报告有值 0/缺失 1,188）；新增失败门禁覆盖真实 item 形状、唯一来源、禁止时间字段替代、取消和迟到零写入。
- [x] v1.10 provider 以 Library+集合+成员指纹+item ID 绑定异步 EXIF 补水，最多 2 个并发，可取消；仅拍摄时间规则启动，完成前不应用，完成后只一次性提交。
- [x] package/lock/manifest/核心/面板/构建器/安装器/测试身份统一为 `1.10.0`、`v1.10`；正式运行白名单加入 `lib/exifr-mini.umd.js`，预期产物 `Eagle排序助手-v1.10.0.eagleplugin`。
- [x] `npm run check:v1`、`npm test`、`git diff --check` 作为安装前代码检查；未构建、未安装，真实 Eagle 功能仍待总管安装后核验。
- [ ] 仅项目总管可从唯一正式根构建并原位安装 v1.10；不得保留 v1.9 平行交付物。

# 2026-08-31：v1.10 file:// 读取失败，v1.11 宿主字节桥接收口

- [x] v1.10 真实 Eagle 首红灯：`4-英国站🇬🇧` 的 Library、集合 ID、1,188 项成员和宿主数组均已核对，但拍摄时间统计为有值 0、缺失 0、读取失败 1,188；未执行排序、拖拽、改名或锁定。
- [x] 只读核对官方 EXIF 检查器确认唯一同语义来源为 Eagle item `filePath` 读取文件后的 EXIF `DateTimeDigitized`；v1.10 renderer 直接解析 `file://` URL 不具备可靠本地/NAS 字节能力。
- [x] 先红后绿新增 `v1-11-file-reader-bridge.test.js`：要求正式运行链使用宿主 `fs.promises.readFile`、以字节交给 EXIF 解析器、保留 item ID 与错误码/消息，并禁止 `exifr.parse(file:// URL)`。
- [x] v1.11 唯一读取 owner 使用 `filePath → fs.promises.readFile → exifr.parse(bytes)`；保留最多 2 并发、取消、Library/集合/成员指纹/generation 隔离、迟到零写入和失败放行。
- [x] package/lock/manifest/核心/面板/构建器/安装器/测试身份统一为 `1.11.0`、`v1.11`；预期唯一产物 `Eagle排序助手-v1.11.0.eagleplugin`。
- [ ] 仅项目总管可从唯一正式根构建并原位安装 v1.11；当前正式安装仍是 v1.10，未创建备份或平行包；安装后先复验拍摄时间读取再恢复真实排序回归。

# 2026-08-31：v1.12 读取能力探针（安装前）

- [x] 记录 v1.11 真实红灯：`4-英国站🇬🇧` 完整 1,188 项均为 `taken-at-read-failed`，未执行真实排序或改名。
- [x] 先红后绿新增 `v1-12-reader-probe.test.js`；正式 runtime 通过 `executeInMain` 暴露只读探针，面板显示 require/fs/readFile、item ID、路径形状、输入、执行环境、字节结果及原始错误。
- [x] v1.12 代码保持唯一 `filePath → fs.promises.readFile → EXIF` 读取 owner，保留最多 2 并发、取消、身份隔离、迟到零写入和 fail-open；不读 `.library`、不恢复旧入口。
- [ ] 仅项目总管可从唯一正式根构建并安装 v1.12；安装后先在真实 Eagle 运行探针取得能力证据，再决定是否恢复拍摄时间排序回归。

# 2026-08-31：v1.13 ItemPathResolver（安装前）

- [x] 记录 v1.12 真实探针根因：快照与批量 `item.get` 均缺少 `filePath`，不能把 `item.filePath missing` 解释成无拍摄时间。
- [x] 先红后绿新增 resolver 门禁：裁剪快照/无路径批量响应必须回退官方 `item.getById`，显式读取原型 getter，并保留唯一资源契约失败码。
- [x] 正式 runtime 的探针与拍摄时间补水共用 `ItemPathResolver`，再走 `filePath → fs.promises.readFile → EXIF.DateTimeDigitized`；保留取消、最多 2 并发、身份隔离、迟到零写入和 fail-open。
- [x] 唯一正式身份统一为 `v1.13 / 1.13.0`，预期产物 `Eagle排序助手-v1.13.0.eagleplugin`；release 目录保持无包。
- [ ] 仅项目总管可从唯一正式根构建并安装 v1.13；安装后先复验探针取得绝对路径和字节/DateTimeDigitized 证据，再决定是否恢复真实排序回归。

# 2026-08-31：v1.14 getById-only 宿主修复（安装前）

- [x] 记录 v1.13 真实红灯：executeInMain 无 `eagle.item.get`，探针报告 `E_TAKEN_AT_ITEM_GET_UNAVAILABLE`，未执行真实排序。
- [x] 先红后绿新增 getById-only 门禁：批量 API 缺失时按已核对 item ID 调官方 `item.getById`，并读取原型 getter `filePath`。
- [x] 保留批量可用但缺路径时的 getById 回退；两种官方能力都不可用才 fail-open；探针与正式补水共用唯一 resolver。
- [x] 唯一正式身份递增为 `v1.14 / 1.14.0`，预期产物 `Eagle排序助手-v1.14.0.eagleplugin`；releases 保持无包。
- [ ] 仅项目总管可构建/安装 v1.14；安装后先取得绝对路径、字节和 DateTimeDigitized 证据，再恢复排序回归。

# 2026-09-01：v1.15 `getById` 响应形状取证（安装前）

- [x] 已在唯一 `ItemResourceResolver` 写入失败后修复的 shape-only 门禁：Map、wrapper、prototype getter 可归一化到精确 item ID；诊断不泄露完整路径值。
- [x] 修复注入 runtime 的 resolver 源码中 wrapper 字段数组被错误序列化为裸标识符的问题；正式注入检查恢复通过。
- [x] package/lock/manifest/核心/面板/构建与安装脚本统一为 `v1.15 / 1.15.0`；未构建、未安装、未创建平行包。
- [x] `npm run check:v1` 作为安装前自动证据已通过；不等于真实 Eagle 功能通过。
- [ ] 仅项目总管可构建并原位安装 v1.15；安装后由本专项只读取得 `item ID → shape → filePath shape → bytes → DateTimeDigitized` 实证，首个失败立即停止真实动作并回到最小 owner。

## v1.15 原生排列 UI 收口（安装前）

- [x] 以用户提供的错误/目标截图为视觉真源，先红后绿替换 native-layout 门禁：旧独立大块、规则字段、恢复/全局/导入导出/来源按钮均不得存在。
- [x] adapter 仅向 Eagle 原生排列 select 加入“拍摄时间”“自定义排序”，不调用 preventDefault/stopPropagation、不轮询/MutationObserver、不搬网格 DOM；选项只发 `set-layout-mode` 到唯一 runtime。
- [x] 当前窗口收敛为版本、总开关、Library/集合/完整成员数、任务、诊断和错误；不写 Eagle 原生计数。
- [x] “排序锁”位于可识别的“缩略图”原生行正下方，普通集合可用、智能集合隐藏。自动重命名当前没有可证明的 runtime 状态命令，故显示为禁用行，未猜测写入；安装后必须依据真实 Eagle/产品命令补齐或明确移除。
- [ ] 仅项目总管安装后在同一真实布局弹窗截图逐项对比；静态检查不能证明宿主实际 thumbnail-row selector、原生下拉显示或升降序交互。

## 2026-09-04：v1.15 原生排列与安全重命名安装前收口

- [x] 先红后绿：原生排列下拉固定为“文件名、拍摄时间、多级排序、手动排序、恢复自动排序”，各插件项可追溯至唯一 runtime command；非插件项及 Eagle 原生方向事件未被拦截。
- [x] “自动重命名”原生行接入 `preview-rename → 唯一插件窗口全量确认 → 两阶段原子改名/失败回滚`；取消零写入，锁定禁用，智能集合隐藏。
- [x] v1.15 EXIF resolver 的 Map/wrapper/prototype getter、路径形状脱敏与一次性提交门禁仍通过；`npm run check:v1`、`npm test`、`git diff --check` 全绿。
- [x] 只读审计：唯一正式源码 manifest/package 为 1.15.0，唯一已安装同 ID 插件仍为 1.14.0；未构建、未安装、未重启、未操作 Eagle、Library、NAS、`.library` 或 app.asar。既有备份仅登记未改动。
- [ ] 由项目总管完成 v1.15 生产白名单构建与唯一安装后，专项才可进行真实 resolver 样本、原生 UI、计数和完整行为矩阵验收。


## 2026-09-11：总管获明确授权后直接接手整体修复（未完成）

- 用户本轮明确允许必要时在总管对话修改。专项01a04308恢复归档后仍因429请求限流失败，未产生业务工具，停止依赖其执行；本轮只有总管唯一正式根写入。
- 已修改：文件名尾号解析/编号保留原标点；mini改full EXIF字典并准确映射0x9004；status纯读；开关取消；改名上下文重验；原生选项委托/方向/晚开挂载；短投影和迟到呈现保护；锁态规则固定/规则失败恢复。
- 新增两项安装前检查先红后绿；check:v1及npm test通过（仅代码辅助证据）。未安装，版本仍待最终1.16.0收口；真实排序、改名、拖拽、缓存性能和成员计数未通过。
- 不具备最终交付条件；剩余项见唯一开发文档第25节。没有修改真实Library/NAS/app.asar、没有新运行副本。

## 2026-09-11：v1.16 重建安装与实机核验（进行中）

- 安装前 `check:v1` 与 `npm test` 全部通过；v1.16.0 已由唯一正式根构建并安装到唯一 Eagle 插件目录。
- 实机确认入口脚本执行、面板显示 v1.16；在“全部/父级”视图中安全放行原生行为并报告 collection-required，未执行真实数据写入。
- 通过 Eagle 侧栏筛选可见 `4-英国站🇬🇧` 当前计数 1,188；该计数与此前不同 Library/父级视图的数字不能直接比较，仍需同一集合完成排序核验。

## 2026-09-12：v1.17 文件/文件夹编号分离与紧凑原生入口（安装前）

- [x] 新增 `v1-17-folder-file-numbering-native-ui` 红灯：首次捕获 `numberingTarget` 不存在，补齐目标契约后再次捕获身份仍为 1.16.0；统一到 v1.17/1.17.0 后转绿。
- [x] 普通父级以直属子文件夹为唯一目标，文件夹编号计划只有 folder ID；普通叶子以直属媒体为唯一目标，文件编号计划只有 item ID。文件只替换末尾连续数字，不插入分隔符或补零。
- [x] `应用到全部` 只传播被点击的排序/手动/锁定/自动编号配置，计划不含名称且返回 `renamed:false`；状态失败按运行状态快照整批恢复。
- [x] 原生排列 adapter 提供文件名、拍摄时间、多级与方向组合，紧凑显示规则来源、锁定、默认开启手动拖动/恢复自动、动态文件或子文件夹编号；全局默认、本地覆盖、恢复全局分别进入唯一命令。
- [x] 编号从原生入口发起，唯一插件窗口区分文件/直属子文件夹并显示全量预览；取消零写入，确认分别进入 item 两阶段 owner 或直属 folder owner。手动开关/自动编号状态已覆盖 runtime 与 Library 状态导出、导入及旧格式默认值。
- [x] 原生 adapter 行为门禁实际验证启动时面板不存在、晚开挂载一次、重复打开不重复、卸载清节点/监听器/option、旧按钮零命令和重新安装只一份。
- [x] 总管 UI 复核退回后新增真实节点红灯：来源操作与状态文件不得继续常驻主区。现已收进一个默认关闭的高级设置节点，摘要持续显示“跟随全局/本文件夹”；三条来源命令、导出和加载都只存在于该节点后代，主区仅保留锁定、手动/恢复自动及当前目标编号。
- [x] 生命周期门禁不再只检查源码文字，已真实构造原生面板节点并断言折叠默认关闭、按钮归属、晚开/重复挂载及卸载后旧引用零命令。
- [x] 唯一源码身份及构建/安装白名单已统一为 1.17.0，新增 `folder-level-core.js`、`folder-tree-batch-core.js`；预期唯一产物 `Eagle排序助手-v1.17.0.eagleplugin`。专项未构建、未安装、未操作 Eagle/Library/NAS/app.asar。
- [ ] 项目总管构建前须精确处理 `releases/Eagle排序助手-v1.16.0.eagleplugin` 与同名 SHA256SUMS，禁止与 v1.17 并存；随后由总管生产构建/唯一安装，再恢复专项做真实 Eagle 完整验收。
