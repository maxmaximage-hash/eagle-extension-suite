# 任务

## 2026-11-06：启动前只读安全门禁（app.asar / 插件边界 / hosts / FlClash）

- [x] 为 `scripts/eagle-preflight.sh` 增加失败即阻断的基线门禁：必须提供 64 位官方
  Eagle `app.asar` SHA-256 与 `/etc/hosts` SHA-256；缺失或格式错误直接失败。
- [x] 预检只读核对插件目录越界 symlink、FlClash `dns.fake-ip-filter` 对
  `eagle.cool`（含通配域名）排除规则，以及可用时的系统 DNS Fake-IP 结果；失败输出明确原因，
  不修改宿主、插件、hosts、代理配置或 Library。
- [x] 新增 `tests/eagle-preflight.test.js` 验收样例，覆盖通过且不变更文件、Fake-IP 缺失、
  插件 symlink 越界、app.asar 指纹不匹配、缺少指纹基线等红灯。
- [ ] 尚未在真实 Eagle 启动流程安装或执行本门禁；仍需项目总管在真实 Eagle 中接线并记录启动时间与
  界面可操作验收。当前实现仅提供安全阻断脚本和自动化 fixture 证据。

## 2026-10-30：当前电脑 Eagle 插件同步与真实加载验收

- [x] 核对当前主机为 Eagle 4.0.0；`app.asar` SHA-256 为
  `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`，与已审计 bridge 一致，未修改宿主。
- [x] 发现本机排序助手为旧版本、MAX Publisher 为 1.2.5；从当前 GitHub 同步源码对应的正式包安装排序助手 1.17.0 和 MAX Publisher 1.2.7。
- [x] 替换前分别建立可恢复备份：
  `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin-before-sync-20261030/plugin`、
  `/Users/max/Library/Application Support/Eagle/Backups/max-publisher-before-sync-20261030/plugin`。
- [x] 正常退出并重启 Eagle；插件菜单可见 `MAX 头像共享源`、`MAX Publisher`、`Eagle 排序助手`、`Eagle 工作台`。
- [x] 真实打开排序助手：显示 `v1.17`、当前 Library/集合、`宿主 bridge 已返回`、最近错误“无”。
- [x] 真实打开 MAX Publisher：显示本地导出、隐私打码、线上水印与发布、字体分类管理和系统设置；线上展示标签读到 91 张，状态为等待配置。
- [x] Publisher 自动测试 82/82 通过；包现场 SHA-256 为 `5a42c53a37ce799f0431cf5ce98d4193bf3eac772e7809f4c68eb4f1282017f2`。
- [ ] 尚未执行真实图片导出、打码落盘、批量排序/改名或线上发布；这些动作保留为下一步可审计验收，不以窗口打开冒充业务写入已通过。

## 2026-10-30：排序助手真实不可用红灯与 scope 修复

