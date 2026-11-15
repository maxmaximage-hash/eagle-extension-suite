# MAX Live Photo 管家基础闭环架构

## 当前交付范围

0.2 开发版完成以下基础能力：

- 源目录由 Eagle 文件夹选择器指定，路径写入插件本地设置；
- `JPG/JPEG/HEIC + MOV` 扫描结果生成统一 `live-photo-identity.v1` 结构；
- 文件名配对明确标记为 `provisional`，asset identifier 或完整内容哈希验证后才可标记为 `verified`；
- 图片和 MOV 的不匹配 asset identifier 在导出前拒绝执行；
- 本地台账使用原子写入，记录组件组、操作、结果和事件；
- 静态图、MOV 和 Eagle `.livp` 使用临时文件/冲突阻断，默认不覆盖已有文件；
- 操作状态固定为 `planned -> running -> completed/failed/cancelled`；
- Apple Photos 和 Eagle Library 写入仍由后续 adapter 负责，当前插件不直接修改 `.library`。

## 数据边界

```text
Source components
  -> LivePhotoIdentity
  -> Ledger group
  -> Operation
  -> Local derivative / Eagle adapter / PhotoKit adapter
```

`Source components` 是只读输入。导出、Eagle 导入和 Photos 回流都必须创建独立的
`Operation`，不能直接改变源文件或用 UI 状态代替台账状态。

### LivePhotoIdentity

```json
{
  "schemaVersion": 1,
  "groupId": "live:<stable-key>",
  "assetIdentifier": "<optional Apple identifier>",
  "pairing": {
    "method": "basename | asset-identifier | content-hash",
    "confidence": "provisional | verified | invalid"
  },
  "components": {
    "image": { "filename": "...", "fingerprint": "..." },
    "movie": { "filename": "...", "fingerprint": "..." }
  }
}
```

文件名只是发现候选组的依据。后续媒体元数据 adapter 必须读取 Apple asset identifier，
并把文件哈希、大小、编码和时长写入组件指纹。

### Ledger

台账存放在 Eagle Application Support 下的 Live Photo 专用目录，当前包含：

- `groups`：组件组、身份、源路径和冲突；
- `operations`：导出/导入操作、目标目录、状态和逐组结果；
- `events`：发现、状态变化和结果确认事件。

写入使用同目录临时文件加 `rename`，避免 Eagle 崩溃时留下半份 JSON。所有目标 adapter
都必须复用这套状态和事件模型。

## 目标 adapter 状态

```text
Local export:
  planned -> running -> confirmed | failed

Eagle:
  planned -> running -> accepted -> confirmed | failed | cancelled

Apple Photos:
  planned -> running -> accepted -> verified-live | duplicate | failed
```

API 返回成功只能记为 `accepted`。只有重新读取 Eagle item 或查询 Photos 资产并确认
`isLivePhoto=true`、资源包含 `photo + pairedVideo`，才能进入目标确认状态。

## 下一阶段顺序

1. 增加 EXIF/QuickTime asset identifier 与内容哈希读取 adapter；
2. 增加多选、批量本地导出和输出目录选择；
3. 在 QA Library 做 Eagle 单项导入，建立 `accepted -> confirmed` 单写入队列；
4. 集成 PhotoKit helper，加入去重锁和导入验证；
5. 接入封面编辑、重建 Live Photo 和短视频降级出口；
6. 最后接入 iCloud/NAS 批次台账、空间预检、断线熔断和跨天恢复。

正式库和正式 Photos 账户必须等第 3、4 步的单项与 `1 -> 3 -> 10 -> 50` 逐级验收通过后再开放。
