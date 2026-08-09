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
| R52 | 普通文件夹切到“全部”时首屏短暂乱序，数秒后才恢复 Eagle 原生添加日期顺序 | Eagle 切换首帧残留旧 `currentFolder`；`fromContext()` 若先采用宿主对象，会把 global/all 误认成旧 normal collection，排序包装随即读取旧 manual overlay/文件夹锁与规则；L2 collection ownership | qa.29/API106（本轮）；关联 R13/R15/R19/R31/R48 | 高；首帧与稳定帧都必须 fail-open，未知上下文也不得猜测；不得在 UI/DOM 事件追加规则 | C/SRC/DOC；明确 `view=all/global` 与 `view=unknown` 高于残留 folder；global/unknown 原样返回 Eagle 输入顺序，不读 overlay/lock/folder rule，不扫 EXIF、不做 N+1、不刷新、不生成改名/编号计划 |
| R53 | 智能文件夹启动发生“默认顺序 → 长卡顿 → 真成员到达后二次跳变” | 智能成员路径允许 `allData/raw` 进入；loading/ready 只由 busy/可见数组猜测；临时大表仍可做 automatic/manual overlay；overlay ready 数组在循环中反复排序。qa.30 真实失败还证明 Eagle 可让已完成的显式 `filtereds` 与 `allData` 同引用，且 LOADING 监控会错误扫描 538 项 EXIF | qa.30/API107 已拒绝并回滚；qa.31/API108 Phase 2 候选；关联 R38-R48、R52 | P0；正常/全局 R52 fail-open 与 qa.26 冻结行为不得改变；不得以 sleep、DOM 重排或按全库数量拒绝替代来源认证 | SNAPSHOT/LIFECYCLE/COORD/SRC/DOC；只接受显式 `filtereds` 槽位的本轮 `eagle-smart-query` sourceIdentity + route generation/引用+成员指纹推导的 queryEpoch，连续稳定成员快照才 READY；`allData/raw` 永不 fallback；LOADING 零排序/overlay/refresh/EXIF/改名，EMPTY 需稳定当前查询，旧 generation 自动失效；合法 smart 全库匹配可在 READY 排序；稳定堆拓扑避免 24k 反复 ready.sort |
| R54 | Eagle/NAS Library 启动可能卡在“即将完成”，或 identity 已出现后因主窗口 readiness 瞬态/证据不足而永久不注入 | bootstrap、host readiness 与业务 I/O 曾缺少唯一 generation gate；qa.33 把瞬态 false 当终态失败，qa.34 又证明单一 DOM/host 分支会对已 loaded 可操作主窗 false-negative；L1/L2 | qa.33/API110、qa.34/API111 均拒绝；qa.35/API112 独立源码候选 | P0；不得为启动成功放宽 R53，不得以路径、固定 sleep、cache/team/metadata poll 证明 ready | STARTUP/HOST/SRC/DOC；identity 前零 executeInMain/业务 I/O；identity 后只读、多正向证据 readiness evaluator + 有界可取消 waiter；同 generation verified ready 后一次 inject，超时 fail-open，切库/STOPPED 丢弃迟到结果 |
| R55 | 智能文件夹首个可见帧仍可能先展示已知错误的 Eagle 原生顺序，metadata/cache 完成后约一分钟再跳到插件最终顺序；安装升级还会丢 cache/team backup，呈现或持久化失败可留下 DOM/宿主数组/manual store 半提交 | L0-L8 存在多事实源与旁路：成员完整性只靠重复观察，metadata proof 未绑定 snapshot，presenter/数组写入/READY commit 分散；可变状态与插件代码同目录；普通拖动先呈现后持久化但无立即双向回滚 | qa.36/API113 T3 首帧 loading 通过但 READY 失败，已拒绝并回滚；关联 R01-R54 | P0；验收是 **SMART FIRST VISIBLE FRAME**，不是“最终排对”；不得用 native 错序闪现、fabricated revision、partial READY、刷新补救或第二 OrderCoordinator 换绿 | R55.1 `IMMUTABLE CODE / DURABLE STATE`；R55.2 未验证 smart 帧显示 loading/兼容稳定投影；R55.3 仅 `VERIFIED_COMPLETE` 成员；R55.4 identity-bound metadata proof+缺失哨兵；R55.5 唯一 OrderCoordinator 与 lifecycle commit；R55.6 `HostOrderPresentationPort` 双向事务；R55.7 generation/fingerprint/stop/observer 去重；R55.8 普通拖动 DOM+arrays+manual persistence 三方原子回滚。`team-state-backups` 已迁移 durable root；`geo-tag-state.json` 属 C，仍是独立状态债务 |
| R56 | qa.36 在真实 `MAX照片集` 首帧正确显示 loading，但 538 项永远无法 READY；诊断在 memberCount=100/visibleCount=0 与 visibleCount=120 间交替，sourceIdentity 为空 | `selectSmartQuerySource` 用一个 `sourceReference` 同时代表 filtered-query 与 current-view ownership；真实 Eagle 的 `filtereds`、`allData` 为分离对象时，任意单值都会使另一候选永远不匹配，自动 fake 只覆盖 alias/手工纯函数；L2 host adapter wiring | qa.36/API113 真实失败并回滚；qa.37/API114 Phase 1 | P0；不得恢复 allData fallback、不得让 partial 100/300 READY、不得破坏 `filtereds===allData` 合法 alias | SNAPSHOT/SRC/DOC；证据拆为 `filteredReference` 与 `currentViewReference`；非空 partial filtereds 阻止 current-view 降级；真实分离对象 100→300→538 + 120 可见虚拟化，最终仅 538 + queryFinished + paginationComplete + advertisedCount=538 连续观察 READY；插件真实调用集成合同必须同时传两引用并禁止旧歧义字段 |
| R57 | qa.37/API114 真实启动恢复 `MAX照片集` 时首帧 loading 正确，但 `currentSmartFolder` 尚未 hydration，路由已是 smart、右侧已显示 538，插件仍报 `no-smart-query-source` | collection-core 已从 URL 可靠得到 `MJCRT7F81VVTJ`，但 host observation 再次硬依赖 `bodyScope.currentSmartFolder.id/count`，形成第二份身份门禁；L2 adapter wiring | qa.37 真实失败；qa.38/API115 源码候选 | P0；不得用名称/DOM 计数、不得以 `allData.length` 自证完整、不得放宽 R55/R56 partial 门禁 | SRC/DOC；同 ID `currentSmartFolder` 优先，缺失时只读 Eagle `smartFolderMappings[collection.id]`；route collection ID 作为当前 smart identity，映射记录 `imageCount` 作为独立 advertised count；真实 538 只 READY/PRESENT 一次 |
| R58 | qa.38/API115 使用 route+mapping 后仍 `no-smart-query-source`；Eagle 4.0 宿主源码显示 `filtereds = allData.slice(0, len * page)`，旧模型把 filtereds 误当完整查询、allData 误当 provisional | 字段命名推断替代了宿主真实数据流；非空 100 项 filtereds 错误阻断完整 538 项 allData，且 `allData===raw` 被无条件拒绝；L2 source ownership | qa.38 真实失败；qa.39/API116 源码候选 | P0；必须保留 24k 临时全库拒绝、R55 首帧和 R56 双引用；不得靠固定延时或 DOM 文案 | SNAPSHOT/SRC/DOC/HOST-SOURCE；route + 同 ID mapping imageCount + query finished + currentViewReference + visible consistency + unique count 精确匹配共同证明 allData；filtereds 视为分页投影，只有自身完整才优先；raw alias 不再单独决定真伪 |
| R59 | qa.39/API116 已证明 `MAX照片集` 的 538 个成员完整且 READY，但 metadata proof 永久显示“538 个媒体，0 个具有文件路径 / 0/0”，首帧一直 loading | `api.current()` 的排序成员身份已来自 route collection，后台元数据上下文却第三次依赖未 hydration 的 `bodyScope.currentSmartFolder.id`；路径补全失败被吞掉并把上下文标记为已扫描；scan key 不含 smart generation；非媒体/无路径成员没有终态；L2/L3 metadata adapter | qa.39 真实失败；qa.40/API117 源码候选 | P0；不得放宽 R55 metadata proof，不得遍历 `.library` 或用固定延时；普通文件夹、global、原生预览保持冻结 | META/SNAPSHOT/SRC/DOC；metadata 继承已证明的 `collection.id`；READY 538 IDs 按公开 `eagle.item.getByIds` 分批补路径；成功响应后仍无路径或非媒体写本次注入会话 missing sentinel，API/超时失败不伪完成并 5 秒退避重试；scan identity 绑定 collection+snapshot generation+fingerprint，旧扫描自动失效；不得保留从空 sourceItems 取 ID 的死分支 |
| R60 | qa.40/API117 已把 538 个 ID 送入路径补全，但 `eagle.item.getByIds()` 在 Eagle 4.0 返回的成员对象没有 `filePath`，仍为“已补全 0 / 稳定缺失 538”，随后 PRESENT fail-open | 成员身份查询与文件资源解析被错误视为同一 adapter contract；整批 0 路径还会被误判为所有媒体都稳定缺少元数据，掩盖宿主契约不兼容；L2/L3 resource adapter | qa.40 真实失败；qa.41/API118 | P0；禁止扫描/推导 `.library/images/*.info`、禁止绝对 NAS 路径、禁止用 `getSelected()` 改变选择、禁止把整批 0 路径伪造成 missing sentinel | RESOURCE/META/SNAPSHOT/SRC/DOC；唯一 `ItemResourceResolver` 只调用公开 `eagle.item.get({ids, fields:[id,ext,filePath,...]})`，精确去重、200 项有界批次、并发 3、generation 可取消；漏 ID、非数组或整批媒体 0 路径均 retryable fail-open，只有契约已证明且部分项目仍无路径时才允许会话 sentinel；真实 538 必须资源解析、metadata proof、一次 PRESENT 和首帧稳定全部通过 |
| R61 | qa.41/API118 在真实 `MAX照片集` 已得到 538 项 READY，但停在 `FINAL-ORDER-PENDING`；路径资源查询开始后既无完成也无超时 | 大批 `eagle.item.get({ids, fields})` 可能同步阻塞插件事件循环；旧 `withTimeout(eagleCall())` 先执行宿主调用、后创建 timer，阻塞时超时器根本不存在；200 项×并发 3 又放大宿主/NAS 争用 | qa.41 真实失败；qa.42/API119 | P0；禁止扩大并发、固定 sleep、重复整批调用或用 loading 掩盖永久阻塞；诊断异常也不得阻断业务 | RESOURCE/META/MONITOR/SRC/DOC；宿主资源能力从单 ID probe 开始，默认 batch=1/concurrency=1，批间主动 yield；超时器必须在调用 thunk 前建立，返回后复核实际耗时；失败按 5/10/20/40/60 秒指数退避；诊断/yield 失败 fail-open；真实 538 必须可见有界进度并最终 COMPLETE |
| R62 | 真实缓存文件只有单一 `libraryPath/items`，且仍指向另一 Library；切库会清空缓存，启动时磁盘旧 cache 又覆盖刚激活的新库，导致每次重开/切库重复读取 NAS 并可能被迟到扫描污染 | metadata cache 缺少 Library 分区和 generation ownership；签名未使用 Eagle 官方 `modifiedAt`；扫描先补全部路径再查缓存，使缓存即使命中也无法避免宿主/NAS I/O | qa.41 现场证据；qa.42/API119 | P0；不得共享单槽 cache、不得因切库删除其它库分区、不得让迟到扫描写当前 active Library、不得在 cache 命中前查询路径或原图 | META/CACHE/MONITOR/SRC/DOC；schema v3 按 Library identity 分区并迁移 v2；bootstrap 读盘后重新激活当前库；cache-first 只为 miss 请求资源；签名统一 `size+modifiedAt`（兼容旧字段读取）；扫描捕获原 Library ID，迟到结果只能写原分区；重开同库不得再查 538 路径/读 538 原图 |
| R63 | qa.42/API119 单 ID `eagle.item.get({ids,fields})` 在 Eagle 4.0.0/build 20260401 快速返回数组，但遗漏精确请求 ID，首项即 `ITEM_RESOURCE_RESPONSE_INCOMPLETE`，随后按指数退避持续 fail-open | 把新查询契约直接当成已安装宿主能力，缺少运行时 capability negotiation；L2 resource adapter | qa.42 真实失败；qa.43/API120 | P0；不得把无关 item 当请求结果、不得按名称匹配、不得扫描 `.library`、不得为每个 item 重复探测不支持接口 | RESOURCE/HOST/SRC/DOC；resolver 首次精确 query 若返回非数组或遗漏请求 ID，只允许一次切换到公开 `eagle.item.getById(id)` 单项契约并记忆该能力；后续保持单项串行、ID 必须精确相等、仍无路径则沿用 R60 熔断；真实 538 必须完整资源解析并进入 metadata proof |
| R64 | qa.43/API120 已成功 fallback 到精确 `getById`，但仍把每个 item 判为 0 路径并触发 `ITEM_RESOURCE_CONTRACT_UNAVAILABLE` | Eagle Item 是宿主对象，`filePath/size/modifiedAt` 可由只读原型 getter 暴露；adapter 用对象展开复制响应，只复制可枚举自有属性，主动丢失 getter 字段；L2 resource normalization | qa.43 真实失败；qa.44/API121 | P0；不得 `JSON.stringify`/spread 后再判断宿主资源，不得复制未知业务字段或修改原宿主对象 | RESOURCE/HOST/CACHE/SRC/DOC；唯一 normalizer 逐个显式读取 `RESOURCE_FIELDS`，捕获 getter 异常并写入新的 plain adapter item；路径、size、modifiedAt 都必须保留；原型 getter 红灯回归永久保留；真实 538 必须出现 resolvedPathCount>0 |
| R65 | qa.44/API121 已完成 538 路径与 metadata，但最终 `PRESENT-START` 后 fail-open | 自动 smart 恢复复用了手动拖拽的逐张 DOM move；虚拟化网格只渲染约 120 项，最终可见前缀可能包含原先未渲染成员，DOM 搬运无法代表 538 项权威顺序；L5 presentation | qa.44 真实失败；qa.45/API122 | P0；不得用循环拖拽模拟自动呈现、不得把旧可见集合当最终前缀、不得提交完整 538 到分页 `filtereds` | PRESENT/SMART/HOST/SRC/DOC；loading 期间先原子提交完整 `allData` 与保长分页投影，触发 Eagle 原生 rerender，再有界验证最终可见前缀；失败同时回滚 data 与 visible；手动拖拽仍走原事务；失败诊断必须携带 reason/proof |
| R66 | qa.45/API122 已改为 data-first，但 PRESENT 在约 0.16 秒内仍被折叠成无细节 `presenter-failed`；滚动/分页虚拟窗口仍被固定当作 offset=0 | lifecycle 吞掉 present 异常；adapter 用 `nextItems.slice(0, visibleCount)` 猜 DOM 可见窗口；`$evalAsync()` 未形成可等待提交边界；L2/L5 | qa.45 真实失败；qa.46/API123 | P0；不得再吞异常、不得用固定首屏前缀证明任意滚动窗口、不得把分页前缀与滚动窗口混为一谈、不得在 Angular rerender 前读取旧 DOM | PRESENT/LIFECYCLE/HOST/SRC/DOC；present 异常保留有界 name/message；提交前从原 host data 证明当前 DOM 连续窗口 offset/count，无法证明则零写入 fail-open；`filtereds` 保持零起点分页前缀；await `$evalAsync` 后有界验证，失败双向回滚 |
| R67 | schema v3 当前 Library 已有 530 条记录，重启却只命中 12 条并把 526 项列为“需要读取原文件” | smart snapshot 初始对象缺 `size/modifiedAt`，第一次 cache-first 合理 miss；资源 resolver 补齐身份后扫描未二次查询 cache，旧 miss 集合直接进入原图读取；L2/L3 cache pipeline | qa.45 真实证据；qa.46/API123 | P0；轻量身份 hydrate 不得等价于原图 metadata read，已有有效 cache 不得被重复读取 | CACHE/RESOURCE/META/SRC/DOC；补齐 filePath/size/modifiedAt 后必须二次 classify，只把仍 miss 项送入 `getTakenAt`；真实同库重启应为 530 左右 cache hit、零或仅真实变更项原图读取 |
| R68 | qa.46 在 `PRESENT` 立刻 `Maximum call stack size exceeded`，没有可定位阶段 | 注入载荷的纯排序 `applyManualOverlay` 与宿主包装函数同名；共享注入作用域使核心调用被宿主包装劫持并递归回 `resolveHostOrder` | qa.46 真实堆栈；qa.48/API125 | P0；注入的纯函数不得被宿主包装同名遮蔽；异常必须保留阶段与有界 stack | PRESENT/LIFECYCLE/SRC/DOC；宿主包装固定命名为 `applyHostManualOverlay`；完整注入载荷只允许一个纯 `applyManualOverlay` 声明；present error 输出 `presentationStage/errorStack`，同步重入明确 fail-open |
| R69 | qa.48 排序提交后，同一批 538 项仅顺序变化却被当成新 snapshot，触发并发第二次 PRESENT | 生命周期/host snapshot 将成员顺序混入查询成员身份；排序提交又改变该顺序 | qa.48 真实红灯；qa.50/API127 | P0；查询成员身份只表达集合，不表达排列；相同成员重排不得启动第二个 PRESENT 或取消第一个 | SNAPSHOT/LIFECYCLE/PRESENTER/DOC；member fingerprint 对 ID 去重排序后计算；生命周期 signature 也使用无序成员身份；成员替换仍必须换 generation |
| R70 | qa.50 中 Eagle rerender 更换 `allData/filtereds` 数组对象但成员不变，插件把引用变化当成新查询，造成第二轮 PRESENT | query epoch 直接依赖宿主数组引用；渲染实现细节被误作业务身份 | qa.50 真实红灯；qa.51/API128 | P0；宿主数组 reference churn 不是查询变化；只在来源类型或成员集合变化时进入新 epoch | SNAPSHOT/HOST/LIFECYCLE/SRC/DOC；epoch key=`sourceIdentity+unorderedMembershipFingerprint`，source reference 仅作读取入口；真实 538 首次启动只能一次 PRESENT，25 秒无迟到第二轮 |
| R71 | 普通文件夹界面显示“多级排序”，但 Eagle 排序回调仍携带旧原生键，网格按原生顺序显示，规则编辑区同时被隐藏 | 将宿主瞬态回调参数和已保存 collection 排序键并列为真源；L2 host sort intent / L7 UI projection | qa.52/API129 | P0；持久化插件排序键是该 collection 的唯一插件排序意图；原生 select 只能作为非插件排列的后备，不能降级已保存的多级/拍摄时间排序 | SRC/DOC；`sortData` 与 `sortRawData` 都先解析有效键；已保存 `PHOTO_TAKEN` 必须强制走唯一 coordinator，规则区必须展开；原生键延迟一帧不得影响网格结果 |
| R72 | 侧栏红点显示已锁定，而当前文件夹面板未勾选锁定，用户无法知道实际保护状态 | 团队状态导入/布局重渲染替换当前 Library lock store 后，侧栏标记没有与面板同批重算；L4 persisted state / L7 UI projection | qa.52/API129 | 高；侧栏锁标记与当前面板必须来自同一 Library+collection lock store；任何时刻冲突都不得保留旧红点 | SRC/DOC；每次 protection render 先重算侧栏 marker；切库、导入团队状态、重进文件夹后红点、checkbox、实际 guard 三者一致 |
| R73 | 已选择并显示多级排序，普通文件夹仍按 Eagle 历史手动位置分段，`1-`/`2-` 前缀无法按规则归组 | 排序核心把 Eagle `item.pinned[collectionId]`（原生视图状态）置于插件规则之前，反向越过用户定义的 L0 原生基座 < L3 插件自动排序 < L4 插件手动关系层级 | qa.52 真实 `1-网球` 红灯；qa.53/API130 | P0；原生 pinned 位置只能留在 Eagle 原生视图，绝不能参与插件自动比较器；唯一可覆盖插件自动结果的是插件明确持久化的手动相对关系 | SORT/COORD/DOC；带相反 native pinned 的 `1-`/`2-` 素材仍必须按多级规则得出 `1-` 在前；用户手动拖动仍仅通过 L4 relative overlay 覆盖 |
| R74 | 已保存多级排序的普通文件夹在插件启动前已由 Eagle 原生排完，随后打开仍停留在旧顺序 | `sortData`/`sortRawData` 只处理未来宿主回调；首次稳定正常文件夹没有回调时，插件从未把唯一 L3 结果提交到可见网格和宿主数组 | qa.53 真实 `1-网球` 红灯；qa.54/API131 | P0；正常文件夹首次稳定帧必须由唯一 L3 transaction 主动呈现，原生旧顺序不得无限保留；只在同一当前 collection、完整成员和可验证可见窗口时写入，否则 fail-open | SRC/HOST/DOC；预置乱序 normal collection 启动后无需点击排序，数组与可见卡片必须原子成为当前规则结果；缺完整成员、缺网格或校验失败时零写入 |
| R75 | 布局面板已显示“多级排序”，但 legacy folder object 仍回报原生键，R74 transaction 因此误判插件未启用 | Eagle 恢复旧 collection 与布局 select 的时序不一致；只读 folder object 不是充分的用户意图真源 | qa.55 真实 `1-网球` 红灯；qa.56/API133 | P0；持久化插件键优先，其次是已显示的插件 select；只有两者都非插件键才采用 native。网格、规则区、metadata 和首帧 transaction 必须共用该有效键 | SRC/DOC；folder object=BTIME、select=PHOTO_TAKEN 时，规则区可见且自动链仍按多级规则提交 |

