# 2026-11-13 Eagle app.asar 签名与启动事故

状态：已恢复原始宿主，复制文件夹功能未完成真实 Eagle 验收。

## 现象

2026-11-13 本地 Eagle 4.0.0 Build 23 在桥接增量修改后出现两类启动异常。

- 直接向 `app/app.bundle.js` 和 `app/js/plugin/ipc.js` 写入右键菜单桥接后，Eagle 日志出现 `app.bundle.js has been tampered.`，主窗口没有进入可操作状态。
- 随后宿主 `app.asar` 被恢复或重建期间，Eagle 主进程可能存在但没有可操作窗口。一次现场还出现系统提示 `Unable to open because the system lacks the necessary .dll files.[2]`。
- Mac 处于锁屏时，Computer Use 只能看到 `The Mac is locked and automatic unlock could not unlock it`，不能把进程或 Helper 当作界面启动成功。

## 时间线

- 02:31 左右，原有排序桥版本曾正常进入 `mainWindow is ready` 和 `Library loaded`，媒体智能整理服务成功初始化。
- 02:55 左右，包含 `app.bundle.js` 右键补丁的候选宿主启动并记录 `app.bundle.js has been tampered.`。
- 之后撤销 `app.bundle.js` 与 `ipc.js` 的直接改动，恢复到已知排序桥或原始宿主，避免继续覆盖当前 Eagle。
- 09:46 重新核验原始宿主备份和当前文件指纹，恢复脚本将当前 `app.asar` 恢复为原始 SHA-256 `b04a2efdb8bc8d06910552f43f38c056e6964c8f74798e1b2849f1bffab8a1bd`。
- 恢复后 `codesign --verify --deep --strict /Applications/Eagle.app` 通过。Eagle 曾出现主进程与 Helper 长时间停在 V8 `SetupIsolateDelegate::SetupHeap`，没有新增 `Eagle start` 或 `Library loaded` 日志，系统同时存在约 11GB swap 使用量。这一阶段没有进行真实 Library 写入。

## 根因

第一根因是修改了已签名应用包中的 `app.asar`，导致 macOS sealed resource 校验失效。此前流程只校验 app.asar SHA-256 和桥接 marker，没有把应用签名、Helper、`Library loaded` 和真实可操作窗口作为发布门禁。

第二根因是把原生右键菜单直接写入 `app.bundle.js`，触发 Eagle 自身的篡改检查。该路径不具备可交付条件。

第三个独立因素是现场系统内存和交换压力很高。恢复原始宿主后，某次主进程停留在 V8 初始化，没有形成新的 Eagle 日志。该现象需要在系统资源正常、Mac 解锁后重新测量，不能归因到复制文件夹业务。

## 影响

- Eagle 宿主未被 ad-hoc 重签，未修改 `.library` 内部文件。
- 复制文件夹业务源码、核心测试和发行包已经完成，原生右键入口和真实素材引用尚未通过真实 Eagle 验收。
- 直接 app.bundle/ipc 方案被判定为不可交付，并已从当前宿主恢复。
- 预防门禁已加入桥接脚本、恢复脚本和插件安装器。门禁失败时不得继续安装。

## 恢复与证据

恢复命令如下。

```bash
cd "/Users/max/引力环球/软件开发中台/EAGLE 扩展/extensions/media-organizer"
./bridge/restore-compatible-bridge.sh --restore
shasum -a 256 "/Applications/Eagle.app/Contents/Resources/app.asar"
codesign --verify --deep --strict "/Applications/Eagle.app"
```

恢复后的宿主指纹是原始 `b04a2efdb8bc8d06910552f43f38c056e6964c8f74798e1b2849f1bffab8a1bd`。原始备份位于 `/Users/max/Library/Application Support/Eagle/Backups/media-organizer-safe-bridge/Eagle-4.0.0-build23-original-app.asar`，其 SHA-256 与原始指纹一致。

预防门禁现在执行以下检查。

1. `codesign --verify --deep --strict /Applications/Eagle.app` 失败立即阻断。
2. 候选 app.asar 在临时签名校验失败时自动删除，并恢复已校验的原始 app.asar。
3. 启动探测要求本次启动新增日志包含 `Library loaded` 与 `mainWindow is ready`，同时存在 Eagle Helper。旧日志不会被当作本次启动证据。
4. 插件安装器在安装前后执行相同的签名检查。
5. 恢复脚本在恢复后再次执行签名检查。

相关自动证据包括 `node bridge/rebuild-compatible-bridge.test.js`、`node test/github-release-contract.test.js`、全量 `npm test`、`node -c bridge/rebuild-compatible-bridge.js` 和 `zsh -n scripts/install-github-release.sh`。

## 未完成事项

复制文件夹仍需在真实 Eagle 中完成以下验收后才能交付。

- 解锁 Mac 后记录从 Eagle 启动到可操作资源库界面的耗时。
- 在普通文件夹原生右键中确认“复制文件夹（含内容）”只追加在 Eagle 原生菜单链，原生“克隆”、选择、预览、拖出和右键保持可用。
- 复制后核对新旧文件夹树、直属素材的相同 item ID、全库资源总数和跨文件夹引用。
- 验证智能文件夹、密码锁文件夹、同名避让和失败恢复行为。

在这些证据完成前，当前状态是“尚未通过真实 Eagle 验证，仍未完成”。
