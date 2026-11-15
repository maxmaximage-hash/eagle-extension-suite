# 任务

## 2026-09-24：2.4.4 升级审查（只读）

- [x] 完成代码、graphify 架构图、现有测试和发布脚本审查；当前 `npm test` 为 66/66，`npm run check` 和稳定打包通过。
- [ ] P1：图片转 JPG 目前对所有 `image` 都执行 `transcodeImageToJpeg()`；应只对非 JPEG 输入转码，并评估大图经 base64 data URL 进入 `chrome.downloads.download()` 的内存峰值。
- [ ] P1：`normalizePositiveBytes()` 没有上限，弹窗的单项/整批 MB 输入也没有 `max`；应把配置上限钳制到产品安全边界，并增加回归测试。
- [ ] P1：`contextMenus.onClicked` 直接返回 `openCollector()` Promise，异常没有统一反馈；应补充可见错误提示和 MV3 事件处理测试。
- [ ] P1：`initializeQueues()` 在 `onInstalled`、`onStartup` 和文件末尾启动调用中可能并行执行；应增加一次性启动 promise，覆盖迁移、恢复和重复事件测试。
- [ ] P2：补充 Chrome API + Eagle API 的集成测试（下载中断/恢复、取消竞态、accepted_unconfirmed 读回、JPEG 转码），当前 66 项主要是纯函数和源码契约测试。
- [ ] P2：按 graphify 低内聚热点拆分 `background.js`（队列、下载、Eagle API、清理）和 `content.js`（采集、轮播、文件夹选择器、悬浮操作），先保持接口和安全门禁不变。
- [ ] P2：同步 `README.md` 与 `PROJECT.md` 的版本号（仍写 2.4.2，manifest/package/popup 已是 2.4.4）。
- [ ] P2：推荐流场景的主按钮当前只是禁用态；保留 fail-closed 语义，同时把“请在封面上右键保存单张”做成明确可执行提示，避免用户把禁用按钮理解成插件失效。
- [ ] P2：本次同一源码两次打包均得到 `3caa426a5ae7412b6cca3064486783e84be1477395248effde0edaaefbc0b0dc`，与历史记录中的 2.4.4 SHA-256 `58a869ff5a1855a22eb2c790c3a55612c34fba8bb09da251ef12b8efbb6f83a1` 不一致；发布前应核对源码基线、版本记录和发行包来源。

## 2026-08-20：2.4.4 小红书正文、JPG 与一键文件夹导入

- [x] 小红书整帖改为专用正文媒体收集器：只接受可见的大尺寸正文图片/视频；头像、评论、回复、表情、贴纸、图标和 URL/属性带有相应证据的图片一律排除。无唯一笔记容器仍 fail-closed。
- [x] 所有非 JPG 图片在 MV3 service worker 内经无凭据读取、最终来源检查、50 MiB 源文件上限、48 MP 解码上限与 `OffscreenCanvas` 转为 JPEG；只有 `image/jpeg`、`.jpg` 的下载缓存可进入 Eagle。SVG、错误 MIME、不可解码或超限资源不会回退导入原格式。
- [x] 文件夹选择器按 Eagle `/folder/listRecent` 原始顺序置顶最近使用项（当前实机 API 第一项为“海外素材”）；点击普通文件夹立即建立任务，移除“确认导入”复选框与二次按钮。后台仍在创建、重试和提交前验证普通文件夹。
- [x] 右键统一为一个动态入口，覆盖页面、链接、图片和视频：媒体右键为单张保存，非媒体右键保持平台感知的整体保存；单张不会扩大为整帖扫描。
- [x] 66/66 自动测试、全部 JS 语法检查和 `git diff --check` 通过；两次确定性打包 SHA-256 一致：`58a869ff5a1855a22eb2c790c3a55612c34fba8bb09da251ef12b8efbb6f83a1`。
- [ ] Chrome 的 `chrome://extensions/` 被当前自动化 URL 策略阻拦，不能通过旁路重载；待用户手动重载 2.4.4 后，依次验证小红书封面单张、详情正文整帖、最近文件夹置顶、JPEG 文件类型与 Eagle 界面可见性。用户触发导入前不写入 Library。