### R53 Phase 3（2026-08-08）

qa.31 真实失败已转为永久回归：Eagle UI 显示 571 项而 adapter 为 0。qa.32/API109 以
`filtereds` 优先、current-view 联合来源证据、generation/source-reference/member-fingerprint
推导 epoch 修复接线；仅 allData/raw 临时库仍拒绝。LOADING 零 metadata 门禁、R52 global
fail-open、普通/qa.26 冻结保持。qa.31 失败证据：
`qa-evidence/QA-R53-QA31-T3-INSTALL-ROLLBACK-2026-08-07.md`。

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
  `/Users/max/Desktop/录屏2026-07-29 19.16.09.mov` 证明 qa.23 HOST FAIL：所有
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
- qa.34/API111 在真实 loaded/可操作 Library 上仍因 readiness evidence false-negative 被拒绝并回滚；
  qa.35/API112 仅完成 R54.2 多正向证据源码候选，未安装，版本语义永久保留。
- `2.5.22-qa.36 / API113` 已进入真实 T3：首个可见 loading 成功阻止错误 native 顺序，但真实
  `MAX照片集(MJCRT7F81VVTJ, 538)` 因 R56 source ownership 接线错误永远不 READY。候选已正常回滚，
  当前唯一真实安装恢复 qa.29/API106；不得报告 R53/R55 已修复。