- [x] 真实 Eagle 原生排列面板确认旧安装没有任何排序助手注入项；仅显示 Eagle 原生“使用全局设置”，因此排序功能确实不可用。
- [x] 根因已对上 Eagle 4.0 模板：原生 `select` 的 `ng-change` 使用 `$parent.changeOrderBy(...)`，旧 adapter 却只包装 child scope；自动测试此前未覆盖该真实 scope 形状。
- [x] 先写 child scope + `$parent` 失败测试，再修改 `native-layout-adapter.js` 沿 `$parent` 找到实际 owner；排序全量 `npm test`、`npm run check:v1` 通过。
- [x] 修复包重新安装并重启 Eagle；真实原生面板已出现 `排序锁定`、`手动拖动（默认开启）`、`文件自动编号` 和 `高级设置`，确认注入链已恢复。
- [x] 旧安装备份至 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-plugin-before-native-scope-fix-20261030/plugin`；未修改 `app.asar`、Library 或 NAS。
- [ ] 尚未执行真实排序写入、拖拽、批量改名；当前只关闭“原生入口注入失败”红灯。

## 2026-09-18：总管继续核验（替代专项仍待授权）

- [x] 按 P0.1 重读 `/Users/max/引力环球/AGENTS.md`；完成时间 `2026-09-18 03:30:33 +0800`，SHA-256
  `2801097c9d0efece8df9c22da95ea3f285d431c11f13a8242777b360d578aeb1`。
- [x] 复核唯一正式源码 `extensions/media-organizer` 为 `1.17.0`，唯一正式安装目标为 `1.16.0`；
  未安装、未重启 Eagle、未操作真实 Library/NAS、未批量改名或删除。
- [x] 复核排序专项 `01a04308-2871-7de3-ad83-2ede4324223f` 仍因 HTTP continuation 缺失 `call_id`
  终止；未发送消息、未 fork、未把空结果当完成。当前源码仍构造三个规则来源按钮，安装前证据不完整。
- [x] 发现 `releases/` 当前仅有 `.DS_Store` 与网页媒体子目录；先前登记的 v1.16 包和校验文件缺失，
  缺失来源与用户授权未知，不推断为已批准删除或清理完成。
- [ ] 用户明确授权在正式 EAGLE 项目内创建新的可见排序专项后，才恢复业务实现和证据闭环；在此之前
  保持代码、构建、安装和真实数据冻结。

## 2026-09-12：总管恢复与持续跟进（接管阻塞）

- [x] 用户已批准建立干净总管并持续推进原总管未完成事项，最终由用户验收；新任务 `01a095c3-db6e-74c1-9111-541c57c916f9` 属于正式 EAGLE 项目并直接使用唯一正式根，未创建 worktree。
- [x] 新任务以统一规则指定的 `gpt-5.6-sol/high` 首次运行及一次受控重试均在执行前失败：`function_call_output requires call_id on HTTP requests; continuation via previous_response_id is only supported on Responses WebSocket v2`。尚未完成接管或恢复专项，不能称为持续执行中。
- [x] 原有 `eagle` 五分钟 heartbeat 已迁到新任务并暂停，避免反复唤醒故障任务；旧总管与专项历史保留，未删除或归档。
- [ ] 等用户批准临时调整总管固定模型，或调用链恢复后，在同一新任务继续接管；成功后恢复原 heartbeat，不另建重复总管或监督。
- [ ] 恢复排序专项 `01a04308-2871-7de3-ad83-2ede4324223f` 的实质进展及证据审核。v1.17 的安装前记录仍须核实，安装和实机合同未完成；不把继续授权扩展为安装、重启、真实 Library/NAS 操作或批量改名的精确授权。

## 2026-08-25：EAGLE 项目总管治理接管

- [x] 当前治理任务接管唯一项目总管职责；旧总管 `019f8f8e-0465-7491-9dde-44a026e3dfc7` 因 `ctc/fc` 内部上下文损坏退出派发，仅保留历史读取。
- [x] 当前唯一已安装且已验证基线登记为 `2.5.22-qa.113/API189`；本轮不重复构建、安装或操作 Eagle。
- [x] 保留专项收敛为三条：`01a033fb-a48c-7172-a255-77b9fd587a2e` 排序控件状态显示、`01a0291f-7051-7730-9017-e16a842aefcb` R121 物理拖放验收、`01a00a09-f0b1-76f1-bb69-f1c8de4a7bf3` Chrome/Instagram 导入修复闭环。
- [x] 其余重复、失败和被取代窗口不再派发，进入归档范围；本轮仅更新治理状态与任务映射，未修改业务代码、测试、安装或 Eagle UI/Library/NAS。

## 2026-08-23：R130 正常重启后 MAX host scope 重绑（qa.113/API189）

- [x] qa.112 真实红灯定位为 route 已知但 exact Angular scope/renderer 后水合，首次 fail-open 后缺失事件驱动 reattach；未重做 qa.112 已通过的 539 fixture 与 L0 证据。
- [x] R130 先红后绿：旧 generation 取消、single readiness observer、同 identity 去 storm、身份变化 dispose、迟到零提交、永不水合零业务写入；URL route 不再被 stale global scope 覆盖。
- [x] qa.113/API189 完整门禁关闭：79 个测试文件、140 JS、123 shell、diff、双构建一致；插件包 SHA-256 `6c90efcdd79fd3388cd0e799825f80d6f48dd04af77be9e4a8dfc68e5c3cca84`，安装器 `a2ccdf4e6540c3b8bc001759739ba892972c72d19f2dd91e57353d4534f099a8`。
- [x] 正常退出/备份 qa.112/唯一安装/正常启动完成；MAX 重启恢复、smart 往返、两 Library 往返均重新 READY。最终 MAX 539/527/12/0，视频 `高颜值` 571/571/0/0；60 秒无二次跳序，两库普通文件夹选择/预览/右键无回归，`app.asar` 未变。

## 2026-08-23：排序 v3 supervisor / MAX 照片集根治（qa.112/API188）

- [x] 新增 R122-R129 红绿回归，建立每窗口/Library 唯一 `SortingSupervisor`；route、scope、renderer、Library、前后台和排序意图变化统一取消旧 generation 并重新绑定，旧链不再并行启动。
- [x] MAX 539 fixture 覆盖 527 valid + 12 stable-missing + 0 failure；`PHOTO_TAKEN_AT` 纯 TAKEN_AT 与 `PHOTO_TAKEN` 多级规则身份分离，升降序严格相反。
- [x] 完整 `npm test` 78 个测试文件、139 个 JS、90 个 shell、`git diff --check` 通过；qa.112 双构建插件包 SHA-256 均为 `eca0d906f09bb12ac4964739525deeb9247ac176b2ccdd8ff180815d6fc5d072`。
- [x] qa.112 已正常退出 Eagle、建立 qa.111 回滚点、唯一安装并正常启动；源码/安装 `plugin.js` SHA-256 均为 `b0eba32bd17b8d66b75811c4e9fad8c3ad4df443c1e7e7f1613d1249b47f328a`，`app.asar` 未变。
- [x] 引力环球 Library 的 MAX 冷启动、降→升→降、11 项 smart 往返已完成只读 UI 验收；每个最终 generation 均 `DATA-VERIFY=true`、`VISIBLE-VERIFY=true`、`PRESENT-READY`。
- [x] 解锁后只读完成引力环球视频 Library 往返：`高颜值` 571 项 generation 1、571/0/0、DATA/VISIBLE/READY 全绿；原生选择、空格预览、右键菜单可用。最终正常重启回 MAX 后，新 runtime generation 1 再次取得 539/527/12/0，65 秒首序列不变且仅一次 commit/PRESENT-READY；普通文件夹与混合类型 L0 证据沿用 R121 已完成抽样。

## 2026-08-22：排序 R121 qa.107/API183 真实接管

- [x] qa.107 已唯一安装并运行，源码/安装版/发布包内 `plugin.js` SHA-256 一致；全量 `npm test`、L0 选择/预览/右键入口与 `app.asar` 指纹通过。
- [x] 确认上一 JPG 手势及三次受控复核均未交付 Eagle 宿主 drop；网格不变且零 `HOST_INPUT/MOVE_RECEIVED/PERSIST_OK/MANUAL_DROP_COMMITTED`，符合既有 Computer Use 输入边界，未擅自升 qa.108。
- [ ] JPG/PDF/DOC/DOCX 物理内部 drop、持久化与 Finder 物理拖出仍未关闭，不能回报全部真实工作流通过。证据：`qa-evidence/QA-R121-QA107-REAL-UI-TAKEOVER-2026-08-22.md`。

## 2026-08-20：排序 R120 qa.105/API181 smart READY 事务证明边界

- [x] qa.104 真实升降序、A→B→A 与标签筛选画面均正确，但日志仍出现
  `SMART_PRESENTER_DATA-VERIFY ok=false`、`PRESENT-FAIL-OPEN`；清除筛选后又出现
  `READY-COMMIT-FAILED`，故不能以画面正确或 fail-open 结案。
- [x] R120 先红后绿：backing + 分页 projection 的顺序证明绑定同一原子 transaction；presenter
  优先消费明确 `dataOrderVerified`，删除可变全局 host-array 指针与分页/陈旧 readback 覆盖。
- [x] 原生筛选检测前移到 smart lifecycle/frame generation 之前；筛选期间 lifecycle inactive，
  清除筛选后按新 generation 重新进入，不写宿主筛选结果。
- [x] 完整自动门禁、静态检查、双确定性构建与安装器只读预检通过；插件 SHA-256
  `cd7ef72999a0e2b3906657d5384606c96bbb2aae72418636e619e260a5b8a85e`，安装器 SHA-256
  `ea2bd39a60748504066ad9d49b2824093677bd6a1ca1fd66d2b10541361b2181`。
- [x] 唯一安装及 MAX照片集 539 项冷启动/升降序/A→B→A/人物图筛选真实验收完成：
  qa.105/API181 正常安装、正常启动，冷启动与升→降→升、A(539)→B(91)→A、人物图
  539→394→539 均保持原生首帧可见；清除筛选后的 token 8 再次进入 `DATA-VERIFY ok=true`、
  `VISIBLE-VERIFY ok=true`、`PRESENT-READY`。当前运行实例所有最终 generation 均无
  `DATA-VERIFY false`、`PRESENT-FAIL-OPEN` 或 `READY-COMMIT-FAILED`。
- [x] 最终身份核验：源码/安装 manifest 均为 `2.5.22-qa.105`，API181，`plugin.js` SHA-256
  均为 `2bd77f4d4e5a175447c8c1d7d638132a61d0be93547c051b483f697d1f2a8f9c`；同 ID 只有
  `/Users/max/Library/Application Support/Eagle/Plugins/com.max.eagle-photo-taken-sort`，
  `app.asar` SHA-256 仍为 `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`。

## 2026-08-20：排序 R119 qa.104/API180 smart 稳定窗口末次确认

- [x] qa.103 真实冷启动首帧无白屏，但 539 项持续原生顺序且日志永久 HOST-PENDING，否决发布。
- [x] R119 先红后绿：完整投影只差稳定尾差时返回精确预算并安排一个 generation-scoped follow-up；
  loading/切路由/停模块取消，禁止轮询、refresh、DOM 重排和素材写入。
- [x] 全量自动门禁、静态检查、双确定性构建及安装器只读预检通过；插件 SHA-256
  `18a327796b8593c083d8385938d3684c37c50797f7d2b33f50a926937347bed6`。
- [ ] 唯一安装及 MAX照片集冷启动/升降序/A→B→A/筛选计数真实验收。

## 2026-08-20：排序 R118 qa.103/API179 smart host 晚刷新不得覆盖最终顺序

- [x] qa.102 真实 MAX照片集已通过 539 项冷启动升序、降序及再切回升序；但快速
  A→B→A 返回时，插件在 60 张虚拟卡过渡态过早提交，Eagle 后续 120 张宿主补载把网格覆盖回
  539 项原生顺序，6.5 秒后仍未恢复，qa.102 不得结案。
- [x] R118 先红后绿：完整成员证明与宿主投影稳定分离；同一 source/query/member 必须连续稳定
  150ms 才可进入 presenter，期间 loading、虚拟窗口补载或 route 切换会重置窗口。无全屏遮罩、
  无 refresh、无轮询、无素材写入。
- [x] qa.103/API179 全量自动门禁、静态检查、双确定性构建与安装器只读预检通过；插件 SHA-256
  `de2f5c46ed7964036b67d5d5cb71e7ddbc98586517f1e855c273f4ee477a1632`。
- [ ] 唯一安装和真实 A→B→A/筛选计数验收。

## 2026-08-20：排序 R117 qa.102/API178 smart metadata 有界续跑

- [x] qa.101 真实冷启动 539 项在 deadline 后永久 `metadataReady=false`，无 presenter/commit，否决发布。
- [x] 先红后绿修复 heartbeat fast path 与两次 smart snapshot 稳定门的死锁；pending proof 只放行一次
  follow-up context read，确认后清空，不形成 monitor/EXIF/NAS 轮询风暴。
- [x] 完整回归、静态检查、双确定性构建和安装器只读预检通过；插件 SHA-256
  `71d54db2eb398b5a5f13a191ee0138a9ce477d62e4e5f21bfb021b5cafe4d6e4`。
- [ ] 唯一安装和真实升降序/A→B→A/筛选计数验收继续执行。

## 2026-08-20：排序 qa.100/API176 smart presenter owner 透传

- [x] qa.99 真实日志再次出现 `smart-owner-required`；定位为 lifecycle 已捕获 owner、presenter glue 漏传。
- [x] R115 先红后绿，只原样透传 owner，不放宽 route/scope/generation/ref/page/member 门禁。
- [x] 全量自动回归、静态检查、双确定性构建和安装器只读预检通过；插件 SHA-256
  `47b959aa9597bd74836e132ea8c87a3ec19a46809a82e1da5017aa1897609191`。
- [ ] 唯一安装、正常重启和 MAX照片集 539 项真实升降序/多级规则验收。

## 2026-08-20：排序 qa.99/API175 智能路由 scope 所有权

- [x] qa.98 真实升序验证完成 527/12 metadata 后被 `smart-owner-required` 拒绝，登记 R114 并否决发布。
- [x] R114 先红后绿：解析 Eagle 真实小写 `smartfolder=` 路由，只绑定拥有同一 smart collection ID
  的活跃 Angular scope；找不到 owner 时保持原生 fail-open，禁止借用旧普通文件夹 scope。
- [x] 候选递增 qa.99/API175；全量自动回归通过。
- [x] 双确定性构建和安装器只读预检通过；插件 SHA-256
  `9322f41d97ec86e418f233b010a742440e3c5f29ff8b6a00d69a340a11c7df20`。
- [ ] 唯一安装、正常重启和 MAX照片集 539 项真实升降序/多级规则验收。

## 2026-08-20：排序 qa.98/API174 智能分页投影原子提交

- [x] qa.97 现场证明完整 `allData` 提交成功但 100 项 `filtereds` 与网格保持旧顺序，登记 R113 并否决发布。
- [x] R113 先红后绿：完整 backing + `len × page` 投影同事务、live item 保鲜、filter/search 零写入、
  owner/ref/page 漂移零提交、原子回滚；删除 presenter 轮询。
- [x] 候选递增 qa.98/API174，首轮全量自动回归通过。
- [x] 双确定性构建与安装器只读预检通过；插件 SHA-256
  `d9fec3b782ae57416b94c721b6e2c74a78a4b256a31f79365d0af5ccf726535b`。
- [ ] 唯一安装、正常重启及 MAX照片集 539 项真实升降序/多级规则验收。

## 2026-08-20：排序 qa.97/API173 虚拟窗口成员证明

- [x] qa.96 真实运行已在 deadline 后完成 527 有时间/12 缺失 metadata 并进入 presenter，证明 R111
  生效；但 539 项/300 挂载卡被 `visible-window-unproved` 拒绝，qa.96 失去发布资格。
- [x] R112 先红后绿：预提交 DOM 只证明当前 smart membership；完整 host projection 在提交后证明
  顺序，重复卡/跨集合卡仍 fail-open。
- [x] qa.97/API173 全量门禁、双确定性构建与安装预检通过；插件 SHA-256
  `bb2fa3a95ce85909e6884ce8b17d32cd9ffeb9ddc26f0e5243a78fdccc34849f`。
- [ ] 唯一安装与 539 项真实升降序/多级规则验收。

## 2026-08-20：排序 qa.96/API172 智能后台就绪后一次真实提交

- [x] R111 验收退回 qa.95：1500ms 首帧预算到期后永久终止 observation，故只能证明不白屏，
  不能证明 `MAX照片集` 539 项拍摄时间排序生效。
- [x] deadline 与 presenter transaction timeout 分离；metadata 后续就绪可在同 generation 提交，
  排序意图变化生成新 generation，路由/Library 变化取消旧 generation。
- [x] 全量自动回归通过；候选递增为 qa.96/API172。
- [x] 双确定性构建与唯一来源只读预检通过；插件 SHA-256
  `6f1a57e655abe5372e49ca1cff0a8187dbd793df74904ef990e76fa591f03001`。
- [ ] 正常安装/重启及 539 项真实升降序、多级规则、筛选计数验收。

## 2026-08-20：排序 qa.95/API171 智能白屏与拍摄时间真源根治

- [x] R110 先红后绿删除智能文件夹全屏验证层和网格隐藏；验证后台化、1500ms 超时、
  AbortSignal 路由取消、迟到结果拒绝，原生首帧始终可见可操作。
- [x] 新鲜 Eagle item 拍摄时间优先旧 cache；五项升降序镜像、无 EXIF 稳定置尾、手动关系和锁
  自动合同通过。qa.94/API170 失去发布资格，候选递增 qa.95/API171。
- [x] 双构建/SHA/安装器门禁通过：插件包
  `0e56bb1d6e5b15761f7437cf382d005fde2565a9886117095afac57065a68882`，安装器
  `8804ec9eba119731a73c1365c9225972cebb6e3852a81247cb73a86dfd665e47`。
- [ ] 唯一安装并真实验收 MAX照片集 539 项拍摄时间升降序及 L0。

## 2026-08-20：测试文件位置收敛

- [x] 唯一允许的外部测试位置固定为 `/Users/max/Downloads/测试/`；禁止自行挂载卷，禁止在
  `/Users/max/NAS`、桌面、用户主目录或正式 NAS 根目录创建测试库、辅助目录或导出副本。
- [x] 清理本专项误放的 R105 测试库、`GravitySharedSources`、`Eagle-Test-Libraries`、桌面
  `1-GAGA-*` 目录及 NAS 收藏根目录 39 张副本；明确保留正式入口 `团队文件-MAX线上协作中台`。
- [x] 完整 39 张统一放到 `/Users/max/Downloads/测试/1-GAGA-39`：39 文件、39 唯一名称、
  39 唯一 SHA-256、227,188,953 bytes、0 子目录。

## 2026-08-20：排序 qa.94/API170 首次普通路由空网格根治

- [x] qa.93 已安装且 R108 自检转绿；真实首次“海外素材 587 → 1-GAGA 39”出现右侧 39、
  网格 0，切到 2-OOTD 45 正常并返回后恢复 39，锁定为旧 scope/新 route 竞态。
- [x] R109 先红后绿新增 host sorter route ownership；旧 active scope、旧 callback、空数组、
  错误成员归属全部 Eagle 原生 fail-open，不通过刷新或导航掩盖。候选 qa.94/API170。
- [x] 全量自动/静态门禁、双确定性构建和安装器只读预检通过；插件包 SHA-256
  `d3b5330dc27974607e7e27924bf0419e02a63ebff4979fed60c8a394fdb1a751`，安装器
  `dca98b3725a2455ad33c135d492481f332af4e83760e5ef1d04bc7a63a9f76f2`。
- [ ] 完成唯一安装和“首次进入即 39 项”现场复验；源码门禁通过不等于 Eagle 现场通过。

## 2026-08-20：排序 qa.93/API169 修正拖动健康误报

- [x] R108 先红后绿证明 qa.92 仍用旧 11-listener 自检检查已删除的 pointer 状态机；当前
  拖动运行时只有七个必要的 fail-open 监听器，普通 `IMPORT` 视图继续由 Eagle 原生拥有。
- [x] 启动健康与只读拖动检查改为共享 canonical handler set，严禁 pointer listener 回流；
  候选递增为 `2.5.22-qa.93/API169`。
- [x] 全量自动/静态门禁和双确定性构建通过；插件包 SHA-256
  `ef254a27cd83f65490e965453535294428988129619b93b91a6e4f3e17e58d33`，安装器
  `4ab4e007d903c104ee814278a1c0678b239506193e45db4d202d14502445ad6c`。
- [x] qa.93 唯一安装/正常重启，R108 日志自检通过；但因 R109 首次进入 1-GAGA 空网格，
  qa.93 失去最终候选资格。真实内部 drop、Finder 拖出、原生批量改名仍独立验收。

## 2026-08-20：排序 qa.92/API168 已修复 11 项并完成原生 39/39

- [x] qa.90 关闭注入 helper 缺失；qa.91 关闭冷启动 recovery 永久 pending，均先红后绿。
- [x] 真实修复/导出由 qa.91/API167 完成；qa.92/API168 递增运行时身份并重新通过全量门禁与
  双确定性构建，禁止 qa.90/qa.91 同 API 双语义进入最终候选。
- [x] 11 项 reference drift 通过 Eagle 官方项目级 rename pipeline 完成，零手改 `.library`、
  零回滚失败；已验证原生导出现在统一位于 `/Users/max/Downloads/测试/1-GAGA-39`，为 39/39，
  39 唯一名、39 唯一 SHA、227,188,953 bytes。
- [x] `IMG_7504` 检查器/EXIF 1.131 秒响应，右键与预览现场通过，无持续 spinner。
- [ ] 保留 Finder 物理拖出、内部 drop、原生批量改名与普通/智能锁/手动顺序为最终用户验收项。

## 2026-08-20：排序 R105 导入/点击/EXIF 主路径性能隔离

- [x] 无插件本地隔离库完成 1/10/39 张无 EXIF 基线：最后项目完成约
  0.19/1.10/4.80 秒，39 张 UI 约 10.8 秒确认 39 项，零新增后台无响应、缩略图超时或
  renderer crash；该结果不能排除生产 NAS 间歇性问题。
- [x] qa.89/API166 源码隔离每秒重型快照、500ms DOM 巡检、普通网格 observer、每 8 秒
  整库 GPS 枚举和整份 metadata cache 序列化；R105 先红后绿且完整 `npm test` 已通过。
- [x] 治理记录、全量自动/静态门禁、安装器预检、确定性双构建和唯一来源审计通过；
  qa.89 包 SHA-256 为 `f81b07009246ff1bc415441be90d1a5bf1437e91eabfdf0baa22c3912f6ce7cc`。
- [ ] 按既有授权唯一安装，
  用另一组 1/10/39 样本做启用插件对比，增量不得超过 25%。
- [ ] 性能通过后继续 1-GAGA 39/39、无 EXIF L0、原生改名/导出、预览/右键与普通/智能验收。

## 2026-08-18：排序 R101/R102 无 EXIF L0 资格与响应阻断

- [x] qa.85 已可逆停用并正常重启，未卸载、未改安装包、未改源素材或 `.library/app.asar`；
  恢复目录已记录在媒体整理专项任务。
- [x] 真实第一轮 1-GAGA 原生全选导出为 28/39；第二个新目录因选择在菜单操作时收缩为
  单项而为 1/39，已按门禁停止，两个目录均未补导、删除或覆盖。
- [x] 源码先红后绿移除 metadata scan 完成后的 host refresh，并锁定有/无 EXIF成员、
  selection、native dragend 与 manual move 同资格；新候选 `2.5.22-qa.87/API164`。
- [ ] qa.87 仍为发布否决状态；真实 39/39、IMG_7504/7517、EXIF 检查器和响应门禁需
  总管重新批准统一安装后执行。

## 2026-08-18：排序 R100 P0 原生改名、拖出与导出回归

- [x] 将原生批量改名 20 项名称混杂、`1-GAGA` 39→28、`IMG_7517.jpg` 单张导出失败及多项冻结合并为同一 L0 发布否决项；`qa.85/API162` 不可发布。
- [x] 先红后绿完成 live item 重排、dragend 零提交、显式 drop 单次提交、无 DOM 名称遮罩/selection 回写、无锁态原生改名拦截合同。
- [x] 全量自动回归和静态检查通过，候选为 `2.5.22-qa.86/API163`；确定性双构建插件包 SHA-256 为 `e93d24d82cede2b97b3807546539cf3250ae7148a96674edc88cf7cf278d0d14`。未安装、未重启、未真实改名/导出、未操作 Library/NAS。
- [ ] 待总管恢复门禁后执行 `IMG_7517.jpg` 单项、异常+正常混选、Finder 拖出、39 项逐项导出对账和 20 项原生批量改名真实验收。

## 2026-08-17：排序 R99 普通文件夹路由补水与部分窗口零写入

- [x] 录屏与真实 Library 元数据已对齐：`MB3Y67Y8494GH` 是普通文件夹“设计完成稿”，`MRDMCKFE47WO1` 才是智能文件夹“线上展示照片”。
- [x] 实机只读取证：当前 native `IMPORT` 下“设计完成稿”静置 30 秒日志零新增，画面 SSIM≥0.999992；录屏时则有陈旧 89 项和目标 166/可见 120 项两次 `visible-order-mismatch` transaction。
- [x] 先红后绿补齐 R99：跨文件夹陈旧成员必须 `SKIP_ROUTE_UNHYDRATED`，虚拟化部分可见窗口必须 `partial-visible-window`，两者均零 DOM move/零 host-array commit。
- [x] 完整 `npm test`、注入/JS/zsh 语法、差异检查、确定性重复构建与只读安装预检均通过；候选为 `2.5.22-qa.84/API161`，包 SHA-256 `1146bc40570fc4252b63d04f6d809a3a7a0c1c0ea3b2d0f1aa986736f56dc812`。
- [ ] qa.84 未安装、未重启 Eagle，未写 Library/NAS；真实插件模式 30 秒验收及安装回滚闭环需再次批准后执行。

## 2026-08-16：排序 R98 原生添加日期单一权威

- [x] 修复旧 `PHOTO_TAKEN` 持久值覆盖 Eagle 原生“添加日期”的 collection 意图缺口；R98 先红后绿与永久合同已登记，qa.83/API160 全量回归和确定性构建通过。
- [x] 经授权正常退出后安装唯一 qa.83，qa.82 回滚点、单一来源、安装 SHA、PluginData 与未变的 `app.asar` 均已核验；正常启动进入 `INJECT_OK`。
- [x] 真实 `BROLL` 与智能 `线上展示照片` 均显示纯原生“添加日期”，等待 5 秒不回跳；切回多级分别恢复原两条/一条规则，智能既有 3 条手动相对调整也未变化，团队 sidecar SHA 全程不变。
- [ ] 安装和 Computer Use 代验完成，仍等待用户最终目视验收；未经再次批准不执行额外 Eagle 重启。

## 2026-08-16：网页媒体保存至 Eagle 2.4.3

- [x] 推荐流封面恢复为用户明确选择的单张图片/视频保存；小红书与 Instagram 的卡片链接右键可从同一事件路径提取唯一媒体，不扩大为帖子或信息流扫描。
- [x] 图片/视频悬浮时展示单张保存按钮；可唯一确认的详情页展示保存当前图与按平台命名的整帖入口。小红书整帖只接受详情容器，不退回全页 `main/article`。
- [x] 64/64 自动回归、语法与差异门禁通过；`eagle-web-media-importer-v2.4.3.zip` 两次构建一致，SHA-256 为 `2bccc4d295c7addc3b53d33b4647401aae7e0823dcb2cf4d0e363f1f824fee95`。
- [ ] Chrome 实例在运行，但本机受控通道不可通信；仍需用户在 Chrome 扩展页重载 2.4.3、刷新目标页，才可继续真实 Eagle 写入与界面可见验收。

## 2026-08-16：网页媒体保存至 Eagle 2.4.2

- [x] 根据用户真实小红书截图修复右键可发现性：卡片链接右键不再无提示；推荐流明确要求先打开具体笔记，整帖按钮禁用。
- [x] 小红书/Instagram 详情页才启用整帖保存，单张保存仍限浏览器实际识别的图片或视频媒体；62/62 自动测试与语法检查通过。
- [ ] Chrome 自动化无法进入扩展管理页，需用户手动重载 2.4.2 后才能做真实 Eagle 写入验收。

## 2026-08-16：网页媒体保存至 Eagle 2.4.1

- [x] 整体保存入口改为平台感知文案：Instagram / 小红书显示对应整帖，未识别平台显示“保存当前媒体整体”；弹窗、右键和确认框语义一致。
- [x] 小红书仅允许详情页的已加载、归属唯一媒体整体保存，首页/发现流保持拒绝；新增 CDN 仍走既有下载与文件验真链路。
- [x] `npm test` 61/61、语法检查和差异检查通过；`eagle-web-media-importer-v2.4.1.zip` 连续两次 SHA-256 一致：`4303998faead7c88bdb1bb42b7b59f836c4b82ff8ef3d642498127488994694c`。
- [x] 发行包白名单、完整性、包内 JS 语法和源码逐文件一致性复核通过；Eagle 公开 API 已连通并可读。
- [ ] 已获用户实机授权，但 Chrome 自动化策略阻止访问 `chrome://extensions/`，必须由用户手动重新加载 2.4.1 后才能继续真实素材下载、Eagle 写入与 UI 可见验收。

