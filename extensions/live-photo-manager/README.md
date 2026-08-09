# MAX Live Photo 管家

独立 Eagle 扩展与本地只读 Demo。当前版本验证：

- 将同名、扩展名大小写无关的 `JPG/JPEG/HEIC + MOV` 识别为一个 Live Photo 项目；
- 重复静态图、重复 MOV 或缺少伴侣文件时进入冲突，不猜测配对；
- 网格只显示一项，悬停或键盘聚焦后播放 MOV，不使用右侧预览栏；
- 浏览锚点与处理队列分开保存，“继续上次”恢复到上次项目；
- 预览检查严格串行，每项独立临时目录，支持暂停、取消、超时和连续失败熔断；
- 当前 Demo 不封装 `.livp`、不写 Eagle Library、不修改或导出源文件。
- 用户出口固定为三个：导入苹果照片（Live）、导出静态 JPG、导出 MOV；选中多项时
  仍使用相同命令，不增加“批量同步”或“发布包”概念。

## 本地 Demo

```bash
cd extensions/live-photo-manager
npm test
npm run demo -- --port 4177 --source "/Users/max/Downloads/iCloud 照片 2"
```

浏览器打开 `http://127.0.0.1:4177/`。

## 当前边界

- `tools/icloud-intake-workbench/lib/live-package.js` 是现阶段配对与封装核心的事实源；
  `npm run sync:core` 生成扩展内冻结副本，并由契约测试校验一致。
- Eagle 生命周期只负责打开/关闭独立窗口；当前没有调用 `eagle.item.add*`、
  `eagle.folder.*` 或任何资料库写入 API。
- 安装到 Eagle、连接正式 NAS 接收区、真实导入和导出都需要新的用户批准。
- 官方 `eagle-extension-livp` 不作为批量处理依赖。

## 下一试点

在低风险 QA Library 依次执行 `1 -> 3 -> 10 -> 50` 组测试，完成后才允许讨论正式库：

1. 以公开 Eagle API 创建单一逻辑项目，不手改 `.library`；
2. 导出 JPG、MOV 和可回流 Apple Photos 的配对资源；
3. 封面替换后验证 PhotoKit 导入、小红书与朋友圈发布；
4. 接入搬运台持久化台账、NAS 挂载熔断和跨天续传。
