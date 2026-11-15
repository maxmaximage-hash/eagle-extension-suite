# MAX Live Photo 管家

Eagle 原生网格优先的 Live Photo 后台管理能力。独立窗口只用于诊断和恢复，不是日常工作区。
当前版本验证：

- 将同名、扩展名大小写无关的 `JPG/JPEG/HEIC + MOV` 识别为一个 Live Photo 项目；
- 重复静态图、重复 MOV 或缺少伴侣文件时进入冲突，不猜测配对；
- 诊断窗口中的网格只显示一项，悬停或键盘聚焦后播放 MOV；Eagle 原生网格不由插件重绘；
- 浏览锚点与处理队列分开保存，“继续上次”恢复到上次项目；
- 预览检查严格串行，每项独立临时目录，支持暂停、取消、超时和连续失败熔断；
- 当前版本已支持单项静态图和 MOV 的安全本地导出，并写入导出清单与 SHA-256；导出不覆盖源文件。
- `.livp` 的“在其他应用打开”已注册为可逆的 `用 Photoshop 打开 Live Photo 封面.app`，会在 Library 外提取
  静态 HEIC/JPG 并启动 Photoshop/Preview；HEIC 会先转换为 Library 外的 JPG 编辑副本，Eagle 后台
  service 会检测保存、重封装并通过 `replaceFile()` 写回。
- `.livp` 封装能力保留在共享核心；原生网格导入桥接会把一对组件封装成单一卡片，
  由 Eagle 负责缩略图、悬停预览和原生拖动语义。
- Apple Photos（Live）入口仍由 PhotoKit 适配器实现；在适配器完成前不会伪装成已导入。
- Eagle 日常使用的正式目标是：一个 Live Photo 对应一个 Eagle 原生 `.livp` 卡片，
  原生网格、选择、拖动、预览和文件夹语义继续由 Eagle 所有；管家只负责配对和台账。
  公开 API 暂未提供把导出动作追加到 Eagle 原生网格右键的回调。

## 诊断窗口

```bash
cd extensions/live-photo-manager
npm test
npm run demo -- --port 4177 --source "/Users/max/Downloads/iCloud 照片 2"
```

浏览器打开 `http://127.0.0.1:4177/`。

诊断窗口用于检查源目录配对、队列、身份和导出结果。日常浏览不需要打开它。

## 当前边界

- `tools/icloud-intake-workbench/lib/live-package.js` 是现阶段配对与封装核心的事实源；
  `npm run sync:core` 生成扩展内冻结副本，并由契约测试校验一致。
- Eagle 后台服务只接收原生导入登记和右键导出动作；它不渲染网格、不替换选择状态，
  也不接管 Eagle 的拖动、预览和文件夹操作。独立窗口仍是显式诊断入口。
- `max-live-photo.native-action` 是宿主桥接的窄接口：`register` 登记 `itemId + imagePath +
  moviePath`，`export` 以 `itemId + mode` 执行静态图、MOV、组件或 LIVP 导出。两者都写入
  本地台账，失败通过 `max-live-photo.native-action-result` 返回。
- 本地台账位于 Eagle Application Support 下，操作状态使用 `planned -> running -> completed/failed`，
  支持重启后读取已完成结果。
- 安装到 Eagle、连接正式 NAS 接收区、真实导入和导出都需要新的用户批准。
- 官方 `eagle-extension-livp` 不作为批量处理依赖。
- 安装/卸载外部封面处理器：
  `macos/install-handler.sh` / `macos/uninstall-handler.sh`；脚本会同步注册或注销 LaunchServices。

## 下一试点

在低风险 QA Library 依次执行 `1 -> 3 -> 10 -> 50` 组测试，完成后才允许讨论正式库：

1. 把配对组件安全封装成单一 Eagle 原生 `.livp` 卡片并接入单写入队列；
2. 等 Eagle 提供原生网格右键回调后，接入右键导出动作；在此之前只从诊断入口导出，不修改宿主；
3. 将 HEIC 封面缩略图和 MOV 悬停播放接入 Eagle preview/thumbnail adapter；
4. 封面替换后验证 PhotoKit 导入、小红书与朋友圈发布；
5. 接入搬运台持久化台账、NAS 挂载熔断和跨天续传。
