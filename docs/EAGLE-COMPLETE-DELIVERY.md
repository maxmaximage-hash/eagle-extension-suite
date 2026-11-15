# Eagle 完整跨电脑交付

## 目的

Eagle 的原生排序面板不只由插件源码决定，还依赖 Eagle 4.0.0 build 23 的专用通信桥。跨电脑复制必须同时取得：

1. 本仓库 `main` 分支中的全部插件源码；
2. GitHub Release `v2026.11.14-eagle-complete-1` 中的桥接版 Eagle 主程序；
3. 同一版本的媒体智能整理插件包。

只执行 `git pull` 或只安装 `.eagleplugin`，不会得到原生主网格排序面板。

## 固定交付指纹

| 项目 | 值 |
| --- | --- |
| Eagle | 4.0.0 build 23 |
| 原始 `app.asar` SHA-256 | `b04a2efdb8bc8d06910552f43f38c056e6964c8f74798e1b2849f1bffab8a1bd` |
| 桥接 `app.asar` SHA-256 | `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3` |
| 媒体智能整理 | `2.5.22-qa.94` |
| 完整交付 Release | `v2026.11.14-eagle-complete-1` |

## 另一台电脑的安装顺序

1. 从仓库拉取 `main`。
2. 从上述 Release 下载 `Eagle-4.0.0-build23-bridged-app.asar` 和完整交付压缩包。
3. 完全退出 Eagle。
4. 先通过 `extensions/media-organizer/bridge/install-compatible-bridge.sh --check` 检查宿主；只有 Eagle 为 4.0.0 build 23 且原始 `app.asar` 指纹匹配时才允许安装桥接。
5. 使用交付包中的桥接安装脚本安装桥接主程序，再安装 `2.5.22-qa.94` 媒体智能整理插件。
6. 重启 Eagle，确认主网格出现排序锁定、手动拖动、自动编号和多级排序。

## 安全边界

- 不复制或修改任何 Library、NAS 素材和 `.library` 内部文件。
- 桥接主程序只接受固定 Eagle 版本和固定指纹；未知宿主必须拒绝安装。
- 回退脚本只恢复安装前自动保存的原始 `app.asar`，不删除插件和用户资料。

