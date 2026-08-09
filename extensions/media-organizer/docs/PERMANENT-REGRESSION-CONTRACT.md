# Eagle 排序系统永久回归契约

排序功能的完整分层产品语义见 `docs/SORTING-RULES.md`。本文档只记录已发生故障的永久禁止回归项。

本文档是发布门禁，不是建议。用户已经报告并修改过的问题必须永久保留为回归项。任意一项失败，整个版本不得安装、不得打包、不得交给用户验收。

本合同是 2.5 原生排序工作流的单一故障台账。版本号变化、重构、文件移动或另建实现，都不能删除、弱化或绕过这里的行为约束。

## 最高验收原则

1. Eagle 真实界面的最终显示是唯一验收标准。只认用户实际看到的照片顺序、文件名、开关状态、操作结果和重启后的画面。
2. 自动测试、源码断言、模拟适配器、内部数组、DOM 推测、日志、API 返回值和理论推导全部只是开发排错工具，不能单独或组合宣布验收通过。
3. 真实界面与任何内部证据冲突时，一律以真实界面为准并判定失败。测试全绿但界面有断号、错序、失效或错误提示，版本仍然不合格。
4. 每个现场步骤必须在真实 Eagle 中操作并直接观察结果；涉及顺序和编号时，必须逐张读取当前画面，不能用“任务成功”“已完成”文案代替结果核对。
5. 未完成真实界面全流程前，只能说“开发预检通过”，不得使用“验收通过”“已经修好”“可以交付”。

## 唯一产品语义

1. 排序直接工作在 Eagle 原生照片网格和原生排列面板中，不要求用户打开“媒体智能整理”标签窗口。
2. 当前层有直接子文件夹时，当前层排序对象是直接子文件夹；叶子层排序对象是直接素材。
3. 手动拖动是最高优先级。一旦用户拖动，该 collection ID 的手动顺序就是显示、下一次拖动、刷新、重启和自动编号的唯一权威顺序。
4. 拍摄时间只是用户可选的比较键。它不是拖动资格、自动编号资格、保存资格或顺序恢复资格。
5. 排序锁定只阻止锁定之后会改变顺序或文件名的动作。勾选或取消锁定本身必须零排序、零刷新、零重命名、零快照恢复、零手动顺序重捕获。
6. 自动编号按当下最终可见顺序生成预览并执行，与拍摄时间是否存在无关。

## 已知故障的永久回归

