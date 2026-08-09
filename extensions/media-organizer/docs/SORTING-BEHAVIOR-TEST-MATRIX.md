# 排序与重命名行为及测试矩阵

状态：强制门禁。自动测试只决定候选是否可进入真实 Eagle 验收；真实界面是最终结果
真源。历史故障 ID 见 `SORTING-BUG-LEDGER.md`，任何一项失败都不得发布。

## 用户可见行为合同

| 场景 | 唯一正确结果 | 永久禁止 | 关联故障 |
| --- | --- | --- | --- |
| 普通叶子文件夹 | 只排序直属素材 | 读取父层、兄弟层或整库 | R11-R13 |
| 普通父文件夹 | 只排序直属子文件夹 | 把后代素材混入当前层 | R10-R11 |
| 智能集合 | 只处理 adapter 明确返回的当前结果；允许当前智能结果网格内手动拖动并按智能 collection ID 持久化；只提供排序和手动视图 | 空结果回退 `raw` 整库；读取残留普通文件夹树；显示或执行自动编号/改名；写入来源普通文件夹 | R12-R13、R15、R38、R42 |
| 全部/未知上下文 | 受控不可操作，Eagle 原生继续；明确 `view=all/global` 或未知路由高于残留 `currentFolder`，原样保留 Eagle 输入 ID 顺序 | 扫描约 2.4 万项、读取旧 overlay/锁/文件夹规则、扫描 EXIF、N+1 访问、主动刷新或生成改名/编号计划 | R13、R52 |
| 智能集合加载中 | 仅接受本轮显式 `filtereds` 宿主槽位的 `eagle-smart-query` sourceIdentity/queryEpoch；引用可与 `allData` 别名，epoch 由 collection generation、source reference 与成员指纹推导；连续稳定观察后才以同一成员快照进入 READY，临时全库、临时空和旧 generation 都保持 Eagle 原生画面 | `allData/raw` 回退、固定延迟、按成员数猜测、任何 automatic/manual overlay、锁/规则读取、成员/路径导出、缓存注入、refresh、EXIF、改名或 DOM 重排 | R38-R48、R52、R53 |
| 自动排序 | L3 对当前 snapshot 生成稳定 base order | DOM/UI 自己重排 | R19-R20 |
| 手动拖动 | 有效网格内 drop 写入当前 collection 的稀疏相对关系；宿主漏发 drop 时，仅允许同网格 `dragend` 补交一次 | 把完整旧数组当自动排序覆盖、污染其它集合、恢复第二套鼠标状态机 | R01-R04、R15、R39-R40 |
| 自动规则升降序 | 先按当前规则重算 base order，再应用同一手动相对关系；拍摄时间方向进入 `TAKEN_AT` 规则 | 升降序都返回同一画面、旧完整手动数组压过规则 | R40-R41 |
| 关闭手动输入 | 只拒绝后续网格内 MoveCommand，已有顺序不变 | 清空、停用或重捕获 manual view | R33 |
| 排序保护开/关 | 只改变 guard 状态，画面、文件名、手动指纹完全不变 | 排序、刷新、改名、恢复旧快照 | R08-R09 |
| 配置应用到全部 | 配置传播到当前层及所有后代，包括空层和保护层 | 把保护层整个跳过 | R09-R10 |
| 拖动后自动编号 | 只用这次 FinalVisibleOrder 生成同组序号变化的最小连续区间 | 等待拍摄时间、重读 raw/DOM 或整文件夹改名 | R04-R06、R19、R37 |
| 预览确认编号 | 预览逐项显示旧名和新名，确认后由唯一事务执行 | UI 或渲染进程直接改名 | R07、R24 |
| 快速连续拖动 | 只保留最新顺序，collection 队列不重叠 | 旧计划追赶、跨集合串台 | R21、R26 |
| 启动/刷新/切换/分页 | 零改名、零隐式重排 | 用成员变化触发编号 | R22、R31 |
| 网格外拖放 | 完全由 Eagle 原生处理，可拖到 Finder/聊天/上传框 | 扩展取消 `dragstart` 或未知落点 | R34 |
| 改名失败/NAS 不可用 | 显示失败原因并进入可恢复状态 | 静默成功或继续下一批覆盖现场 | R07、R18、R32 |
| NAS 文件夹预览 | Eagle 原生缩略图先显示，缓存时间戳先注入，未缓存 EXIF 延后且可取消 | 打开即并发扫描全部原图或因视图键高频写 sidecar | R13、R22、R27、R31、R36 |

