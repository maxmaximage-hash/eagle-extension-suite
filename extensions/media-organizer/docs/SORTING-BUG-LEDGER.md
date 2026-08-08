# 排序历史 bug 永久台账

状态定义：`候选`表示已有代码/自动证据但未完成全局真实 UI；`局部现场`表示只在一个
文件夹通过；`未通过`表示最新真实 UI 明确失败。任何状态都不能删除回归项。

自动证据简称：`S`=sort-core，`SYS`=sorting-system-core，`C`=collection-core，
`TREE`=folder-tree/folder-level，`RN`=rename-core/rename-batch，`MON`=monitor-core，
`SRC`=plugin-source，`DOC`=permanent-regression-contract。

## R01-R12：顺序、范围和保护

| ID | 用户现象 | 根因与受影响层 | 首次修复证据 | 当前复发风险/冲突 | 自动证据与真实 UI 步骤 |
| --- | --- | --- | --- | --- | --- |
| R01 | 第一次拖动成功，第二次失效 | 原生 drag 与鼠标备用状态机并存；L7/L4 | 2.5.21 API 68-72 候选 | 高；R34 要求保留原生 drag，不能用全局取消换稳定 | S/SRC/DOC；同夹连续 20 次并穿插拖出 |
| R02 | 第二次从旧数组重算，前一次位置丢失 | `allData`/DOM/manual store 多事实源；L2/L4 | API 66 后改读完整渲染顺序 | 高；DOM 坐标与持久顺序仍可分叉 | S/SYS/SRC；每次拖后立即核对并刷新返回 |
| R03 | 无拍摄时间照片不能拖 | 拖动资格和顺序误依赖拍摄时间/旧数组；L2/L7 | API 66/68，`4-harrat餐厅`局部现场 | 中高；R01/R34 事件改动可回归 | S/SRC；有/无时间四种源目标组合 |
| R04 | 编号不跟最终画面 | 编号读取 raw、插入 DOM 或重新排序；L4/L6 | 2.5.11，API 73 再改屏幕坐标 | 高；任何 adapter fallback 都可能重引入 | RN/SYS/SRC；拖后逐张比对画面与预览 ID |
| R05 | 画面错序却提示“已经连续” | 只校验编号集合，未按可见位置计算差异；L6 | 2.5.21 工作候选 | 中；依赖 R04 的最终顺序 | RN；画面 `1,3,2` 必须预览 2 项变更 |
| R06 | 无拍摄时间时自动编号等待/失效 | 编号错误等待 metadata；L6 | 2.5.21 API 64 前后 | 中；树批仍含 metadata fallback | RN/SRC；全无时间仍完整预览与确认 |
| R07 | 循环换名重名、部分成功或静默成功 | 单阶段改名，无事务/回滚；L6/L8 | 2.5.21 API 69 后安全两阶段候选 | 高；渲染进程仍有直接改名旁路 | RN/SRC；循环换名、NAS 失败、重复执行 |
| R08 | 开关排序锁定改变顺序或文件名 | 锁状态进入扫描键并触发 refresh；L5/L7 | API 63，`3-Seven Hills`局部现场 | 中；监控/刷新旁路仍在 | MON/SRC；锁开关各 10 次三指纹不变 |
| R09 | 保护目录完全收不到配置 | 把“配置传播”和“破坏性执行”一起跳过；L5/L8 | 2.5.20 | 中；旧文档曾定义相反语义 | TREE/C；四层树含空层/保护层逐层查看 |
| R10 | 父层“应用到全部”成功但深层没同步 | 只处理当前/一级，且多次持久化失败无汇总；L2/L8 | 2.4.2 初版，2.5.19/20 完善 | 中；不同开关仍有各自 UI 入口 | TREE/SRC；四层以上逐层重进核对 |
| R11 | 父层文件夹和叶子素材对象混乱 | 用当前媒体数组判断层级；L2 | 2.5.10 folder-level-core | 中；父层仍走独立 sortable 路径 | TREE/SYS；父层只动直属文件夹，叶层只动素材 |
| R12 | 普通与智能文件夹排序结果不同 | 两套上下文/来源数组；L2/L3 | 2.5.0 schema v3 | qa.2 文案失败已由 qa.3 修复；智能集合 3 项真实复验为只作用当前智能视图 | C/S/SRC；相同输入规则逐项一致，智能集合明确只作用于当前智能视图且范围计数为 1 |

