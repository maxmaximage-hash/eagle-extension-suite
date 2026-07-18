# Eagle 媒体智能整理协作规则

## 运行

```bash
npm ci
npm test
```

插件安装与 Eagle 主程序桥接必须在阅读 `bridge/README.md` 和恢复脚本后执行。

## 验证

- 所有 Node 测试通过。
- 插件版本与安装版一致。
- Eagle 不自动弹出插件窗口。
- 真实文件夹中拍摄时间显示和升降序正确。
- 恢复脚本对应的 `app.asar` 哈希有效。

## 约束

- 未确认 Eagle 精确版本前不覆盖 `app.asar`。
- 不删除备份或恢复脚本。
- 不直接批量修改 Eagle `.library` 内部文件。
- 运行数据、缓存和日志不进入 Git。
- 完成任务后更新 `TASKS.md`，重要决定写入 `DECISIONS.md`。
