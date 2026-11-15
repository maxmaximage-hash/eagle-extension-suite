# Eagle 跨电脑功能差异与恢复交接报告

更新时间：2026-11-14（Asia/Shanghai）

这份报告用于把能显示 Eagle 原生排序面板的旧电脑，与当前重装后的电脑对齐。报告以当前机器实测结果、历史 QA 记录、GitHub 远端清单和桥接脚本证据为准。

## 结论

两台电脑可以使用相同的 Eagle 插件版本，同时呈现不同的界面。决定“排序锁定、手动拖动、自动编号、多级排序”是否出现在 Eagle 主网格里的关键状态，是 Eagle 主程序 `app.asar` 是否暴露 `eagle.photoTakenSort.execute()`。

旧电脑的历史成功记录对应已桥接的 Eagle 主程序。当前电脑使用官方原始 Eagle 主程序，插件服务能够启动，主网格通信入口不存在，因此原生排序面板不会出现。

## 两台电脑的差异

| 项目 | 旧电脑的历史成功状态 | 当前电脑实测状态 |
| --- | --- | --- |
| Eagle 版本 | Eagle 4.0.0 build 23 | Eagle 4.0.0 build 23 |
| Eagle 主程序 `app.asar` | 桥接版本 SHA-256 `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3` | 原始版本 SHA-256 `b04a2efdb8bc8d06910552f43f38c056e6964c8f74798e1b2849f1bffab8a1bd` |
| 主网格通信入口 | 存在 `eagle.photoTakenSort.execute()` | 不存在 |
| 历史服务日志 | `BOOTSTRAP_READY` → `INJECT_START` → `INJECT_OK` | `BOOTSTRAP_MAIN_WAIT` → `BOOTSTRAP_TIMEOUT` |
| 原生主网格面板 | 显示排序锁定、手动拖动、自动编号和多级排序 | 不显示扩展面板，Eagle 原生能力仍可用 |
| 当前 Eagle Library | 历史旧电脑路径未读取 | `/Volumes/max ssd 990 pro/引力环球.library`，392 个文件夹、29102 个项目 |
| 当前系统 | 旧电脑系统版本未读取 | macOS 26.5.1，build 25F80 |

旧电脑截图显示的是 Eagle 主网格里的原生面板。截图中的面板不是插件独立窗口，因此仅复制 `.eagleplugin` 不能复制出相同界面。

## 插件和远端版本

GitHub 远端仓库是 `https://github.com/maxmaximage-hash/eagle-extension-suite.git`，当前主线 commit 是 `d3846f24152adadc6f9251ceb35f4e0874a88fcd`。

远端主线 manifest 版本如下。

| 插件 | GitHub 主线版本 | 说明 |
| --- | --- | --- |
| 媒体智能整理 | `2.5.22-qa.94` | 含排序核心源码，依赖主程序桥接才能进入 Eagle 主网格 |
| MAX Publisher | `1.2.7` | Eagle 插件 |
| MAX 头像共享源 | `1.0.0` | Eagle 插件 |
| Eagle 工作台 | `1.1` | Eagle 插件 |
| MAX Live Photo 管家 | `0.1.0-demo.1` | GitHub 主线的 Demo 版本 |
| Instagram 整帖 | `1.1.2` | Chrome 扩展，不是 Eagle 插件 |
| 小红书整帖 | `1.0.0` | Chrome 扩展，不是 Eagle 插件 |

GitHub Release 目前只发布了媒体整理旧包和 MAX Publisher 包。Release 与仓库都不包含 Eagle 完整 `app.asar`、桥接版本或桥接载荷。

当前电脑最近一次本地版本安装后的插件清单如下。

| 插件目录 | 名称 | 版本 |
| --- | --- | --- |
| `com.max.eagle-photo-taken-sort` | 媒体智能整理 | `2.5.22-qa.98` |
| `com.max.eagle-online-showcase` | MAX Publisher | `1.2.7` |
| `com.max.eagle-avatar-source-publisher` | MAX 头像共享源 | `1.0.0` |
| `com.max.eagle-workbench` | Eagle 工作台 | `1.1` |
| `com.max.eagle-live-photo-manager` | MAX Live Photo 管家 | `0.1.0-demo.1` |
| `com.max.eagle-live-photo-inspector` | MAX Live Photo 静态照片信息 | `0.1.0` |

当前本地 `qa.98` 还包含针对无桥接环境的插件窗口 fallback。它可以显示人物图与环境图重命名入口，也可以显示多级排序预览和复制结果。fallback 读取 Eagle 公开 API，不写入 Eagle 主网格顺序。

