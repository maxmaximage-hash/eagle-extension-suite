# 发行范围与已知限制

## 冻结基线

- 排序冻结行为：`2.5.22-qa.26 / API103`
- 媒体智能整理发行：`2.5.22-qa.27 / API104`（仅增加首次标签安全与 ffprobe 诊断）
- MAX Publisher：`1.2.7`（`sharp 0.35.3` 安全基线）
- 目标宿主：Eagle `4.0.0`
- 基线日期：`2026-07-29`

未来功能必须保留该基线的普通文件夹和智能文件夹排序行为，并继续运行永久回归合同。

## 不进入仓库

- Eagle `.library` 和任何素材；
- 团队排序 sidecar；
- `geo-tag-state.json`、拍摄时间/GPS 缓存、诊断日志、窗口状态；
- NAS/iCloud 路径和搬运台账；
- MAX Publisher `config.json`、`state.json` 和线上业务图片；
- Cloudflare token、API Key、账号信息；
- Eagle `app.asar`、宿主备份或任何 Eagle 二进制；
- QA Library、历史候选和安装备份。

## 已知限制

- 媒体智能整理原生排序入口受 Eagle 版本和既有、已审计宿主通信能力约束；官方 Eagle 4 插件 API 不足以单独实现主网格 1:1 排序。未知或缺少该能力的全新宿主必须拒绝安装，仓库不会修改 `app.asar`。
- 智能文件夹只排序当前 Eagle 查询结果，不自动编号、不改名、不改来源普通文件夹。
- 团队 sidecar 解决插件顺序同步，不把 Eagle Library 变成支持多人同时写入的数据库；团队仍应避免多电脑同时改同一 Library。
- 自动地域标签依赖素材实际包含可读取的 GPS/视频位置字段；没有 GPS 的素材不会凭空推断地点。
- 字体仅能使用目标电脑实际安装并可读取的字体；仓库不分发商业字体文件。
- Cloudflare Pages 是可选暂用发布流程，需用户自己的 Cloudflare 项目和登录。
