# Document Lifecycle

状态：文档生命周期规则。新增治理文档必须先落到这里的命名与归类规则。

## 生命周期

- `active`：当前必须直接使用的文档，例如总导航、当前工作台、当前基线和当前事故索引
- `frozen`：已经定版但仍需保留作为基线或回滚依据的文档
- `historical`：保留事实，不再作为当前决策来源的文档
- `archive`：仅用于长期保存，不再参与日常导航

## 命名规则

- active 文档优先使用大写短横线名，例如 `PROJECT-DOCUMENTATION-INDEX.md`
- frozen 文档优先带日期或版本，例如 `FROZEN-BASELINE-2026-07-23.md`
- historical 文档优先保留原始任务名或事故名，例如 `R97`、`INCIDENT-2026-07-27-...`
- archive 文档必须在文件名中显式带 `archive`、`historical` 或日期区间

## 放置规则

- `docs/governance/` 放 active 与跨项目索引
- `extensions/<module>/docs/` 放模块内冻结基线、测试矩阵和台账
- 根目录保留少量总览文件，不再新增一批互相打架的状态页

## 新文档准则

1. 先问自己它是否会改变发布状态的理解。
2. 会改变则优先进入 active / frozen，并加上清楚状态。
3. 不会改变则只做 historical 附录或模块内补充。
4. 不要把 candidate、installed、released 混成一个词。

## 旧文件归属

- 根 `PROJECT.md`、`TASKS.md`、`DECISIONS.md`：历史总览，不再作为唯一导航
- `extensions/media-organizer/TASKS.md`、`DECISIONS.md`：模块现役任务与决策事实
- `extensions/online-publisher/DECISIONS.md`：B 线决策事实
- `extensions/web-media-importer/README.md`、`TASKS.md`：导入线说明与任务

