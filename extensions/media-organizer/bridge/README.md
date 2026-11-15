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

已存在旧版精确桥接哈希时，脚本会报告“无需重建”。历史
`install-compatible-bridge.sh` 已永久禁用，不再接受任何 bridge/app.asar 安装请求。

安装前会在 Eagle Application Support 的备份目录留下经过哈希验证的原始副本。
`restore-compatible-bridge.sh --restore` 仅在当前文件仍是已知桥接版本，或与本机
`bridge-evidence.json` 完全匹配的重建桥版本时回退；不会删除插件、资料库或其他用户数据。

## 宿主签名与启动门禁

每次 `--check`、`--install` 和 `--restore` 都必须在当前 Mac 上执行签名校验。已经登记的 `BRIDGED_SHA256` 会同时按固定哈希和桥接证据核验。

```bash
codesign --verify --deep --strict /Applications/Eagle.app
shasum -a 256 /Applications/Eagle.app/Contents/Resources/app.asar
```

未知哈希或签名失败立即阻断。已经登记的桥接哈希允许继续启动验收，因为桥接会使 Eagle 的原始封条发生可预期变化。只看进程存在或 Helper 存在不能继续安装。禁止 ad-hoc 重签、禁用校验或手工修改 `app.asar`。

`rebuild-compatible-bridge.js --install` 会在候选包替换前保存已校验的原始宿主，在候选宿主上执行严格签名检查或固定桥接哈希核验。两者都通过后，启动探测最长 120 秒，必须同时满足以下证据。

- Eagle Helper 进程存在。
- 本次启动新增日志出现 `Library loaded`。
- 本次启动新增日志出现 `mainWindow is ready`。

任何一项失败都会恢复原始 `app.asar`。启动探测使用本次启动前的日志偏移，旧日志不能满足门禁。恢复后再次执行 SHA-256 和签名校验。事故记录见 `docs/INCIDENT-2026-11-13-EAGLE-ASAR-SIGNATURE-AND-STARTUP.md`。

右键扩展只能使用 Eagle 官方入口或已签名并经过真实原生菜单验收的桥接。直接修改 `app.bundle.js`、未审计 IPC 或绕过签名会触发 Eagle 篡改检查，脚本必须阻断并恢复原始宿主。

## 2026-11-15 恢复后的永久阻断

恢复原始 b04a 宿主后，正式流程不再安装或修改 bridge/app.asar。历史
`bridge/install-compatible-bridge.sh` 与旧 `releases/install-*.sh` 已永久 fail-closed。
原始未桥接宿主只允许插件文件安装：

```bash
./scripts/install-github-release.sh --install-plugin-only
node test/host-install-safety-contract.test.js
```

扫描测试发现任何针对 `app.asar` 的 `cp`、`mv`、`ditto` 或覆盖路径都会失败。
