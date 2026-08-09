# MAX 头像共享源

这是一个独立 Eagle service-mode 扩展。它只把指定的 Eagle 头像文件夹导出为
MORROW 可读的版本化共享源；MORROW 不调用 Eagle API、不读取插件状态、不扫描
`.library` 内部。

## 唯一人工维护入口

- 女生头像：`MR6L4NLN5G4Y0`
- 男生头像：`MR6L4IMOVX6XL`

用户只在这两个 Eagle 文件夹里新增、修改或删除头像。扩展安装后自动启动，并每 60 秒
检查一次、在 Library 切换后重新检查。每次更新都输出完整权威快照，不会修改或移动
任何 Eagle 原素材。
扩展优先使用本机 Eagle cache 中同时命中这两个 Folder ID 的条目，再逐项有界读取对应
原头像；只有 cache 不存在时才使用 Eagle 文件夹查询（12 秒超时）。超时和 NAS 不可用
均不会生成删除快照。

## 输出

输出根由当前 Eagle Library 的父目录推导，始终位于 `.library` 外：

```text
GravitySharedSources/eagle-avatar-source/v1/
  locator.json
  manifests/current.json
  manifests/versions/<version>.json
  assets/sha256/<prefix>/<sha256>.<ext>
```

`locator.json` 和 manifest 从不包含 `/Volumes/...` 或 Eagle 内部路径。团队机器用
固定相对 locator 发现共享源，再由本机 adapter 解析本机挂载点。

共享方可使用 `lib/shared-source-locator.js` 的 `resolveSharedAvatarSource()` 作为
无 Eagle 依赖的发现参考：它只接收当前机器已挂载的卷根和可选 `libraryIdentity`，并在
固定相对位置查找 `locator.json`。MORROW 应自行携带等价 adapter，不直接 import 本插件。

## 同步规则

- 只有完整、哈希验证通过、版本号单调递增的快照才可被 MORROW 应用。
- Eagle 删除或移出头像文件夹后，会在下一完整快照中出现 tombstone；MORROW 应移除
  对应头像关联，但不能删除人物的其他资料。
- NAS 不可用、文件夹查询失败、锁冲突或快照校验失败时，扩展不发布；MORROW 必须保留
  上一次已验证状态，不能将不可访问当作删除。
- 高宽比不在 `0.85–1.15`、缺尺寸、缺来源 URL 或格式不支持的项目标记为 `invalid`。
  已知 `MRNR1FQR0ZRF9` 会被标记 `NON_AVATAR_ASPECT`，不输出可消费资源。

## 本地验证

```bash
npm test
npm run package
```

打包只生成 `.eagleplugin`，不安装、不启动 Eagle、不写 NAS；首次真实发布需让扩展在
已打开目标 Library 的 Eagle 中运行。

当 Eagle 本机 API 暂时无响应、但用户已批准首次导出时，仓库内的受控 bootstrap 脚本
只会读取本机 Eagle cache 已命中的 50 个项目 ID，并逐项读取对应的 `.info/metadata.json`
与原头像二进制；它不会扫描整个 Library，也不会把任何 `.library` 路径写入共享输出。