## 对象与范围矩阵

| collection kind | 当前处理对象 | current | current + descendants |
| --- | --- | --- | --- |
| 普通叶子 | 直属素材 | 排序/手动/预览当前直属素材 | 配置传播；每个后代按自己的层级独立执行 |
| 普通父层 | 直属子文件夹 | 排序/手动/预览直属子文件夹 | 配置传播到完整树；不得把后代摊平 |
| 智能集合 | adapter 当前结果 | 统一 L3 规则；手动顺序按智能 collection ID 隔离；不显示、不生成、不执行自动编号或改名 | 无后代语义，始终受控拒绝 |
| 全部/未知 | 无扩展处理对象 | 受控拒绝 | 受控拒绝 |

## 自动测试层级

### 单元测试

- L3：文件名、拍摄时间、多级组合、稳定后备、正反向、重名、空时间、中文、数字、
  NFKC 和全半角前缀。
- L4：连续 20 次移动、相对关系合并、成员增删/锚点缺失、刷新/模拟重启、
  Library + collection 隔离、旧完整数组迁移保留
  隔离、关闭输入后顺序不变。
- L5：保护开关前后三类指纹完全相同；所有破坏性 command 拒绝，配置 command 允许。
- L6：最终可见顺序到编号计划、最小差异、循环换名、重复执行、两阶段验证、失败回滚。

### 契约测试

- L1：A 独立 `start/stop/status`，重复启动幂等，停止后 listener/timer/observer/queue 为 0。
- L2：普通、智能、父、叶和受控不可操作上下文使用统一 snapshot 契约；智能身份覆盖
  Eagle 暂时残留的旧普通文件夹对象。
- L6/L8：任务键至少包含 Library ID、collection ID、command ID 和成员/顺序指纹。
- L7：未知落点不调用 `preventDefault`、`stopPropagation` 或
  `stopImmediatePropagation`；`dragstart` 归 Eagle。同网格 `dragend` 补交只复用既有
  `dragState` 和放置函数，collection 改变、网格外或正常 drop 已完成时不得写顺序。
- L7 视觉反馈：普通与智能入口共用唯一 feedback controller，但使用明确分离的投影策略。
  normal 保持宿主 helper；smart 禁止遍历、显示全部 helper 或改写任何非当前 helper，
  只允许复用 resolver 返回的当前 left/right helper，并将它绝对定位为贯穿目标卡高度的
  原生蓝色落点。切换或清理时必须精确恢复该 helper 原有 inline style 和优先级；仅在
  当前 helper 缺失且宿主目标卡已经是非 static 定位时，才允许投影不参与布局的完整
  纵向伪元素，static 时 fail-open；任何路径都不得改写目标卡的 position/overflow。
  有效目标后的未知 native surface 保留最后蓝线；左右切换、换卡、选中项、网格外、
  drop、dragend、pointercancel、Esc、预览、集合切换和失焦都必须清理。
- 迁移：旧键只读，目标键分库；失败不删除旧键且可回滚。

### 关键组合测试

| 维度 | 取值 |
| --- | --- |
| collection | 普通叶子、普通父层、智能、全部/未知 |
| 输入模式 | 自动、手动已开、手动已关但已有 manual view |
| protection | 开、关 |
| auto-number | 开、关 |
| metadata | 全有时间、部分缺失、全部缺失 |
| lifecycle | 初次加载、刷新、切换、模拟重启 |

至少覆盖成对组合，并固定以下序列：连续拖动 20 次；锁开关各 10 次；A/B 集合往返；
四层以上树含空层和保护层；快速 20 次拖动后只执行最新编号计划。

## 性能门禁

- 核心处理量只能等于 adapter 明确提供的当前集合成员数；测试用哨兵证明不会访问
  未提供的第 N+1 项。
