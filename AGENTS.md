# EAGLE 扩展协作规则

## 项目

EAGLE 扩展是独立产品体系。MORROW 和其他软件只能通过共享模块复用能力，不能直接依赖插件内部实现。

## 当前阶段

本目录目前是迁移目标骨架，不是正在运行的标准插件目录。迁移前先读取各历史项目规则和恢复脚本。

## 运行

迁移后按每个扩展分别填写安装、启动和加载方式，并记录支持的 Eagle 版本。

## 验证

迁移后至少执行自动测试、扩展加载、真实 Eagle 操作和恢复流程检查。涉及 `app.asar` 或桥接修改时必须先验证备份。

## 约束

- 不直接批量修改 Eagle `.library` 内部文件。
- 不破坏现有 Eagle 安装、桥接备份或恢复脚本。
- 共享模块不得依赖 Eagle API；Eagle 差异放在 `adapters/`。
- 未停止相关服务和记录指纹前不移动正在使用的插件。
- 完成任务后更新 `TASKS.md`，重要决定写入 `DECISIONS.md`。

## 排序与重命名治理门禁

- A 排序与重命名、B 媒体处理与发布、C GPS/元数据标签必须保持业务隔离，只能依赖
  `docs/EAGLE-EXTENSION-MODULE-BOUNDARIES.md` 定义的基础设施接口。
- 修改 A 前必须先读 `plugins/media-organizer/docs/SORTING-BUG-LEDGER.md`、
  `SORTING-TARGET-ARCHITECTURE.md`、`SORTING-BEHAVIOR-TEST-MATRIX.md` 和迁移计划，列出
  受影响 R-ID 与冲突关系。
- 任何修复必须先写失败测试，再修改最小所有权模块；不得在 UI/DOM 事件里新增业务规则。
- 自动测试只是进入真实 Eagle 验收的门禁。真实 Eagle 界面是最终验收真源，但未经用户
  再次批准不得安装、不得重启 Eagle、不得操作真实 Library 或 NAS 素材。
- Eagle 原生选择、预览、右键、快捷键、拖出、导入导出和集合语义是 L0；扩展无法确认
  事件所有权时必须放行原生行为。
