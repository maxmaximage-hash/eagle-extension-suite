# 项目档案

- 项目名称：网页媒体保存至 Eagle
- 类型：Chrome MV3 扩展 / Eagle 外部导入工具
- 当前源码版本：`2.0.0` 候选
- 标准源码：本目录
- 发布目录：仓库根 `releases/网页媒体保存至Eagle-Stable/eagle-web-media-importer`

## 最终产品语义

用户明确点击或右键后，扩展先证明“当前帖子/当前内容”的归属，再由站点 adapter 只输出该内容内
已经加载的公开媒体候选。下载完成后必须依据 Chrome `DownloadItem` 的真实 MIME、大小、最终地址、
危险状态和扩展名再次验真；只有普通 Eagle 文件夹可作为目标。

后台以单项持久事务运行：`pending -> downloading -> downloaded -> validated -> accepted -> confirmed`。
Eagle API `success` 只代表 accepted；返回 ID 且公开 API 可有界读回后才是 confirmed。没有 ID 或读回
失败时保留 `accepted_unconfirmed`，缓存不会自动删除。

## 平台边界

- 微博：当前帖子容器内已加载图片；多图未加载数量会提示。
- B站：当前视频封面；视频只有页面公开完整单文件且能证明含声音时才允许，常见 DASH 分轨会阻止。
- 抖音：当前作品容器内已加载图片；`blob:`、分片或声音不明视频会阻止。
- YouTube：只保存当前视频封面。本人视频须走 YouTube 官方下载/导出后再导入 Eagle。
- 通用网页：仅处理归属唯一的 `article/main` 内容或用户右键选中的媒体。

不绕过登录、访问控制、DRM、反爬或平台权限；不解析 `.library`，不修改 `app.asar`，不持有 NAS 路径。