## 2026-08-16：网页媒体保存至 Eagle 2.4.0

- [x] 完成网页媒体保存链路、Instagram 整帖能力和文件夹选择体验的对抗性审查；证据与范围记录在 `extensions/web-media-importer/docs/audit-2026-08-16/REPORT.md`。
- [x] 增加 Instagram 当前帖轮播导入入口、严格帖子归属门禁和已登记 CDN 验证；单张右键不会扩大成批量采集。
- [x] 更新文件夹选择器的最近使用区、遗漏/阻止说明及对话框语义；`npm test` 59/59、语法检查、差异检查与确定性打包通过。
- [ ] 未授权实际安装、重新加载 Chrome 扩展、操作 Instagram 登录页或写入真实 Eagle Library；需要用户明确批准后进行分层实机验收。

## 2026-08-15：排序 R97 普通/智能连续拖动回归

- [x] 用户两段真实录屏与 qa.81/API158 诊断证明：故障不限视频素材，根因为 `.pinned` 权限误判、normal 拖动期重投影和 smart 同 key 呈现重入。
- [x] 排序专项先红后绿完成 R97 最小修复，生成 `2.5.22-qa.82/API159`；完整自动门禁通过，双构建 SHA-256 `3704c995b06cd46a620bb064b2609bfecdd2e53c241b43dd322cc0d179a15b91`。
- [x] 用户于 2026-08-15 明确授权立即修复；Eagle 正常 Quit 7 秒内退出，qa.81 留存于 `PluginBackups/com.max.eagle-photo-taken-sort/2.5.22-qa.81-r97-20260815-011800`，qa.82/API159 已安装为唯一活动来源并正常重启。
- [x] 真实 `引力环球视频.library` 运行时核对：normal 合成拖动期间出现 `manual-drag-active` 且后台 presenter 零抢占；smart `高颜值` 自动编号整行不存在，拖动源和落点反馈正常；重启后零改名、零删除、零自动编号。
- [ ] Computer Use 合成手势只投递 `dragstart`，未投递 `dragover/drop`，因此未冒充真实最终改序通过；R97 代码修复与安装闭环完成，真实物理 drop 的最终用户验收仍保留。

