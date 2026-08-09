# 团队排序状态接力审计：2026-07-19-v2.4.2

审计时间：2026-07-19

## 范围

只读审计目录：

`/Users/max/Downloads/团队排序状态接力-2026-07-19-v2.4.2/`

未执行包内代码，未导入状态，未用 v2.4.2 覆盖本机 2.4.6 候选代码。

## 文件清单

- `媒体智能整理-v2.4.2-team.eagleplugin`
  - 大小：2,507,988 bytes
  - SHA-256：`550013830c8c3d99eda624030c8b8b50fd4998c4c0c6bc9c7190a45bd45058a2`
  - 类型：旧团队版插件代码包，manifest 版本 `2.4.2`。
- `引力环球-library-2026-07-19.eagle-sort-state.json`
  - 大小：70,091 bytes
  - SHA-256：`07847e29a03f26675b5bbfeb8a120e07948e1790b62d75682b3cbfa01b66076b`
  - 类型：另一台电脑导出的真实排序状态数据。
- `SHA256SUMS.txt`
  - SHA-256：`fc5f31e40571bf292078e97c679335a38c0fd32a7b9cd7bd68d276e20c0f449c`
  - 类型：导出清单。
- `00-请先阅读-团队排序状态接力说明.md`
  - SHA-256：`c00adcf9a0c61f9601033dcb6757b464dc777a3af731ef9b6a12f650a3f9e2c2`
  - 类型：说明文档。

## 状态数据结论

交接状态 JSON 与本机 2.4.6 候选包内置文件
`defaults/sort-state/team.eagle-sort-state.json` 逐字节一致。

状态摘要：

- format：`gravity-eagle-team-sort-state`
- schemaVersion：`1`
- exportedAt：`2026-07-19T09:48:48.572Z`
- source.pluginVersion：`2.4.1`
- 源 Library 键：
  `/Users/max/%E5%BC%95%E5%8A%9B%E7%8E%AF%E7%90%83/%E5%BC%95%E5%8A%9B%E7%8E%AF%E7%90%83.library`
- 存储键：9 个
- 多级排序规则：99 个文件夹
- 防止全局覆盖：17 个文件夹，809 个固定顺序项目
- 简介字段：85 个文件夹
- 自动编号：98 个文件夹

`9-杭州 / 散组` 对照：

- NAS Library 路径：`/Volumes/团队文件-MAX线上协作中台/引力环球.library`
- `散组` ID：`MKPBHL373OFYO`
- `散组` 在状态中：
  - 防止全局覆盖：未直接锁定
  - 多级规则：存在
  - 简介字段：存在
  - 自动编号：存在
- `散组` 17 个直接子文件夹：
  - 防止全局覆盖：17/17 均存在
  - 多级规则：17/17 均存在
  - 自动编号：17/17 均存在

NAS ID 覆盖：

- 锁定文件夹：17/17 能在当前 NAS Library `metadata.json` 中找到
- 规则文件夹：98/99 能找到，缺失 ID：`MNOU2HHLLPGW6`
- 简介字段：84/85 能找到，缺失 ID：`MNOU2HHLLPGW6`
- 自动编号：97/98 能找到，缺失 ID：`MNOU2HHLLPGW6`

缺失 ID 不在当前 NAS `metadata.json` 中，不能按名称猜测导入对象。

## 代码结论

`媒体智能整理-v2.4.2-team.eagleplugin` 是旧代码包：

- manifest 版本：`2.4.2`
- plugin API_VERSION：`34`
- 内置团队状态文件与本机候选一致
- 包内导入模块：`lib/team-sort-state.js`
- 缺少本机 2.4.6 候选中的：
  - 高层级“防止全局覆盖”UI
  - 全部排列/显示选项统一“应用到全部”
  - 自动编号两步启动
  - 更保守的团队导入策略
  - `folder-tree-batch-core.js`
  - `team-sort-state-core.js`

旧团队版导入会包含 `eagle.photoTakenSort.autoRename.v1`；本机 2.4.6 候选默认跳过该风险键，避免启动后自动编号触发真实改名。

## 分类

可直接接收项：

