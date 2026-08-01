# 媒体智能整理运行源码

本目录是 `2.5.22-qa.27 / API104` GitHub 安装包逐文件解压得到的 44 个白名单运行文件，便于代码审阅；`releases/媒体智能整理-v2.5.22-qa.27-github.eagleplugin` 是实际安装产物。

排序业务行为仍以 `2.5.22-qa.26 / API103` 冻结基线为准。qa.27 只调整 GPS/元数据标签的首次运行安全：干净安装默认不扫描整库、不写标签，首次明确开启只建立基线，视频缺少 `ffprobe` 时给出明确诊断。

本目录不包含团队 sidecar、标签状态、缓存、备份、真实 Library/NAS 路径、测试素材、Eagle `app.asar` 或桥接载荷。完整功能、限制与安装方式见仓库根目录文档。

排序唯一规范见 `docs/SORTING-RULES.md`，永久回归合同见 `docs/PERMANENT-REGRESSION-CONTRACT.md`。GitHub 脱敏测试可运行 `npm ci && npm test`。三个依赖历史真实团队状态文件的迁移回归没有随仓库分发，但已在生成发行包前于唯一事实根完整通过；仓库绝不为复跑测试而上传真实 sidecar。