## 2026-08-16：2.4.3 推荐流封面单张保存与详情悬浮入口

- [x] 根据用户新截图修正产品边界：推荐流封面是用户明确指向的一张媒体，应可单独保存；它不能被当作整帖范围。
- [x] 小红书与 Instagram 信息流的“链接右键”现在会把本次右键事件中的实际 `img/video` 作为唯一候选；若不是媒体则明确提示，不扫描卡片、页面或推荐流。
- [x] 在可见图片/视频悬浮时加入直接操作：`保存当前图片/视频至 Eagle`；在可唯一确认的详情页额外提供动态命名的整帖按钮。小红书整帖只锚定详情对话框/笔记容器，无法确认时停止并建议使用单张保存。
- [x] 64/64 自动测试、全部运行脚本语法与差异检查通过；稳定包连续两次 SHA-256 一致：`2bccc4d295c7addc3b53d33b4647401aae7e0823dcb2cf4d0e363f1f824fee95`。
- [ ] Chrome 正在运行，但本机 Chrome 控制通道目前不可通信；无法代替用户点击扩展重载或把源码测试写成 Eagle 可见验收。待手动重载 2.4.3 并刷新目标页后，按“推荐流封面单张 → 详情当前图 → 详情整帖 → Eagle 可见”顺序做真实验收。

## 2026-08-16：2.4.2 右键可发现性与推荐流诚实状态

- [x] 用户真实截图证明：小红书推荐卡片右键被 Chrome 识别为链接，旧 `image/video` 菜单不会出现；同时 popup 错把推荐流显示为可保存整帖。
- [x] popup 改用 URL 级 action 资格：推荐流禁用并解释“请先打开一条笔记”，详情页才启用整帖；页面/链接右键菜单同步显示并禁用同一说明。
- [x] 新增小红书/Instagram 信息流不承诺整帖的失败测试；`npm test` 62/62、`npm run check`、`git diff --check` 通过。
- [ ] 待用户手动重新加载 2.4.2 后，在真实小红书详情页验证右键可见性、整帖候选和 Eagle 可见写入。

## 2026-08-16：2.4.1 平台感知整体保存命名

- [x] 将 Instagram、小红书和未识别平台的整体保存文案收敛为 provider 标签；弹窗、右键页面菜单和文件夹确认标题不再各自硬编码。
- [x] 小红书新增详情页门禁、当前笔记候选范围和 `xhscdn.com` 登记 CDN；首页/发现流/归属不明内容 fail-closed，单图右键不扩大。
- [x] 新增平台命名、小红书详情页与 CDN 回归用例；`npm test` 61/61、`npm run check`、`git diff --check` 通过；两次稳定打包 SHA-256 一致：`4303998faead7c88bdb1bb42b7b59f836c4b82ff8ef3d642498127488994694c`。
- [x] 发行包对抗检查：zip 完整性、白名单文件、包内 JS 语法和源码逐文件一致性通过；Eagle 4.0.0 的公开 API 可读，普通文件夹列表可用。
- [ ] Chrome 自动化策略禁止访问 `chrome://extensions/`，无法代替用户点击重新加载；待用户手动重新加载 2.4.1 并刷新目标页面后，才能进行真实下载、文件夹确认、Eagle 写入和 UI 可见验收。

## 2026-08-16：2.4.0 网页媒体可靠性与 Instagram 整帖迭代

- [x] 以用户提供的三张截图、现有扩展代码和历史 Instagram 扩展为证据，完成保存链路、范围、交互和边界的对抗性审查；记录见 `docs/audit-2026-08-16/REPORT.md`。
- [x] 为 Instagram 增加独立 provider、受限的跨站 CDN 许可、整帖右键入口与轮播媒体收集；只接受被用户选中的单个帖子，收集后恢复原轮播位置，单图右键不扩大为整帖。
- [x] 文件夹选择器增加“最近使用”、更清晰的候选/阻止/遗漏说明、对话框语义与 Escape 退出；确认勾选与普通文件夹门禁保留。
- [x] 新增 Instagram 归属与 CDN 回归测试；`npm test` 59/59、`npm run check`、`git diff --check` 通过。
- [ ] 未获授权在真实 Chrome、Instagram 账号页或 Eagle Library 写入；不能将源码门禁写为实机导入成功。