- 状态 JSON 可作为同一份团队状态源；它已在 2.4.6 候选包内置，无需重复接收。
- 说明文档可作为审计证据保留。
- SHA 清单可作为交接完整性证据保留。

需要合并项：

- 无新增状态需要合并；新包状态与本机候选内置状态完全一致。
- 无新增代码能力需要从 v2.4.2 向前合并；本机 2.4.6 已覆盖且更安全。

冲突项：

- v2.4.2 团队插件会导入自动编号状态；本机 2.4.6 候选有意跳过自动编号风险键。
- v2.4.2 保护开关仍在多级排序区域内；本机 2.4.6 已提升为排序系统高层级开关。
- v2.4.2 版本号低于本机候选，不能覆盖安装。

过期项：

- `媒体智能整理-v2.4.2-team.eagleplugin` 仅用于代码和交接方式审计，不应用于安装。

缺失项：

- 交接状态中的锁定记录不包含 2.4.6 新增的完整 `orderBy/config` 快照字段；这是因为源状态来自 2.4.1。
- 当前 NAS `.library/metadata.json` 中保存了文件夹原生 `orderBy` 和 `sortIncrease`，所以同一 Library 接力不需要从 Local Storage 额外恢复这些字段。
- ID `MNOU2HHLLPGW6` 当前 NAS Library 未找到。若确需恢复该文件夹，需要另一台电脑提供最新 Library 元数据或确认该文件夹已删除/迁移。

## 待批准动作

如需恢复本机 Eagle 插件运行：

1. 先确认是否恢复已被临时改名的本机 2.4.5 安装目录，或直接安装 2.4.6 候选包。
2. 恢复前备份：
   - 当前插件目录状态
   - `~/Library/Application Support/Eagle/Local Storage/leveldb`
   - 媒体智能整理插件目录中的 `diagnostic.log`、`photo-taken-cache.json`、`geo-tag-state.json`
3. 经用户批准后再执行安装/恢复和真实 Eagle 验证。

## 运行状态风险登记

本轮审计期间，用户报告 Eagle 卡在“即将完成”。已发生的运行状态变更：

- 已正常退出过 Eagle。
- 已将已安装媒体智能整理插件目录改名：
  - 原路径：`~/Library/Application Support/Eagle/Plugins/com.max.eagle-photo-taken-sort`
  - 当前路径：`~/Library/Application Support/Eagle/Plugins/com.max.eagle-photo-taken-sort.disabled-20260719-190140`
- 已重新启动过 Eagle。

后续不得自行回滚或继续处理，需等待用户批准。

## 2026-07-19 批准后执行结果

- 已安装并验证媒体智能整理 `2.4.7`，没有安装旧团队版 `2.4.2`。
- 已修复启动早期 `rootDir=default` 导致团队状态写入错误作用域的问题；现在等待真实 NAS `.library` 路径后再导入，并合并保留其它 Library 状态。
- 已将同 ID 的旧 2.4.5 目录移出 Eagle `Plugins` 根目录，避免 2.4.5 与 2.4.7 重复注入；原目录保存在 Codex 备份中，未删除。
- 真实导入日志：规则 99 个文件夹、保护 17 个文件夹、简介 85 个文件夹，跳过自动编号风险键 1 个。
- 真实界面：`散组` 自身未锁定并显示“下级已保护 17 个文件夹”；`浴袍照` 显示“已保护 58 个项目”，复选框为勾选状态。
- 完整退出并重启 Eagle 后，上述父级汇总和子文件夹锁定均保持不变，证明锁定状态已持久化。
- 启动遮罩“即将完成”可通过 `Esc` 关闭；这是 Eagle 主界面遮罩问题，与团队状态导入失败不是同一故障。
- 未修改 `.library` 内部结构，未导入 `eagle.photoTakenSort.autoRename.v1`。

最终安装包：

- `releases/媒体智能整理-v2.4.7.eagleplugin`
- SHA-256：`b5671c7f5e9d39506e7d0914c879e8cacf4b3372bba8b37743e697a2f1b09f5a`

恢复点：

- `~/Library/Application Support/Eagle/Codex Backups/media-organizer-20260719-193500/`
