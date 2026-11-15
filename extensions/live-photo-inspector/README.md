# MAX Live Photo 静态照片信息

这是一个 Eagle Inspector 扩展，针对原生 `.livp` 卡片在右侧显示封面静态照片的原始信息。

它读取封面照片的格式、尺寸、文件大小、拍摄时间、GPS、海拔、相机、镜头、光圈、快门、ISO、色彩配置和 macOS `mdls` 原始字段。读取过程只使用 Eagle Library 外的缓存或 Live Photo 管家台账中的封面副本，不改写 `.library`。

```bash
node --test test/*.test.js
scripts/install-real.sh
scripts/build-release.sh
```

当前 `v0.1.0` 已安装到真实 Eagle，并在 `IMG_4154.livp` 上验证右侧 Inspector 能显示静态照片信息。安装目录为 `~/Library/Application Support/Eagle/Plugins/com.max.eagle-live-photo-inspector`。

Inspector 提供“导出静态照片到下载”按钮。点击一次后，封面 HEIC/JPG 会写入 `~/Downloads/MAX Live Photo Exports`，并在 Finder 中定位新文件，已有同名文件会自动追加序号。需要直接拖动时，也可以使用“从此处拖出静态照片”并在点击后立即移动鼠标到 Finder、Photoshop 或桌面并松开。Eagle 网格中直接拖动 `.livp` 卡片仍由 Eagle 原生处理。
