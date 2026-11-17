# 跨电脑同步与交接

更新时间：2026-11-17。GitHub 同步软件源码、默认模板和安装包。目标电脑保留自己的 Library、挂载路径、客户文案配置和登录状态。

## 当前版本与入口

- 工作台 2.1；运行服务 2.5.22-qa.104。
- 交付文案 1.6：保留编辑文本与换行，粘贴夸克分享消息后提取有效 URL；模板从工作台管理。
- 排序与自动编号 2.6、人物/环境图重命名 1.0：在 Eagle 布局面板执行。
- 地点与元数据标签 2.6：由工作台打开独立标签面板。标签窗口没有复制、排序、改名或交付面板。
- MAX Publisher 1.2.7；Live Photo 管家 0.2.0-dev.11（Demo）；静态照片信息 0.1.0；头像共享源 1.0.0。
- 复制文件夹的源码保留，真实递归副本及引用验收尚未完成，不能按已交付功能使用。

## 1. 获取源码或整套发行包

```zsh
git clone https://github.com/maxmaximage-hash/eagle-extension-suite.git
cd eagle-extension-suite
git switch main
```

也可下载 GitHub Releases 的整套 ZIP，解压后阅读 `SYNC-INSTRUCTIONS.md` 和 `PLUGIN-REGISTRY.json`。先在解压目录运行 `shasum -a 256 -c SHA256SUMS`。发布包不包含 Eagle 主程序、Library、运行状态或客户分享链接。

## 2. 从源码测试和构建

构建环境需要 Node.js/npm、Python 3、Git、zsh 和系统 zip/unzip。Python 3 用于正确保存含中文安装器文件名的整套 ZIP；直接下载发行包的使用者不需要安装这些构建工具。

```zsh
(cd extensions/media-organizer && npm ci && npm test)
(cd extensions/eagle-workbench && npm test)
(cd extensions/online-publisher && npm ci && npm test)
(cd extensions/avatar-source-publisher && npm test)
(cd extensions/live-photo-manager && npm test)
(cd extensions/web-media-importer && npm test && npm run check)
(cd extensions/xiaohongshu-post-importer && npm test && npm run check)
zsh scripts/build-eagle-suite-release.sh
node scripts/verify-eagle-suite-release.cjs releases/eagle-suite-v20261117-suite-sync-1
```

本机依赖和 `.eagleplugin` 属于构建产物，不进入 Git 源码历史。完整发行包包含所有运行依赖；工作台的 `delivery.js`、`delivery-entry.js` 和媒体服务的 `lib/delivery-template-core.js` 均在包内。

## 3. 在目标电脑安装

安装前完全退出 Eagle，确认 Eagle 4.0.0 的精确版本和当前宿主指纹，同一插件 ID 只保留一个活动来源。

媒体服务的当前安装器为：

```zsh
cd extensions/media-organizer
zsh scripts/build-github-release.sh
zsh releases/install-媒体智能整理-v2.5.22-qa.104.sh --check
```

已通过当前审计桥接指纹/证据的宿主，检查通过后运行同一安装器的 `--install-plugin`。安装器会备份被替换的插件，不改写宿主或 Library。原始未桥接宿主的 `--check` 会明确拒绝桥接安装路径；只安装插件可使用 `--install-plugin-only`，但这不恢复主网格的排序兼容能力。

需要主网格通信兼容层时，应先在 `extensions/media-organizer/bridge` 阅读 README、核对版本/指纹并执行 `npm ci` 和 `node rebuild-compatible-bridge.js --check`。按当前机器的签名、备份和启动门禁评审兼容流程；不运行已永久停用的旧安装器，不复制另一台电脑的 `app.asar`。本轮 GitHub 同步没有执行任何宿主安装。

整套包的 `plugins/` 目录包含其余 5 个 Eagle 插件，可通过 Eagle 插件安装入口安装；媒体服务优先使用上述受控安装器。工作台包为 `com.max.eagle-workbench-v2.1.eagleplugin`。浏览器扩展从 `assets/*.zip` 解压，在 Chrome 的 `chrome://extensions/` 中加载 Instagram、小红书和网页媒体导入器三个目录。

## 4. 本机数据与凭证

排序规则、手动顺序、锁定和自动编号状态属于当前 Library，不通过 GitHub 同步。同一 NAS Library 可读取其旁边受控 sidecar；不同 Library 保持各自状态。交付模板的本机配置与正式客户文案不进入仓库，软件默认模板保留指定正文和教程。Cloudflare 发布由每个操作者授权，字体由目标电脑发现；Chrome 登录状态、目录与权限也需本机配置。

## 5. 真实验收

目标电脑必须启动到可操作的真实 Library，记录耗时，并确认工作台和布局插件面板持续可见。手动拖动、升降序、自动编号、人物/环境图重命名必须实际操作，切换文件夹和重启后再次核对持久化；不能用测试输出、进程或桥接状态代替。交付文案需实际扫描、编辑分享链接并复制全文；标签、Publisher、Live Photo 与导入器按各自使用范围验收。复制文件夹继续保持未完成，不与这次同步混为一项验收。
