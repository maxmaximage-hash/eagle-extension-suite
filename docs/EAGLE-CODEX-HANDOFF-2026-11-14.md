# Eagle 另一台电脑 Codex 交接说明

## 目标

让另一台电脑得到与当前旧电脑相同的 Eagle 主网格排序环境。不能只执行 `git pull`，因为原生排序面板依赖 Eagle 主程序桥接，而不是只依赖插件源码。

## 唯一交付入口

GitHub Release：

`v2026.11.14-eagle-complete-2`

下载其中的 `eagle-complete-runtime-2026-11-14.tar.gz` 和 `install-complete-eagle-handoff.command`。双击 `.command` 即执行完整流程：退出 Eagle、确认 Helper 退出、下载并校验桥接版 Eagle.app、保留现有 Eagle.app、安装完整 Eagle.app、安装媒体整理插件并做哈希检查。

如果没有一键脚本，按下面顺序执行：

1. 拉取本仓库 `main`。
2. 下载 Release 的完整交付压缩包。
3. 完全退出 Eagle，确认 Eagle Helper 已退出。
4. 用交付包中的完整 Eagle.app 替换目标电脑的 `/Applications/Eagle.app`。
5. 执行交付包中的媒体整理安装脚本。
6. 启动 Eagle，确认主网格出现排序锁定、手动拖动、自动编号和多级排序。

## 固定指纹

- Eagle：4.0.0 build 23
- 桥接 `app.asar`：`4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`
- 媒体智能整理：`2.5.22-qa.94`

## 绝对禁止

- 不复制或修改任何 Library、`.library` 或 NAS 素材。
- 不执行 ad-hoc 重签。
- 不关闭 macOS 签名校验。
- 不把旧电脑的用户数据、排序状态或插件缓存打进交接包。

## 验收

完成不是“文件下载成功”，而是目标电脑真实 Eagle 中出现原生排序面板，并完成一次排序拖动、自动编号和智能文件夹读取。若主网格没有面板，先检查 `app.asar` SHA-256 是否与上面的固定指纹一致，再检查插件日志中的 `BOOTSTRAP_READY → INJECT_START → INJECT_OK`。