| ID | 禁止回归的旧行为 | 唯一正确行为 | 必须验证 |
| --- | --- | --- | --- |
| R01 | 手动拖动第一次成功，第二次失效 | 只允许一个 Eagle 原生拖动会话；只有有效网格卡片上的 `dragover/drop` 进入排序，不得再并存第二条鼠标放置链 | 同一文件夹连续拖动 20 次，包含同一张反复拖、不同照片交替拖、跨行拖；期间穿插拖出到本地文件夹后继续内部排序 |
| R02 | 第二次拖动从旧 DOM、`allData` 或原始数组重新计算 | 每次放置后立即按 Library ID + collection ID 保存完整手动顺序；下一次只在该顺序上移动 | 每次的指纹等于上一次结果再执行一次 `moveItems` |
| R03 | 没有拍摄时间的照片不能拖 | 有时间、无时间和时间尚未读取的素材拖动能力完全一致 | 源、目标分别为有时间/无时间的四种组合 |
| R04 | 自动编号读取旧排序、原始数组、DOM 插入顺序或拍摄时间顺序 | 编号计划必须直接消费按屏幕坐标排序的完整最终可见顺序；手动拖动产生的画面顺序是最高优先级，拍摄时间不得参与编号决策 | 每次拖动后编号预览的 item ID 顺序与真实卡片屏幕顺序逐项一致 |
| R05 | 界面明显不连续却提示“已经连续” | `changes` 必须按可见位置重新计算，不得只检查编号集合是否完整 | 将 `1,2,3` 显示为 `1,3,2`，预览必须产生 2 条变更 |
| R06 | 自动编号因缺失拍摄时间等待或失效 | 编号不读取、不等待、不检查拍摄时间 | 所有素材无拍摄时间时仍生成完整预览 |
| R07 | 自动编号交换文件名时发生重名冲突、部分成功或静默失败 | 执行层必须使用不重名的临时名称阶段再进入最终名称阶段；任一阶段失败必须显式失败并可回滚 | 循环换名 `13 -> 16 -> 17 -> 13`、NAS 暂时不可用、重复执行 |
| R08 | 打开或关闭排序锁定改变照片顺序或文件名 | 锁定开关本身只写保护状态 | 切换前后可见顺序、文件名、手动顺序三个指纹完全相同 |
| R09 | 保护文件夹被整个跳过配置传播 | 配置仍传播到保护层；保护只拒绝实际排序、拖动和重命名 | 三层以上树，包含空层和保护层 |
| R10 | 父层“应用到全部”报成功，但一级、二级、三级子层没有同步 | 范围是当前层加全部后代，任意深度统一遍历 | 四层树逐层重新进入检查开关、简介和排列值 |
| R11 | 父层子文件夹与叶子层素材对象混淆 | 当前层的目标种类只能是 `direct-folders` 或 `direct-media` 之一 | 父层只改直接子文件夹，叶子层只改直接素材 |
| R12 | 普通文件夹和智能文件夹使用不同排序核心 | 两种适配器只转换为同一核心输入 | 相同项目、相同规则得到相同顺序 |
| R13 | 智能文件夹或“全部”视图回退扫描整库 2.4 万项 | 只处理适配器明确提供的当前集合；全部和未知上下文返回受控不可操作状态 | 真实打开“全部”和智能文件夹时界面保持流畅，“全部”明确不可操作，智能结果只显示当前集合 |
| R14 | 批处理进度和结果跨文件夹串台 | 批处理状态始终携带发起的 collection ID，只在相同上下文显示 | 运行中切换文件夹，新文件夹不显示旧进度 |
| R15 | 刷新、切换集合或重启后手动顺序丢失或污染其他集合 | 手动顺序按 Library ID + collection ID 隔离 | 刷新、A/B 文件夹往返、完整重启后指纹一致，B 不受 A 影响 |
| R16 | 同一排序插件被 Eagle 从正式安装目录和开发源码目录同时加载，反复注入监听 | 主窗口同一 API 版本只能初始化一次；同版本后续注入只返回已存在的集成结果 | 完整重启后在真实界面连续拖动 20 次，过程中不得因重复注入突然失效、复位或重复编号 |
| R17 | 为了排序自动打开“媒体智能整理”窗口或初始化 GPS/标签服务 | 自动服务启动只注入排序；GPS/标签服务只在用户主动打开该窗口时初始化 | 重启 Eagle 后排序可用，标签窗口不出现 |
| R18 | 部分失败、重复执行或 NAS 不可用时静默报成功 | 真实界面必须显示明确的失败数、首个失败原因和可恢复状态 | 在真实 Eagle 可控失败场景中，界面不得显示成功，恢复连接后可继续或重试 |
| R19 | 多级排序、手动视图和自动编号各自读取不同顺序 | 顺序链固定为：适配器当前集合 -> 纯排序核心 -> 手动拖动覆盖 -> 完整可见顺序快照 -> 编号计划 | 同一输入逐阶段比较 ID 序列 |
| R20 | 中文、数字、全半角前缀、重名、缺失时间或反向排序不稳定 | 比较器完全确定、稳定，缺失值固定在末尾 | 单元数据覆盖所有组合并在重复运行中得到相同指纹 |
| R21 | 手动拖动成功，但已开启的自动编号没有响应，或响应被重复注入清掉 | 每次有效手动放置先持久化完整手动顺序，再重启且只保留一个当前集合编号任务；编号计划必须读取刚保存的顺序 | 连续 20 次拖动中，每次都产生同顺序预览；开启自动编号时每次有效放置只调度一次当前集合任务 |
| R22 | 打开插件、拍摄时间读取完成、普通菜单刷新或锁定开关触发了意外编号 | 这些动作全部是非编号事件；只能同步显示/签名或取消旧任务，不得创建重命名计划 | 源码门禁确认时间戳回填和普通菜单刷新不调用通用编号调度；锁定切换前后三指纹不变 |
| R23 | 为了“自测拖动”在用户真实网格执行放置、写手动顺序、刷新或清空撤销历史 | 运行时集成检查必须纯只读，只检查资格、处理器、目标和纯函数移动结果 | `runDragIntegrationTest` 不得调用放置、持久化、重置、刷新或编号调度 |
| R24 | 当前文件夹自动编号由主窗口直接并发改名，循环名称发生 `ENOENT`、重名冲突或半成功 | 主窗口只提交带 collection ID 的后台安全批任务；后台顺序执行临时名阶段、最终名阶段，失败后回滚并明确报告 | 真实界面逐张核对最终名称连续且无半成功；失败时界面明确显示失败/回滚，切换文件夹不得串台 |
| R25 | 自动编号只改 Eagle 元数据名称，没有同步真实 JPG，刷新后出现空缩略图、破图和右侧预览消失 | 编号路径禁止使用 `item.save()`；每一步必须调用 Eagle 原生 `ayncsImagesChange`，并验证新真实文件存在、旧文件消失、`metadata.json` 名称一致 | 编号后逐张打开右侧预览，刷新后全部网格缩略图仍存在；只读核对当前集合每个项目的元数据名称与真实文件名一致 |
| R26 | 快速连续拖动时自动编号重叠执行，弹出“找不到文件”，或后一次手动顺序未被编号 | 每次拖动重启静默期，只保留最新手动顺序；编号批任务严格串行，运行中发生的新拖动在完成后按最新顺序重新排队 | 真实界面快速连续拖动 20 次，全程不出现找不到文件；停止后只按最后画面编号，刷新后缩略图和预览均正常 |
| R27 | 当前文件夹自动编号完成后连续执行两次全列表刷新，导致缩略图成片变暗、空白或右侧预览短暂消失 | 当前文件夹编号只使用 Eagle 原生改名管线更新现有卡片，完成后禁止全列表刷新；跨文件夹树批处理最多刷新一次 | 真实界面连续拖动并等待编号，每次从放置到编号完成全过程观察网格和右侧预览，任何一帧出现成片空白、破图或预览消失都失败 |
| R28 | 两阶段安全编号把 `__eagle_number` 内部临时名直接显示在网格或右侧名称框 | 内部临时名绝不出现在真实界面；临时阶段和最终阶段分别整批提交，事务期间网格与右侧名称只显示该 item 的最终业务名 | 自动编号开启时快速连续拖动，逐帧检查网格与右侧名称；任何 `__eagle_number`、临时名、空名或错误业务名都失败 |
| R29 | 自动编号一次提交大量原生改名，Eagle 弹出“正在处理 N 个更改”并阻挡操作 | 每个安全改名阶段最多提交 3 项，确认该组真实文件和元数据落定后才提交下一组；最终只更新当前选中项，不刷新整页 | 真实界面连续拖动并等待编号，全程不得出现原生大进度层，右侧预览必须保持可见且使用最终业务名 |
| R30 | 只移动一张照片、只交换 2 个编号，却要等待 10 至 25 秒后界面名称才变化 | 拖动后的最终编号必须立即显示，后台仍以两阶段原生管线安全落盘；同一批项目的文件、目标路径和 metadata 校验并行执行，禁止在第一阶段前再串行重复整轮预检 | 真实界面单次相邻拖动和跨行拖动后立即看到最终编号，后台完成前仍可继续操作；记录从放置到可见编号及安全落盘完成的耗时，任何 10 秒无界面反馈都失败 |
| R31 | 文件夹切换、分页或列表逐批补全被误判成用户改序，自动启动整夹编号；不同规模文件夹因此表现不同 | 文件夹切换、分页、刷新、启动和列表补全全部无权创建编号任务；自动编号只允许由明确的有效手动放置或用户明确确认执行触发 | 在 88、169、179 项文件夹间往返、翻页、刷新和重启，期间不拖动、不确认编号，改名请求必须始终为 0，界面不得出现同步文件名或改名进度 |
| R32 | 编号任务中断后，`__eagle_number` 内部临时名长期留在真实网格、右侧名称和真实文件中，只能手工猜测恢复 | 中断恢复必须按精确 item ID、当前临时名和备份原名，通过 Eagle 原生改名管线分批恢复；状态不完全匹配时拒绝执行，不得直接写 `.library` | 人为中断临时阶段后，恢复请求只纳入当前仍为临时名的项目；恢复后真实界面、真实文件和 metadata 都不再包含 `__eagle_number` |
| R33 | 旧“手动拖动”开关曾删除或停用已保存顺序，导致刚排好的照片立即变乱 | 手动拖动改为 collection 默认能力并移除开关；已保存顺序仍是显示、刷新、切换、重启和自动编号的唯一权威，只有用户明确点击“恢复自动排序”才能清除 | 源码和真实界面均不得再出现可操作的手动启停开关；拖动后刷新、切换返回和重启，顺序指纹必须不变 |
| R34 | 手动排序监听器取消所有原生 `dragstart`，导致照片只能在网格内排序，无法拖到 Finder、桌面、聊天框或其它软件 | 排序只接管另一个有效网格卡片上的 `dragover/drop`；原生 `dragstart`、`dataTransfer` 和所有网格外拖放完全归 Eagle | 手动拖动开启、关闭和排序锁定三种状态分别把照片拖到本地测试文件夹，文件必须成功出现；Eagle 内顺序、名称和手动顺序指纹不变，再做网格内拖动确认排序仍有效 |
| R35 | Eagle 卡片名称已经更新，但该 item 的真实原图仍保留旧名，导致单张素材无法拖动、导出或预览 | 精确恢复允许磁盘旧名与 metadata 当前名不同，并通过 Eagle 原生改名管线把真实原图同步到 metadata 当前名；普通编号仍必须要求 item、metadata 和磁盘源名一致 | 构造单 item `metadata=新名/raw=旧名`，恢复后两者一致且旧路径消失；相同分叉进入普通编号时必须继续拒绝 |
| R36 | 打开 179 项 NAS 文件夹时，插件立即并发读取全部原图 EXIF，并因旧当前视图键变化高频重写团队 sidecar，导致缩略图一张一张出现 | Eagle 原生缩略图和预览优先；缓存时间戳先用 item `size/mtime` 校验并注入，未缓存 EXIF 等原生预览后以并发 2 扫描；切换 collection 立即取消旧排队；旧当前视图键不参与团队指纹，自动同步 debounce 为 5 秒 | 打开 179 项文件夹时原生卡片先出现，缓存命中不访问 NAS 原图；扫描中切换文件夹后旧任务不再排新项；只改变旧显示键不写 sidecar，现代每文件夹规则变化仍会写 |
| R37 | 用户只拖动一张照片，自动编号却把整个文件夹全部送入两阶段改名事务 | 完整最终顺序仍用于正确计算，但 `changes` 只保留同组序号真正变化的最小连续区间；该边界必须随请求进入后台并再次过滤 | 在 8 项连续编号中把第 2 项拖到第 5 项后，只允许第 2-5 项进入事务；区间外 item 即使旧业务名异常也不得由本次拖动顺带改名 |
| R38 | 智能文件夹保留上一个普通文件夹对象时，手动拖动被误判成父层子文件夹排序而完全禁用 | 当前智能 collection 身份必须覆盖残留 `currentFolder`；智能结果始终按 `direct-media` 接受有效网格 drop，完整顺序只写入该智能 collection，不继承或触发来源普通文件夹自动编号 | 从有子文件夹的普通父层切入智能文件夹，完成多次网格内拖动；刷新和切换返回后顺序保持，来源普通文件夹的顺序、成员、自动编号状态和文件名不变 |
| R39 | 智能集合已经允许拖动，但 Eagle 没有派发扩展可见的 `drop`，`dragend` 直接清掉会话导致画面不动 | 同网格 `dragend` 补交只能复用唯一原生 `dragState` 和现有放置函数；仅当 collection 未变化且最终坐标命中另一卡片时执行一次，正常 drop、网格外和跨 collection 不执行，也不得取消事件或修改 `dataTransfer` | 自动执行有状态同网格、无状态、网格外、跨 collection、手动关闭五种分支；真实智能集合拖动后切换返回仍保持，并复核 Finder 原生拖出不改变网格顺序 |
| R40 | 已选择“拍摄时间排序”且简介能显示相机时间，但真实网格仍按旧手动数组、Eagle 原生数组或刷新前顺序显示；旧自检在 manual overlay 存在时直接误报通过 | 唯一顺序协调器必须显式输出 `native / automatic / manual` authority；拍摄时间自动模式不得叠加旧手动数组，手动模式必须如实显示；现场检查逐项比较最终可见 ID 顺序，不允许 manual 状态绕过 | 用 `改造对比案例` 的混合 JPG/HEIC/视频和缺失时间样本验证：自动模式已知时间严格有序、缺失值稳定在末尾；手动拖动后 authority 为 manual；“恢复自动排序”后重新严格有序；自检任何可见违规必须失败 |
| R41 | 拍摄时间升序和降序切换后真实网格方向不变 | 宿主 `sortIncrease` 必须进入唯一顺序协调器；升序生成 `TAKEN_AT asc`，降序生成 `TAKEN_AT desc`，两者都在同一 collection 的自动基础顺序上应用现有手动相对关系 | 同一组已知时间素材分别切换升序和降序，真实网格方向严格互逆；刷新、切换返回后方向和手动相对关系保持 |
| R42 | 智能文件夹仍显示或进入自动编号/改名入口 | 智能集合只允许当前查询结果排序和手动相对位置；不显示自动编号区、不构造改名计划、不进入改名事务，来源普通文件夹不受影响 | 智能集合界面不显示编号区；源码/契约确认计划构造和执行均受普通集合边界保护；普通文件夹编号回归保持通过 |
| R43 | 智能文件夹真实拖动时宿主既不派发扩展可见 `drop`，也没有可提交的原生 drag 会话，导致零 `MoveCommand` 且画面不变 | 只在明确智能 collection 内建立被动 pointer 会话：不取消事件、不修改 `dataTransfer`，左键同库同集合、从媒体卡到同网格另一卡且超过阈值时只生成一次既有 `MoveCommand`；原生 drop 与 fallback 互斥，普通/global/unknown 完全放行 | 自动覆盖阈值、重复会话、原生提交互斥、Esc、预览、锁定、上下文变化、网格/窗口外取消及有界诊断；真实智能集合首拖必须立即改变画面，成功后再做 3-4 次、刷新和切换返回持久化，并确认零改名与普通文件夹只读回归 |
| R44 | 智能拖动已捕获 pointer 起点，但 Eagle 转入原生 drag 后 pointerup 先取消会话，原生覆盖层又使落点无法解析 | `SmartDragTargetResolver` 统一从 `composedPath`、`elementsFromPoint` 和稳定媒体卡 ID 解析同网格目标；同一 HostInputAdapter 会话被动观察 `dragstart/drag/dragend`，保留最后有效目标，且不取消事件、不改 `dataTransfer`、不捕获指针、不模拟鼠标、不增加覆盖层 | 自动重放 qa.17 的 `below-threshold`、`target-invalid`、`replaced-session`、`window-blur`；前三类可由同一原生 drag 会话继续或去重，窗口失焦仍硬取消；真实首拖只允许一次 commit 并立即改变画面，否则停止 |
| R45 | 诊断已经记录唯一 `pointer-commit` 和有效 `MoveCommand`，但真实智能网格顺序完全不变 | “命令生成”与“命令应用”必须分开确认；智能应用直接消费命令 ID，不依赖 dragend 后 DOM helper；只有 `MOVE_RECEIVED`、`REDUCER_BEFORE_AFTER`、`PERSIST_OK`、`RENDER_REQUESTED` 和 `VISIBLE_VERIFY_OK` 完整出现后才能记录 applied，任一步失败必须给出受控原因 | 自动覆盖 helper 缺失、命令校验拒绝、reducer 未变、持久化失败、网格局部更新失败和刷新重新覆盖；真实首拖前后逐项比较可见 ID 顺序，画面未变或阶段不完整立即失败并停止 |
| R46 | 智能文件夹拖动和刷新正确，但切换其它集合再返回后已保存顺序没有恢复 | 重入当前智能 collection 时必须从该 collection 的 manual overlay 经唯一 order coordinator 计算 final order，并由同一个 smart presenter 恢复；不得回退到原始查询顺序或复制第二套排序规则 | 真实智能集合拖动后刷新、切换其它智能文件夹、切换普通文件夹并返回，逐次核对可见 ID 顺序保持；来源普通文件夹状态不变 |
| R47 | 智能文件夹能移动但缺少普通文件夹同款左右落点提示、目标高亮或取消清理 | 普通和智能输入必须共用唯一 `drag-feedback-controller` 的 start/update/clear；未知 native surface 不得抹掉最后有效目标，智能卡缺少 helper 时只允许在既有 targetBox 投影同色左右边框，禁止覆盖层或第二套鼠标/视觉状态机 | 拖动过程中左右切换和换卡持续更新；选中项、网格外、drop、dragend、pointercancel、Esc、预览、集合切换和失焦后辅助 UI 全部清除，排序结果和 Eagle 原生行为不受影响 |
| R48 | 智能文件夹切换后宿主结果仍存在，但网格空白、界面卡顿并持续抛出 collection actions DOM 异常 | 普通/智能设置渲染必须使用真实 DOM 容器引用并保持幂等；智能集合使用 generation/token 生命周期，加载瞬态不清空原生画面，迟到任务取消；恢复只由宿主上下文/结果变化事件触发一次，500ms 轮询只保证入口存在；smart presenter 禁止改写 Eagle `allData/filtereds`，失败必须放行原生结果 | 自动真实运行 normal↔smart、smart↔smart、重复渲染，覆盖真实空集合、`0→511`、快速切换、迟到 token、重复进入和 presenter 失败；真实主库在 `MAX照片集` 与 `线上展示照片` 往返 3-4 次，网格非空、界面响应、无持续异常/后台无响应风暴，智能自动编号仍不存在 |
| R49 | 智能拖动为了显示落点而暴露全部宿主 helper，导致瀑布流巨型空洞、卡片跳位和绿色复制外观 | 唯一 `drag-feedback-controller` 必须显式区分 normal/smart strategy；normal 保持 Eagle helper，smart 禁止遍历/显示全部 helper、禁止修改非当前 helper、永不启用 normal dragging class；原生 dragstart/dataTransfer 继续放行 | DOM 测试证明 smart 任一时刻至多一个 current helper 可见且 position absolute、其它 helper mutation 为 0；native 非原位 target 后 unknown surface 再 dragend 只创建一次 MoveCommand，重复结束不提交，网格外拖出仍归 Eagle |
| R50 | 智能目标卡的 inset box-shadow 被真实卡片层裁成角点，用户仍看不到普通文件夹同款完整落点 | smart 优先复用 resolver 返回的当前 Eagle left/right helper：保存原 inline style，设为 display block、position absolute、top/bottom 0、height auto、零布局占位并使用原生 drag-over；切换/clear 完整恢复。任何 helper 路径都禁止改变 targetBox 的 position/overflow；helper 缺失且宿主 targetBox 已是非 static 定位时才允许 top=0、bottom=0、width=3px 纵向伪元素，static 时 fail-open | 可执行 style port 测试确认恰好一个 target helper 可见、绝对定位、切换后上一 helper 的 display/priority/position/top/bottom 完整恢复、所有结束原因恢复、非目标 helper mutation 为 0；normal 不变；源码契约禁止 inset box-shadow 和 targetBox 布局改写；真实用户拖动必须看到完整竖向落点而不是小蓝点 |
| R51 | 动态注入载荷因样式模板语法错误而整体无法执行，排序界面消失 | 必须从真实 `plugin.js` 构造完整 `injectionSource` 并以 `new Function` 编译，注入/monitor 失败需持久化完整诊断并限流 | qa.26/API103 | P0；外层 `node --check` 或字符串存在不能替代完整载荷编译 | SRC/HOST/DOC；完整 payload 编译通过，失败路径可审阅且原生 Eagle 行为放行 |
| R52 | 普通文件夹切到“全部”时首屏短暂乱序，数秒后才恢复 Eagle 原生添加日期顺序 | Eagle 切换首帧残留 `currentFolder`；`fromContext()` 若先采用宿主对象，会把 global/all 误认成旧 normal collection，排序包装随即读取旧 manual overlay/文件夹锁与规则；L2 collection ownership | qa.29/API106（本轮）；关联 R13/R15/R19/R31/R48 | 高；首帧与稳定帧都必须 fail-open，未知上下文也不得猜测；不得在 UI/DOM 事件追加规则 | C/SRC/DOC；明确 `view=all/global` 与 `view=unknown` 高于残留 folder；global/unknown 原样返回 Eagle 输入顺序，不读 overlay/lock/folder rule，不扫 EXIF、不做 N+1、不刷新、不生成改名/编号计划 |
| R53 | 智能文件夹启动先将临时全库 24,319 项套用手动关系并长卡顿，随后真查询 538 项再跳一次；qa.30 真实 538 项又卡在 HOST-PENDING 并错误读取 EXIF | 通用成员入口把宿主 `allData/raw` 当 smart 成员；只靠 busy/可见数误判 ready；qa.30 又把与 `allData` 同引用的显式 `filtereds` 错拒，监控却从 LOADING 普通上下文读取成员；L2/L3/L4 | qa.30/API107 已拒绝；qa.31/API108（本轮源码候选）；关联 R38-R48、R52 | P0；不得用固定延迟或“数量等于全库”猜测；合法全库匹配仍必须允许 | C/COORD/LIFECYCLE/SRC/DOC；`SmartCollectionHostSnapshot` 成员只能来自显式 `filtereds` 槽位，引用别名不是回退证明；sourceIdentity 必须为本轮 `eagle-smart-query`，queryEpoch 由 route generation + source reference + member fingerprint 推导，连续稳定才 READY；`allData/raw` 永不 fallback；LOADING 原样放行、零成员导出/overlay/锁/规则/刷新/EXIF/改名；EMPTY 必须由当前查询稳定确认，旧 generation 的 present 必须取消，手动覆盖采用稳定优先队列避免临时大表反复排序 |
| R54 | 插件服务一启动即读 cache/团队 sidecar、桥接主窗口、安装 observer 或触发业务轮询，可能与 Eagle/NAS 的 Library 枚举争用而卡在“即将完成”；qa.33 又将 identity 到达后主窗口瞬态 false 错当终态注入失败 | 唯一启动门禁保留 `BOOTING → WAITING_LIBRARY → READY_TO_INJECT → ACTIVE / STOPPED` 骨架，并细分 `WAITING_MAIN`；identity 仅允许开始同 generation、可取消、有界的纯 `mainLibraryReadiness` re-observation，不是注入授权；verified main identity/ready 前零业务 I/O，超时 `BOOTSTRAP_TIMEOUT` fail-open；真实注入失败才 `INJECT_FAIL` | startup gate waiting spy 为零；瞬态 false 后 ready 仅 inject/activate 一次；timeout 零 inject/一次诊断/无风暴；切库/STOPPED 取消迟到结果；R53 LOADING 零 metadata、R52 global 和 qa.26 normal/smart 冻结不变；真实 Eagle 启动仍由 T3 验收 |
| R55 | 智能文件夹最终虽然排对，但首个可见帧先展示已知错误 native 顺序，metadata/cache 完成后再跳变；升级丢 cache/team backup，DOM/host arrays/manual store 任一步失败可能半提交 | **SMART FIRST VISIBLE FRAME**：插件排序 smart 在 `VERIFIED_COMPLETE` 成员、同 snapshot 的 `metadata proof`、`HostOrderPresentationPort` 数据层与可见层验证全部完成前，只能显示明确 loading 或成员兼容的稳定投影，绝不展示已知错误顺序。正确顺序只由唯一 OrderCoordinator 产生；lifecycle 的 `onReady` 是 post-await commit phase。`IMMUTABLE CODE / DURABLE STATE` 把 cache/diagnostic/rename recovery/`team-state-backups` 放入 PluginData，迁移幂等且不覆盖；`geo-tag-state.json` 是 C 模块独立债务，不在 R55 冒充完成 | A→B→A/切库/退出旧 generation+fingerprint 丢弃；100→300→571、旧571→新538、分页/虚拟化/稳定空不出现 partial READY；advertised count 已知且精确相等时不要求 fabricated source revision，未知 count 必须 terminal/verified evidence；metadata 缺失为稳定哨兵且 proof identity 完全匹配；无 manual overlay 也必须验证 final order；commit/verify/persist 任一失败双向回滚，普通拖动 DOM+`allData/filtereds`+manualStore/localStorage 同旧或同新；升级 cache/team backup 仍命中且发行包零运行态；smart 永不自动改名，qa.26 normal 与 R52 global 不变 |
| R56 | qa.36 真实首帧 loading 正确，但 `MAX照片集` 的独立 `filtereds`/`allData` 在分批查询中永远没有 sourceIdentity，538 项无法 READY | filtered-query 与 current-view 必须分别由 `filteredReference`、`currentViewReference` 证明所有权，禁止一个 `sourceReference` 字段混用。非空 `filtereds` 即使 partial 也阻止 current-view fallback；partial 100/300 只能 loading，最终 538 + queryFinished + paginationComplete + advertisedCount=538 连续稳定后才能 READY；`filtereds===allData` alias 仍由 filtered 优先合法处理 | `MAX照片集(MJCRT7F81VVTJ)` 真实形状纯流水线测试 + `observeSmartCollectionHost()` 插件调用集成合同；测试必须包含独立对象、visible 0/120 交替、100→300→538、24k allData/raw、alias 反例；源码合同同时出现两种 reference 且不得出现旧歧义 evidence 字段 |
| R57 | qa.37 启动恢复到 `MAX照片集` 时 URL/collection identity 与右侧 538 项已就绪，但 Eagle 尚未把 `currentSmartFolder` 挂回 body scope，插件仍永久 loading | 当前 smart 身份必须由已验证路由 collection ID 持有；宿主记录优先读同 ID `currentSmartFolder`，缺失时只从 Eagle 自有 `smartFolderMappings[collection.id]` 取回记录与独立 `imageCount`。不得依赖名称、DOM 文案或把 `allData.length` 自证为完整计数 | 插件真实调用合同必须同时证明 route ID fallback、`smartFolderMappings` 同 ID 解析和独立 `imageCount` 完整性；真实 T3 首帧保持 loading，随后 538 项只 READY/PRESENT 一次，20–30 秒无二次跳变 |
| R58 | qa.38 仍永久 loading；Eagle 真实宿主源码证明 `allData` 是完整 smart 结果，而 `filtereds = allData.slice(0, len * page)` 只是分页投影，旧策略把变量名当语义导致真源倒置 | source ownership 由事实组合决定而不是字段名：route ID、同 ID `smartFolderMappings.imageCount`、query finished、当前 `allData` 引用、visible 属于 allData 且 unique count 精确匹配时，`allData` 是完整真源；filtereds 只在自身也完整或 current-view 未获强证明时作为候选。`allData===raw` 不能单独拒绝，24k provisional 会被独立 538 count 拒绝 | 真实宿主形状 538 allData + 100 filtereds + 120 visible + raw alias 必须选择 current-view；24,319 allData/raw + advertised 538 必须 untrusted；真实 T3 只允许一次 READY/PRESENT，分页/滚动不重建成员真源 |
| R59 | qa.39 已得到 538 项 VERIFIED_COMPLETE，但后台元数据上下文的 smart ID 为空，导致 538 个 item ID 从未进入路径补全，metadata proof 永远为 0/538 | 排序成员、元数据扫描和 PRESENT 必须继承同一个 route collection identity。READY smart snapshot 的缺失路径只可按 item ID 调用公开 `eagle.item.getByIds`；成功响应后仍无路径或非媒体项目写入本次会话 missing sentinel，失败/超时不伪完成并退避重试。scan identity 必须包含 smart collection、snapshot generation 与 member fingerprint；同 context 新 generation 不得借用旧 in-flight promise；删除从空数组推导 ID 的死分支 | `api.current()` 在 `currentSmartFolder` 未 hydration 时仍输出 route ID；538 IDs 进入分批 hydration；成功/部分/无路径/非媒体/异常、A→B→A 与同 ID 新 generation 均有回归；真实 T3 必须看到 metadata proof COMPLETE、一次 PRESENT、loading 消失且 20–30 秒无二次跳变 |
| R60 | qa.40 已收到 538 个精确成员 ID，但错误地把 `getByIds()` 返回的成员对象当作带真实文件资源的富对象，整批 0 路径又被伪装成稳定缺失 | 成员身份与文件资源必须是两个独立 adapter contract。唯一 `ItemResourceResolver` 只通过公开 `eagle.item.get({ ids, fields })` 明确请求 `filePath`；精确 ID 去重、有界批次和 generation 取消必须内建。响应漏 ID、类型错误或一整批媒体 0 路径表示宿主资源契约不可用，必须 retryable fail-open，不得写 null sentinel、不得完成 metadata proof、不得扫描 `.library` 或猜 NAS 路径 | `test/item-resource-resolver-core.test.js` 覆盖精确 fields、重复 ID、部分路径、整批 0 路径、漏 ID 和旧 generation；`test/plugin-source.test.js` 禁止 metadata scan 使用 `getByIds` 并确认只走 resolver；真实 `MAX照片集` 538 项必须出现路径资源、metadata proof COMPLETE、单次 PRESENT、loading 消失，20–30 秒无二次跳变 |
| R61 | qa.41 已有 538 READY，却在资源查询后永久 `FINAL-ORDER-PENDING` | 所有可能同步阻塞的宿主调用必须用 thunk 交给 timeout 包装，使 timer 先建立；资源能力先用单 ID probe，默认串行单项并在批间 yield。诊断和 yield 失败不得改变业务结果；失败按 5/10/20/40/60 秒指数退避，禁止固定频率风暴 | resolver 单 ID/串行/有界诊断、诊断失败隔离、monitor 指数退避与源码 thunk 合同；真实 538 必须持续产生有界进度、超时可恢复并最终 COMPLETE |
| R62 | 单槽 metadata cache 在切库/启动竞态中互相清空或覆盖，且先补路径后查缓存导致 NAS I/O 每次重做 | cache schema v3 必须按 Library identity 分区；读取磁盘后重新激活当前 Library；cache-first，仅 miss 才解析路径/原图；身份签名使用 `size + modifiedAt`；每次 scan 捕获自己的 Library ID，迟到结果只能写原分区 | v2 迁移、A/B 往返、active B 时迟到写 A、modifiedAt 失效、serialize 多分区与 plugin cache-first 源码合同；真实同库重开应直接命中 cache，不再查询/读取 538 个资源 |
| R63 | qa.42 的单 ID `item.get({ids,fields})` 返回数组却遗漏精确请求 ID | `ItemResourceResolver` 必须运行时协商能力：query 非数组或遗漏精确 ID 时，只探测一次并切到公开 `item.getById(id)`；记忆已证明模式，后续不得重复不支持探测。任何响应必须逐项精确 ID 校验，禁止接受无关 item、名称猜测或 `.library` fallback | unsupported query→singular fallback、模式记忆、后续 scan 零重复 query、singular 漏 ID/无路径和诊断轨迹回归；真实 538 必须看到一次 fallback 后持续单项路径完成 |
| R64 | qa.43 的 `getById` 已返回精确宿主 Item，但对象 spread 丢失原型 getter 上的 `filePath/size/modifiedAt` | 宿主对象不得按普通 JSON 复制。唯一 normalizer 必须对允许的资源字段逐项直接读取 getter，再生成 plain adapter item；读取异常隔离，原对象不修改，未知字段不穿透业务层 | prototype getter fixture 必须保留 filePath、size、modifiedAt 并完成 hydration；真实首个 singular batch 的 resolvedPathCount 必须大于 0 |
| R65 | qa.44 已完成 metadata，却因逐张 DOM restore 在虚拟化 smart 网格 PRESENT fail-open | 自动恢复必须 data-first：loading 内原子提交权威 host order，保持分页数组长度，触发 Eagle 原生 rerender，再验证最终可见前缀；失败双向回滚。禁止把自动恢复实现为数百次手动 DOM move | virtualized restore 测试证明零 moveBefore、一次 host commit/rerender、前缀验证和失败回滚；真实必须 PRESENT READY 且 20–30 秒无二次跳变 |
| R66 | data-first 仍可能把滚动后的虚拟窗口误当首屏，且生命周期把真实异常压扁为 `presenter-failed` | 提交前必须从原 host data 证明虚拟窗口偏移与长度，无法证明则零写入 fail-open；`filtereds` 始终保持零起点分页前缀，不与滚动窗口混用；Angular rerender 必须可等待。任何 present 异常保留有界类型和信息，禁止静默吞掉 | 非零 offset、非连续窗口拒绝、分页前缀 + 异步 rerender 回归；present throw 诊断回归；真实 PRESENT 必须一次 READY，失败日志必须给出明确 reason |
| R67 | cache 已有 530 条但身份字段尚未补齐时首次只命中 12 条，补齐后仍错误读取 526 个原文件 | cache-first 是两阶段：初始快照先命中；只为 miss 做轻量资源/身份 hydrate；身份补齐后必须二次查询缓存；仅二次仍 miss 才读原文件 | metadata cache classify 回归和 plugin 接线合同；真实同库重启不得再次读取 526 个原文件 |
| R68 | 纯排序函数和宿主包装函数在 Eagle 同一注入作用域重名，形成递归栈溢出 | 纯排序核心与宿主 adapter 使用不同命名空间；present 异常必须保留 `presentationStage` 与有界 `errorStack` | 完整注入载荷只允许一个纯 `applyManualOverlay`，真实失败可定位到准确阶段 |
| R69 | 同一组智能成员仅被排序重排，就被误判为新 query/snapshot 并启动第二次 PRESENT | member fingerprint 和 lifecycle signature 只由无序成员集合决定；成员新增、删除、替换仍触发新 generation | 反序相同 ID 是 duplicate observation，只提交一次；成员替换必须不是 duplicate |
| R70 | Eagle rerender 更换数组对象却让插件误判为新查询，取消首个正确提交或产生迟到跳变 | query epoch 只由来源语义和无序成员集合决定，不能由 `allData/filtereds` 引用决定；宿主数组 reference churn 是渲染细节 | host 引用变更、成员不变时只有一次 PRESENT；真实 538 首次排序后 25 秒无第二次 PRESENT/fail-open |
| R71 | 面板显示多级排序，但 Eagle 回调仍给旧原生排序键，网格和多级规则区分别降级/隐藏 | 持久化插件排序键是唯一自动排序意图；`sortData`、`sortRawData` 与规则区都先使用它，宿主 select/回调键只可作为非插件排序后备 | 模拟“持久化 `PHOTO_TAKEN` + 延迟原生键”：网格仍走 coordinator，规则区展开；单一拍摄时间同样不降级 |
| R72 | 侧栏红点和当前面板的锁定框显示相反状态 | 侧栏锁标记与当前面板必须在同一轮从同一 Library+collection store 重算；旧标记不得跨团队状态导入、切库或重进集合残留 | 每次 protection render 调用 marker reconciliation；红点、checkbox 和实际 lock guard 三者一致 |
| R73 | 多级排序已启用，Eagle 原生历史手动位置仍把 `1-`/`2-` 分段打散 | `item.pinned` 是 Eagle 原生视图状态；Eagle 原生 pinned 位置只属于 L0 基座，禁止进入插件自动比较器；自动结果只能由当前多级规则产生，显式插件手动相对关系才可在其上覆盖 | 设置相反的 native pinned 值后，`文件名前缀升序 → 拍摄时间升序` 仍输出完整 `1-` 组后再 `2-` 组；L4 手动 overlay 另行覆盖 |
| R74 | 正常文件夹在插件注入前已由 Eagle 排好，之后没有再次触发 `sortData`，旧原生画面持续存在 | normal 首帧必须主动走唯一 L3 presentation transaction；只有同 collection、完整成员与可验证可见窗口才提交数组和网格，任何证据不足或校验失败都 fail-open | 预置 native 乱序后重启并直达普通文件夹，零点击、零拖动时仍由当前多级规则原子呈现；缺网格/成员不全/验证不一致时零写入 |
| R75 | Eagle legacy folder object 与已显示的布局 select 暂时不一致 | 有效插件排序意图按“持久化插件键 → 已显示插件 select → native 后备”解析，规则区、host wrapper、metadata 和首帧 transaction 共用该结果 | folder=BTIME、select=PHOTO_TAKEN 时仍按多级规则呈现；没有任一插件键时保持原生 |

