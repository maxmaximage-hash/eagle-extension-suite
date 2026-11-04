# Eagle 主程序恢复任务

这是独立的 Eagle 启动恢复流程。它只恢复 Eagle 主程序的原始 `app.asar`，不删除或修改：

- Eagle `.library`
- NAS 素材
- Eagle 插件源码
- 排序 sidecar

## 使用

在另一台电脑拉取仓库后，先完全退出 Eagle，然后执行：

```zsh
git pull origin main
zsh recovery/restore-eagle-host.sh
```

脚本会优先使用本机桥接安装时生成的原始 `app.asar` 备份，并校验 SHA-256。恢复成功后，
先直接打开 Eagle 验证原生界面；确认 Eagle 能正常启动后，再重新安装扩展。

如果提示没有原始备份，脚本不会覆盖未知的 Eagle 文件，也不会删除任何插件或 Library。
此时请按脚本输出执行官方 Eagle 重装，或把诊断结果发回项目任务。