- 下一次功能修改必须先在本台账标出影响 ID 和冲突 ID，再写失败测试。

### R54：Eagle Library 启动隔离与“即将完成”卡住（2026-08-08）

- 现场：qa.32/API109 在 NAS Library 启动时停留“即将完成 …”超过五分钟；诊断只见排序服务启动，
  没有 injection/smart/PRESENT/metadata/EXIF，因此 P0 的归因是 B/C，不能倒推为 R53 业务逻辑已证实阻断。
- 根因边界：旧启动链在确认当前 Library 可操作前已经启动 1 秒 `monitor` 轮询并读取 cache；`onLibraryChanged`
  还会立即切换 GPS library。它们与 main renderer readiness、team sidecar 和注入生命周期没有唯一所有权。
- 唯一正确行为：R54 gate 以 library identity/generation 所有权隔离 bootstrap；未收到 library-change identity 或
  `mainLibraryReadiness` 未确认时完全 fail-open，业务服务静默。READY 后同 generation 仅一次 inject/activate；失败
  不重试风暴，切库/STOPPED 自动作废旧异步结果。
- 关联：R13、R17、R22、R36、R48、R52、R53。R53 smart readiness 和 LOADING 零 metadata 不得因 R54 放宽。
- 自动证据：`startup-readiness-gate-core.test.js`、`plugin-source.test.js`、`monitor-core.test.js`、
  `injection-source-compilation.test.js`、永久合同；真实启动仍是后续 T3 门禁。