R53 Phase 3 补充：当 Eagle 已完成 smart 查询但只在 current-view `allData` 暴露结果时，
适配器必须依据 smart route、collection identity、source reference 和 visible consistency
联合证据建立 `eagle-smart-query:current-view`；无联合证据的 allData/raw 仍为 provisional，
不得进入 READY 或任何 metadata/present 路径。qa.31 的 571 项真实失败继续作为下一轮 T3 必测证据。

R54 的 `Library loaded` 必须来自当前 Library identity 的宿主事件和后续主窗口 readiness 确认；identity 之前必须保持零 executeInMain，
禁止把固定 sleep 当作 ready 判断。identity 后的时间仅用于给纯 host-readiness re-observation 设定可取消、
有界上限，不能替代 readiness 证据，也不能运行任何业务 poll。诊断只记录 `BOOTSTRAP_WAIT`、
`BOOTSTRAP_MAIN_WAIT`、`BOOTSTRAP_READY`、`INJECT_START`、`INJECT_OK`、`INJECT_FAIL`、
`BOOTSTRAP_TIMEOUT` 或 `BOOTSTRAP_STOPPED` 及 library identity/generation/reason/attempts/elapsedMs，
不得通过高频日志形成新的启动负担。

## 开发预检索引（不得作为验收）