## R13-R24：性能、隔离、触发和改名入口

| ID | 用户现象 | 根因与受影响层 | 首次修复证据 | 当前复发风险/冲突 | 自动证据与真实 UI 步骤 |
| --- | --- | --- | --- | --- | --- |
| R13 | 智能/全部视图扫描约 2.4 万项并卡顿 | 智能切换残留普通上下文，空结果回退 raw；L2 | 2.5.12，2.5.20 再封全部视图 | 中；1 秒 monitor 仍存在 | C/SRC；打开全部及 554/49/96 智能集合观察范围/流畅性 |
| R14 | 批处理进度跨文件夹串台 | 进度无 source collection；L6/L8 | 2.5.20 `sourceContextId` | 中；后台仍是进程级单例 | TREE/RN/SRC；任务中切到 B 不显示 A 状态 |
| R15 | 刷新/重启后手动顺序丢失或污染其它集合 | 状态未按 Library+collection 隔离；L4/L8 | 2.5.0 manualViews.v2 | 中高；切换时 DOM fallback 可重捕获 | C/S/SYS；A/B 往返、刷新、重启指纹 |
| R16 | 同一插件重复加载，拖动/编号突然复位 | 正式目录与开发目录同时注入；L1/L7 | 2.4.7 清重复实例，后加 canonical guard | 中；同 API 注入仍靠全局对象防重 | SRC；重启后 listener 单实例并连续 20 拖 |
| R17 | 排序操作自动打开标签/GPS 窗口 | 排序与 C 共用 `onPluginRun` 生命周期；L1 | 2026-07-23 自动服务/用户开窗分支 | 高；A/C 仍在同一 plugin.js | SRC；重启只见排序，C 服务/窗口不启动 |
| R18 | 部分失败/NAS 不可用却提示成功 | 批处理缺少失败聚合和回滚；L6/L8 | 2.4.2-2.5.19 多轮完善 | qa.3 自动重试和 qa.4 投影失败已由 qa.5 真实复验通过；仍保留正式发布回归 | TREE/RN/SRC；可控失败显示数量、原因、恢复，失败后不得自动重放同一请求 |
| R19 | 多级排序、手动视图、编号各读不同顺序 | 三套顺序来源；L3/L4/L6 | 2.5.11，API 66/73 继续修 | 高；是当前最核心结构风险 | S/SYS/RN；逐阶段 ID 序列完全一致 |
| R20 | 中文/数字/全半角/空值/反向排序不稳定 | 比较器规范化与稳定后备不足；L3 | 2.5.0 sort-core | 低中；纯核心已有覆盖 | S；重复运行同指纹，真实抽查名称顺序 |
| R21 | 拖后自动编号不响应、重复调度或开关异常置灰 | drop、metadata、重复注入争用同 timer/signature；任务忙碌状态被当成开关权限，且 `running` 与 `sourceContextId` 同步不完整；L6/L7/L8 | qa.2/API79；特殊文件夹置灰场景真实复验通过 | qa.5 受控失败后开关释放、无自动重试、用户明确预览后单次恢复成功；正式发布仍需 20 次拖 | SRC/RN；未锁定非空文件夹始终可切换开关，失败必须释放状态且只允许用户显式重试，正式发布仍需 20 次拖 |
| R22 | 打开插件/时间读取/刷新/锁开关意外编号 | 通用调度函数被非用户事件调用；L6/L7 | 2.5.21 API 64 后持续清理 | qa.4/qa.5 真实日志证明失败后不再恢复到 monitor；只在用户明确确认后出现第二次执行 | MON/SRC；所有零副作用事件改名请求恒为 0，失败请求不得自动恢复到轮询入口 |
| R23 | “自测拖动”真实改网格、存储和历史 | 运行时 integration test 调 `performManualDrop`；L7 | API 66 改为只读 | 低中；测试入口仍注入主窗口 | SRC；运行自检前后画面/存储指纹不变 |
| R24 | 主窗口并发直接改名导致 ENOENT/半成功 | 渲染进程直接执行改名；L6 | API 69 后后台安全批任务 | qa.5 受控失败终态网格、检查器、真实文件和 metadata 一致；明确重试成功 | RN/SRC；循环名、失败回滚、切换不串台，失败终态三处名称必须一致 |