## 2026-08-12：排序 R96 P0 原生集合与手动顺序保护

- [x] 发现并登记 smart 538 项异步结果可能污染 global 24,483 项的 host-array 所有权缺口；用户手动顺序不允许被自动排序、切库或旧回调覆盖。
- [x] 排序专项完成统一 host-array ownership 门禁、R96 对抗测试和全量自动回归；global 一律 zero-commit/fail-open。
- [x] qa.81/API158 已通过双构建和全量自动门禁，正常退出后安装为唯一插件来源并正常启动；安装包 SHA `1a20bae496ac8213c932df66139e4919038c2b50b37221e016893912869c65ae`，运行插件 SHA `40483b8e04d6f98ba8824e8fb53042448ab8ab7854f6ec1cdd6782bc236adc2f`，`app.asar` 未变。
- [x] 真实 Eagle 只读路由核验：MAX照片集538 → 全部后，全局为当前稳定基线24,490，未被覆盖为538。历史24,483与当前相差7项，记为既有素材新增差异，不归因本插件。
- [ ] 用户在真实工作流验收原有手动顺序、普通/智能排序与锁态；未通过前不得称为用户验收通过。

## 2026-08-12：总管与专项唯一停止条件

- [x] 用户明确要求：一次修复任务启动后，除非用户明确暂停、停止或取消，否则总管和专项必须持续运行。
- [x] 分析、失败测试、源码、自动回归、候选包或 QA 完成都不是停止点；唯一正常停止点是全部要求修改完成、唯一正式版本已安装到本地 Eagle、宿主正常启动且安装身份核验完成，然后回报“已安装，等待用户验收”。
- [x] 新回归或真实日志红灯必须自动回到修复阶段；安全阻断只允许保持未完成并等待授权，不允许绕过安全规则或伪报完成。
- [ ] 当前 `24,483 -> 538` P0 原生集合污染专项继续执行：R96 已复现缺少统一 host-array ownership 门禁，尚未完成源码修复、全量回归和正式安装，因此不得停止或称为修复完成。

