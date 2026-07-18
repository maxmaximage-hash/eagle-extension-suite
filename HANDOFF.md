# EAGLE 扩展跨电脑安装与开发接力

本交接目录只包含可恢复的离线产物，不包含 Eagle `.library`、已安装插件状态、
线上发布数据或账号凭证。不要把任何文件上传或直接用于线上发布。

## 三类交付

### 1. 一键可装

`01-一键可装/MAX-Publisher-v1.2.5.eagleplugin`

双击或拖入 Eagle 安装。它不要求修改 Eagle 主程序。安装后仍需用测试图片人工检查
水印、隐私打码、字体和本地导出；不要在交接验收中执行真实线上发布。

### 2. 需要一次手动加载

`02-需要一次手动加载/Instagram-整帖导入-v1.1.2-Chrome.zip`

1. 解压到一个以后不会移动的目录。
2. Chrome 打开 `chrome://extensions/`，开启“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的解压目录。
4. 修改源码后回到该页面点扩展卡片上的“重新加载”，并刷新 Instagram 页面。
5. Eagle 需保持运行；真实验收时选择一条有权访问的多图或视频帖子，通过媒体区域
   右键菜单导入，并核对图片、视频、标题和来源链接。

Chrome 不能直接加载这个 zip，必须先解压；这是一次手动加载，不是一键安装。

### 3. 因宿主版本需兼容安装

`03-宿主兼容安装/媒体智能整理-v2.4.1.eagleplugin` 是插件本体，但完整排序能力还依赖
Eagle 4.0 build 23 的通信桥。先阅读 `bridge/桥接审计说明.md`。

在另一台 Mac 上先运行：

```zsh
./bridge/install-compatible-bridge.sh --check
```

默认和 `--check` 都只检查。只有结果明确显示 Eagle 4.0.0 build 23 且当前
`app.asar` 是已知原始指纹时，完全退出 Eagle 后才可显式运行 `--install`。
未知版本或未知哈希会被拒绝，禁止绕过校验硬覆盖。安装器先保存原始文件并验证哈希；
回退时先退出 Eagle，再运行 `restore-compatible-bridge.sh --restore`。

## 开发接力

`04-开发接力/EAGLE-extensions-source.bundle` 是完整 Git bundle。新电脑执行：

```zsh
git clone EAGLE-extensions-source.bundle EAGLE-扩展
cd EAGLE-扩展
git switch main
```

继续开发前逐级阅读根目录和目标扩展的 `AGENTS.md`、`PROJECT.md`、`TASKS.md`、
`DECISIONS.md`。从新电脑带回改动时，在新电脑先提交，然后生成新的 bundle；原电脑用
`git fetch /路径/新.bundle main:refs/remotes/handoff/main` 检查差异，再合并或拣选提交。
不要用文件夹覆盖的方式带回源码。

`提交哈希.txt` 是交接基线，`最近提交清单.txt` 便于人工核对。目录根的
`SHA256SUMS.txt` 覆盖全部交付文件；收到后在该目录运行
`shasum -a 256 -c SHA256SUMS.txt`。

## 已完成与仍需人工完成

自动测试、构建、压缩包解压测试、版本核对、SHA-256 校验、桥接原始/修改后审计和
Git bundle 克隆验证已完成。根据安全约束，本专项没有修改当前 Eagle、已安装插件、
资料库和线上数据，也没有替用户执行真实 Eagle/Chrome 交互验收；这些人工冒烟项仍需
在目标电脑按上述分类完成并记录宿主版本。
