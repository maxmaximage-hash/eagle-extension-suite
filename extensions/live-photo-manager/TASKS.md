# Live Photo 管家专项任务

## 2026-11-06：导出契约与原生右键边界

- [x] 将用户可见导出动作收敛为静态照片（HEIC/JPG）、MOV、完整 LIVP 三种形式。
- [x] 增加静态封面写回计划契约：MOV 与配对身份保持不变，写回前必须在 Eagle Library 外暂存。
- [x] 增加契约测试，阻断直接写入 `.library` 的静态封面计划。
- [x] 核对 Eagle 公开 API，确认没有安全的原生网格右键回调。
- [x] 禁止安装 `bridge/rebuild-native-bridge.js` 的 app.asar 宿主桥。
- [ ] 等 Eagle 提供公开原生网格右键扩展点后，再把 `native-live-registry` 导出服务接入；
  在此之前不宣称 Eagle 原生网格右键已可用。

## 2026-11-06：外部静态封面编辑 helper

- [x] 增加 Library 外的封面编辑会话、保存稳定检测、LIVP 重封装和 Eagle `item.replaceFile()` 写回。
- [x] 增加 `用 Photoshop 打开 Live Photo 封面.app` LaunchServices document handler，声明 `.livp`，可逆安装/卸载，
  读取容器中的静态 HEIC/JPG 并启动 Photoshop/Preview。
- [x] 在真实 Eagle 中选中 `IMG_4154.livp` 触发编辑会话，并完成一次字节不变的 `item.replaceFile()` 写回验收；
  封面与 MOV SHA-256 保持一致，卡片仍显示 LIVP。
- [x] LaunchServices 右键处理器实际收到 `.livp` 文件路径，提取静态封面并启动 Photoshop 2026；
  service 在未打开诊断面板时也能轮询 staged session 并完成 `replaceFile()`。
- [x] HEIC 封面在 Library 外先由 `sips` 转成可编辑 JPG；真实 Photoshop 2026 打开 JPG 后保存检测、
  重封装和后台 `replaceFile()` 已完成一次验收，MOV 与配对身份保持不变。

## 2026-11-06：无感静态封面编辑状态机

- [x] 新增 `lib/cover-edit-session.js`：在 Eagle Library 外创建静态封面编辑工作区，复制原始
  HEIC/JPG 作为外部编辑器输入，MOV 和配对身份只读保留。
- [x] 新增覆盖测试：编辑文件稳定检测、Library 外暂存 `.livp`、通过 `item.replaceFile()` 写回，
  以及直接指向 `.library` 的路径阻断。
- [x] Photoshop/LaunchServices 文档处理器和 service 轮询已接入；真实 Eagle 已完成一次 staged
  session 到 `item.replaceFile()` 的闭环验收。
