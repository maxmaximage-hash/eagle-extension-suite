# EAGLE 扩展跨电脑交接

本仓库是 Eagle 扩展的唯一源码来源。另一台 Mac 只需要从 GitHub 拉取同一个 `main`
分支，再按 [跨电脑同步与交接](docs/CROSS-COMPUTER-HANDOFF.md) 构建和安装；不要复制这台
电脑的 Eagle 插件目录、`.library`、NAS 素材、缓存或运行状态。

## 当前交接基线

- 媒体智能整理：产品版本 `2.5`，源码 `2.5.22-qa.94`
- MAX Publisher：产品版本 `1.2`，源码 `1.2.7`
- Eagle 工作台：`1.1`
- Instagram 整帖导入：`1.1`
- 小红书整帖导入：`1.0`
- Live Photo 管家：`0.1` Demo
- 头像共享源：`1.0`

GitHub 只保存源码、测试、构建脚本和说明。`.eagleplugin`、`node_modules`、运行缓存、
真实资源库状态和本机 Library 内部 ID 均不会进入仓库；在目标电脑上重新构建即可得到同一
版本的安装包。

## 目标电脑执行

```zsh
git clone https://github.com/maxmaximage-hash/eagle-extension-suite.git
cd eagle-extension-suite
git switch main
open docs/CROSS-COMPUTER-HANDOFF.md
```

然后按文档逐项完成依赖安装、测试、打包、Eagle 插件安装和 Chrome 扩展加载。所有扩展
都必须使用仓库中的唯一插件 ID，不要并行安装旧目录或第二份同 ID 插件。

## 不同步的内容

当前电脑的 Library 路径、NAS 挂载路径、素材、排序状态、Cloudflare 登录态、本机字体、
Chrome 登录态和 Eagle 运行缓存都属于本机环境。它们不能安全地放进 GitHub；目标电脑应
打开同一个 NAS Library（或它自己的本地 Library），再分别配置自己的字体、Cloudflare 和
Chrome 权限。
