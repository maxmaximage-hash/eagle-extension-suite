# Project Documentation Index

状态：唯一导航页。此页只负责指路，不承载业务决策。

## 入口

- [Active Work Dashboard](./ACTIVE-WORK-DASHBOARD.md)
- [Baseline and Release Registry](./BASELINE-AND-RELEASE-REGISTRY.md)
- [Incident and Regression Index](./INCIDENT-AND-REGRESSION-INDEX.md)
- [Document Lifecycle](./DOCUMENT-LIFECYCLE.md)

## 主线

- Eagle 排序与重命名：`extensions/media-organizer/`
- Eagle 媒体处理与线上发布：`extensions/online-publisher/`
- Eagle GPS 与元数据标签：`extensions/media-organizer/`
- 共享基础设施：`docs/EAGLE-EXTENSION-MODULE-BOUNDARIES.md`
- 网页导入：`extensions/web-media-importer/`、`extensions/instagram-post-importer/`、`extensions/xiaohongshu-post-importer/`

## 读文顺序

1. 先看 [Document Lifecycle](./DOCUMENT-LIFECYCLE.md) 识别 active / frozen / historical / archive。
2. 再看 [Active Work Dashboard](./ACTIVE-WORK-DASHBOARD.md) 判断当前是否允许改动。
3. 需要版本和回滚依据时查 [Baseline and Release Registry](./BASELINE-AND-RELEASE-REGISTRY.md)。
4. 需要事故、回归或 R-ID 时查 [Incident and Regression Index](./INCIDENT-AND-REGRESSION-INDEX.md)。

## 现状说明

- `extensions/media-organizer/` 当前唯一已安装且已验证基线为 `2.5.22-qa.113/API189`。
- 该状态不等于用户已完成最终主观验收，也不等于已经执行外部分发或正式发布。
- 根目录现有 `PROJECT.md`、`TASKS.md`、`DECISIONS.md` 属于历史总览，不替代本索引。