- 全部视图、未知上下文和空智能集合不扫描整库，也不以整库作为任何 fallback。
- 排序保持 `O(n log n)` 量级，manual overlay 和计划生成保持 `O(n)` 量级。
- 禁止高频整库轮询；空智能集合、全部视图和未知上下文不得调用整库读取 API。
- 未缓存 EXIF 必须等待原生预览，以并发 2 执行；切换 collection 后旧扫描不得继续排队。
- 团队状态指纹忽略旧当前视图显示键，现代每文件夹规则、手动顺序和排序锁仍必须同步。
- 性能测试记录集合规模、比较次数、adapter 调用次数和任务数，不以单一耗时掩盖扫描范围。

## 真实 Eagle 最终验收

真实验收必须经用户再次批准，先备份已安装目录并记录指纹，只在用户指定的低风险
测试文件夹进行。每个动作必须直接观察照片网格、名称和右侧预览，日志或成功提示不
能代替界面结果。

1. 扩展关闭：选择、右键、预览、快捷键、拖到 Finder/聊天框/上传框全部正常。
2. 扩展开启：手动开/关/保护三态均可原生拖出，且拖出不改变网格顺序。
3. 同一文件夹连续网格内拖动 20 次，每次画面立即正确；有/无拍摄时间素材一致。
4. 拖动后编号预览与从左到右、从上到下的真实画面逐项一致；确认后只改最小差异项。
5. 编号期间不得出现临时名、空白缩略图、右侧预览消失或 Eagle 大进度遮罩。
6. 锁开关各 10 次，顺序、文件名、manual view 指纹保持不变。
7. 刷新、切换集合和完整重启后顺序保持；其它 collection 不受污染。
8. 普通/智能/父/叶和“应用到全部”逐层验收；智能集合拖动后切换返回仍恢复，来源
   普通文件夹顺序和自动编号状态不变；全部/未知视图保持流畅且不可操作。
9. 注入可控失败验证明确错误和回滚；不得在真实 NAS 上制造故障。

R34 的 2026-07-24 无插件 A 基线和单一候选 B 物理鼠标拖出及 SHA-256 对照已经通过。
2026-07-25 用户取消手动开/关/排序锁定三态的重复物理测试，并明确以 A/B 实证与三态
源码/自动回归接受残余风险；R34 在本次发布口径下关闭。Computer Use 仍不得冒充跨应用
物理拖动，后续如开专项可补三态实证，但不再阻断本次发布。

## R54：启动隔离（开发预检；真实 Eagle 启动另行验收）

| 场景 | 期望 | 自动证据 | 真实 T3 观察 |
| --- | --- | --- | --- |
| Library 未 ready 或尚未收到 identity | 仅 `BOOTSTRAP_WAIT`；零 bridge/inject/cache/team/metadata/EXIF/observer/refresh/sort/rename | startup gate waiting spy、plugin-source public probe contract | Eagle 仍由原生加载，插件不写业务状态 |
| 当前 identity + main readiness | 同 generation `INJECT_START → INJECT_OK` 恰好一次，之后才 ACTIVE/monitor | startup gate concurrent-ready test | 启动日志按阶段一次出现，Library 正常进入树和网格 |
| identity 已到达、main scope/hash 短暂未 ready | `BOOTSTRAP_MAIN_WAIT` 期间零 inject/cache/team/metadata/EXIF/observer/业务 monitor；后续本轮 verified ready 后一次 `BOOTSTRAP_READY → INJECT_START → INJECT_OK` | deferred readiness 红/绿回归、bounded waiter 三次 observation | 不得因一次瞬态 false 留在 `INJECT_FAIL`；最终需 Eagle T3 观察 |
| main readiness 持续未确认、切库或退出 | 有界观察后一次 `BOOTSTRAP_TIMEOUT` fail-open、零 inject；generation 改变/STOPPED 取消迟到结果 | waiter timeout/cancel + gate no-retry/cancel tests | 原生 Eagle 继续可用；不出现业务 poll 或高频日志 |
| 切库/退出/注入失败 | 旧 generation 不 activate；失败 `INJECT_FAIL` fail-open，无 sleep 或 retry storm | reset/stop/failure tests | 不阻塞宿主；失败候选按安装门禁回滚 |
| R53 smart LOADING | 启动门禁不能绕过 smart READY；零 timestamp/path/EXIF/cache | monitor-core LOADING trap | smart query 到 READY 前原生顺序不跳变 |

## R55：SMART FIRST VISIBLE FRAME 与全链事务

