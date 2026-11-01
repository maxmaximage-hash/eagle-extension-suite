# 跨电脑同步与交接

这是一台新 Mac 从 GitHub 恢复当前 Eagle 扩展套件的唯一流程。它恢复的是源码和功能，
不是把第一台电脑的 Library 素材、账号登录态或本机路径复制过去。

## 1. 拉取同一版本

```zsh
git clone https://github.com/maxmaximage-hash/eagle-extension-suite.git
cd eagle-extension-suite
git switch main
```

开始前确认：macOS、Eagle `4.0.0`，并完全退出 Eagle。目标电脑打开 NAS Library 时，
使用该电脑自己的挂载路径；不要把 `/Volumes/...` 或本机 `.library` 路径写入仓库。

## 2. 构建和测试

```zsh
cd extensions/media-organizer
npm ci
npm test
zsh scripts/build-github-release.sh
cd bridge
npm ci
node rebuild-compatible-bridge.js --check
cd ..
zsh releases/install-媒体智能整理-v2.5.22-qa.94.sh --check
cd ../..

cd extensions/eagle-workbench
npm test
npm run package
cd ../..

cd extensions/online-publisher
npm ci
npm test
npm run package:plugin
cd ../..

cd extensions/avatar-source-publisher
npm test
npm run package
cd ../..

cd extensions/live-photo-manager
npm test
cd ../..

cd extensions/xiaohongshu-post-importer
npm ci
npm test
npm run check
npm run package:stable
cd ../..

cd extensions/instagram-post-importer
# 这是 Chrome 解压扩展；源码本身就是可加载目录。
cd ../..
```

`.eagleplugin` 和 `node_modules` 是构建产物/依赖，不提交到 GitHub；每台电脑按上面的命令
本地生成。媒体智能整理安装器的 `--check` 只做 Eagle 版本、宿主桥接指纹、包校验和唯一
插件来源检查；检查失败时不得绕过保护去改 `app.asar`。

## 3. 安装 Eagle 扩展

先完全退出 Eagle，在媒体整理桥接目录执行一次本机桥接重建：

```zsh
cd extensions/media-organizer/bridge
node rebuild-compatible-bridge.js --install
cd ..
```

桥接脚本只接受 Eagle `4.0.0` 原始指纹，自动备份原始 `app.asar`，重建后验证两个
排序桥接入口，并写入本机 `bridge-evidence.json`。随后在媒体智能整理目录执行：

```zsh
cd extensions/media-organizer
zsh releases/install-媒体智能整理-v2.5.22-qa.94.sh --install-plugin
```

将下面这些本地生成的包分别拖入 Eagle 的插件安装入口：

- `extensions/eagle-workbench/eagle-workbench-1.1.eagleplugin`
- `extensions/online-publisher/max-eagle-publisher-1.2.7.eagleplugin`
- `extensions/avatar-source-publisher/releases/MAX头像共享源-v1.0.0.eagleplugin`

Live Photo 管家当前是 Demo，可在其目录打包后作为 Eagle 插件安装：

```zsh
cd extensions/live-photo-manager
rm -f max-eagle-live-photo-manager-0.1.eagleplugin
zip -qr max-eagle-live-photo-manager-0.1.eagleplugin \
  manifest.json index.html app.js server.js styles.css logo.png plugin.js lib
```

重启 Eagle 后，从插件菜单确认工作台、媒体智能整理、MAX Publisher、头像共享源和 Live
Photo 管家均只出现一份。

## 4. 加载 Chrome 扩展

在 Chrome 打开 `chrome://extensions/`，开启开发者模式，分别选择并加载：

- `extensions/instagram-post-importer/`
- `extensions/xiaohongshu-post-importer/`

加载后刷新对应网页，并使用目标电脑自己的 Eagle 与 Library 做一条真实导入冒烟测试。
Chrome 登录态、站点权限、下载目录和 Eagle 本地接口均不会从 GitHub 同步。

## 5. Library 与本机设置

排序规则、手动顺序、锁定状态和自动编号状态属于当前 Library 的运行数据，不放进 GitHub。
如果两台电脑打开同一个 NAS Library，媒体智能整理会从该 Library 旁边的受控 sidecar 读取
对应状态；如果使用不同本地 Library，两边自然保持各自独立。工作台只读显示版本和修复
日志，不会跨库同步或修改素材。

MAX Publisher 的本地水印、打码、导出不需要密钥；Cloudflare Pages 发布必须在目标电脑
使用操作者自己的登录态。字体文件也必须在目标电脑本机存在。

## 6. 交接验收

目标电脑必须实际确认：

1. Eagle 可打开目标 Library，插件菜单中每个 Eagle 扩展只有一个来源。
2. 工作台显示产品版本、基本功能和版本日志，不显示无效的入口/安装登记信息。
3. 媒体智能整理能读取普通文件夹和智能文件夹，排序、手动拖动、自动编号和地点标签可用。
4. MAX Publisher 能完成本地水印/打码/导出；线上发布只在配置个人 Cloudflare 后验收。
5. 两个 Chrome 扩展能在有权限访问的公开帖子上生成 Eagle 导入计划。
6. Live Photo 与头像共享源按各自 README 的边界运行，不修改 `.library` 内部文件。

任何一项失败，都应保留版本号、Eagle 版本、错误截图和复现步骤；不要直接复制第一台
电脑的插件目录或修改 Library 内部文件来“修复”。