## 2026-08-10：网页媒体保存至 Eagle 2.3.0 稳定发行候选

- [x] 浏览器媒体导入器完成交接幂等、最终跳转门禁、取消竞态、视频容器双流验证、HEAD 拒绝时的一字节
  Range 预检与临时凭据清理；B站多段 `durl` 永久阻止，绝不作为多个完整视频导入。58/58 自动测试和六个
  脚本语法门禁通过。
- [x] `2.3.0` 两次确定性发行包 SHA-256 一致：
  `c0403b3a111128200f9c5aa9d3ccc03e6b8ab9d67fd70e30709f225882dd98c8`；发行脚本保留历史包作为回滚点。
- [ ] 候选尚未重新加载到真实 Chrome；真实平台下载与 Eagle 可见验收仍需用户单独批准，未写入真实
  Eagle Library 或 NAS。

## 2026-08-09：网页媒体保存至 Eagle 2.0.0 对抗审查候选

- [x] 以 `generic/weibo/bilibili/douyin/youtube` provider registry 取代整页媒体扫描；不能证明当前
  内容时 fail-open，微博/抖音只收当前作品媒体，B站/YouTube 只认当前视频页封面。
- [x] B站只接收页面显式 `__playinfo__.data.durl` 渐进完整媒体，DASH 继续 blocked；抖音只接收
  当前作品 `RENDER_DATA` 的显式 play 地址。YouTube 视频坚持官方出口，本插件不第三方下载。