| 场景 | 唯一正确结果 | 自动故障注入 | 下一 T3 真实观察 |
| --- | --- | --- | --- |
| smart 首个可见帧 | `VERIFIED_COMPLETE + metadata proof + final data/visible order` 前显示明确 loading 或兼容稳定投影；不得显示已知错误 native 顺序 | first-frame 四证明缺一拒绝、稳定 empty commit、onReady false/throw 不留伪 READY | 从普通/global 进入真实 smart，逐帧不得出现 native→plugin 跳变 |
| 100→300→571、旧571→新538、分页/滚动 | partial、旧 collection、旧 fingerprint 和可见子集均不得冒充完整成员；完整成员只 present 一次 | advertised-count mismatch 永远 loading；count 精确匹配+query/pagination complete 无 fabricated revision 可 READY；未知 count 需 terminal/verified evidence | 记录 member count/source/reason；滚动与分页重建不重复 present |
| A→B→A、切 Library、退出/重启 | request 固化 library/collection/frame generation/snapshot fingerprint；所有迟到异步结果丢弃 | lifecycle stale token/query epoch、first-frame A→B→A、stop 资源归零 | 快速切换和重启无旧顺序闪回、无隐藏网格遗留 |
| metadata 缺失/失败/超时 | 缺失写稳定哨兵；proof 必须绑定同一 identity/generation/fingerprint；不无限重扫 | stale proof 拒绝、resolved+missing=total、同 fingerprint 不重复 scan/present | 缓存缺失时 loading 清晰，完成后一次原子 present，无一分钟后二次跳变 |
| automatic + manual + lock | 唯一 OrderCoordinator 先算新自动基础，再应用 relative constraints；lock 最高；smart 永不自动改名 | 升降序重算 overlay、lock guard、smart rename=0、重复实现计数=1 | 改规则后关系保持，锁定不改变画面/文件名 |
| R71 宿主回调键滞后 | collection 已保存 `PHOTO_TAKEN` 时，Eagle 可暂时回调 `BTIME` | 网格仍按已保存多级规则经唯一 coordinator 排序，规则区保持展开；不得把 `BTIME` 当作新的用户选择 | 普通文件夹重进、刷新和宿主 select 异步重绘后，图片顺序与多级规则一致 |
| R72 锁状态投影 | 团队状态导入、切库或布局重绘后读取当前 Library lock store | 侧栏红点、锁定 checkbox 和实际 mutation guard 同步；若未锁则三者都不显示锁定 | 重进已锁/未锁普通文件夹，三处状态一致且没有排序、刷新或改名副作用 |
| R73 原生 pinned 越权 | Eagle 原生对象带相反的 `pinned[collectionId]`，当前排列方式为多级排序 | pinned 不进入插件自动比较器；自动顺序严格按文件名前缀、拍摄时间等当前规则；只有插件 L4 手动关系可覆盖 | `1-网球`/`2-网球` 在有旧 Eagle 手动位置时仍完整归组；无手动关系时“恢复自动排序”无需做任何重置 |
| R74 正常文件夹首帧遗漏 | normal collection 在插件启动前已完成 Eagle 原生排序，之后无新的 host sort callback | 唯一 L3 presentation transaction 在完整成员、同 collection 和可验证可见窗口同时成立时主动呈现当前规则；失败或证据不足零写入 | 重启并直接打开 `1-网球`，不点击排序、不拖动，`1-` 组完整在 `2-` 组前；20 秒无二次跳变 |
| smart 呈现故障 | presenter 只发 apply/verify；adapter/HostOrderPresentationPort 持有 arrays snapshot；任一步失败 DOM 与 arrays 双向回滚并显式 FAILED | DOM move throw、array commit fail、verify mismatch、visible/data rollback fail | 失败不留半提交，不以 refresh 掩盖 |
| normal 拖动持久化故障 | DOM、`allData/filtereds`、manualStore/localStorage 三者同时旧或同时新 | write-then-fail 后 presentation rollback handle + state/storage snapshot 恢复 | qa.26 普通拖动行为不变，失败不跳位、不延迟刷新修正 |
| 安装升级 durable state | cache/diagnostic/rename recovery/`team-state-backups` 位于 PluginData；迁移一次、并发幂等、不覆盖，发行包零运行态 | 旧 cache 命中、team backup 目录迁移/不覆盖、临时清理、builder/installer 污染合同 | 安装后无需全量重扫；回滚可识别。`geo-tag-state.json` 仍按 C 模块债务单独处理 |
| 24k/observer/refresh 性能 | provisional 24k 零 present/metadata；overlay 稀疏堆有操作数上限；插件自有 mutation 不反触发 | 24,319 comparisons 门禁、observer 自有 mutation 过滤、同 fingerprint 去重 | 无 >10 秒后台无响应，无重复 refresh/observer 风暴 |

