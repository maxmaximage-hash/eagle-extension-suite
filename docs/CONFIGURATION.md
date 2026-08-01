# 配置与 API

## 不需要 API Key 的功能

以下功能全部本地运行：

- 普通/智能文件夹排序与手动拖动；
- 排序锁定、编号预览和安全改名；
- 图片 EXIF/视频元数据时间读取；
- GPS 解析和离线地域标签；
- 水印、马赛克、模糊、文字标注、字体预览与本地导出；
- 团队排序 sidecar 同步。

自动标签使用仓库内的离线行政区划数据，不调用地图 API，不上传媒体或坐标。

## MAX Publisher 本地配置

配置保存在当前用户的 Eagle Application Support 下，不进入仓库：

```text
~/Library/Application Support/Eagle/MAX Publisher/config.json
```

主要配置包括：

- 本地导出目录、格式、尺寸、质量/文件大小和同名策略；
- 水印预设、字体收藏和分类；
- 线上发布标签（默认 `线上展示`）；
- Cloudflare Pages 项目名、项目目录和公开地址。

不要把该文件复制到 GitHub。团队成员应在自己的电脑分别设置本地路径和账号凭据。

## Cloudflare Pages（可选）

本地交互登录：

```bash
npx wrangler login
```

自动化环境可使用环境变量：

```bash
export CLOUDFLARE_API_TOKEN='在本机安全输入'
export CLOUDFLARE_ACCOUNT_ID='在本机安全输入'
```

规则：

- 不把 token 写入 `config.json`、README、命令历史、GitHub Issue 或截图；
- `.env` 已被 Git 忽略，但仍优先使用系统钥匙串、CI Secret 或当前 shell 临时变量；
- 发布数据和 Eagle 原图不进入源码 Git；
- `pagesRoot` 指向用户自己准备的 Cloudflare Pages 项目目录。
