# Live Photo 管家专项决定

## 2026-11-06：静态封面为主数据，写回必须经过独立状态机

- `.livp` 内的 HEIC/JPG 是静态封面主数据；MOV 是保持配对关系的动态组件。
- 导出动作固定为三种用户可理解的结果：
  - 静态照片（保留源 HEIC/JPG 扩展名）；
  - MOV 动态组件；
  - 完整 Live Photo（`.livp`）。
- 静态封面编辑不得直接覆盖源文件、MOV 或 Eagle `.library`。必须先在 Library 外生成临时
  `.livp`，验证配对身份和包内容，再通过公开 `eagle.item.replaceFile()` 写回对应原生 item。
- 写回状态独立使用 `planned -> staged -> package-validated -> accepted -> confirmed`，任意
  失败回到原卡片，不把失败误报为完成。
- 其它应用打开或导出静态内容时，以 HEIC/JPG 静态照片为入口；MOV 只作为配对组件处理。

## 2026-11-06：原生网格右键暂不通过宿主改包实现

- Eagle 公开 Plugin API 没有原生网格右键回调或选中项 context-menu 注入接口。
- `bridge/rebuild-native-bridge.js` 修改 `app.asar` 的方案禁止安装；它会触发宿主完整性保护，
  也违反插件与宿主隔离约束。
- 在 Eagle 提供公开回调前，导出服务只从诊断入口或未来官方扩展点调用；不拦截 Eagle 原生右键、
  预览、选择、拖动、导入导出。

## 2026-11-06：`.livp` 外部编辑使用可逆 LaunchServices helper

- `.livp` 的“在其他应用打开”由独立 `用 Photoshop 打开 Live Photo 封面.app` 处理；helper 只读取容器，
  将 HEIC/JPG 提取到 Eagle Library 外的工作区，再启动 Photoshop/Preview。
- helper 不修改 `app.asar`、Eagle 原生 DOM、`.library` 或 hosts；安装与卸载脚本均可逆。
- 保存检测、重封装和写回仍由 Eagle 插件 service 完成，最终只能通过 `item.replaceFile()` 写回原 item。

## 2026-11-06：封面写回轮询在后台服务加载时启动

- 外部编辑 session poller 在 service 模块加载时幂等启动，不依赖诊断窗口是否打开；
  `onPluginRun` 只负责补触发和立即扫描，`onPluginBeforeExit` 统一清理计时器。
- 真实 `IMG_4154.livp` 的 LaunchServices helper session 已在后台 service 中自动处理为
  `replaceFile confirmed`，不需要打开诊断面板。

## 2026-11-06：外部静态封面编辑采用 Library 外工作区

- 外部编辑器只接收从 `.livp` 解出的 HEIC/JPG 副本；源图片、MOV 和 Eagle Library 保持只读。
- Photoshop 不可靠地直接覆盖 HEIC，因此 HEIC 先通过 macOS `sips` 转换为 Library 外的 JPG；
  重封装以编辑后的 JPG 作为静态主数据，原 MOV 继续保持配对。
- 编辑文件在保存后必须先通过稳定性检测，再在 Library 外重新生成 `.livp`，最后调用公开
  `eagle.item.replaceFile()` 写回对应原生 item。任何失败都保留原卡片和原配对。
- Photoshop/LaunchServices 的自动打开与保存监听属于独立 helper 集成，不能通过修改 `app.asar`
  或注入 Eagle 主网格实现。