## 2026-08-10：2.3.1 小红书 SPA 右键竞态修复

- [x] 选中单图右键时允许页面路由在消息交付期间变化，只要该媒体仍存在当前 DOM；整页扫描继续严格校验页面身份。
- [x] 58/58 自动回归、六个运行脚本语法检查和 `git diff --check` 通过；两次打包 SHA-256 一致：
  `49a0aa0bfa64dd570163e41a55f9a32a365fcb26a3cbbc2084f33acb7de99602`。
- [ ] Chrome 控制层读取小红书页面仍持续超时；2.3.1 尚未在真实 Chrome 重新加载，因此不能把源码门禁写成实机通过。

## 2026-08-10：2.3.0 最终完整性审查与稳定发行候选

- [x] 修复普通网页、微博等可信直连视频在页面未能直接证明音轨时被过早拒绝的问题；无扩展名直连视频可进入
  MIME 与容器探测，但 HLS/DASH/blob/分轨仍在下载前阻止。
- [x] 下载前先尝试无凭据 HEAD；CDN 拒绝 HEAD 时仅回退读取 `Range: bytes=0-0` 的响应头，避免为预检下载正文。
- [x] B站多段 `durl` 被认定为一个分片视频而不是多条独立视频，永久阻止残片导入；空/陈旧的早期
  `__playinfo__` 不会遮蔽后续有效数据。
- [x] 58/58 自动回归、六个运行脚本语法检查和 `git diff --check` 通过。
- [x] 两次确定性打包得到同一 SHA-256：
  `c0403b3a111128200f9c5aa9d3ccc03e6b8ab9d67fd70e30709f225882dd98c8`；打包流程不再清空历史发行包，
  以保留可回滚版本。
- [ ] 真实 Chrome 和 Eagle 可见验收仍未完成：现有 Chrome URL 策略阻止了本轮对扩展页的自动访问，且本轮未
  获得新的真实 Eagle 写入授权。源码与发布包门禁不能替代这两项验收。

## 2026-08-10：2.2.0 事务与媒体真实性对抗审查（已由 2.3.0 取代）

- [x] Chrome 下载与 Eagle `addFromPath` 前均先持久化交接状态；worker 在这两个窗口重建分别进入
  `download_unknown` / `submission_unknown`，永不自动重复下载或重复提交。
- [x] 下载完成后再次校验最终地址；跨站、私网、协议降级或非法跳转精确删除下载缓存并阻止提交。
- [x] Eagle `confirmed` 除同 ID、未删除外，还必须属于用户选定的普通文件夹；未证实项保持
  `accepted_unconfirmed`，只读回既有 ID。
- [x] 取消、历史批次淘汰和队列并发均精确清理自己的下载缓存与 session 凭据；取消覆盖下载 ID 未返回、
  下载校验和 Eagle 提交前的三个竞态窗口，不能让取消后的项目继续进入 Eagle。
- [x] SVG 主动内容、私网 IPv4/IPv6、异常长 URL、HTML/JSON 伪媒体、扩展名冲突和未验证格式永久拒绝。
- [x] 视频只允许可验证的渐进完整单文件：MP4/MOV/M4V 解析 ISO-BMFF 的 `moov/trak/hdlr` 音视频轨；
  B站渐进 FLV 读取容器双流标志。HLS/DASH/blob/DRM、分轨或无法证明双流的容器保持阻止。
- [x] 51/51 自动回归、六个运行脚本语法检查及 `git diff --check` 通过。
- [ ] 2.2.0 尚未重新加载到真实 Chrome；真实 B站/抖音/微博的下载前探测、Chrome 实际下载和 Eagle
  accepted/confirmed/UI 可见仍必须在用户明确批准后分层验证，不能由源码门禁替代。

## 2026-08-09：2.0.0 对抗审查候选