## R56：真实 filtereds/allData 分离 ownership

| 场景 | 期望 | 自动证据 | 真实 T3 观察 |
| --- | --- | --- | --- |
| `filtereds` 独立对象，100 项，visible=0 | 可识别为 filtered candidate，但 advertised 538 不匹配，保持 loading | R56 pipeline 第一阶段 | sourceIdentity 可诊断，零 READY/PRESENT/metadata |
| `filtereds` 100，visible=120 | visible 不属于 partial filtered；不得降级 current-view/allData | `untrusted` + current-view fallback blocked | loading 保持，绝不吃 24k allData |
| `filtereds` 300，visible=120 | filtered ownership 成立但 count 不完整 | advertised mismatch | 零 READY |
| `filtereds` 538，visible=120 | queryFinished + paginationComplete + advertisedCount=538，连续两次后 READY | adapter loading→ready，members=538 | `MAX照片集(MJCRT7F81VVTJ)` 一次 READY/present |
| `filtereds===allData` alias | filtered 优先，仍兼容高颜值等 alias 场景 | alias regression | 不因 R56 修复重新 HOST-PENDING |
| 插件真实接线 | 同时传 `filteredReference: filtereds`、`currentViewReference: allData`，禁止旧 `sourceReference` | plugin integration contract | 日志 sourceIdentity 与真实来源一致 |

## R57：启动路由已就绪但 currentSmartFolder 尚未 hydration

| 场景 | 期望 | 自动证据 | 真实 T3 观察 |
| --- | --- | --- | --- |
| URL 已是 `view=smartfolder&smartfolder=MJCRT7F81VVTJ`，`currentSmartFolder` 为空 | collection route ID 继续拥有当前 smart identity，不降级 global/normal | plugin integration route fallback | 首帧只显示 loading，不显示 native 错序 |
| `smartFolderMappings[MJCRT7F81VVTJ].imageCount=538` | 只使用同 ID Eagle 宿主记录作为独立 advertised count | source contract | 538 完整成员连续观察后 READY |
| 映射缺失或 ID 不一致 | 继续 loading/fail-open，不使用名称、DOM 文案或 `allData.length` 自证 | negative contract | 不 PRESENT、不读 EXIF、不改名 |

## R58：Eagle allData 完整结果与 filtereds 分页投影

| 场景 | 期望 | 自动证据 | 真实 T3 观察 |
| --- | --- | --- | --- |
| allData=538、filtereds=100、visible=120、imageCount=538 | 选择 `eagle-smart-query:current-view`，filtereds 不阻断 | R58 host-truth fixture | 首帧 loading 后一次 READY/PRESENT |
| allData/raw=24,319、filtereds=100、imageCount=538 | untrusted，保持 loading/fail-open | provisional mismatch fixture | 零 metadata/present/refresh |
| allData/raw=538、filtereds=100、imageCount=538 | raw alias 本身不拒绝；强独立证据允许 current-view | raw-alias fixture | 分页/滚动不改变成员真源 |

## R59：READY 成员到 metadata proof 的唯一身份与终态