- [x] 下载后验证真实 MIME、字节数、最终 URL、危险状态和扩展名；HTML/JSON/空文件/类型不符永久拒绝。
- [x] MV3 每项事务、worker 重建恢复、Chrome 中断续传、取消、幂等事件、短期签名 URL session 隔离完成。
- [x] 任务默认 25 项、单项 1 GiB、整批 2 GiB且可配置；不向 Chrome Downloads 注入 Referer、Cookie、
  token 或 Authorization。跨站登记 CDN 标记 `requires-browser-validation`，真实 Chrome 前不宣称稳定。
- [x] Eagle 普通文件夹三重校验；API `success` 只 accepted，返回 ID 且 `/item/info` 读回同 ID、未删除
  才记 confirmed（仅 API-readable，不代表 UI visible）；只有 confirmed 缓存延时精确清理。
- [x] accepted_unconfirmed 使用 1/5/15/60/240 分钟退避重新确认，并提供手动“重新确认已接收项”；
  只读既有 item ID，禁止再次 `addFromPath` 造成重复。
- [x] 38/38 自动测试和六个运行脚本语法检查通过；1.x accepted 队列迁移为 accepted_unconfirmed。
- [x] 2.0.0 两次确定性发布包 SHA-256 一致：
  `1671d07bad41a96db58dd3bcedc9108550382fd505b477bd116f9050f14026ef`；包不含测试、状态或账号数据。
