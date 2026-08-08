# 媒体智能整理运行源码

本目录是 GitHub `main` 的 `2.5.22-qa.34` 单一开发真源，包含运行代码、自动测试与永久治理契约。它取代旧目录中的 qa.27 解压源码；安装包仍须由受控构建流程生成并单独验证。

qa.34 延续既有排序、改名和 GPS/元数据安全边界，并补充全局/未知视图放行、智能集合宿主快照以及主 Library 就绪门禁。自动测试通过只表示开发预检通过，不代表已经完成真实 Eagle 验收。

本目录不包含团队 sidecar、标签状态、缓存、备份、真实 Library/NAS 路径、测试素材、Eagle `app.asar` 或桥接载荷。完整功能、限制与安装方式见仓库根目录文档。

排序唯一规范见 `docs/SORTING-RULES.md`，永久回归合同见 `docs/PERMANENT-REGRESSION-CONTRACT.md`。GitHub 脱敏测试可运行 `npm ci && npm test`。依赖历史真实团队状态的现场数据不随仓库分发，仓库绝不为复跑测试而上传真实 sidecar。
