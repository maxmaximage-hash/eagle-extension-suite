# Active Work Dashboard

状态：当前工作台。这里只列“现在正在发生什么”，不写历史总览。

## 2026-10-30 当前安装事实

- Eagle 4.0.0 正在运行，`app.asar` SHA-256 为 `4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3`，与已审计 bridge 一致。
- 当前正式插件：排序助手 `1.17.0`、MAX Publisher `1.2.7`、Eagle 工作台 `1.1`；旧排序和 Publisher 目录均已备份。
- 已完成真实菜单/窗口加载验收；未执行真实 Library 写入、批量改名、导出落盘或线上发布。

## 当前任务

- 唯一项目总管：`[Eagle] 项目总管`
- 总管任务 ID：`01a095da-9b45-7890-b469-387d9a1030ec`
- 已退出排序专项：`01a04308-2871-7de3-ad83-2ede4324223f`（`call_id` continuation
  系统错误，归档保留历史，不再发送消息或 fork）
- 已退出总管：`01a03439-a1d2-7e81-bb8c-540eba5cdc28`（系统错误，继任关系已记录）和
  `019f8f8e-0465-7491-9dde-44a026e3dfc7`（`ctc/fc` 损坏），均只保留历史读取
- 当前用户约束：本轮已明确授权安装、重启 Eagle 和真实窗口验收；批量改名、Library/NAS 写入、导出落盘与线上发布仍须逐项验收。

## 当前事实

- 唯一正式源码：`extensions/media-organizer`，manifest `1.17.0`
- 唯一正式安装目标：`/Users/max/Library/Application Support/Eagle/Plugins/com.max.eagle-photo-taken-sort`，manifest `1.17.0`
- `2.5.22-qa.113/API189` 只保留为 2026-08-25 历史记录，不是当前版本事实
- `releases/` 当前仅有 `.DS_Store` 与网页媒体子目录；先前登记的 v1.16 包和校验文件当前缺失，
  来源与授权未知，不能记为已删除获准或生产构建收口
- 专项先连续 `completed/items=[]`，随后同任务模型恢复得到明确终态错误：
  `function_call_output requires call_id on HTTP requests; continuation via previous_response_id is only
  supported on Responses WebSocket v2`
- 2026-09-12 总管只读审计确认最后 UI 退回尚未落盘：`lib/native-layout-adapter.js` SHA-256
  `e2e5b28d11daab080f6c8f90e980003c664ca41b27b67d7f37b18dfa2f0f3782` 仍构造三个来源按钮，
  生命周期/结构测试与两份权威文档仍要求这些按钮存在；当前源码不具备生产构建资格
- 本轮已完成插件安装和 Eagle UI 验收；未修改 `app.asar`，未操作 `.library`、NAS 素材或线上发布数据。

## 三条主线

- Eagle 排序与重命名：唯一责任范围是排序、手动顺序、自动编号、安全改名
- Eagle 媒体处理与线上发布：唯一责任范围是水印、打码、字体、快速导出、线上发布
- Eagle GPS 与元数据标签：唯一责任范围是离线 GPS 读取、地域标签和标签写入

## 当前主线

- 排序主线复用 `01a04308-2871-7de3-ad83-2ede4324223f`，不得与历史排序专项并发写
- 待专项重新证明：旧总管最后 UI 退回项、受影响 R-ID、先红后绿、完整辅助检查、唯一来源、
  v1.16 release 处理需求、真实验收矩阵和授权阻塞
- 损坏专项已终止，不能再作为执行通道。下一步需要用户明确授权在正式 EAGLE 项目创建一个干净的
  可见替代专项；获准后从上述精确红灯继续，不 fork、不复用历史同域任务
- 现有 heartbeat `eagle` 已迁移到当前总管 `01a095da-9b45-7890-b469-387d9a1030ec`，保持
  每 5 分钟、无变化安静，并已设为 ACTIVE；未创建重复自动化
- 安装后实机位置必须重新取得当前身份；`普通4-英国站` 与 `智能max照片集` 只作历史线索

## 并发保护

- 当前不得与正在运行的 `extensions/media-organizer/TASKS.md` / `DECISIONS.md` 的新增内容冲突
- A 排序与重命名、B 媒体处理与发布、C GPS/元数据标签保持隔离；Eagle 原生行为是 L0
- 当前 Codex 工具未提供稳定的项目内置顶/排序写接口；已核验当前总管属于正确项目且未全局置顶，
  不伪造项目内排序能力