2026-11-14 本地 `qa.98` 已重新安装到当前 Eagle，并在真实插件窗口中确认以下入口可见：排序锁定、手动拖动（默认开启）、恢复自动排序、自动编号、预览自动编号和确认自动编号。排序锁定复选框切换后，恢复自动排序按钮会随锁定状态禁用或恢复。自动编号入口在插件窗口内使用公开 Item API 和现有重命名核心，主网格桥接缺失时不会把这些控件注入 Eagle 原生主网格。

## 为什么同一个插件版本会有不同界面

媒体整理的 `manifest.json` 同时声明了 `serviceMode: true`、`keepAlive: true` 和 `childWindow: true`。这些配置只负责启动服务和插件窗口。

真正把排序界面挂到 Eagle 主网格的调用链是：

```text
插件服务启动
  → 等待 eagle.photoTakenSort.execute()
  → 读取主窗口当前 Library 状态
  → 注入排序面板和拖动逻辑
  → 主网格显示排序锁定、手动拖动、自动编号和多级排序
```

当前电脑日志在第一步之后进入等待超时。插件代码仍然包含排序、拖动和自动编号核心，但没有主窗口通信入口就不会把这些 UI 注入 Eagle 主网格。

## 为什么上一次重装后可以用

历史桥接脚本 commit `c078925` 在重建 `app.asar` 后直接替换文件，没有执行现在的严格签名门禁。历史 QA 记录使用该流程后出现桥接 SHA `4f56e0da...e067f3`，并记录了 `INJECT_OK`、多级排序和手动拖动入口。

2026-11-13 事故后，桥接脚本增加了以下门禁。

- 候选 `app.asar` 必须通过 `codesign --verify --deep --strict /Applications/Eagle.app`
- 签名失败时删除候选并恢复原始宿主
- 启动时必须出现本次新增的 `mainWindow is ready`、`Library loaded` 和 Helper

当前 macOS 26.5.1 没有可用的代码签名身份。当前 `security find-identity -v -p codesigning` 返回 0 个有效身份。修改后的 Eagle 主程序无法重新封装成可通过签名校验的版本，因此旧桥接流程不能直接复制到当前电脑。

## 当前电脑已经验证的内容

- `/Applications/Eagle.app/Contents/Resources/app.asar` 当前是原始 SHA `b04a2ef...ab8a1bd`
- `codesign --verify --deep --strict /Applications/Eagle.app` 通过
- Eagle 启动日志出现 `mainWindow is ready` 和 `Library loaded`
- 当前 Library 可操作
- 六个 Eagle 插件均出现在插件菜单
- 本地 `qa.98` 的人物图与环境图重命名 fallback 已在真实 Eagle 中成功改名并恢复原名
- 本地 `qa.98` 的多级排序预览已在 BROLL 文件夹读取 94 个媒体，按两级规则生成结果并复制到剪贴板
- 本地 `qa.98` 重新安装后，真实插件窗口显示排序锁定、手动拖动（默认开启）、恢复自动排序、自动编号、预览自动编号和确认自动编号
- 真实切换排序锁定后，恢复自动排序按钮进入禁用状态，解除锁定后恢复
- GitHub `qa.94` 插件包不会产生 Eagle 主网格排序面板，因为当前主程序没有桥接入口

## 另一台电脑需要提供的完整对齐信息

在旧电脑上执行以下只读命令，把结果放入交接材料。

```zsh
sw_vers
/Applications/Eagle.app/Contents/MacOS/Eagle --version 2>/dev/null || true
shasum -a 256 /Applications/Eagle.app/Contents/Resources/app.asar
codesign --verify --deep --strict /Applications/Eagle.app
security find-identity -v -p codesigning
cat "$HOME/Library/Application Support/Eagle/Plugins/com.max.eagle-photo-taken-sort/manifest.json"
rg -n 'BOOTSTRAP|INJECT|mainWindow is ready|Library loaded' \
  "$HOME/Library/Application Support/Eagle/PluginData/com.max.eagle-photo-taken-sort" \
  "$HOME/Library/Logs/Eagle/log.log"
```

旧电脑如果报告 `app.asar` SHA `4f56e0da...e067f3`，它仍处于历史桥接状态。该主程序必须先通过完整签名和启动检查，才能作为可恢复来源。

## 另一台电脑的安装顺序

### 远端源码版本

```zsh
git clone https://github.com/maxmaximage-hash/eagle-extension-suite.git
cd eagle-extension-suite
git switch main
cd extensions/media-organizer
npm ci
npm test
zsh scripts/build-github-release.sh
zsh releases/install-媒体智能整理-v2.5.22-qa.94.sh --check
```

