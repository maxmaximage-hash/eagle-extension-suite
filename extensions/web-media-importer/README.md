# 网页媒体保存至 Eagle 2.0

这是一个独立 Chrome MV3 扩展。它不是“全网页破解器”：用户明确触发后，先识别当前帖子/当前内容，
再下载归属明确的公开媒体；下载完成后验证真实文件，最后通过 Eagle 公开本地 API 交给普通文件夹。

## 平台能力

| 平台 | 图片/封面 | 视频 |
| --- | --- | --- |
| 微博 | 仅博文详情 URL 的当前帖子图片；不收头像/推荐图 | 搜索、首页、用户时间线拒绝整页采集 |
| B站 | 当前视频 `og:image` 封面 | 常见 DASH/分轨/音轨不明会阻止，不导入无声视频 |
| 抖音 | `/video/<id>`、`/note/<id>` 或数字 `modal_id` 的当前作品 | 搜索/推荐列表拒绝采集；`blob:`、分片、音轨不明会阻止 |
| YouTube | 当前 watch/shorts 视频封面 | 不支持第三方下载；本人视频先走 YouTube 官方下载/导出 |
| 其他网页 | 唯一 `article/main` 内容或右键选中的图片 | 仅限可证明完整且含声音的直连文件 |

页面仍未加载的轮播项不会被伪称为完整；能够读取总数时，确认框会提示可能遗漏的数量。当前页面有多个
帖子且无法唯一归属时，扩展会停下，要求在目标图片或视频上右键。

## 安全链路

1. 默认每批最多 25 项、单项 1 GiB、整批 2 GiB；可在扩展弹窗调整。
2. 用户选择 Eagle 普通文件夹并勾选确认项目数/估计大小，任务才建立。
3. 每个文件独立持久化：pending、downloading、downloaded、validated、accepted、confirmed。
4. Chrome 下载后检查真实 MIME、大小、最终 URL、危险状态、类型与扩展名；HTML/JSON/空文件拒绝。
5. Eagle `success` 只是 accepted；返回 ID 且公开 API 读回才 confirmed。
6. 只有 confirmed 缓存会在 24 小时后按精确 downloadId 清理；accepted_unconfirmed 不清理。

MV3 worker 重建或浏览器重启后会恢复队列。Chrome 明确允许续传时才 resume；否则任务显示中断。
取消不会删除已经 accepted/confirmed 的 Eagle 项。Eagle 提交失败时优先复用已 validated 缓存。

扩展不会向 Chrome Downloads 注入 Referer、Cookie、Authorization 或 token。平台登记 CDN 使用 Chrome
原生网络上下文，并在队列标记 `requires-browser-validation`；因此 B站/抖音视频必须经过真实 Chrome
验收后才能称为该版本稳定能力。自动测试只能证明规则，不证明站点当前允许下载。

`accepted_unconfirmed` 会按退避计划重新读取既有 Eagle item ID，也可在 popup 点击“重新确认已接收项”；
这条链不会再次调用导入 API，因此不会为了确认而制造重复素材。

签名媒体 URL 只在本次浏览器会话内短期保存；长期队列和 Eagle 来源不会保存 token、签名或账号凭据。
扩展不会自定义 Cookie、Authorization 或 token header，也不绕过登录、DRM、反爬或平台权限。

## 验证与打包

```bash
cd extensions/web-media-importer
npm test
npm run check
npm run package:stable
```

包位于仓库根 `releases/网页媒体保存至Eagle-Stable/`。发布包只含运行脚本、manifest、popup 和本说明，
不含测试、账号、队列、缓存、Library/NAS 路径或密钥。

## 安装与使用

1. 获得安装批准后，在 Chrome 打开 `chrome://extensions/` 并启用开发者模式。
2. 加载本目录或打包目录 `eagle-web-media-importer`。
3. 打开 Eagle 和目标资源库；打开自己有权保存的网页。
4. 点击扩展的“保存当前帖子/内容”，或在目标媒体上右键。
5. 检查数量、估计大小、阻止/遗漏提示，选择普通 Eagle 文件夹并确认。
6. popup 中区分“API 已读回、待确认、失败/阻止”；不能把 accepted_unconfirmed 当作已完成。

`2.1.0` 在 `2.0.1` 平台门禁基础上重新设计扩展卡片说明、图标和弹窗：明确“大多数普通网页图片可右键保存”，
将“扫描当前帖子/页面”作为多媒体入口，并用人话说明 YouTube 封面、受保护流媒体、临时链接与站点限制。
同时修复普通网页图片常由独立 CDN 提供却被误拦的问题：只有用户明确右键选择的公开 HTTPS 图片可以跨站进入
Chrome 原生下载与 MIME 验真；页面扫描、视频和内网地址不会获得这项放宽。
右键“保存当前媒体”严格只处理浏览器传入的这一张图片或这一个媒体，不会因为它位于 `article/main` 中就
扩张为整篇网页；需要批量候选时必须显式使用“扫描当前帖子/页面”。
`2.0.1` 已以未打包扩展安装到本机真实 Chrome。已实测通用无媒体页 fail-closed、单图右键候选、
YouTube 封面边界、B站 DASH 阻止、抖音搜索页拒绝与当前 `modal_id` 作品识别。尚未向真实 Library 提交导入；
微博真帖因 Chrome 未登录尚未验证。