| 回归项 | 自动证据 |
| --- | --- |
| R01-R04、R06、R19 | `test/sort-core.test.js` 的连续 20 次移动；`test/rename-core.test.js` 的每次移动后编号预览与全无拍摄时间样本 |
| R05、R07、R24-R26 | `test/rename-core.test.js` 的可见位置变更、循环换名临时阶段与回滚计划；`test/plugin-source.test.js` 的原生改名、磁盘验证、串行静默期源码门禁 |
| R08、R22 | `test/monitor-core.test.js` 和 `test/plugin-source.test.js` 的锁定零刷新、零排序、零编号副作用门禁 |
| R09-R11 | `test/folder-tree-batch-core.test.js`、`test/folder-level-core.test.js` 的深层、空层、保护层和父/叶对象边界 |
| R12-R15、R18、R20 | `test/collection-core.test.js`、`test/sort-core.test.js`、`test/folder-tree-batch-core.test.js`、`test/rename-batch-core.test.js` |
| R16-R17、R21-R23 | `test/plugin-source.test.js` 的单实例、单拖动状态机、拖动后编号、标签窗口隔离和只读集成检查门禁 |
| R28-R50 | `test/plugin-source.test.js` 的分批原生改名、可见名称隔离、并行批校验、大进度层规避、后台成员监听器禁用、中断/分叉名称恢复、默认手动能力、原生拖出边界、原生预览优先、智能集合身份、同网格 dragend 补交、真实可见顺序硬校验、团队同步、智能只排序不改名和重入呈现门禁；`test/drag-feedback-controller.test.js` 的 normal/smart 策略隔离、单 target helper absolute/full-height 投影、inline style 精确恢复、完整纵向 fallback 和清理；`test/host-input-adapter.test.js` 的非原位 unknown-surface exactly-once commit；其余智能生命周期、presenter、resolver、coordinator 和 application 测试保留既有门禁 |
| R54 启动隔离 | `test/main-library-readiness-waiter-core.test.js`、`test/startup-readiness-gate-core.test.js`、`test/plugin-source.test.js`、`test/monitor-core.test.js`；identity 后瞬态 main false 零注入、有限 host re-observation、ready 后一次注入、超时 fail-open、切库/停止取消和失败无风暴 |
| R55 首帧与事务 | `test/smart-first-visible-frame-core.test.js`、`test/smart-collection-host-snapshot-core.test.js`、`test/smart-metadata-proof-core.test.js`、`test/smart-collection-lifecycle-core.test.js`、`test/host-order-presentation-core.test.js`、`test/manual-drop-transaction-core.test.js`、`test/durable-state-core.test.js`；首帧、完整性、metadata identity、READY commit、双向回滚和升级状态迁移均为可执行故障注入 |
| R56 分离引用 ownership | `test/smart-collection-host-snapshot-core.test.js` 的真实 538 分批/虚拟化流水线；`test/plugin-integration-contract.test.js` 的 filtered/current-view 双引用真实调用合同 |
| R60 文件资源契约 | `test/item-resource-resolver-core.test.js` 的精确 fields、整批 0 路径、漏 ID、部分成功、重复 ID 和 generation 取消；`test/plugin-source.test.js` 的唯一 resolver 接线合同 |
| R61 宿主查询背压 | `test/item-resource-resolver-core.test.js` 的单 ID probe、串行查询、诊断/yield 故障隔离；`test/monitor-core.test.js` 的指数退避；`test/plugin-source.test.js` 的 timeout thunk 合同 |
| R62 Library 分区缓存 | `test/metadata-cache-core.test.js` 的 v2→v3、A/B 分区、迟到写隔离、`modifiedAt` 与多分区持久化；`test/plugin-source.test.js` 的 cache-first 接线合同 |
| R63 宿主能力协商 | `test/item-resource-resolver-core.test.js` 的 ignored IDs→`getById` fallback、模式记忆和精确 ID；`test/plugin-source.test.js` 的公开 singular adapter 接线合同 |
| R64 宿主 getter 归一化 | `test/item-resource-resolver-core.test.js` 的 EagleHostItem 原型 getter、路径/size/modifiedAt 显式物化合同 |
| R65 虚拟化 data-first PRESENT | `test/smart-collection-presenter.test.js` 的 virtualized prefix、零 DOM drag imitation、data/visible 双回滚；lifecycle reason 诊断 |
| R66 虚拟窗口与异常可观测 | `test/smart-collection-presenter.test.js` 的非零 offset/异步 rerender；`test/smart-collection-lifecycle-core.test.js` 的 present-threw 有界诊断 |
| R67 身份补齐后二次 cache-first | `test/metadata-cache-core.test.js` 的 hydration 后 cache hit；`test/plugin-source.test.js` 的 resolver 后 classify 接线 |
| R68-R70 注入命名与查询身份 | `test/injection-source-compilation.test.js`、`test/smart-collection-lifecycle-core.test.js`、`test/smart-collection-host-snapshot-core.test.js`、`test/plugin-source.test.js` |
| R71-R72 宿主排序意图与锁状态投影 | `test/plugin-source.test.js` |
| R73 原生 pinned 与插件优先级 | `test/sort-core.test.js` |
| R74 正常文件夹首帧呈现 | `test/plugin-source.test.js`、`test/host-order-presentation-core.test.js` |
| R75 有效排序意图 | `test/plugin-source.test.js` |
| R01-R75 文档完整性 | `test/permanent-regression-contract.test.js`；缺少任意 ID、关键语义或证据文件时 `npm test` 必须失败 |