- [x] 用 `generic/weibo/bilibili/douyin/youtube` provider registry 取代整页 `img/video/a` 扫描。
- [x] 无法唯一证明当前内容时 fail-open；头像、Logo、推荐内容不进入当前帖子计划。
- [x] YouTube 只输出当前视频封面；B站/抖音分轨、`blob:`、HLS/DASH 和音轨不明视频明确 blocked。
- [x] 下载后校验 MIME、真实大小、最终 URL、危险状态、媒体类型和扩展名；HTML/JSON/空文件不能伪装媒体。
- [x] 建立单项持久状态机、worker 重建启动恢复、下载中断 resume/失败语义、取消与重复事件幂等。
- [x] 原始签名 URL 只存 `chrome.storage.session`；本地长期队列和 Eagle 来源只保留脱敏页面 URL。
- [x] 不向 Chrome Downloads 注入 forbidden Referer/Cookie/Authorization；登记跨站 CDN 标记
  `requires-browser-validation`，须真实 Chrome 验证原生网络上下文。
- [x] 默认 25 项、单项 1 GiB、单批 2 GiB，可在 popup 调整；导入前必须确认项目数与估计大小。
- [x] Eagle 文件夹在创建任务、重试和实际提交前重复验证；只允许普通文件夹。
- [x] `success` 只记 accepted；有 ID 且公开 API 读回才 confirmed；无 ID 保持 accepted_unconfirmed。
- [x] 只有 confirmed 项在 24 小时后精确清理自身 `downloadId`；Eagle 失败时复用 validated 缓存。
- [x] accepted_unconfirmed 自动退避并可手动重新确认，只轮询已有 item ID，绝不重复导入。
- [x] 1.x accepted 队列迁移为 accepted_unconfirmed，旧任务中的签名 URL 不进入 2.x 长期存储。
- [x] 38 项自动测试与 JS 语法门禁通过（最终数字以根任务验收记录为准）。
- [x] 两次确定性 2.0.0 打包 SHA-256 一致：
  `1671d07bad41a96db58dd3bcedc9108550382fd505b477bd116f9050f14026ef`；包只含 9 个运行/说明文件。
- [x] 真实 Chrome 已安装本地未打包扩展，唯一 ID `mbkfbaifmiidlbeaknnhhpkmgidjgoik`。
- [x] 实机发现抖音搜索页被中心卡片误判为当前作品；`2.0.1` 增加详情 URL/`modal_id` 门禁，搜索页复测明确拒绝。
- [x] `2.1.0` 重构插件图标、Chrome 卡片说明和弹窗信息层级；主功能明确为普通网页图片右键保存，批量入口明确为扫描当前帖子/页面。
- [x] `2.1.0` 真实 Chrome 视觉验收通过；初次发现并修复弹窗右侧空白，展开说明与滚动内容可访问，结果记录于 `design-qa.md`。
- [x] 对抗审查发现普通网页跨站 CDN 图片会被网络门禁误拦；现仅对用户明确右键选择的公开 HTTPS 图片放行，页面扫描、视频和私有网络仍拒绝。
- [x] 真实 Wikipedia 右键单图曾错误扩张为正文 `main` 的 25 个候选；选中媒体现在在容器枚举前短路，
  严格只生成 1 项，页面扫描继续走独立入口；永久回归增至 43 项。
- [x] 对抗检查补齐 IPv6 回环、IPv4 映射 IPv6、ULA 与链路本地地址；同时消除 `fcdn.*` 等公网域名
  因字符串前缀被误判私网的隐藏回归。
- [x] `2.1.0` 修复后两次确定性打包 SHA-256 一致：
  `81b9942b09a695243958431e77b2aa6b45c9de2d07cb4b20830e259bb3653b47`；发布包只含 16 个目录/运行文件条目。
- [x] YouTube 真页仅 1 个当前封面候选且视频被阻止；B站真页仅 1 个封面候选且 DASH 被阻止。
- [x] 抖音带数字 `modal_id` 的当前作品实机可识别；单图右键可生成唯一候选。
- [x] 真实 Eagle 普通文件夹列表可只读获取，本轮没有提交导入、没有写 Library/NAS。
- [ ] 微博真帖因当前 Chrome 跳转登录页未验证；真实 Eagle 下载→接收→同 ID 读回链路仍需单独授权后执行。

