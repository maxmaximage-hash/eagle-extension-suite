# 决策记录

## 2026-08-09：网页图片右键保存是首要入口

- 弹窗首屏必须先解释“大多数普通网页图片可右键保存”，不能让用户误以为只能扫描帖子。
- “扫描当前帖子/页面”是多媒体批量入口，仍必须执行归属证明、用户确认和文件真实性校验。
- 不使用“所有网页图片都能下载”的绝对表述；画布、临时 blob、登录限制、防盗链、流媒体与 DRM 必须明确说明限制原因。
- 用户明确右键选择的普通 HTTPS 图片允许来自页面之外的公开 CDN，并继续交给 Chrome 原生下载上下文与下载后 MIME 校验；页面扫描仍只允许同站或登记 CDN。
- 该例外不适用于视频、HTTP 地址、localhost、局域网或私有网段，避免把单图便利性扩大成跨站批量下载权限。
- 私网判断只识别明确的本机、IPv4/IPv6 私网字面量；不能用 `fc`/`fd` 等字符串前缀误伤同名公网域名。
  IPv4 映射 IPv6、ULA、链路本地和回环地址仍一律阻止。
- 右键“保存当前媒体”是严格单项语义：一旦浏览器传入所选媒体 URL，内容脚本只为该 URL 建立一个候选，
  不得再把它所在的 `article/main` 当作整帖授权。整帖/整页枚举只能来自单独的扫描入口。

## 2026-08-09：2.0 以归属证明、文件验真和二阶段 Eagle 确认为真源

- 整页媒体标签不等于当前帖子。站点 adapter 只能读取用户当前已加载的公开 DOM/结构化元数据；
  当前内容归属不唯一时必须拒绝，提示用户在目标媒体上右键。
- `kind=image/video` 不是文件事实。候选 URL 先做协议/流/分轨检查，下载后再以 Chrome DownloadItem 的
  MIME、字节数、危险状态、最终地址和扩展名验真；HTML 登录页、JSON 和零字节永久回归。
- MV3 长任务拆成每项独立持久事务。每次状态变化先写本地队列；下载事件、worker 每次重建、浏览器启动
  都可以恢复。活动下载只在 Chrome 明确 `canResume` 时 resume，否则留下可解释失败。
- 页面签名 URL 是短期凭据，只存在 `chrome.storage.session`；长期队列保存脱敏地址与 requestRef。
  Chrome Downloads 不注入 Referer、Cookie、token 或 Authorization；登记跨站 CDN 标记
  `requires-browser-validation`，由真实 Chrome 验收浏览器原生网络上下文。
- B站/抖音视频必须同时证明为直接 HTTP(S) 完整单文件且含声音；常见 DASH/分片/`blob:`/音轨未知状态
  一律 blocked。YouTube 只支持封面，不实现第三方视频下载或官方权限绕过。
- 实机对抗审查证明“屏幕中心卡片”不能作为平台内容所有权证据。抖音只有详情路径或数字 `modal_id`，
  微博只有已登记的博文详情路径才可进入平台 adapter；搜索、首页、推荐与用户时间线必须 fail-closed。
- Eagle API `success` 只记 accepted。返回 item ID 并能通过公开 `/item/info` 有界读回后才 confirmed；
  无 ID 或读回失败保持 accepted_unconfirmed。只有 confirmed 项可延时精确删除对应下载缓存。
- accepted_unconfirmed 通过退避 alarm 或手动按钮只重新读既有 item ID，不重复调用 addFromPath。
- 取消只终止 pending/downloading/downloaded/validated，不能撤销 accepted 或 confirmed；Eagle 提交失败时
  保留已 validated 文件供重试，格式错误/危险下载则精确清除。

## 2026-08-09：1.0 直连入口由 2.0 兼容迁移取代

- 1.0 的显式触发、安全直连、不碰 `.library` 和普通文件夹边界继续保留。
- 1.0 的“整页扫描、串行长消息、API success 后定时清理”不再有效：它们分别被 provider registry、
  可恢复状态机和 confirmed-only 清理取代。
- 1.x 历史 accepted 记录无法证明真实可见，升级时只能迁移为 accepted_unconfirmed；不得补写 confirmed。