## R25-R39：真实文件、界面稳定、性能和宿主主权

| ID | 用户现象 | 根因与受影响层 | 首次修复证据 | 当前复发风险/冲突 | 自动证据与真实 UI 步骤 |
| --- | --- | --- | --- | --- | --- |
| R25 | 编号后缩略图/右侧预览消失 | `item.save()`只改元数据，真实文件名不同步；L0/L6 | API 69 后原生管线候选 | 高；已有真实事故与恢复记录 | SRC/RN；编号后逐张预览、刷新、核对文件引用 |
| R26 | 快速拖动弹“找不到文件”或编号落后 | 多个编号事务重叠，旧计划继续运行；L6/L8 | 2.5.21 串行+静默期候选 | 高；进程级队列未按 collection 建模 | SRC/RN；快速 20 拖只执行最后顺序 |
| R27 | 编号后双刷新，缩略图成片空白 | 当前夹完成后重复全列表 rebind；L2/L7 | 2.5.21 R27 工作候选 | 高；多个 refresh fallback 尚存 | SRC；全程逐帧观察网格和预览 |
| R28 | `__eagle_number` 临时名出现在界面 | 事务临时阶段直接投影到 UI；L6/L7 | 2.5.21 可见名称 mask 候选 | qa.5 失败清 mask 后定向刷新受影响 item 与选择，真实终态未见临时名且名称一致 | SRC/RN；快速拖动逐帧不得见临时/空名，失败清 mask 后网格/检查器恢复真实名 |
| R29 | 一次改很多项弹 Eagle 大进度层阻挡 | 原生改名批次过大；L0/L6 | 2.5.21 分组最多 3 项候选 | 中高；最小差异和分批需统一 | SRC；全程无大遮罩，预览保持可用 |
| R30 | 移一张照片要 10-25 秒才显示新名 | 重复串行预检且 UI 等待落盘；L6/L7 | API 74 即时 mask/并行校验候选 | qa.5 真实失败在有界时间内结束并恢复一致投影；明确重试即时显示并成功落盘 | SRC；相邻/跨行拖动立刻显示，失败也必须在有界时间内结束并恢复一致投影 |
| R31 | 切换/分页/列表补全触发整夹编号 | 成员指纹变化被当成用户改序；L6/L7 | API 75 删除成员触发链 | 高；历史代码/迁移可再引入 | SRC；88/169/179 项往返、刷新、重启请求=0 |
| R32 | 中断后大量临时名留在真实文件 | 无精确 item 恢复协议；L6/L8 | API 75 `restore-interrupted-batch`，局部事故恢复 | 中高；恢复文件仍在插件目录 | SRC/RN；只恢复精确匹配项，三处不含临时名 |
| R33 | 关闭手动开关后已排顺序立即改变 | 将输入许可等同于 manual view 是否生效；L4/L7 | 2.5.21 API 75 后决策候选 | 高；旧 `resetManualState`/clear 语义需审计 | S/SRC；开关各 10 次+刷新/切换/重启不变 |
| R34 | 开启手动排序后不能拖到 Finder/聊天框 | 历史路径曾在捕获阶段取消 `dragstart`；L0/L7。Computer Use 跨应用拖动无判定力 | 无插件 A 与候选 B 物理 Finder 拖出及 SHA-256 对照已通过 | 本次关闭并接受残余风险：用户取消三态重复物理拖出，以 A/B 实证和三态源码/自动回归验收 | SRC/DOC；后续专项可补三态物理拖出，但不再作为本次发布阻断 |
| R35 | 单张卡片名已改但真实原图仍是旧名，只有该图无法拖动或导出 | 历史编号事务留下 metadata/raw 名称分叉；通用恢复错误要求 metadata 先等于磁盘旧名，导致合法恢复永远被拒绝；L0/L6/L8 | qa.9/API86 恢复通道候选 | 高；不得放宽普通编号的同名预检，也不得手写 `.library` | SRC/RN；精确 ID 的 metadata/raw 分叉可经 Eagle 原生管线恢复，普通编号分叉仍拒绝 |
| R36 | 179 项 NAS 文件夹缩略图一张一张出现，约 25 秒后插件才完成 EXIF | 原生预览尚未稳定就并发读取全部 NAS 原图；旧当前视图键又触发 sidecar 写入；L0/L7/L8 | qa.9/API86 候选 | 高；与 R13/R22/R27/R31 交叉，切换 collection 时旧扫描必须取消 | SRC/MON/TEAM；179 项先见原生预览，缓存命中零原图读取，切换后旧扫描停止排队，旧显示键不写 sidecar |
| R37 | 拖动一张照片却整文件夹全部改名 | 完整顺序计划未携带本次拖动的最小序号变化边界，后台重建时再次扩成全量；L6/L8 | qa.9/API86 候选 | 高；与 R04/R07/R18/R24/R29/R30 交叉 | RN/SYS/SRC；跨 N 位只提交 N+1 个同组变化项，后台事务再次按 `allowedChangeIds` 过滤 |
| R38 | 智能文件夹中手动拖动完全不可用 | Eagle 切入智能集合时仍保留旧 `currentFolder`；L2/L7 的资格判断先读旧普通文件夹子级，把智能媒体误判成 `direct-folders`；L4 写入链未被现场触发。qa.16 已让显式 smartfolder 路由优先，但 2026-07-28 真实首拖仍无顺序变化 | qa.10/API87 源码候选；qa.16/API93 自动通过、真实未通过 | 高；影响 R12/R15，交叉 R18/R27/R34/R40/R41；当前不能证明 MoveCommand 在真实事件链被提交 | TREE/C/HOST/SRC；带残留普通父文件夹或仅有显式 smartfolder 路由时仍为 `direct-media`，有效 drop 通过唯一 MoveCommand 写入该智能 collection 的 `manualViews.v2`，刷新/切换后恢复且来源普通文件夹状态不变 |
| R39 | 智能文件夹已具备拖动资格，但松开鼠标后画面仍不移动 | 部分 Eagle 网格拖动会话只派发 `dragstart/dragend`，没有派发扩展可见的 `drop`；qa.16 已保留最后有效网格落点并统一单次提交，但 2026-07-28 真实首拖后画面和诊断均无 MoveCommand 证据；L0/L7 | qa.11/API88 候选；qa.16/API93 自动通过、真实未通过 | 高；交叉 R01/R15/R34/R38；首次真实复验失败已触发升级，禁止恢复第二套鼠标/指针状态机或盲目重试 | SRC；仅当既有 `dragState`、collection 未变化且最终坐标或同一状态中最后有效落点命中另一卡片时，提交现有 MoveCommand 一次；正常 drop、网格外、跨 collection、锁定均不补交，且不取消事件、不改 `dataTransfer` |
| R40 | 已选拍摄时间排序且单张简介有相机时间，真实网格仍明显乱序 | 自动结果、旧完整 manual view、Eagle raw/DOM 与刷新链并存；现场自检在旧覆盖存在时直接放行；L2-L4/L7 | qa.12/API89 源码候选；qa.13/API90 修复 | 高；交叉 R02/R15/R19/R33/R36 | COORD/S/SYS/SRC；自动基础顺序先重算，再应用稀疏相对关系；旧 v2 完整数组迁移为历史字段；升降序方向必须进入规则 |
| R41 | 拍摄时间升序/降序按钮切换后网格方向不变 | 单独拍摄时间模式的规则方向写死为 asc，宿主 sortIncrease 未进入 L3；L3/L7 | qa.13/API90 修复 | 高；与 R40、R19 交叉 | SRC/COORD；升序生成 `TAKEN_AT asc`，降序生成 `TAKEN_AT desc`，两者都重新应用同一 overlay |
| R42 | 智能文件夹显示或进入自动编号/改名入口 | 智能集合虽已被 `canAutoNumber=false` 拒绝，但 qa.15 仍无条件创建整行后仅做 `display:none`，切换瞬态可显示灰色入口；手动拖动成功链也仍无条件调度自动编号；L2/L4/L6/L7 | qa.16/API93 源码、自动与真实 UI 通过 | 中；智能界面已证实整行不存在且布局自检通过；普通文件夹真实只读回归因 R38/R39 首个失败而未执行 | SRC/SYS/DOC；智能集合 DOM 中不存在自动编号整行、计数或入口；MoveCommand 链零改名计划、零事务、零 autoRename 读写；普通文件夹编号回归保持通过 |
| R43 | 智能文件夹真实拖动后零 `MoveCommand`、零 drop 诊断且画面不变 | Eagle 在该智能网格会话中没有向扩展暴露可提交的 HTML5 drag/drop；qa.17 被动 pointer 能捕获起点，但移动/落点仍不稳定，6 次会话均取消且零 commit；L0/L2/L7 | qa.17/API94 自动通过、真实未通过 | 高；直接影响 R38/R39，交叉 R01/R15/R34/R42；继续修复需要拦截原生或第二套业务鼠标层，已按宿主硬限制停止 | HOST/SRC/DOC；仅智能 collection 建立左键同库同集合 pointer 会话，超过阈值且落到同网格另一卡时生成一次既有 `MoveCommand`；原生 drop 与 fallback 互斥，Esc/预览/锁定/上下文变化/网格外/窗外取消，普通/global/unknown 零介入；真实首拖必须立即改变画面后才继续 3-4 次及持久化验收 |
| R44 | qa.17 已捕获 pointer 起点，但原生 drag 接管后 pointer 会话先以阈值/目标无效取消，落点被宿主覆盖层遮蔽 | 目标只取 `elementFromPoint`，且 pointerup 不知道同一会话已转入 native drag；L0/L2/L7 | qa.18/API95 自动候选 | 高；直接影响 R38/R39/R43，交叉 R01/R15/R34/R42；普通文件夹原分支冻结，任何需要拦截原生、指针捕获、覆盖层或模拟鼠标的方案立即停止 | HOST/SRC/DOC；单一 resolver 用 composed path、元素栈和稳定卡片 ID 解析并保留最后有效同网格目标；同一 adapter 被动观察 native drag，pointer/native drop/dragend 只提交一次，窗口外、预览、锁定、上下文变化和选中目标全部取消 |
| R45 | qa.18 真实诊断已有唯一 `pointer-commit`，但智能网格画面顺序不变 | adapter 在生成 MoveCommand 时即记录 commit；智能提交又依赖 dragend 后 helper，网格 API 的 `undefined` 返回值也可能被误判失败并触发刷新覆盖；L4/L7 | qa.19/API96 自动候选；真实首拖在更早的 `grid-outside` 取消，未进入应用链 | 高；直接影响 R38/R39/R43/R44，交叉 R15/R19/R40/R42；禁止把内部 commit 当成用户结果，也禁止为追求画面变化修改普通文件夹分支 | HOST/MOVE/SRC/DOC；阶段必须完整到 `MOVE_RECEIVED -> REDUCER_BEFORE_AFTER -> PERSIST_OK -> RENDER_REQUESTED -> VISIBLE_VERIFY_OK`；任一步失败不得计成功，首拖前后可见 ID 必须变化且刷新/切换后保持 |
| R46 | 智能拖动和刷新后顺序正确，但切换到其它集合再返回时恢复为原始查询顺序 | manual overlay 已持久化，但 collection 重入只恢复自动/native 结果，未调用唯一 smart presenter 重新呈现 overlay；L4/L7 | qa.21/API98 自动与真实通过 | 高；直接影响 R38/R39/R45，交叉 R15/R40/R42；不得新增第二套排序规则或复制状态 | COORD/MOVE/SRC/DOC；重入时按当前 smart collection ID 读取 overlay，经唯一 coordinator 得到 final order 并由 smart presenter 呈现；刷新、切换智能/普通集合再返回和重启后保持，来源普通集合不变 |
| R47 | 智能文件夹虽然能移动，但没有与普通文件夹一致的左右落点提示和目标高亮，用户无法判断放置位置 | qa.21 只做了源码接线，视觉仍由普通 helper、智能 pointer、native drag 三个调用点直接竞争；有效 target 后的 `target-unknown/helper=null` 会立即清掉蓝框，部分智能卡又可能只有 targetBox/side 而没有 helper；L7 | qa.23/API100 先以真实事件序列红灯复现，再提取唯一 `drag-feedback-controller` | 2026-07-29 用户真实验收重开；交叉 R01/R34/R38/R39/R43-R46；禁止另造覆盖层或第二套视觉/鼠标状态机 | HOST/FEEDBACK/SRC/DOC；普通与智能共用一个 controller 的 start/update/clear；未知 native surface 保留最后有效目标，无 helper 时在既有卡片投影同色左右边框；移动到新卡、左右切换、选中项、网格外、drop、dragend、pointercancel、Esc、预览、集合切换、失焦均有可执行状态测试 |
| R48 | 切换智能文件夹后网格变空并近似卡死，控制台持续出现 `collectionActions.append is not a function` | `renderSettings` 把 collection actions 容器遮蔽成 boolean 后仍调用 `.append()`，500ms 入口轮询持续重放异常；智能重入又依赖固定延迟并直接改写 Eagle `allData/filtereds`，把加载瞬态放大为空白/重复呈现；L2/L7 | qa.22/API99 源码候选 | P0；主影响 R12/R13/R15/R38-R47，交叉 R16/R19/R27/R34/R40/R42；普通文件夹和 HostInputAdapter 冻结，禁止以 Eagle 私有数组写入或定时重试换取恢复 | HOST/LIFECYCLE/PRESENTER/SRC/DOC；normal→smart→normal、smart→smart 和重复渲染无异常/重复节点；`0→511`、快速切换、迟到 token、真实空集合和 presenter 失败全部 fail-open；500ms 轮询只补入口，智能 presenter 不写 `allData/filtereds`，真实主库往返 3-4 次不空白、不出现异常风暴 |
| R49 | qa.23 智能拖动出现绿色加号和原图 ghost，网格产生巨型空洞并连续跳位，观感与普通文件夹完全不同 | qa.23 虽只有一个 feedback controller，却没有区分宿主布局策略；smart start/update 仍启用 `eagle-photo-sort-dragging` 并把所有 `.box-sortable-helper` 强制显示，helper 参与 Eagle 智能瀑布流布局；L0/L7 | qa.24/API101 取消“显示全部 helper” | 2026-07-29 用户真实录屏 HOST FAIL；交叉 R01/R34/R38-R48；绿色加号/ghost 属于 Eagle 原生 drag 外观，不得靠拦截原生 drag 隐藏 | HOST/FEEDBACK/SRC/VIDEO/DOC；唯一 controller 显式区分 normal/smart strategy；smart 禁止遍历/显示全部 helper、禁止修改非当前 helper、禁止启用 normal body class；当前一个 helper 必须脱离布局，未知 surface 保留，外部 drag-out 继续放行 |
| R50 | qa.24 智能拖动只在目标照片角上出现一个小蓝点，仍与普通文件夹完整竖向落点标识不一致 | qa.24 放弃 helper 后把 inset box-shadow 画在 smart `.box` 层，该层的真实尺寸/裁切边界不等于普通 helper 的可视容器，完整竖线被裁成角点；L7 | qa.25/API102 源码候选 | 用户真实 qa.24 HOST FAIL；交叉 R47/R49/R34；不得再叠加相似 box-shadow、显示全体 helper 或改写 targetBox 的 position/overflow | HOST/FEEDBACK/SRC/DOC；smart 优先复用 resolver 已返回的当前一个 Eagle left/right helper，保存全部相关 inline style 后设为 absolute/full-height/zero-footprint，并加原生 drag-over；切换/clear 精确恢复；helper 缺失且宿主 targetBox 已是非 static 定位时才挂 top=0、bottom=0、width=3px 的完整纵向伪元素，static 时 fail-open；normal 不变 |
| R51 | 安装 qa.25 后智能与普通文件夹的拍摄时间、多级排序、手动拖动等整个排序界面同时消失 | 智能蓝线伪元素 CSS 位于动态 `injectionSource` 外层模板中，`content:\"\"` 展开后变成无效 JavaScript，完整载荷在执行前 `SyntaxError: Unexpected string`；现有 `node --check` 只检查外层文件，regex 测试只检查样式文本；L1/L7/L8 | qa.26/API103 修复并补完整载荷编译门禁 | P0；交叉 R16/R17/R42/R47-R50；禁止再用外层语法检查或字符串存在代替最终载荷可执行性 | SRC/HOST/DOC；测试必须从真实 `plugin.js` 构造完整 `injectionSource` 并以 `new Function` 编译；任何 inject/monitor 失败把完整 stack 持久化到 diagnostic 且同错 60 秒限流；真实主库必须出现拍摄时间、多级和手动入口，智能自动编号/改名仍不存在 |
| R52 | 切入“全部”或未知视图首帧仍残留旧文件夹，扩展错误过滤或重排 Eagle 原生列表 | all/global 显式路由优先，全部和未知视图直接放行输入顺序，零扫描、零写入 | qa.34 源码与自动门禁通过；真实 Eagle 尚待重新确认 | C/SRC/DOC；all-view first frame、空全部视图和 unknown view 必须 fail-open |
| R53 | 智能集合把 `allData` 临时全库或旧查询 epoch 当成当前成员，造成空白、错序或跨查询污染 | 只接受带可信 `sourceIdentity` 与当前 `queryEpoch` 的 `SmartCollectionHostSnapshot` | qa.34 源码与自动门禁通过；真实 Eagle 尚待重新确认 | HOST/LIFECYCLE/SRC/DOC；24319 项临时全库拒绝、合法查询、瞬态空结果和 epoch 切换 |
| R54 | 主 Library 尚未就绪时插件注入或执行主进程动作，触发启动竞态和重试风暴 | `BOOTING -> WAITING_LIBRARY -> READY_TO_INJECT -> ACTIVE/STOPPED` 证据驱动；等待期零注入、零文件 I/O、零 executeInMain | qa.34 源码与自动门禁通过；真实 Eagle 尚待重新确认 | LIFECYCLE/HOST/SRC/DOC；身份不匹配、超时、同 generation 单次注入和无固定延迟重试 |

