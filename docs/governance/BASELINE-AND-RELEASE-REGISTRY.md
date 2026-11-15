# Baseline and Release Registry

状态：版本与回滚台账入口。这里只记录可识别的基线、候选和回滚依据。

## 冻结基线

- 排序冻结基线：`extensions/media-organizer/docs/FROZEN-BASELINE-2026-07-23.md`
- 目标架构：`extensions/media-organizer/docs/SORTING-TARGET-ARCHITECTURE.md`
- 行为门禁：`extensions/media-organizer/docs/SORTING-BEHAVIOR-TEST-MATRIX.md`

## 当前安装基线

- `extensions/media-organizer`：`2.5.22-qa.113/API189`
- 当前语义：唯一已安装且已验证基线；R130 正常重启、MAX、smart/Library 往返和两库原生抽样证据已关闭
- 不得写成：用户已经完成最终主观验收，或已经执行外部分发/正式发布

## 已知回滚点与历史基线

- `2.5.22-qa.112/API188`：qa.113 安装前回滚基线
- `2.5.22-qa.84/API161`：当前现场仍保留为上一候选参照
- `2.5.22-qa.83/API160`：已安装历史基线，仍是当前现场事实对照
- `2.5.22-qa.82/API159`：R97 回归修复基线
- `2.5.22-qa.81/API158`：R96 回归修复基线

## 发布状态规则

- `candidate`：只代表源码候选或安装验收前状态
- `installed`：只在实际安装并完成身份核验后使用
- `released`：只在外部分发或明确发布动作完成后使用
- `rollback`：只记录可逆证据，不表示自动执行

## 依据文件

- `extensions/media-organizer/README.md`
- `extensions/media-organizer/TASKS.md`
- `extensions/media-organizer/DECISIONS.md`
- `extensions/media-organizer/scripts/build-github-release.sh`
- `extensions/media-organizer/scripts/install-github-release.sh`
