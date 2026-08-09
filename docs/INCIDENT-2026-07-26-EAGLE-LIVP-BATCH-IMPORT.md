# 2026-07-26 Eagle LIVP 批量导入严重故障

## 状态

- 严重级别：P0，真实 Eagle / 正式 NAS Library 宿主阻塞。
- 当前处置：冻结。禁止新增导入、补导、Eagle API 调用、Eagle UI 操作和 `.library`
  枚举；未经用户明确批准不得取消、删除、退出、重启或强杀 Eagle。
- 现场：Eagle 原生进度持续显示“正在添加文件 8/58”约一小时，LIVP 缩略图未正常生成，
  全局截图快捷键 `Shift+X` 不响应。
- 总管只读证据：`en9` 为 `2500Base-T active`，NAS ping 约 `0.486 ms`、零丢包；
  Eagle 主进程、多个 renderer 及 4 个 `exif-metadata/exiv2` 子进程处于 `U` 状态；
  正式库在线但容量约 91% 已用。排序插件 qa.8 另有一条 183 项 EXIF 扫描停在
  `75/183`；qa.9 尚未安装。

## 58 个请求的可证实构成

- 唯一输入素材：54 组，`IMG_3248` 到 `IMG_3301`，每组为一张 JPG 与一段 MOV。
- 首轮提交：54 次 `addFromPath`，每个 `.livp` 一次。API 均返回 `success` 和 ID。
- 补导提交：4 次。因此 Eagle 原生队列显示总请求数 58；这不是 58 个不同素材，而是
  54 个唯一 `.livp` 加 4 个重复提交请求。
- 缺口：补导脚本没有把每次补导请求单独写入持久化结果文件。现有证据只能确定补导
  次数为 4，不能可靠确定这 4 次分别重复了哪些 stem 或取得了哪些新 ID。禁止根据
  UI 顺序猜测。
- 事故门禁：任何批量 API 返回成功后，必须逐项确认 Eagle 可重新读取、目标文件夹可见、
  缩略图终态明确，才能提交下一项。确认超时立即熔断，禁止继续补导。

首轮完整结果：

- `/tmp/icloud-live-54-eagle-import-results-20260726.json`
- `/tmp/icloud-live-54-eagle-item-ids-20260726.txt`

复核快照：

- `/tmp/icloud-live-54-eagle-info-verify-20260726.json`
- `/tmp/icloud-live-54-eagle-info-verify-20260726-r2.json`

只读 SHA-256：

- `icloud-live-54-eagle-import-results-20260726.json`：
  `310676f34d2f260651022ad6268f8a354bcfe7420d864bdd48bba8fe4ce8ff7a`
- `icloud-live-54-eagle-item-ids-20260726.txt`：
  `16905e93282fdf1e0089ad6d2526be164b79592cfb65e6786585147d6dab799c`
- `icloud-live-54-eagle-info-verify-20260726.json`：
  `4809934ef1ebd0da8717e74f4ccffc955f91a76343e7351c70df6de5ea91c00c`
- `icloud-live-54-eagle-info-verify-20260726-r2.json`：
  `a804b5ce93586e7779ce26411d9e7e94a6d530f7f25e3e8065ce36c38020ed76`

测试文件夹：

- 名称：`MAX Live 54 Demo 2026-07-26`
- Folder ID：`MS0NDHXFUZYG6`
- 标签：`MAX_LIVE_54_DEMO`、`iCloud_Live_Workflow`、`iCloud_54_Sample`

## 已确认状态

首轮 API 返回的 54 个 ID 只表示请求被受理，不表示素材已完成落库。01:36 的最后一份
逐 ID 复核快照仅能重新读取以下 6 个 item：

| stem | item ID | 复核状态 |
| --- | --- | --- |
| `img_3248` | `MS0NE7JQY575A` | 可读取，`noPreview=true` |
| `img_3249` | `MS0NE7JXR1WCY` | 可读取，未记录有效缩略图尺寸 |
| `img_3250` | `MS0NE7K13UP66` | 可读取，`noPreview=true` |
| `img_3251` | `MS0NE7K5TZQCV` | 可读取，`noPreview=true` |
| `img_3253` | `MS0NE7KC3IJJA` | 可读取，`noPreview=true` |
| `img_3254` | `MS0NE7KFB6HOR` | 可读取，未记录有效缩略图尺寸 |

UI/列表曾观察到 `img_3248` 至 `img_3254` 共 7 个名称，但 `img_3252` 的返回 ID
`MS0NE7K9E8QB0` 在两轮逐 ID 复核中均为 error。因此：

- “UI 曾可见 7 个”保留为观察证据；
- “API 最后确认可读取 6 个”是当前可列出精确 ID 的证据；
- Eagle 当前显示 `8/58` 只代表队列进度，不能推导第 8 个 item 已成功。

## 已知故障链

1. 搬运台快速提交 54 个 `.livp`，把 API `success` 错当成可继续推进的信号。
2. Eagle 的 `eagle-extension-livp` 缩略图插件使用共享 `temp/zip_temp` 解包目录；
   并发任务互相删除/覆盖，日志出现 `zip_temp/image.jpeg` 缺失和
   `Thumbnail generate timeout`。
3. 首轮返回成功但后续 item 不可见后，仍继续发出 4 次补导请求，扩大宿主队列。
4. Eagle 同时存在 LIVP 解包/缩略图、宿主元数据子进程和 qa.8 EXIF 扫描，最终多个
   进程进入 NAS I/O 的 `U` 状态，原生预览和快捷键被拖住。

