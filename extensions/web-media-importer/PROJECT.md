# 项目档案

- 项目名称：网页媒体保存至 Eagle
- 类型：Chrome MV3 扩展 / Eagle 外部导入工具
- 当前源码版本：`2.4.2` 稳定发行候选
- 标准源码：本目录
- 发布目录：仓库根 `releases/网页媒体保存至Eagle-Stable/eagle-web-media-importer`

## 最终产品语义

用户明确点击或右键后，扩展先证明“当前帖子/当前内容”的归属，再由站点 adapter 只输出该内容内
已经加载的公开媒体候选。下载完成后必须依据 Chrome `DownloadItem` 的真实 MIME、大小、最终地址、
危险状态和扩展名再次验真；只有普通 Eagle 文件夹可作为目标。

后台以单项持久事务运行：`pending -> download_starting -> downloading -> downloaded -> validated -> submitting -> accepted -> confirmed`。
Eagle API `success` 只代表 accepted；返回 ID 且公开 API 可有界读回后才是 confirmed。没有 ID 或读回
失败时保留 `accepted_unconfirmed`，缓存不会自动删除。下载 ID 或 Eagle 接收结果在交接点中断时分别
进入 `download_unknown` / `submission_unknown`，两者均禁止自动重试，避免重复下载或重复素材。

## 平台边界

- 微博：仅博文详情 URL 内当前帖子的已加载图片；搜索页、首页和用户时间线拒绝采集。
- B站：当前视频封面；页面公开的单段渐进 MP4/MOV/M4V 或 FLV 只有在容器可证明同时有音频和视频时才允许。DASH、分轨和多段 `durl` 都会阻止，绝不把连续片段误导入为多个残片。
- 抖音：仅 `/video/<id>`、`/note/<id>` 或带数字 `modal_id` 的当前作品；搜索/推荐列表页拒绝采集。
- Instagram：仅用户在当前帖媒体上显式触发的 `article`。轮播由扩展临时遍历并恢复原页，未能读取的项必须以遗漏数提示；不将网格、推荐或其他帖子混入。
- 小红书：仅 `/explore/<id>` 或 `/discovery/item/<id>` 笔记详情页中归属唯一、已加载的媒体；首页、发现流和多卡片页面拒绝整体保存。`xhscdn.com` 直链仍经 Chrome 原生下载上下文与下载后验真。
- YouTube：只保存当前视频封面。本人视频须走 YouTube 官方下载/导出后再导入 Eagle。
- 通用网页：仅处理归属唯一的 `article/main` 内容或用户右键选中的媒体。

不绕过登录、访问控制、DRM、反爬或平台权限；不解析 `.library`，不修改 `app.asar`，不持有 NAS 路径。
