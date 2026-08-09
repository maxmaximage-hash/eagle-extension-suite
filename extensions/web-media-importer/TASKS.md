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
- [ ] 真实 Chrome / 微博 / B站 / 抖音 / YouTube / Eagle 尚未获准安装和操作，不得宣称现场通过。

## 下一门禁

用户明确批准后，才可把候选加载到 Chrome，并在用户有权访问的页面及低风险 Eagle 普通文件夹中
逐平台验证。测试必须分开记录“候选识别、文件验真、API accepted、公开 API confirmed、Eagle 界面可见”；
任何一层未通过都不能写成完整下载成功。
