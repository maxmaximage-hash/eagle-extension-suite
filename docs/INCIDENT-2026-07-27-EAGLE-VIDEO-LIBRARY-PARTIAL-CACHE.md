# 2026-07-27 引力环球视频 Library 部分缓存事故

## 范围

- 真实 Library：
  `/Volumes/团队文件-MAX线上协作中台/引力环球视频.library`
- 用户现场：`24.11 🇫🇷🇨🇭🇮🇹欧洲法瑞意站` 的 24 个子文件夹多数显示 0 项。
- 本次只恢复 Eagle 索引，没有修改排序业务代码、安装插件、手改 `.library`、删除素材
  或创建新备份。

## 根因证据

- Eagle 侧栏最初只显示全部 `1,945` 项、未分类 `103` 项。
- 回收站为空；未分类内容也不是欧洲站缺失素材的整体落点。
- 对 Library `images` 目录仅做一次浅层名称计数：存在 `10,949` 个 `.info` 目录。
- 随机精确抽查的旧素材 ID 可通过 `/api/item/info` 读取，且仍保存原文件夹 ID，说明素材
  和文件夹归属元数据没有被排序插件批量删除。
- Eagle 日志确认旧会话从本地 Library cache 加载。强制重载前，界面计数与磁盘
  `.info` 数量相差约 9,000 项，属于本地 Library cache 部分加载。

## 恢复动作

- 2026-07-27 23:09 通过 Eagle 原生
  `资源库 -> 清除缓存并重新加载` 执行一次强制重载。
- 未强杀 Eagle，未编辑或删除 `mtime.json`、本地 cache 或任一 `.info`。
- Eagle 日志记录：
  - `No library cache`
  - `Get /images folders finished, total: 10950`
  - `Files: 10945`
  - `Loading time: 75.114 sec`
  - `Loading speed: 145.71 files/sec`

## 恢复结果

- Eagle 全部项目从 `1,945` 恢复到 `10,945`。
- 欧洲站 24 个子文件夹全部恢复非零计数，合计 `2,767` 项。
- `day1 杭州到米兰` 显示 `134` 项，缩略图网格已出现；首项
  `IMG_9619.mov` 已进入 Eagle 原生预览。
- 其它顶层计数同步恢复，例如埃及站 `1,369`、日本站 `1,148`、英国站 `1,595`。

## 四个未索引目录

磁盘比 Eagle 有效项目多 4 个 `.info` 目录：

- `MRUY3BKK8VJP1`
- `MRUY3BKKCC2NW`
- `MRUY3BKKLJYBE`
- `MRUY3BKKOAMSY`

这四个目录只有原文件，没有 Eagle item 元数据或缩略图。对应名称在 `S5成片`
（Folder ID `MRUY2U2M81OH0`）已有有效项目；其中三个文件名和大小一致，另一个同名
视频大小不同，属于旧版或未完成写入残留。本次不重复导入、不手工删除，避免制造副本或
越过 Eagle 的数据边界。

## 后续门禁

- NAS Library 出现“文件夹大量归零”时，先比较 Eagle 全部计数、回收站、未分类和
  `images/*.info` 浅层数量。
- 如果 `.info` 明显多于 Eagle 计数，优先使用 Eagle 原生强制重载；禁止手改
  `mtime.json`、本地 cache 或 `.info`。
- 强制重载完成必须以 Eagle 日志 `Files`、侧栏总数、目标文件夹计数和真实缩略图/预览
  四项共同验收。
