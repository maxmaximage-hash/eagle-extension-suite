# Eagle 4.0 build 23 通信桥

Eagle 的公开插件 API 不允许插件窗口访问主窗口 DOM。本机安装版本在以下两处
加入了专用 IPC：

- `app/js/plugin/index.js`：在 Eagle 主窗口执行带固定标记的排序注入脚本。
- `app/js/plugin/api.js`：向本插件暴露 `eagle.photoTakenSort.execute()`。

原始 `app.asar` 已备份。Eagle 更新会覆盖这个桥；更新后应先确认新版本内部结构，
再重新应用，而不是直接复用旧的 `app.asar`。

## 已审计指纹

- 原始 build 23 `app.asar`：`b04a2efd...ab8a1bd`
- 已加桥版本 `app.asar`：`4f56e0da...2e067f3`
- 差异仅位于 `app/js/plugin/api.js` 与 `app/js/plugin/index.js`；完整指纹见
  `bridge-manifest.json`。
- 原始归档含有指向 `app.asar.unpacked` 的外置文件记录；仓库中的原始备份可用于
  精确恢复 `app.asar`，但不能脱离对应 Eagle 安装独立完整解包全部外置文件。

## 安全安装原则

交接包中的 `install-compatible-bridge.sh` 默认只检查。只有宿主版本为 4.0.0、
当前 `app.asar` 恰好等于上述原始哈希、桥接载荷也等于已审计哈希，并且 Eagle
已经退出时，显式传入 `--install` 才会安装。未知版本、未知哈希一律拒绝。

安装前会在 Eagle Application Support 的备份目录留下经过哈希验证的原始副本。
`restore-compatible-bridge.sh --restore` 仅在当前文件仍是已知桥接版本时回退，
不会删除插件、资料库或其他用户数据。