媒体整理的 `--check` 通过后，再在 Eagle 完全退出的状态下执行：

```zsh
zsh releases/install-媒体智能整理-v2.5.22-qa.94.sh --install-plugin
```

如果目标是当前本地增强版，而不是 GitHub 主线版本，应使用本地 `qa.98` 发布包和安装器。两者版本不能混装后再用插件目录判断功能完整。

### 真实验收

重启 Eagle 后必须同时确认：

1. 插件菜单中每个 ID 只有一个来源。
2. Eagle 主窗口出现 `mainWindow is ready` 和 `Library loaded`。
3. 媒体整理日志出现 `BOOTSTRAP_READY`、`INJECT_START` 和 `INJECT_OK`。
4. Eagle 主网格中出现截图对应的排序锁定、手动拖动、自动编号和多级排序面板。
5. 选择一张测试图片完成一次人物图或环境图重命名，并恢复测试对象原名。
6. 不直接修改 `.library` 内部文件，不从另一台电脑复制 Library 素材或 NAS 状态。

如果第 3 项没有出现，插件包已经安装但主网格桥接没有工作。继续安装同一个 `.eagleplugin` 不会改变结果。

## 当前可恢复路径

要让当前电脑与旧电脑完全一致，需要满足以下条件之一。

1. 找到旧电脑对应的已签名 Eagle 主程序或官方提供的同等通信能力。
2. 在旧电脑保留原环境继续使用主网格排序，并把当前电脑用于插件窗口 fallback。
3. 使用 Eagle 官方新增的主网格排序接口，重新把排序功能迁移到公开 API。

当前仓库、GitHub Release、本机安装镜像、NAS、Eagle 备份目录和本地快照中都没有历史桥接 `app.asar` 或 payload。现有备份目录只包含原始宿主：

```text
/Users/max/Library/Application Support/Eagle/Backups/media-organizer-safe-bridge/Eagle-4.0.0-build23-original-app.asar
```

这份文件的 SHA-256 是原始值 `b04a2ef...ab8a1bd`，不包含旧电脑的主网格桥接。

## 交接判断

插件版本一致不能证明两台电脑的运行环境一致。只有 Eagle 主程序指纹、桥接入口、插件版本、插件状态和验收日志全部一致，截图中的原生排序面板才会一致。

## GitHub 完整交付复核（2026-11-14）

GitHub 最新完整交付 Release 为 `v2026.11.14-eagle-complete-1`。该 Release 新增了桥接版 `app.asar` 和完整交付压缩包，目标插件版本为 `2.5.22-qa.94`。

| 交付物 | SHA-256 |
| --- | --- |
| `Eagle-4.0.0-build23-bridged-app.asar` | `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3` |
| `媒体智能整理-v2.5.22-qa.94-github.eagleplugin` | `c0e25c18b0a43d43c69c857e084bd7750606f7e2f2658a0ce4e8140143f5e9ff` |
| `install-媒体智能整理-v2.5.22-qa.94.sh` | `dd98d24c15279831c7b6d92621258301b25e08e4e052ab232285b89f5a2ddf31` |

在当前 Mac 上按 Release 提供的 `bridge/install-compatible-bridge.sh --check` 和 `--install` 执行，桥接载荷先通过原始宿主版本与 SHA 检查并安装到 Eagle。安装后的候选主程序 SHA 为 `4f56e0da...e067f3`，随后执行 `codesign --verify --deep --strict /Applications/Eagle.app` 返回 `a sealed resource is missing or invalid`。

按交付包提供的 `restore-compatible-bridge.sh --restore` 自动恢复原始主程序。恢复后的 `app.asar` SHA 为 `b04a2efdb8bc8d06910552f43f38c056e6964c8f74798e1b2849f1bffab8a1bd`，`codesign --verify --deep --strict` 通过。插件安装在桥接候选未通过签名门禁后停止，避免把 `qa.94` 安装到没有可用主网格通信入口的宿主上。

恢复后的真实 Eagle 启动验收记录为：

- `Eagle start`：`2026-11-14 21:17:45.021`
- `mainWindow is ready`：`2026-11-14 21:17:46.505`
- `Library loaded`：`2026-11-14 21:17:47.680`
- 当前 Library 可操作，原始宿主签名保持通过

这次复核证明 GitHub 已发布桥接载荷，但该载荷在当前 Mac 的 Eagle 签名封条下无法通过严格校验。需要另一份可通过当前系统签名验证的 Eagle 主程序，或在提供该 Release 的电脑上继续使用已桥接环境。