该故障不能归因为局域网链路速度；现有证据更符合 Eagle 宿主内部并发任务与 SMB I/O
阻塞。NAS 91% 占用是风险放大项，但当前证据不足以单独认定为根因。

## 待批准的安全恢复方案

以下仅为方案，当前不执行：

1. 保持冻结并保存 `/tmp` 四份结果/快照文件；不再轮询 Eagle API。
2. 由总管取得用户对“正常取消”“正常退出/重启”“清理测试项”的分别明确批准。
3. Eagle 恢复响应后，先使用公开 Eagle API 对测试 Folder ID、三个测试标签和已知 ID
   做一次有界清点；禁止全库扫描，也禁止直接遍历 `.library/images`。
4. 将 54 个首轮 ID、可能的 4 个补导返回项分成“存在且完整、存在但无缩略图、处理中、
   不存在、重复”五类。未完成清点前不删除。
5. 若用户批准取消，只使用 Eagle 原生取消能力；取消后再次有界核验，不能把进度消失
   当成回滚成功。
6. 若用户批准清理，只通过 Eagle UI 或公开 API 删除 Folder ID
   `MS0NDHXFUZYG6` 内带 `MAX_LIVE_54_DEMO` 标签的精确测试 item；不得按名称模糊删除，
   不得手工删除 `.library` 文件。
7. 若正常取消/退出不可用，先回报并请求单独的重启批准。强杀或任何手改 `.library`
   均为禁止路径，必须升级给总管，不在本任务执行。
8. 清理完成后，以原始 54 组 JPG/MOV 和 `/tmp` 封装包为源重新建立导入台账；任何
   新试点必须改用单写入、逐项确认、超时熔断，最多从 1 到 3 个样本重新起步。

## 生产门禁

- 禁止依赖官方 LIVP 插件进行并发批量缩略图生成。
- Eagle API `success` 只能记为 `accepted`，不得直接记为 `success`。
- 每次提交前必须有唯一幂等键；补导前必须查询台账，禁止对未确认请求再次提交。
- Eagle、NAS 或缩略图确认任一超时，立即暂停整个队列。
- 排序/GPS/EXIF 后台扫描与媒体导入必须共享宿主级 I/O 互斥门禁，不能同时压正式库。
- 未在低风险 QA Library 完成 1、3、10、50 个逐级试点前，不得再次对正式 NAS Library
  批量导入。

## 2026-07-26 用户批准后的恢复结果

- 用户明确批准原生取消、正常退出/重新打开及本批测试项/测试文件夹清理，并明确要求
  不创建新备份。
- Computer Use 首次进入现场时，“正在添加文件 8/58”进度和取消按钮已经消失；当前
  Eagle 主进程 PID `21029` 已是新实例，说明旧阻塞实例在本任务接手前已被正常重新打开。
  本任务没有执行额外退出/重启，更没有强杀。
- Eagle 公开 API 已恢复响应，版本 `4.0.0`、build `20260401`。测试文件夹
  `MS0NDHXFUZYG6` 实际存在 8 个本批 `.livp`，即 `img_3248` 到 `img_3255`；4 次补导
  没有形成额外可见副本。
- 清理的 8 个 item 均通过精确 ID 移入 Eagle 回收站，逐 ID 复核均为
  `isDeleted=true`：
  - `MS0NE7JQY575A`
  - `MS0NE7JXR1WCY`
  - `MS0NE7K13UP66`
  - `MS0NE7K5TZQCV`
  - `MS0NE7K9E8QB0`
  - `MS0NE7KC3IJJA`
  - `MS0NE7KFB6HOR`
  - `MS0NE7KJ753XP`
- 空测试文件夹 `MAX Live 54 Demo 2026-07-26` 已通过 Eagle 原生 UI 删除；Eagle 明确
  显示删除成功，文件夹总数由 304 降为 303。未清空回收站，因此 8 个 item 仍可恢复。
- 单张基线测试 item `MS0KTJSY3J9BF` 未处理；没有修改其它测试项、正式素材或
  `.library` 内部文件。
- 恢复后普通文件夹缩略图可正常显示；进程复核中 Eagle 主进程和所有 renderer 均为
  `S/R`，不再有 `U` 状态，原先的 `exif-metadata/exiv2` 子进程也已退出。
- Eagle 配置仍记录全局截图快捷键为 `Shift + X`。Computer Use 分别在 Eagle 和 Finder
  前台发送过一次 `Shift+X`，随后均发送 `Esc`，但自动化截图没有捕获到可证明截图模式
  已出现的覆盖层。因此该项只能记为“配置存在、未能自动确认实际截图入口”，不能宣称
  已通过。
- 安全发现：公开 `/api/item/list` 对本次传入的 `folderId` 参数没有按预期过滤，返回了
  最近 100 项而不是仅测试文件夹。清理前仍以 Folder ID、三枚测试标签和 accepted ID
  三重交叉锁定 8 个目标；未对返回的任何其它 item 执行操作。后续不得把该参数当成
  服务端有界过滤依据，应使用已知 ID 逐项查询或先在 UI 精确进入文件夹。
- 本次没有创建或删除任何备份，没有安装 qa.9，没有清空 Eagle 回收站，没有强杀进程，
  没有手改或遍历 `.library`。