- [x] 真实 Chrome 已安装；YouTube 只输出封面，B站 DASH 阻止，抖音搜索页拒绝而数字 `modal_id` 作品可识别，
  单图右键只生成 1 项候选。
- [x] 真实 Chrome 发现并修复抖音搜索页中心卡片误判；`2.0.1` 将抖音/微博限定为明确详情 URL。
- [x] 网页媒体导入器 `2.1.0` 完成功能解释与 UI 重构：普通网页图片右键保存为主入口，扫描帖子为批量入口，并补齐新图标与平台限制说明。
- [x] 修复普通网页跨站 CDN 图片右键保存被误拦；例外仅限用户明确选择的公开 HTTPS 图片。
- [x] 修复右键一张图片却枚举整篇 `article/main` 的权限扩张；单媒体入口现在严格只生成 1 项候选，
  与帖子/页面扫描完全分流，43 项回归通过。
- [x] 补齐 IPv6 私网/回环/映射地址门禁，并修复公网 CDN 域名因 `fc`/`fd` 前缀误判为私网的隐藏问题。
- [x] `2.1.0` 最终候选两次确定性构建一致，SHA-256：
  `81b9942b09a695243958431e77b2aa6b45c9de2d07cb4b20830e259bb3653b47`。
- [ ] 微博真帖因 Chrome 未登录仍是红灯；本轮只读了 Eagle 普通文件夹列表，未向真实 Library/NAS 提交任何导入。

## 2026-08-09：网页媒体保存至 Eagle 1.0.0 历史候选（已由 2.0 取代）

- [x] 新建独立 `extensions/web-media-importer`，用户点击扩展按钮或右键菜单后才收集当前页直连图片/视频。
- [x] 普通 Eagle 文件夹选择、稳定去重、80 项上限、串行 Chrome 下载 + 公开 `addFromPath` 队列、
  来源记录、最近 20 批次和失败项重试均已实现。
- [x] `blob:`、`data:`、`.m3u8`、`.mpd`、未知媒体地址明确拒绝；不支持 DRM/加密或权限绕过，
  不宣传为所有网页/视频万能下载。
- [x] popup 统一通过后台 `openCollector`，可为安装前已打开的普通网页补注入；缓存只在 Eagle API
  `success`（accepted）后安排清理，延迟至少 24 小时。
- [x] 9/9 自动测试、四个运行脚本语法检查和干净发布包通过；发布包不含测试、台账、缓存或配置。
- [x] 两次确定性打包 SHA-256 一致：`062cce01e6292bafcbbf76cb4ff7f8d5dcb406902581255dc4e2bc1ade2b2dfe`；
  打包目录和安装指南统一为 `eagle-web-media-importer`。
- [x] 本轮按边界未安装 Chrome 扩展、未启动/操作 Eagle、未操作真实网页账号、Library 或 NAS；
  真实可见验收须另获用户批准。

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
  `/Users/max/引力环球/AGENTS.md`；Eagle
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

## 2026-08-09：Eagle 视频缩略图恢复

- [x] “IP 号 / 素材”中的 7 个 DJI MP4 曾有 4 个空白缩略图且显示时长为“—”；通过 Eagle 当前文件夹的
  “刷新”重新触发索引后，7 个缩略图和全部时长均已恢复。
- [x] 只读对比 SD 卡源文件：所有目标均为 HEVC Main 10、1728×3072、59.94fps；`ffprobe` 元数据读取和
  `ffmpeg` 单帧解码均成功，排除文件损坏或其中部分视频的编码不兼容。
- [x] 未重启 Eagle、未重导入/删除素材、未修改 `.library` 内部文件或 NAS 原片；现场验证为正常显示。
## 2026-08-20：网页媒体保存至 Eagle 2.4.4

- [x] 修复小红书整帖把头像、评论表情和 UI 图导入的问题；正文专用过滤器只允许可证明的正文媒体。
- [x] 图片导入改为 JPG：WebP/PNG/GIF 等非 JPG 位图在扩展内安全转码，未经 JPEG 验证不写入 Eagle。
- [x] 最近文件夹按 Eagle API 顺序置顶（实机 API 第一项为“海外素材”），点击文件夹立即建立任务；移除冗余“确认导入”步骤。
- [x] 右键入口覆盖页面、链接、图片和视频，并动态显示单张图片/视频保存或平台整体保存。
- [x] 66/66 测试、语法检查与差异检查通过；稳定包连续两次 SHA-256 一致：`58a869ff5a1855a22eb2c790c3a55612c34fba8bb09da251ef12b8efbb6f83a1`。
- [ ] Chrome 扩展页被当前自动化 URL 策略阻拦，待用户手动重载 2.4.4 后完成真实 Chrome/Eagle 分层验收；不以源码和发布包门禁替代真实 JPG 文件类型与界面可见证据。

## 2026-08-20：网页媒体保存至 Eagle 2.4.4 Service Worker 热修复

- [x] 修复 Chrome 扩展页显示“Service Worker（无效）”：移除了 Chrome 不存在的 `contextMenus.onShown`
  监听，避免后台启动时崩溃。
