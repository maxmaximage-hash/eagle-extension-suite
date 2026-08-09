# 网页媒体导入器协作规则

## 归属

- 本目录是独立 Chrome 扩展，不属于排序、GPS/标签或水印/发布业务实现。
- Eagle 差异仅在后台公开 API adapter；采集与队列核心不得读取 `.library` 或排序 sidecar。

## 安全边界

- 仅在用户点击扩展按钮或右键菜单后采集当前网页。
- 仅处理用户有权访问、当前页面已加载、具有直接 HTTP(S) 文件地址的媒体。
- `blob:`、`data:`、`.m3u8`、`.mpd`、DRM、加密和不可直接下载源必须明确拒绝。
- 不绕过登录、访问控制、反爬或站点限制，不做自动翻页和创作者主页批量爬取。
- 只调用 Eagle 公开 localhost API；禁止修改 `app.asar`、`.library` 或 NAS 原素材。

## 验证

- 修改前先写失败测试；`npm test`、`npm run check` 和 `npm run package:stable` 必须通过。
- 自动测试与 API `success` 只证明源码门禁和请求已接收；不得冒充真实 Chrome/Eagle 可见验收。
- 真实安装、账号页面、Eagle 或 Library 操作必须另获用户明确批准。