## 发布状态

- R01-R33：qa.5 已通过本轮快速 QA 的关键真实矩阵与受控失败恢复；用户明确接受 4 次
  物理拖动作为本次 R01 发布样本，R01-R33 本次全部关闭。
- R34：A/B 物理鼠标拖出与 SHA-256 对照已通过；用户明确取消三态重复物理测试，并以
  源码/自动回归接受残余风险，R34 本次关闭。
- 当前 2.5.21/API 77 不得打包为新发布；该冻结历史结论继续作为永久治理基线保留。
- `2.5.22-qa.5 / API 82` 已作为本机唯一插件安装，R01-R34 在本次治理口径下全部关闭。
- 正式 Library 位于 NAS；本轮未获 NAS 写入授权，因此不宣称生产 NAS 已真实写入验证。
- `2.5.22-qa.16 / API 93` 已唯一安装并在真实 NAS 主库加载。R42 的智能自动编号整行
  已真实关闭；R38/R39 第一次真实拖动仍无顺序变化，当前状态为未通过，不能发布为
  “智能文件夹排序已修复”。证据：
  `qa-evidence/QA-SMART-FOLDER-SORTING-QA16-2026-07-28.md`。
- `2.5.22-qa.17 / API 94` 已唯一安装并由真实 Eagle 加载。R43 诊断捕获 6 次
  `pointer-start`，但 `pointer-commit` 为 0，会话以 `below-threshold`、
  `target-invalid`、`replaced-session` 或 `window-blur` 取消；画面仍不改变。
  R42 继续真实通过，R38/R39/R43 仍未通过。证据：
  `qa-evidence/QA-SMART-FOLDER-SORTING-QA17-2026-07-28.md`。
