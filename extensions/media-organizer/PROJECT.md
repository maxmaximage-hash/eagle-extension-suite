# 项目档案

- 项目名称：Eagle 媒体智能整理
- 项目类型：Eagle 独立扩展
- 所属产品：EAGLE 扩展
- 插件 ID：`com.max.eagle-photo-taken-sort`
- 当前活动版本：`2.5.22-qa.38 / API 115`（真实 R58 失败候选；Eagle 已正常退出）
- 支持基线：Eagle 4.0 build 23
- 当前状态：qa.38/API115 已完成受控 T3：启动隔离和首帧 loading 继续通过，但真实宿主语义证明 `allData` 才是完整智能结果、`filtereds` 只是分页切片，旧 source ownership 仍倒置，已登记 R58。qa.39/API116 正在按 route + mapping imageCount + 完整 allData 的事实组合修复；真实通过前不得发布完成结论。
- 创建日期：2026-07-18
- 最后更新：2026-08-08

## 能力

- schema v3 确定性单级/多级排序，普通与智能文件夹共用排序引擎；
- 智能文件夹只提供当前查询结果排序与手动相对位置，不提供自动编号或改名；
- `拍摄时间排序`（单键）与`多级排序`（组合键）是并列排列方式；
- 排列方式上方固定显示三个独立开关：排序锁定、手动拖动、自动编号；每行有自己的“应用到全部”；
- 多级排序在排列方式下方内联显示全部规则，文件夹级“应用到全部”位于规则区之后；
- 当前层直接媒体/直接子文件夹两类手动拖动，以及递归下发开关的明确边界；
- `sortingLocks.v3` 硬锁优先于排列、拖动、自动编号和文件名；旧 17 条团队保护自动升级为同级硬锁；显示简介等纯展示配置不受锁定影响；
- 连续重命名；
- 普通文件夹的自动编号直接消费当前单级/多级排序与显式手动覆盖的最终顺序；
- GPS 地域识别和文件夹地域标签；
- Library 绑定的团队排序与展示状态发布、自动读取和文件导入；
- Eagle 主程序桥接。

## 边界

- 不属于 MORROW。
- Eagle API、主窗口注入和资料库状态属于本扩展适配层。
- 不直接修改媒体内容；连续重命名除外，必须提供预览和撤销记录。
- 已修故障不得只留在聊天或提交说明中；必须进入永久回归合同、自动测试和真实 Eagle 发布门禁。
- 所有验收结论只以真实 Eagle 界面显示为准；测试、日志、内部状态和理论符合均不能宣布通过。

## 当前治理状态

- `2.5.21 / API 77` 已冻结，不是可发布候选；R34 原生拖出最新真实 UI 明确未通过。
- 当前 7,846 行 `plugin.js` 是待迁移现状：A 排序与重命名和 C GPS/标签仍共享生命周期、
  注入、监控和 UI，不能继续在其中追加跨层业务规则。
- A 的目标是 L0-L8 单一链：EventOwnership → CollectionSnapshot → BaseOrder →
  ManualOverlay → FinalVisibleOrder → 可选 RenamePlan/Transaction。
- 事实、基线、历史故障、行为矩阵和迁移批次分别记录在 `docs/SORTING-AUDIT-2026-07-23.md`、
  `docs/FROZEN-BASELINE-2026-07-23.md`、`docs/SORTING-BUG-LEDGER.md`、
  `docs/SORTING-BEHAVIOR-TEST-MATRIX.md` 和 `docs/SORTING-MIGRATION-PLAN.md`。