上述证据只用于在进入 Eagle 前尽早发现代码回归。无论这些证据是否全部通过，都不能抵消真实界面中的任何错误，也不能作为交付结论。

## 每次发布的强制顺序

1. 完整自动测试和语法检查通过，仅标记为“开发预检通过”，不构成验收。
2. 假适配器连续 20 次拖动通过，仅用于阻止已知代码回归，不构成验收。
3. 安装前备份当前插件，只替换插件文件，不改 `app.asar`。
4. 完整重启 Eagle，确认不打开标签窗口，不扫描整库。
5. 在指定测试文件夹做 20 次真实拖动，每次立即核对位置。
6. 打开自动编号预览并执行后，从真实画面左到右、从上到下逐张核对名称严格连续；不能只看“已完成”提示。未确认预览前不执行真实改名。
7. 切换文件夹、返回、刷新、再重启，手动顺序指纹仍一致。
8. 排序锁定开关各切换一次，三个指纹必须不变。
9. 在真实界面确认没有断号、重复号、错序、拖动失效、串台、静默半成功或错误成功提示；日志只辅助定位，不作为通过证据。
10. 只有第 4-9 步的真实 Eagle 界面全部通过，才能请用户验收；第 1-3 步只能决定是否具备进入现场测试的资格。

## 新故障登记规则

