# 任务

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