| 场景 | 期望 | 自动证据 | 真实 T3 观察 |
| --- | --- | --- | --- |
| route smart ID 已就绪、`currentSmartFolder` 仍为空、snapshot=538 READY | metadata context 直接继承 `collection.id`，538 IDs 全部进入公开 `getByIds` 路径补全 | plugin source/integration contract | 不再出现“538 个媒体、0 个路径、0/0 后永久等待” |
| `getByIds` 全部返回路径 | 合并完整 item，缓存命中或读取 metadata；proof 的 resolved+missing=538 | hydration pure test + metadata proof | metadata READY 后只 PRESENT 一次 |
| 成功响应但个别 ID 缺失/仍无路径，或 smart 含非媒体 | 只在本次注入会话写 missing sentinel，不写磁盘假缓存；proof 可终止 | partial/pathless/non-media fixture | 缺失项排在规则定义的稳定位置，界面不永久 loading |
| `getByIds` 抛错或超时 | 不写 missing sentinel、不伪造 COMPLETE；清除 scan claim，5 秒退避后重试 | plugin source retry contract | NAS/宿主短暂异常恢复后可继续，不形成 1 秒风暴 |
| 同 smart ID 产生新 snapshot generation，旧扫描仍在运行 | 新 scan identity 不复用旧 promise；旧 generation 结果丢弃 | monitor key/generation contract | 快切或刷新后不借用旧 metadata，不二次跳变 |

## R60：成员身份与文件资源契约分离

| 场景 | 期望 | 自动证据 | 真实 T3 观察 |
| --- | --- | --- | --- |
| 538 个 smart 成员对象只有 ID/ext、没有 `filePath` | 只通过唯一 `ItemResourceResolver` 调用 `eagle.item.get({ids, fields})` 明确请求路径 | resolver fields/source contract | 538 项进入真实资源解析，不再显示“已补全 0” |
| 输入含重复 ID、部分项目已有路径 | 精确去重；已有路径不重复查；历史 qa.41 的 200 项/并发 3 属失败策略，当前从单 ID probe 开始并保持串行背压 | duplicate/bounded fixture | 不扫描整库，不抢占原生缩略图/预览 |
| 宿主响应漏 ID、非数组或整批媒体 0 路径 | 判定资源契约不可用并 retryable fail-open；不写 null sentinel、不完成 metadata proof | invalid/incomplete/zero-path fixtures | 保留 loading/原生放行并有界重试，绝不呈现错误最终顺序 |
| 部分项目有路径、个别合法项目仍无路径 | 已证明资源契约后才允许个别会话 sentinel；不写磁盘假缓存 | partial fixture | metadata proof 有明确终态且缺失项顺序稳定 |
| A→B→A 或同 ID 新 generation | 旧批次停止排新请求，迟到结果全部丢弃 | cancellation fixture | 快切后不借用上一集合路径、不二次跳变 |

## R61：宿主资源查询背压与可生效超时

| 场景 | 期望 | 自动证据 | 真实 T3 观察 |
| --- | --- | --- | --- |
| 538 项缺路径 | 第一个请求必须是单 ID capability probe，之后仍为 batch=1/concurrency=1，批间 yield | resolver exact call sequence | 日志持续前进，Eagle 网格/预览不被长任务独占 |
| 宿主调用同步阻塞或超时返回 | timeout 在调用前建立，并在调用返回后复核 elapsed；进入 retryable fail-open | plugin timeout thunk/source contract | loading 有明确失败/重试节奏，不永久静默 |
| diagnose 或 yield 自身抛错 | 资源解析继续完成，不能因可观测性或调度辅助失效而失败 | diagnostic-independent fixture | 排序仍可 READY；诊断故障单独记录 |
| 连续暂态失败 | 5→10→20→40→60 秒指数退避并封顶 | monitor retry fixture | 不形成 1 秒/5 秒固定风暴，不持续抢 NAS |

## R62：跨 Library cache 隔离与 cache-first

| 场景 | 期望 | 自动证据 | 真实 T3 观察 |
| --- | --- | --- | --- |
| v2 cache 指向 Library A，当前启动 Library B | 迁移 A 分区但 active 重新指向 B；两者均保留 | metadata cache migration fixture | 不把 A 的时间或 missing 状态用于 B |
| active B 时 A 的旧扫描迟到 | 只写 A 显式分区，B 零污染 | late-photo partition fixture | 快切/切库后不二次跳变 |
| item 的 `size/modifiedAt` 未变 | 先命中 cache，完全跳过路径查询和原图读取 | cache-first source contract | 同库重开不再查询 538 路径/读取 538 NAS 原图 |
| `modifiedAt` 变化 | 旧记录失效，仅该 item 重新解析 | signature fixture | 新上传/修改项目更新，未变项目保持秒开 |
| A→B→A 完整重启 | schema v3 持久化两个分区，切换不清空 | serialize multi-library fixture | 两个 Library 都保留独立缓存与最终顺序 |

