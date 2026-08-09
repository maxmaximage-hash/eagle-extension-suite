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

## 当前冻结与必读契约

- 当前安装基线 `2.5.21 / API 77` 已冻结；先读
  `docs/FROZEN-BASELINE-2026-07-23.md`，不得把同版本号继续覆盖为不同现场行为。
- 排序修改前必须读 `docs/SORTING-BUG-LEDGER.md`、
  `docs/SORTING-TARGET-ARCHITECTURE.md`、`docs/SORTING-BEHAVIOR-TEST-MATRIX.md` 和
  `docs/SORTING-MIGRATION-PLAN.md`，登记影响的 R-ID 与旁路冲突。
- 先写失败测试，再改最小层；永久回归只能增加，不能删除或弱化来让测试通过。
- A 排序与重命名不得启动、import 或共享 C GPS/标签业务状态；B 不在本项目代码范围。
- UI 只生成 command；L3 排序、L4 manual view、L5 protection guard、L6 rename
  transaction 各有唯一所有权，不得新增第二排序器、第二拖动状态机或第二改名入口。
- 未经用户再次批准不得安装、不得重启 Eagle、不得操作真实 Library、不得操作 NAS；
  真实 Eagle 界面虽是最终验收标准，也只能在批准的备份点和测试目录执行。
