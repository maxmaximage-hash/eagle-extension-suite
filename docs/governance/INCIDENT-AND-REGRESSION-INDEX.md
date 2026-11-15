# Incident and Regression Index

状态：事故与 R-ID 台账入口。这里汇总入口，不重复写完整根因故事。

## 主台账

- 排序历史 bug 永久台账：`extensions/media-organizer/docs/SORTING-BUG-LEDGER.md`
- 永久回归合同：`extensions/media-organizer/docs/PERMANENT-REGRESSION-CONTRACT.md`

## 近期主线

- R97：普通与智能手动拖动竞态
- R98：原生添加日期不得被旧多级意图覆盖
- R99：普通文件夹切换时的快闪/空白/假 0 项/延迟恢复

## 其他常见归类

- R01-R39：排序与重命名基础回归面
- R40-R64：顺序权威、筛选、缓存、资源解析与背压
- R65 以后：继续按 `SORTING-BUG-LEDGER.md` 的编号顺序追踪

## 阅读规则

- 事故只看当前事实链，不用“看起来像”替代证据
- 任何新修复都先回到 bug ledger 查对应 R-ID
- 需要受影响面时再回到 `SORTING-BEHAVIOR-TEST-MATRIX.md`