- `2.5.22-qa.18 / API 95` 已唯一安装并由真实 Eagle 加载。首拖捕获完整
  `pointer-start -> native-drag-start -> native-drag-target -> pointer-commit`，
  且 commit 只有一次，但真实画面顺序未改变；首拖已按门禁立即停止。
  R42 继续真实通过，R38/R39/R43/R44/R45 仍未通过。证据：
  `qa-evidence/QA-SMART-FOLDER-SORTING-QA18-2026-07-28.md`。
- `2.5.22-qa.19 / API 96` 已通过自动门禁、唯一安装并正常重启。L4/L7 已增加完整
  应用阶段诊断，但真实首拖在 `native-drag-start` 后以 `grid-outside` 取消，没有
  MoveCommand 或 `MOVE_STAGE`；按首拖门禁停止。R42 保持通过，
  R38/R39/R43/R44/R45 仍未通过。证据：
  `qa-evidence/QA-SMART-FOLDER-SORTING-QA19-2026-07-28.md`。
- `2.5.22-qa.21 / API 98` 已唯一安装并由真实主库验收：`线上展示照片` 连续 3 次
  拖动均立即变化且刷新保持；`MAX照片集` 拖动、刷新、切换其它智能/普通文件夹再返回
  后保持，零改名，智能自动编号整行不存在。R38/R39/R43-R46 关闭；R47 已固定为
  永久视觉一致性规则。证据：
  `qa-evidence/QA-SMART-FOLDER-SORTING-QA21-2026-07-28.md`。