- [x] 加入回归断言并完成 66/66 自动测试、语法检查、差异检查和重新打包；热修复包 SHA-256：
  `3caa426a5ae7412b6cca3064486783e84be1477395248effde0edaaefbc0b0dc`。
- [ ] 等待 Chrome 重载后确认实机 Worker 正常，再继续右键菜单与 Eagle 分层验收。

# 2026-08-28：v1.2 file:// renderer 资源加载红灯，v1.3 修复收口

- [x] v1.2 唯一正式安装后，真实 renderer 仍显示“等待 Eagle...”，未取得 Library/集合/成员身份；未执行真实排序、拖拽、改名或锁定。
- [x] 新增 file:// 资源加载错误可见性门禁：fetch 挂起时先红；修复后通过有限超时、XHR 优先（file://）与 fetch 回退，失败统一放行 Eagle 原生并写入面板错误。
- [x] 下一次正式安装身份按已安装 v1.2 递增为用户版本 v1.3、package/manifest 1.3.0；唯一产物名 `Eagle排序助手-v1.3.0.eagleplugin`。
- [ ] 仅项目总管可从唯一正式根构建并安装 v1.3；本专项不得自行构建/安装；安装后须重新进行实体 Eagle renderer 首红灯复验。
# 2026-08-29：Eagle 排序助手 v1.7 原生排列入口与计数红灯（进行中）

- 已将日常排序入口约束为 Eagle 原生“布局方式/排列方式”弹窗；独立面板仅保留版本、总开关、状态与诊断。
- 已在唯一正式源码加入 v1.7 安装前失败门禁：独立面板不得出现排序/编号/锁定/状态控件；原生布局注入存在且不得写 Eagle 原生计数。
- 实机只读观察：照片 Library `引力环球.library`、普通集合 `4-英国站🇬🇧`、集合 ID `MPB2IRPBMIUTX`；插件快照与侧栏均为 1,188。`396/1831` 仍待原生视图语义核对，未执行真实写入。

# 2026-08-31：Eagle 排序助手 v1.9 拍摄时间排序修复（安装前）

- [x] v1.8 正式安装在 `4-英国站🇬🇧` 复现拍摄时间升序未兑现；真实数据动作已停止。
- [x] 先红后绿加入唯一拍摄时间来源门禁：识别 Eagle item 同语义字段，禁止导入/创建/修改时间替代，并保留缺失时间槽位规则。
- [x] 排序写入后增加宿主完整数组、筛选投影、当前可见网格逐项核对和首个反例诊断；核对完成前不保存本次顺序。
- [x] 唯一可安装身份已统一为 `v1.9 / 1.9.0`，预期产物 `Eagle排序助手-v1.9.0.eagleplugin`。
- [x] 完整安装前代码检查与第二来源审计已完成；由项目总管生产构建和唯一安装，专项不自行构建安装。

# 2026-09-12：Eagle 排序助手 v1.17 当前层操作分离（安装前）

- [x] 唯一正式根已把普通父级直属文件夹与普通叶子直属媒体分为两种互斥目标，编号预览/确认分别进入 folder/item owner；文件名编号保持用户的无新增分隔符格式。
- [x] 紧凑原生排列入口、全局/本地规则命令、晚开/卸载生命周期、配置“应用到全部”零隐式改名及状态持久化已完成先红后绿安装前门禁。
- [x] 唯一可安装身份为 v1.17/1.17.0，预期产物 `Eagle排序助手-v1.17.0.eagleplugin`；专项未构建、未安装、未写真实数据。
- [x] 总管 UI 复核退回后，已把规则来源操作和状态文件入口从常驻主区收进默认关闭的高级设置；新增真实节点门禁验证摘要来源、折叠归属和卸载行为，不再以字符串存在冒充界面结构。
- [ ] 项目总管审核后精确清理既有 v1.16 release 两文件，完成唯一生产构建与安装；再由原专项在实体 Eagle 完成完整成员、真实 EXIF、父级/叶子/智能、L0 和性能验收。

## 2026-09-12：项目总管唯一接管与排序主线恢复

- [x] 新唯一项目总管确认为 `01a095da-9b45-7890-b469-387d9a1030ec`；故障总管
  `01a03439-a1d2-7e81-bb8c-540eba5cdc28` 与更旧 `019f8f8e-0465-7491-9dde-44a026e3dfc7`
  只保留历史，不再接收派发或专项主动回报。
- [x] 只读核对当前身份：正式源码 `1.17.0`，正式安装 `1.16.0`；历史
  `2.5.22-qa.113/API189` 不再作为当前版本事实。
- [x] 已恢复唯一排序专项 `01a04308-2871-7de3-ad83-2ede4324223f`，明确所有主动回报只发
  新总管；同排序域历史专项不并发写入。
- [x] 专项执行通道已取得明确终态：同任务在模型恢复时失败为
  `function_call_output requires call_id on HTTP requests; continuation via previous_response_id is only
  supported on Responses WebSocket v2`；不再向其发送消息或 fork，归档保留历史。
- [x] 总管只读证据审计确认退回项未完成：adapter SHA
  `e2e5b28d11daab080f6c8f90e980003c664ca41b27b67d7f37b18dfa2f0f3782` 仍构造三个来源按钮，
  现有两个 UI 门禁和两份权威文档仍要求它们存在；Graphify 当前图无匹配节点，未用旧图替代磁盘事实。
- [ ] 待用户明确授权创建干净的同项目可见排序替代专项；新专项先把该现状写成真实节点红灯，再由
  `native-layout-adapter` 最小 owner 修复：
  UI 全树移除三个来源按钮，次级 details 改为“排序记录”且只保留导出/加载；runtime/core
  内部规则能力和 Eagle 原生“使用全局设置”路径保持不变。
- [x] 原 heartbeat `eagle` 未重复创建；已把 target/prompt 从失败接管任务迁到当前唯一总管
  `01a095da-9b45-7890-b469-387d9a1030ec`，保留每 5 分钟与静默策略并设为 ACTIVE。
- [ ] 证据审核通过后，由总管一次性向用户请求精确范围：v1.16 两个 release 文件删除、
  v1.17 生产构建/唯一安装、Eagle 正常重启、重新核验的真实普通/智能位置只读与写操作、
  普通集合批量编号/改名。未获授权前全部冻结。
- [ ] 安装后由原专项完成完整成员、真实 EXIF、父级/叶子/智能、手动锁定、编号配置持久化、
  L0 与性能合同；总管只能登记 `已安装，等待用户验收`，用户确认后才能登记 `已验收`。