1. 用户报告的新故障必须先在本表新增永久 ID，写清旧行为、唯一正确行为和复现步骤。
2. 修复必须同时增加能自动化的回归测试作为开发预检；所有用户可见行为都必须加入真实 Eagle 门禁并记录文件夹、项目数、操作次数和真实界面前后结果。
3. `TASKS.md` 记录修复事实和验证结果，`DECISIONS.md` 记录不可再改变的产品语义；只改代码不更新这三处，任务不算完成。
4. 禁止为了让测试通过而删除、跳过、改名隐藏回归项。行为确需改变时，必须由用户明确批准，并保留旧故障与变更原因。
5. 代码、自动测试和安装指纹只决定是否可以进入现场测试；“修好”的唯一结论来自真实 Eagle 界面完成全部门禁。未通过真实界面只能标记为候选，不能通知用户验收。

## 证据规则

- 只有真实 Eagle 界面显示正确才算通过，其它形式的理论符合全部无效。
- “自测通过”不等于“真实 Eagle 可用”，只能表述为“开发预检通过”。
- 一次成功不等于拖动通过；必须是连续 20 次。
- 只看 UI 的“成功/已完成”文字不等于编号通过；必须逐张查看真实画面中的照片名称和位置。
- 没有错误弹窗不等于成功；必须在真实界面逐项确认最终结果。
- 日志、内部 item ID、指纹和截图分析可以帮助定位，但不能覆盖用户在真实界面看到的结果。
- 任何真实文件重命名验收都必须事先确认预览和回滚路径。

## 2026-08-09：R80 普通文件夹规则编辑必须有实际呈现

- 普通文件夹的多级排序规则不是展示设置；每一次字段、方向或优先级变更，只有同一文件夹的网格完成可验证重排才算生效。
- `rebindRefresh` 是宿主刷新请求，不保证 Eagle 再调用排序回调。插件必须保存刷新时的 collection 和规则身份，并在刷新后的 Angular turn 对仍然相同的身份请求唯一 L3 presentation。
- 期间若用户切换文件夹、切换规则或不再选择插件排序，旧请求必须作废；不得把前一个文件夹的排序提交给当前文件夹，也不得为了显示成功写入手动关系、改名或 NAS 素材。

## 2026-08-09：R87-R88 智能虚拟网格排序真源

- 智能自动排序真源固定为完整 `allData` 顺序、当前 `filtereds` 投影和无重复且属于当前结果的渲染成员。DOM 几何、挂载顺序和屏幕外复用不拥有排序语义。
- 投影跳序、重复卡或跨集合卡一律 fail-open；几何窗口不连续只记录布局诊断，不能把已验证排序回退到原生顺序。