## 下一门禁

用户明确批准后，才可把候选加载到 Chrome，并在用户有权访问的页面及低风险 Eagle 普通文件夹中
逐平台验证。测试必须分开记录“候选识别、文件验真、API accepted、公开 API confirmed、Eagle 界面可见”；
任何一层未通过都不能写成完整下载成功。

## 2026-08-20：2.4.4 Chrome Service Worker 启动修复

- [x] 找到实机扩展页“Service Worker（无效）”的启动根因：后台注册了 Chrome 不支持的
  `chrome.contextMenus.onShown`，加载时即抛异常，导致所有右键入口失效。
- [x] 删除该监听；页面切换时的平台整体保存标题更新保持不变，图片/视频右键保存仍由同一个稳定菜单入口处理。
- [x] 新增禁止该 API 的回归测试；`npm test` 66/66、`npm run check`、`git diff --check` 和稳定打包通过。
- [ ] 必须在 Chrome 扩展页重载后确认“Service Worker”不再显示“无效”；本条尚不是 Eagle 写入或 UI 可见验收。

## 2026-09-24：真实 Chrome/Eagle 能力复测

- [x] 真实 Chrome 当前扩展按钮可见，Service Worker 未显示为无效；小红书推荐流可正常加载。
- [x] 推荐流真实页面保持 fail-closed：没有提供整帖导入承诺，页面内容可见多个推荐卡片，符合“只能在封面上单张保存”的产品边界。
- [x] 打开真实小红书详情页后，页面悬浮入口同时显示“保存当前图片至 Eagle”和“保存当前小红书整帖至 Eagle”；详情页识别和入口文案符合预期。
- [ ] P1 现场问题：点击详情页单张入口时出现 `Extension context invalidated`，刷新页面后上下文恢复；需要在 content.js 捕获 `chrome.runtime` 上下文失效，提示用户刷新或自动重新注入，而不是只显示浏览器原生错误。
- [ ] P1 现场问题：Chrome 扩展页被当前浏览器 URL 策略阻拦，无法自动确认手动重载后的 Service Worker 状态；真实 Eagle 写入链仍需在入口修复后做一次低数量可见导入验收。
- [x] Eagle 桌面端真实运行，现有资源库和素材网格可见；本次未删除、未批量修改、未操作 NAS。

## 2026-09-27：现场问题修复
- [x] `content.js` 统一封装 `chrome.runtime.sendMessage`，捕获 `Extension context invalidated` 并提示刷新当前页面，避免把浏览器原生错误直接暴露给用户。
- [x] `npm test` 66/66 通过；`npm run check` 通过；未修改 Eagle Library 或 NAS 素材。
- [ ] 重新加载扩展后，在小红书详情页完成一次单张媒体到指定测试文件夹的真实导入验收。

## 2026-09-27：稳定性与资源边界升级
- [x] JPEG/JPG 不再重复进入 `OffscreenCanvas` 转码；只有非 JPEG 图片才转码，减少大图 CPU、内存和临时文件开销。
- [x] `maxItemBytes` 与 `maxBatchBytes` 增加硬上限（4 GiB / 20 GiB），弹窗输入同步显示上限，避免异常设置绕过批量资源边界。
- [x] Service Worker 的队列恢复改为共享一次性 Promise，避免 `onInstalled`、`onStartup` 与文件末尾启动同时迁移/恢复队列。
- [x] 自动测试 67/67、语法检查和差异检查通过；未修改 Eagle Library 或 NAS 素材。

## 2026-09-29：入口错误恢复升级
- [x] 右键菜单统一捕获采集失败，通过页面 Toast 显示原因，不再出现点击后无反馈。
- [x] 弹窗所有运行时消息统一经过错误保护；扩展更新导致上下文失效时提示重新打开弹窗。
- [x] 自动测试 68/68、语法检查和差异检查通过；未修改 Eagle Library 或 NAS 素材。
