# Eagle 4.0 build 23 通信桥

Eagle 的公开插件 API 不允许插件窗口访问主窗口 DOM。本机安装版本在以下两处
加入了专用 IPC：

- `app/js/plugin/index.js`：在 Eagle 主窗口执行带固定标记的排序注入脚本。
- `app/js/plugin/api.js`：向本插件暴露 `eagle.photoTakenSort.execute()`。

原始 `app.asar` 已备份。Eagle 更新会覆盖这个桥；更新后应先确认新版本内部结构，
再重新应用，而不是直接复用旧的 `app.asar`。