## R63：Eagle 4.0 宿主资源能力协商

| 场景 | 期望 | 自动证据 | 真实 T3 观察 |
| --- | --- | --- | --- |
| `item.get({ids,fields})` 返回数组但遗漏请求 ID | 判定宿主忽略新查询条件；不接受无关 item，只探测一次 | unsupported-query fixture | 仅一条 mode fallback 诊断 |
| `item.getById(id)` 返回精确 item + filePath | 切换为 singular 模式，当前及后续 scan 均逐项串行读取 | legacy-a/b/c + mode-memory fixture | 538 项持续 batch OK，最终 COMPLETE |
| singular 返回 null、错误 ID 或无路径 | 精确 ID 校验；按 R60 retryable fail-open/契约熔断，禁止名称猜测 | incomplete/zero-path fixture | 不呈现错误顺序、不扫 Library/NAS 目录 |
| 新宿主原生支持 `ids/fields` | 保持 query 模式，不调用 fallback | primary contract fixture | 向后兼容，不额外增加调用 |

## R64：宿主 Item getter 显式归一化

| 场景 | 期望 | 自动证据 | 真实 T3 观察 |
| --- | --- | --- | --- |
| `filePath/size/modifiedAt` 位于 Item prototype getter | normalizer 逐项直接读取并物化为 plain item | EagleHostItem fixture | singular 首批 `resolvedPathCount=1` |
| getter 抛错 | 该字段视为 unavailable，其它字段继续；不得拖垮 resolver | safe read contract | 受控 fail-open，不崩插件进程 |
| 宿主对象包含未知字段/方法 | 不穿透，只保留 RESOURCE_FIELDS + 原 snapshot 字段 | whitelist normalization | 排序核心不依赖 Eagle 私有对象 |
| 原宿主 Item | 不修改、不挂载状态、不长期持有 | source immutability contract | 快切/generation 回收不泄漏宿主对象 |

## R68-R70：智能呈现的注入作用域与身份稳定性

| 场景 | 期望 | 自动证据 | 真实 T3 观察 |
| --- | --- | --- | --- |
| 纯排序 core 与 host wrapper 被注入同一作用域 | 两者不得同名；present error 输出准确阶段和有限 stack | injection compilation + lifecycle exception fixture | 不发生 `Maximum call stack size exceeded`，异常可定位 |
| 同一组 smart 成员仅被重新排列 | member fingerprint、lifecycle signature 不变，不启动第二个 PRESENT | reversed-member lifecycle/snapshot fixture | 一次 PRESENT，排序提交不自我取消 |
| Eagle rerender 更换 `allData/filtereds` 引用，成员不变 | reference churn 不换 query epoch；只读入口可变，语义身份不可变 | plugin source query-key contract | 538 项 `PRESENT-START → READY` 仅一次，25 秒无迟到跳变 |

## R80：普通文件夹多级规则变更

| 场景 | 期望 | 自动证据 | 真实 Eagle 门禁 |
| --- | --- | --- | --- |
| 已选多级排序，首级“文件名（自然排序）”从升序改为降序 | 同一文件夹的可见网格必须实际反向；仅下拉框文字变化不算通过 | `plugin-source.test.js` 确认刷新捕获 collection+规则身份，并在宿主刷新后的 `$evalAsync` 请求 `scheduleNormalOrderPresentation` | 选择至少含 `1-` 与 `2-` 前缀的普通文件夹；记录切换前后前两组位置，确认反向后实际互换；不拖动、不改名、不改素材 |
| 规则变更后的宿主刷新期间切换文件夹或再次改规则 | 旧请求零写入，当前文件夹不被前一个规则污染 | collection/规则身份 guard | 快切其它普通文件夹并返回，不出现闪回、错序或跨文件夹重排 |

| 智能虚拟卡环绕/瀑布布局 | 完整权威结果与当前投影正确，渲染卡无重复且属于当前集合时 READY | `smart-projection-proof-core` | 不得因几何卡片次序回退原生顺序 |
| 智能投影跳序、重复卡或混入其它集合 | fail-open | `smart-projection-proof-core` | 不得以“仍有卡片显示”冒充排序成功 |