- `2.5.22-qa.22 / API 99` 已完成 R48 红灯、最小结构修复及工作区/候选完整自动门禁。
  智能设置 DOM、generation/token 生命周期和 fail-open presenter 已分离；智能路径
  不再写 `allData/filtereds`，也不依赖固定延迟或 500ms 业务重放。受控 UI 连续两次
  因 ScreenCaptureKit `-3811` 失败，无法满足正常退出门禁，因此未安装、未执行真实
  主库 smoke；当前唯一安装保持 qa.21/API98，R48 真实门禁仍待安装后关闭。证据：
  `qa-evidence/QA-SMART-FOLDER-STABILITY-QA22-2026-07-29.md`。
- 2026-07-29 用户在唯一安装 qa.22/API99 的真实智能文件夹确认“能拖动但没有蓝色左右
  落点效果”，因此 qa.21 对 R47 的通过结论失效并正式重开。qa.23/API100 把普通与
  智能入口收敛到唯一 `drag-feedback-controller`；但用户录屏
  用户提供的 2026-07-29 录屏（素材不进入仓库）证明 qa.23 HOST FAIL：所有
  smart helper 被显示后参与瀑布流布局，产生巨型空洞和卡片跳位，因此不得发布。
- `2.5.22-qa.24 / API101` 已把唯一 controller 分为 normal/smart 两种投影策略：
  normal 保持 Eagle helper，smart 永不读写 helper display，只在目标卡片投影无布局
  box-shadow；真实非原位 native 事件序列、未知 source surface、exactly-once commit
  与外部拖出放行已进入自动门禁。qa.24 随后完成唯一安装并健康启动，但用户真实拖动只
  看到目标角上的小蓝点，R50 判定 HOST FAIL，不得发布。
- `2.5.22-qa.25 / API102` 已以 R50 红灯改为“当前一个 helper、绝对定位、全高、恢复
  原样”，helper 缺失才使用完整纵向伪元素。当前只完成源码开发，未安装、未操作 Eagle。
- `2.5.22-qa.26 / API103` 已关闭 R51：qa.25 完整注入载荷可稳定复现
  `SyntaxError: Unexpected string`，qa.26 修复后同一门禁通过；候选完整自动回归通过并
  已唯一安装。真实 `MAX照片集` 511 项中拍摄时间、多级排序和手动拖动入口恢复，智能
  自动编号/改名入口不存在，未执行拖动、改序或改名。R50 的完整蓝色落点仍由用户验收。
- 下一次功能修改必须先在本台账标出影响 ID 和冲突 ID，再写失败测试。
