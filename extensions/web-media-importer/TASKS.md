# 任务

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
