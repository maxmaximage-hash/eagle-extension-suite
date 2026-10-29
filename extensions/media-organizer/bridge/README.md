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

仓库不上传 Eagle 主程序二进制，也不把当前电脑的 `app.asar` 直接复制到另一台电脑。
目标电脑先在本目录执行 `npm ci`，再用 `rebuild-compatible-bridge.js --check` 验证本机
Eagle 4.0.0 的原始 `app.asar` 指纹；通过后，完全退出 Eagle，再执行 `--install`。脚本
只对两个已审计的 Eagle 文件做确定性源码插入，重建后会解包复核桥接标记，并保留经过
哈希验证的原始备份和 `bridge-evidence.json`。未知版本、未知哈希、Eagle 正在运行或
结构与审计基线不一致时一律拒绝。

已存在旧版精确桥接哈希时，脚本会报告“无需重建”；现有 `install-compatible-bridge.sh`
仍只用于带有已审计桥接载荷的历史交接包，不是新电脑的首选入口。

安装前会在 Eagle Application Support 的备份目录留下经过哈希验证的原始副本。
`restore-compatible-bridge.sh --restore` 仅在当前文件仍是已知桥接版本时回退，
不会删除插件、资料库或其他用户数据。