- R54.1（qa.33 真实失败）：Library identity 已到达而主窗口 scope/hash 瞬时未 ready 时，qa.33 把
  `main-library-readiness-not-confirmed` 当成终态 `INJECT_FAIL`，即使 Eagle 随后已可操作也不再注入。
  qa.34 必须将此状态限定为同 generation、可取消、纯 host-readiness 的有界 re-observation；只能在
  verified main identity/ready 后一次注入，超时记录 `BOOTSTRAP_TIMEOUT` 并 fail-open，不能以固定 sleep
  证明 ready、不能形成业务轮询/缓存/metadata/DOM I/O 或重试风暴。

| R80 | 在普通文件夹的多级规则编辑器把“文件名”由升序切到降序后，设置已保存、下拉框也显示新方向，但网格仍沿用旧顺序 | normal collection 的 `rebindRefresh` 可以只更新宿主视图数据而不重新触发 `sortData`；规则变更没有一个绑定到刷新完成后的 L3 可验证呈现请求 | 用户真实截图；qa.62/API139 | P0；“配置已变”不是排序成功。普通文件夹规则变更后必须在同一 collection、同一规则版本下执行唯一 L3 transaction；collection/规则在中途切换则零写入、丢弃旧请求 | NORMAL/PRESENT/SRC/TEST/DOC；在 `api.refresh` 捕获 collection+规则身份，`rebindRefresh` 后的 Angular turn 才调用 `scheduleNormalOrderPresentation`；R80 自动源码门禁永久保留，真实 Eagle 必须证明升降序画面实际互换 |
| R87 | 智能网格的虚拟卡片按几何位置读成“窗口不连续”，已写入的自动排序被误判后回退 | 自适应/虚拟网格会复用屏幕外卡片；DOM 坐标不拥有排序语义 | qa.70/API147 真实红灯 | P0；不得放宽跨集合/重复成员校验 | PRESENTER/PROOF；保留无名称/路径/ID 的结构化诊断，几何只作布局诊断 |
| R88 | 智能自动排序须验证宿主投影而非虚拟卡几何顺序 | `allData` 是完整权威结果，`filtereds` 是当前投影；渲染卡只证明成员归属 | qa.71/API148 真实通过：571 项、投影 100、卡片 180、`PRESENT-READY`、20 秒稳定 | P0；投影跳序、重复卡或跨集合卡仍 fail-open | PRESENTER/PROOF；R88 永久回归覆盖虚拟环绕、投影跳序、跨集合和重复卡 |
