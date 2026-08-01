# 排序与重命名迁移计划

状态：设计批准前的迁移约束。本文不授权删除旧代码、迁移用户状态、安装候选包、重启
Eagle 或操作真实 Library。

## 迁移原则

1. 冻结当前 `2.5.21 / API 77` 与 API 75 回滚目录，所有变更从可回退基线开始。
2. 先建立目标接口和失败测试，再把一个入口迁移到唯一链；不在旧入口上继续扩功能。
3. 旧实现先隔离、再影子比对、再切换所有权，最后才标记废弃；本阶段不直接删除。
4. 旧 localStorage/sidecar 只读迁移，保留原始值和迁移审计；v2 完整手动数组迁移为
   `legacyFullOrder`，不得继续作为新自动排序的活动覆盖。
5. 每批只改变一个可证明边界，真实 Eagle 验收必须另行批准。

## 现有代码处置

| 现有区域 | 处置 | 目标 |
| --- | --- | --- |
| `lib/sort-core.js` | 保留并提取 | L3 纯排序；去除 manual/store 责任 |
| `lib/collection-core.js` | 提取 | L2 collection 模型与纯 profile；宿主读取另放 adapter |
| `lib/folder-level-core.js` | 保留并收紧 | 父/叶 target selection 纯逻辑 |
| `lib/folder-tree-batch-core.js` | 保留并收紧 | scope traversal/config plan，不执行宿主动作 |
| `lib/sorting-system-core.js` | 拆分 | command orchestration、L4 manual、L5 guard 分离 |
| `lib/rename-core.js` | 保留 | L6 不可变 RenamePlan |
| `lib/rename-batch-core.js` | 提取 | L6 多集合计划，不直接提交 |
| `lib/monitor-core.js` | 隔离 | 只做 adapter 诊断键；不得拥有排序/改名触发权 |
| `lib/team-sort-state-core.js` | 拆分迁移 | A/C 配置分库；旧格式只读兼容 |
| `plugin.js` 注入字符串 | 逐入口废弃 | 最终只保留薄启动器与独立 adapter 装配 |
| 渲染进程直接改名 | 标记废弃 | 唯一 `RenameTransaction -> HostRenamePort` |
| HTML5 + mouse 双状态机 | 标记废弃 | 一个内部 MoveCommand；原生 `dragstart` 不接管 |
| GPS/标签业务 | 原样隔离 | C 独立生命周期；本轮不改功能 |

“废弃”表示不得新增调用者且必须先有替代、迁移证据和回滚点，不表示现在删除。

## 分批实施

### 批次 0：治理与冻结

- 完成本次事实清单、模块边界、L0-L8、bug 台账、行为矩阵和治理自动门禁。
- 记录已安装版、源码、回滚目录和未通过现场结果。
- 退出条件：治理测试、现有自动测试、语法检查和 diff 检查通过；无运行环境写入。

### 批次 1：A 生命周期与事件 ownership

- 当前状态：边界 facade 已接入 `plugin.js` 注入监听器的 start/stop bridge；R34 的
  真实 Eagle 结果仍保持红灯，不能以源码测试替代。
- 新建 A 的独立 `start/stop/status` 与 `EventOwnership`、`HostEventPort` 契约。
- 先用失败测试证明：未知落点和网格外拖放不拦截；停止后所有资源释放。
- 以兼容 adapter 包住当前宿主调用，只切事件入口，不迁移排序和改名。
- 退出条件：R01、R16、R17、R34 契约测试通过；B/C 与 Eagle 原生无行为变化。

### 批次 2：R21 唯一编号命令队列

- 当前状态：`rename-command-queue.js` 已按 collection 隔离；`plugin.js` 的
  `handleRenameBatchRequest` 只负责 enqueue/确认/start，执行器负责 claim/process/complete。
- 签名只能在 `acknowledgeRenameEnqueue` 成功后写入；入队失败、上下文变化、部分失败都会
  释放签名并恢复可重试请求。
- 退出条件：队列状态机、plugin 集成和 R21 永久回归测试通过；未安装前不宣称真实编号
  可用。

### 批次 2：统一 collection snapshot

- 普通、智能、父、叶只输出 `CollectionSnapshot`；全部/未知返回受控不可操作。
- 建立 Library + collection + revision + member fingerprint 校验。
- 退出条件：R10-R15、R31 的 adapter/性能测试通过，不存在整库 fallback。

### 批次 3：唯一顺序链

- L3 只输出 base order；L4 只输出 current collection 的 final visible order。
- v3 `ManualOverlay` 只保存相对关系；旧完整数组保留为历史/回滚字段，不参与新排序。
- 关闭手动输入不清除 overlay；保护 L5 只返回 allow/deny。
- 退出条件：R01-R05、R08-R09、R15、R19-R20、R33 的组合测试通过。

### 批次 4：唯一编号与改名事务

- 删除调用权而非立即删除代码：旧直改入口先置为不可达，并由测试证明无第二入口。
- 只有有效 MoveCommand 或预览确认可以创建 RenamePlan。
- 队列按 Library + collection 隔离，事务两阶段验证、失败回滚、明确恢复。
- 退出条件：R04-R07、R14、R18-R32 自动门禁全部通过。

### 批次 5：配置迁移与 A/C 隔离

- 目标写入 `eagle.sorting.*`；旧 `eagle.photoTakenSort.*` 双读影子比对。
- C 的 meta/GPS 状态移入独立命名空间、生命周期和 UI ownership。
- 退出条件：旧状态不丢失、失败可回滚、A/C 单独关闭和故障互不影响。

### 批次 6：候选包与真实 UI

- 只有前述门禁全部通过才生成一个唯一候选标识，manifest 和 API 不得再一号多义。
- 用户批准后备份安装目录、完整重启，在指定测试目录执行行为矩阵。
- 任何真实界面失败都回到对应批次，候选不得发布。

## 第一批建议代码范围

下一次批准只处理批次 1：建立 A 独立生命周期、Host/Event adapter 契约和事件
ownership 失败测试；禁止未知落点 `preventDefault`。不同时迁移改名、不安装、不重启，
不触碰真实 Library，也不修改 B/C 的业务实现。

历史门禁原文保留：下一次批准只处理批次 1；本批已在不安装和不触碰真实 Library
的前提下完成源码接入，后续仍需独立测试 Library 批准。

## 回滚和证据

每批必须保存：变更前 Git/文件指纹、影响的 R-ID、失败测试、通过测试、迁移日志格式、
候选安装备份和恢复步骤。回滚只恢复本批新增的 ownership，不删除用户旧配置。若宿主
结构无法识别，默认关闭 A 写能力并保留 Eagle 原生能力。
