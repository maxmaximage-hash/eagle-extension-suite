# iCloud Photos 可靠搬运台产品方案

- 日期：2026-07-19
- 状态：方案与最小台账骨架完成；未安装第三方工具，未登录 Apple ID，未读取照片，未创建 NAS 目录，未启动下载
- 继承边界：NAS 上的 Eagle `.library` 是正式库；`待筛选/Intake` 只做下载和导入前的单向隔离缓冲；不手工修改 `.library`
- 目标文件夹：`/Volumes/团队文件-MAX线上协作中台/icloud 待分类素材/`
- 输出格式决策：JPG 仅作为筛选/预览/轻编辑代理；需要发布成小红书或朋友圈 Live/动态内容的素材必须保留 Live 原始组件或可重建发布版

## 一句话结论

能做。最稳方案不是依赖 iCloud 网页下载按钮，而是让用户在 iCloud Photos 中人工建立“待下载”相簿/批次，本地搬运台按相簿拉取、记录台账、写入 NAS 待筛选区，之后再交给 Eagle 导入和分类。

“继续上次”必须作为首页主入口。它分两层恢复：

- 下载层：恢复未完成文件、失败重试、已下载字节、临时文件和校验状态。
- 选择层：恢复用户上次挑选到的相簿/批次、素材锚点、拍摄日期、文件名、缩略图和前后范围。

这两层分开记录。下载成功不等于用户已经继续挑选，避免跨天回来时跳到错误位置。

## 1. 工具能力核准

### iCloud.com.cn Photos 网页

可用能力：

- 用户可以人工浏览时间线、选择照片/视频并下载副本。
- Apple 官方文档说明 iCloud.com 可下载照片和视频，并可选择“未修改原片”。
- 中国区入口是 `icloud.com.cn`，账号、2FA、网络稳定性都必须按中国区实测。

限制：

- 网页下载不应作为十几万张素材的可靠无人值守主流程。
- 浏览器下载中断后是否可断点续传取决于浏览器、临时下载链接和服务端响应，不能作为产品承诺。
- iCloud Photos 网页是虚拟滚动界面，目前没有官方稳定的“打开某张照片/某个滚动位置”的公开深链接或 API。
- 网页结构、DOM、内部标识和 URL 状态可能变化，浏览器扩展只能做辅助，不能做唯一可靠锚点。

结论：网页适合用户做人工选择和确认，不适合承担核心下载、断点续传和跨天恢复。

### macOS 照片 App

可用能力：

- 官方支持导出未修改原片到 Finder 或外部存储。
- 对 Live Photo、视频、编辑后版本和原片的处理相对符合 Apple 生态语义。
- 通过 PhotoKit 开发原生 Mac 应用时，可以在用户授权后读取相簿、素材和资源，并请求 iCloud 中的资源下载。

限制：

- 如果当前是“优化 Mac 储存空间”，本机可能没有全量原片，导出会触发下载，速度和失败恢复要实测。
- 照片 App 的人工导出没有适合十万级跨天任务的外部下载台账。
- 不能直接解析 `.photoslibrary` 内部目录或数据库作为正式方案。
- AppleScript/GUI 自动化可以辅助，但长期稳定性弱，不适合承担核心迁移。

结论：照片 App 是安全的人工导出入口；若要做高可靠自动化，优先考虑 PhotoKit 原生工具，但开发成本高于复用成熟下载器。

### Apple 可用接口

可用能力：

- PhotoKit 可在本机、经用户授权访问照片库、相簿、PHAsset 与 PHAssetResource，并可请求原始资源数据。
- `PHAsset.localIdentifier` 可作为本机照片库内较可靠的标识；跨库、跨账号、网页侧不应假设完全一致。

限制：

- Apple 没有提供适合第三方服务器用 Apple ID 直接批量下载 iCloud Photos 的公开账号级 API。
- 账号登录、2FA、iCloud 中国区和网页下载接口不应自行逆向重写。

结论：若后续自研核心下载器，应走授权后的本机 PhotoKit Mac 应用，而不是重写 iCloud 私有协议。

### 成熟第三方工具

`icloudpd / iCloud Photos Downloader`：

- 优点：成熟 CLI，支持账号登录、2FA/MFA、按相簿下载、跳过已存在文件、Live Photo、视频、原片尺寸、目录结构、最近项目和 China domain 选项等能力。
- 限制：它主要面向“把 iCloud Photos 下载到目录”，不是为 Eagle 工作流设计。下载台账、Eagle 导入状态、用户挑选锚点、NAS 掉线熔断、Live Photo 成组验收和“继续上次”仍需要本项目外层搬运台。
- 结论：优先作为下载核心候选，但必须先用 50-100 个混合样本验证 iCloud 中国区、2FA、相簿、Live Photo、视频、重复执行和 NAS 断线恢复。

`osxphotos`：

- 优点：成熟本机 Photos 库工具，可按相簿/条件导出，适合利用 Mac 照片图库和本机授权。
- 限制：依赖本机 Photos 图库状态和 macOS 隐私授权；如果原片不在本机，需要触发 iCloud 下载，实际恢复能力要试点。
- 结论：适合作为“照片 App/本机图库路线”的候选，不优先作为 Apple ID 网页下载替代。

推荐顺序：

1. 首选试点：`icloudpd` 按“待下载”相簿拉取，外层搬运台负责台账和 NAS/Eagle 交接。
2. 备选试点：`osxphotos` 按 Photos 相簿导出，适合用户愿意先通过 Mac 照片 App 管理相簿。
3. 后续增强：浏览器扩展只负责捕捉用户选择上下文或高亮锚点，不负责核心下载。

## 2. 用户入口设计

推荐入口：用户在 iCloud Photos 建立相簿或批次，例如：

```text
待下载-2026-07-试点-0001
待下载-2026-07-工作素材-0002
待下载-2024-03-补录-0003
```

操作体验：

1. 用户在 iCloud Photos 时间线里人工挑选素材，加入“待下载”相簿。
2. 回到搬运台首页，点击“继续上次”。
3. 搬运台显示上次停在：相簿、拍摄日期、文件名、缩略图、前后素材范围。
4. 用户确认后，搬运台按该相簿继续下载未完成素材。
5. 下载完成后，素材进入 NAS 待筛选区，等待 Eagle 导入或人工确认。

为什么不首选浏览器扩展直接接管下载：

- iCloud 网页的虚拟滚动、DOM 和内部资源标识不稳定。
- 账号态、2FA、下载链接和跨天恢复都容易受网页变化影响。
- 浏览器扩展可以做“选择辅助”和“锚点高亮”，但不能作为十万级可靠下载核心。

## 3. “继续上次”恢复精度

目标精度分级：

| 等级 | 能力 | 是否承诺 |
| --- | --- | --- |
| A | 打开相簿并精确定位/高亮到最后一张素材 | 仅在浏览器扩展实测稳定后承诺 |
| B | 打开对应“待下载”相簿，并显示最后锚点日期、文件名、缩略图和前后范围 | 当前产品承诺 |
| C | 打开 iCloud Photos，并显示上次停在的月份/批次与锚点素材 | 最差稳定承诺 |

当前结论：不能承诺 iCloud 网页稳定跳转到单张素材。正式承诺应是 B；若网页结构变化或需要重新登录，降级到 C。

搬运台必须记录：

- `anchorId`
- 所属批次或相簿
- iCloud 素材唯一标识或可靠组合标识
- 拍摄日期
- 文件名
- 缩略图路径或缩略图缓存键
- 上次选择时间
- 前后范围素材标识
- 恢复精度：`asset`、`album-or-month`、`manual`

## 4. NAS 待筛选目录归属

正确归属：NAS 正式素材体系，同 Eagle 正式库同级。

禁止归属：Eagle `.library` 内部、iCloud Drive、Mac 本机长期目录、浏览器默认下载目录。

基于本机当前事实，Eagle 正式库位于：

```text
/Volumes/团队文件-MAX线上协作中台/引力环球.library
```

用户已指定 NAS 目标文件夹：

```text
/Volumes/团队文件-MAX线上协作中台/icloud 待分类素材/
```

说明：

- 该目录作为下载完成并通过校验后的可见待筛选区。
- 未完成文件仍应使用临时扩展名或隐藏临时目录，不能被 Eagle 导入。
- 台账、哈希、批次报告不存 Apple ID 或密码。
- 冲突、损坏、校验失败或 Live Photo 配对异常文件要隔离，不能静默覆盖。
- 任何文件进入 `.library` 必须通过 Eagle 正常导入或公开能力，不手工写库。

## 4.1 JPG 与 Live 发布规则

用户明确要求：下载到 NAS 待分类文件夹的图片照片统一为 JPG。随后又确认核心场景是编辑后发布到小红书和微信朋友圈，并希望 Live 素材到最后仍能作为动态内容发布。

执行规则：

- HEIC、JPEG、RAW、PNG 等照片类素材，进入待分类目录时可以统一输出 `.jpg`，但这只是筛选/预览/轻编辑代理。
- 视频仍保持 `.mov`、`.mp4` 等视频格式，不转成 JPG。
- Live Photo 不能只保留 JPG。只保留 JPG 会丢失动态部分，也通常不能再被手机 App 当作 Live Photo 发布。
- Live Photo 必须保留原始组件：优先保留 Apple/iCloud 原始封装或 `HEIC + MOV` 组件，并在台账中绑定为一组。
- `JPG + MOV` 只能作为工作拆分形态，不承诺被 iPhone、小红书或微信自动识别为原生 Live Photo。
- 若最终平台不能直接接受重建后的 Live Photo，则发布版应导出为短视频 `.mp4/.mov`，而不是期待 JPG 动起来。
- 编辑后版本与未修改原片需要在试点时确认：若目标是“所见即所得”，导出编辑后 JPG；若目标是“保留摄影原始信息”，应另存原片备份。
- JPG 是有损格式。RAW/HEIC 转 JPG 后，原始色深、动态范围、部分元数据和后期空间可能减少。

### Live 封面替换工作流

用户的高频工作场景是：拍摄 Live Photo 后，在电脑上编辑静态封面 JPG，然后希望最终仍能作为 Live/动态内容发到小红书或微信朋友圈。

因此正式工作流应拆成三份逻辑资产：

```text
Live 母版
├── 原始静态组件：HEIC/JPEG
└── 原始动态组件：MOV

JPG 工作封面
└── 给 Eagle、美图秀秀、Photoshop 或其他工具编辑

发布版 Live
├── 编辑后的 JPG/HEIC 封面
└── 原 MOV 动态组件，重新写入 Live 绑定信息后导回手机相册
```

产品要求：

- 搬运台必须把 Live 母版和 JPG 工作封面关联在同一组，不能只按文件名碰运气。
- 用户编辑 JPG 后，搬运台应能识别“这是某个 Live 的新封面”。
- 发布前生成“Live 发布包”：编辑后的封面 + 原 MOV + 必要的 Live 绑定元数据。
- 发布包必须经过真实设备验收：导回 iPhone 相册后仍显示为 Live Photo，再从小红书/微信朋友圈测试发布。
- 如果重建 Live 失败，降级发布版应是短视频，而不是单张 JPG。

技术候选：

- 使用本地工具为编辑后的 JPG/HEIC 和 MOV 写入匹配的 Live Photo 资产标识。
- 使用 macOS Photos / PhotoKit 或 iPhone 端导入流程验证它是否被系统识别为 Live Photo。
- 试点时比较 `编辑 JPG + 原 MOV`、`编辑 HEIC + 原 MOV`、以及短视频发布版的真实平台表现。

### iCloud 网页 zip 与极空间识别边界

用户实测 iCloud 网页下载 Live Photo 时得到 `iCloud 照片.zip`，解开后是同名 `IMG_9264.JPG + IMG_9264.MOV`。这说明网页下载把 Live Photo 拆成了静态图和动态视频两个组件。

判断：

- iCloud 网页能播放 Live，是因为 iCloud Photos 自己知道这两个资源属于同一个照片资产。
- Finder/SMB/NAS 文件夹里只有两个普通文件时，系统不会天然知道它们是一个 Live Photo。
- 极空间如果通过“极相册/iPhone 备份”链路接收 Live Photo，可能会保留或识别实况；但把 `JPG + MOV` 手工放进 NAS 文件夹，不应假设它一定自动合并成实况。
- `.livp` 可以视为某些 Apple/iCloud 场景下的 Live Photo 封装包，但不能把它当作所有软件都支持的通用原片格式；Apple 官方 iCloud.com 下载选项目前是未修改原片、最高分辨率、最兼容等格式选项，不承诺直接下载 `.livp` 单文件。
- 因此，从 iCloud.com 直接稳定下载 `.livp` 不作为正式方案。需要 Live 保真时，优先下载“未修改原片”，保留 `HEIC/JPEG + MOV` 组件组和台账绑定关系；若业务需要 `.livp`，由搬运台在本地把组件组打包成内部归档副本，而不是假设 iCloud 网页会给。

因此，搬运台需要同时支持两条试点：

1. **极空间识别试点**：把同名 `JPG + MOV`、`HEIC + MOV`、`.livp` 三种形态分别放入极空间相册索引目录，观察极空间 App 是否显示为实况。
2. **发布回流试点**：用编辑后的 JPG 封面 + 原 MOV 重建 Live Photo，导回 iPhone 相册，确认 iPhone、小红书和微信朋友圈是否仍按 Live/实况处理。

正式规则：在极空间自动识别能力验证前，`JPG + MOV` 只能算“可重建 Live 的组件组”，不能算“已经合并好的实况照片”。

### Eagle Live Photo 格式扩展读取规则

本机已安装 Eagle 官方/内置的 `Live Photo 格式扩展`，插件 ID 为 `eagle-extension-livp`，版本 `1.0.2`。只读检查结果：

- 插件只注册了 `livp` 预览类型；也就是说，Eagle 自动识别的是 `.livp` 文件，不是普通文件夹里的同名 `JPG + MOV`。
- 缩略图和预览逻辑会把 `.livp` 当作 zip 解开，然后寻找其中的图片组件和 `.mov` 组件。
- 当前插件代码寻找的图片扩展是小写 `.heic` 或 `.jpeg`，视频扩展是小写 `.mov`。用户从 iCloud 网页得到的 `IMG_9264.JPG + IMG_9264.MOV` 需要在生成 `.livp` 时规范化为插件可识别的扩展名。
- 预览器先显示 Eagle 缩略图，再把 `.livp` 内的 MOV 解出到插件临时目录并用 video 元素循环播放。

因此，正式搬运逻辑不应寄希望于“Eagle 自动把两个普通文件合并”。更可靠的结构是：

```text
待分类素材/
├── LivePackages/
│   └── IMG_9264.livp          # Eagle 用这个预览成 Live
├── WorkCovers/
│   └── IMG_9264.jpg           # 用户修封面
├── Masters/
│   └── IMG_9264/
│       ├── IMG_9264.heic 或 IMG_9264.jpeg
│       └── IMG_9264.mov
└── Manifests/
    └── IMG_9264.json          # 记录三者关系、iCloud 标识、状态
```

Eagle 中导入 `IMG_9264.livp`，即可由 Live Photo 格式扩展负责显示；搬运台保留 `WorkCovers` 和 `Masters`，用于封面编辑、重建发布版和防丢。

如果用户编辑封面：

1. 用户在电脑上编辑 `WorkCovers/IMG_9264.jpg`。
2. 搬运台标记该 Live 的封面已修改。
3. 需要预览时，搬运台重新生成一个 `.livp`，让 Eagle 继续按 Live 预览。
4. 需要发布时，搬运台用编辑封面 + 原 MOV 生成手机可识别的 Live 发布版或短视频发布版。

### `.livp`、iPhone 实况与小红书发布不是同一种导出

截至 2026-07-20，核准结果如下：

- `.livp` 是本工作流给 Eagle 做单素材管理和预览的封装，不是小红书电脑端或 Apple Photos 公布的通用导入格式。不能承诺把 `.livp` 复制到 iPhone 后会自动进入照片库并识别成 Live Photo。
- 把 `.livp` 拖进 macOS「照片」App 不识别，不按 bug 处理，而是格式边界：Eagle 的 `.livp` 插件把它当 zip 预览；Apple Photos 需要的是照片资源 + `pairedVideo` 资源组成的照片库资产。
- AirDrop、分享表或部分手机 App “直接存入照片”能保留实况，通常是因为接收端走了系统照片库导入通道；若先落到“下载/文件”目录，它就可能退化成普通静态图、普通视频或普通归档文件。
- Apple PhotoKit 把 Live Photo 明确建模为照片资源和 `pairedVideo` 资源。官方 `PHAssetResourceType.pairedVideo` 定义为 Live Photo 的原始视频组件；`PHAssetCreationRequest.addResource(with:fileURL:options:)` 可以在一个资产创建请求中加入本地资源，非法资源组合会由 Photos 返回错误。
- 因此“导回 iPhone 实况”的正式实现应生成匹配的静态照片与 paired MOV，并通过 macOS/iOS Photos 的 PhotoKit 导入照片库。编辑后的 JPG 可作为静态组件，但必须与 MOV 保持同一 Live 资产标识，MOV 还要保留或重写 Live 的时间元数据；仅同名不够。
- 2026-07-16 构建的小红书电脑创作平台前端，图片入口只接受 `.jpg/.jpeg/.png`，并明确提示“不支持 webp、gif、live 及其转化后的图片”；视频入口接受 `.mov`，但按普通视频处理。平台内部虽有 `livePhotoVideoId` 等字段用于已有内容数据，当前 PC 文件选择入口仍不能把本地 `.livp` 作为实况上传。
- 当前可靠发布链路是：搬运台生成手机可识别的 Live Photo → 导入 iPhone 照片库并确认出现“实况”标记 → 从 iPhone 端小红书或微信选择发布。手机 App 的最终发布行为仍需用真实账号和样本验收，因为平台规则可能变化。

正式产品需要两个不同出口：

```text
Eagle 管理出口
└── 生成 .livp，给 Eagle Live Photo 格式扩展预览和管理

Apple 发布出口
└── 编辑后的 JPG/HEIC + 原 MOV → PhotoKit 写入照片库为 Live Photo → iPhone 端发布
```

因此，不能把 `.livp` 当成回传手机的最终交付物。搬运台应提供“导入照片 App/导回 iPhone 实况”按钮，由本地原生助手完成 PhotoKit 导入；导入成功后，用户在「照片」App 和 iPhone 上看到 Live 标记，才算发布版通过。

2026-07-26 单张样本试点：

- 输入：`/Users/max/Downloads/iCloud 照片/IMG_9264.JPG` 与 `/Users/max/Downloads/iCloud 照片/IMG_9264.MOV`，来自 iCloud 网页下载解压后的同名组件组。
- 只读识别：搬运台按大小写无关主干识别为 `img_9264` Live 资产组，状态 `ready`，无缺失伴侣文件。
- Eagle 出口：已在 `/tmp` 生成临时 `img_9264.livp`，包内为 `image.jpeg`、`motion.mov`、`manifest.json`，不改原文件、不写 Eagle `.library`。
- Eagle 真实导入验收：经用户批准后，通过 Eagle 本地 API 正常导入测试 `.livp` 到当前 NAS Library，Eagle item 为 `MS0KTJSY3J9BF`，名称 `MAX_LIVE_TEST_IMG_9264`，标签 `MAX_LIVE_TEST` 与 `iCloud_Live_Workflow`。Eagle 能在“全部/未分类”中显示 LIVP 缩略图，右侧详情识别格式 `LIVP`，并可用 Eagle `LIVP Viewer` 打开预览画面。
- Eagle 反向导出验收：已从真实 Eagle item 文件 `/Volumes/团队文件-MAX线上协作中台/引力环球.library/images/MS0KTJSY3J9BF.info/MAX_LIVE_TEST_IMG_9264.livp` 只读导出到 `/tmp/eagle-live-export-test-20260726-001/`，还原为 `IMG_9264.JPG` 与 `IMG_9264.MOV`。导出文件 SHA-256 与原始 iCloud 下载组件逐字节一致；重复导出到同一目录会报错拦截，不静默覆盖。
- Apple Photos 出口：经用户批准后，用本地 PhotoKit 测试助手写入 macOS「照片」App 测试相簿 `MAX Live Photo Import Test`。
- 验证结果：Photos 返回资产 `DBB28138-9D83-44B7-8E48-AB9EA1B10D7F/L0/001`；只读核验 `assetFound=true`、`isLivePhoto=true`、资源类型为 `photo + pairedVideo`、尺寸 `3024 x 4032`。
- 当前限制：PhotoKit 导入已证明技术可行，但样本重复执行时出现重复 Live Photo；生产导回照片 App 前必须先补导入去重锁和导出批次台账。
- 结论：iCloud 网页下载得到的 `JPG + MOV` 可以作为本工作流的标准 Live 输入；`.livp` 负责 Eagle 管理与可逆组件导出，PhotoKit 负责 Apple Photos/iPhone 发布出口。

2026-07-26 54 组样本批量试点：

- 输入：`/Users/max/Downloads/iCloud 照片 2/`，共 108 个文件，识别为 54 组完整 `IMG_3248` 到 `IMG_3301` 的 `JPG + MOV` Live 组件组；扫描阶段无缺失伴侣文件、无同名冲突。
- 封装结果：搬运台成功生成 54 个 Eagle `.livp` 包到 `/tmp/icloud-live-54-livp-20260726/`，总大小约 439 MB；抽检包内结构为 `image.jpeg`、`motion.mov`、`manifest.json`，manifest 保留原始 `IMG_xxxx.JPG/MOV` 文件名。
- Eagle 试点：经用户批准，通过 Eagle API 创建测试文件夹 `MAX Live 54 Demo 2026-07-26`，folder ID `MS0NDHXFUZYG6`，并尝试导入 54 个 `.livp`。
- 真实结果：`addFromPath` 快速连发返回 54 个 success/ID，但这只能证明请求被受理。
  UI/列表曾观察到前 7 个名称；最后保存的逐 ID 快照只能重新读取 6 个 item，且其中
  4 个明确 `noPreview=true`。后续又发出 4 次未独立持久化的补导请求，使 Eagle 队列
  变为 58 个请求；58 不是 58 个唯一素材。
- 日志证据：Eagle 日志显示 `eagle-extension-livp` 缩略图插件在批量处理中多次报 `zip_temp/image.jpeg` 缺失、`Thumbnail generate timeout`，并出现 Eagle 后台进程 10/20 秒无响应。只读检查插件代码确认它使用固定 `temp/zip_temp` 目录解包并删除，批量并发时存在共享临时目录互相踩踏风险。
- P0 事故：Eagle 原生“正在添加文件 8/58”持续约一小时，缩略图不显示，原生快捷键
  失效；主进程、renderer 和元数据子进程进入 NAS I/O 的 `U` 状态。事故期间禁止继续
  API、UI、全库扫描、取消、删除或重启，等待用户分别批准恢复动作。
- 结论：54 组样本只证明“iCloud `JPG + MOV` 识别与 `.livp` 封装”可批量跑通；
  “依赖 Eagle 官方 LIVP 扩展直接批量导入并生成缩略图”不仅未通过，而且已造成正式
  Eagle/NAS 宿主阻塞，禁止作为生产路径。
- 后续要求：Eagle API `success` 必须只记为 `accepted`；逐项完成 `host_visible`、
  `preview_ready`、`confirmed` 后才允许提交下一项。确认超时立即熔断，补导必须持久化
  并受幂等锁保护。详见
  `docs/INCIDENT-2026-07-26-EAGLE-LIVP-BATCH-IMPORT.md`。

官方依据：

- [Apple `PHAssetResourceType.pairedVideo`](https://developer.apple.com/documentation/photos/phassetresourcetype/pairedvideo)
- [Apple `PHAssetCreationRequest.addResource`](https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:fileurl:options:))

产品导出菜单应把用途分开显示：

1. `导出 JPG`：进入水印、马赛克、修图等静态编辑流程。
2. `导出 Eagle .livp`：用于 Eagle 悬停/打开预览，不标记为发布格式。
3. `导回 iPhone 实况`：生成匹配资源并经 Photos 导入，作为小红书/朋友圈 Live 发布入口。
4. `导出短视频`：平台、账号或设备不接受 Live 时的稳定降级。

Eagle 的 MCP Server 和 AI 功能可辅助这些动作，但不替代 `.livp` 规则：

- MCP `item_add` 支持从本地路径批量导入文件，可以把搬运台生成的 `.livp` 自动导入 Eagle。
- MCP/API 可以批量打标签、加注释、放入指定文件夹，例如 `Live`、`待修封面`、`封面已修`、`可发布`。
- AI 搜索/AI 动作可以做语义搜索、相似图查找、自动描述和标签建议。
- 它们不能自动把 `JPG + MOV` 变成原生 Live，也不能保证小红书/微信发布兼容；封装和发布回流仍需要搬运台试点验证。

### 自研 Live 识别与封装策略

可以自研，但优先顺序是：

1. **先做搬运台识别/封装器**：扫描 iCloud 下载目录，大小写无关地匹配 `JPG/JPEG/HEIC + MOV`，按台账绑定为同一 Live 资产，并生成 Eagle 可预览的 `.livp`。
2. **再评估自有 Eagle 预览插件**：如果官方 `eagle-extension-livp` 不能满足封面替换、JPG 支持、导出和编辑入口，再写 `MAX Live Photo 管家` 作为自有插件。
3. **最后做发布回流工具**：把编辑后的封面和原 MOV 重新生成手机可识别的 Live Photo 或短视频发布版。

原因：

- Eagle 预览插件通常按单个文件扩展名触发，无法天然把两个已经分别导入的 `JPG` 和 `MOV` 合并成一个素材。
- 如果把 `JPG` 和 `MOV` 分别导入 Eagle，它们会成为两个独立素材；不会自动交叉合并，但会带来重名、移动、删除、标签和筛选时分散管理的问题。
- 把 Live 资产封装成一个 `.livp` 或未来自定义 `.maxlive`，Eagle 中只有一个素材，管理更稳定。
- 来源文件名大小写、扩展名和同名冲突应由搬运台处理，不应要求用户或 iCloud 下载结果满足插件内部限制。

当前已在本地搬运台加入第一版封装器：

- 接受 `IMG_9264.JPG + IMG_9264.MOV` 这类 iCloud 网页下载结果。
- 按同名主干、大小写无关地配对。
- 生成 `.livp` 时，把包内文件规范化为 `image.jpeg` 或 `image.heic`，以及 `motion.mov`，从而适配 Eagle 现有 Live Photo 格式扩展。
- 不删除、不改写原始组件文件。

推荐安全策略：

- `icloud 待分类素材` 作为 Eagle 待筛选目录，可以放 JPG 工作版，方便快速预览和筛选。
- Live 素材必须同时保留原始 Live 组件或发布母版，不把 JPG 当作唯一成果。
- 不自动删除 iCloud 原片。
- 后续试点必须验证：`LIVP`、`HEIC+MOV`、`JPG+MOV`、短视频发布版在小红书和微信朋友圈里的真实表现。

## 5. 持久化台账

批次字段：

- 批次编号
- 标题
- 来源相簿名
- 来源相簿 URL 或入口
- 目标待筛选目录
- 状态
- 创建、更新、完成时间
- 最后选择锚点

素材字段：

- 批次编号列表
- iCloud 素材唯一标识或可靠组合标识
- 文件名
- 媒体类型
- 拍摄时间
- 原始大小
- 目标完整路径
- 状态：待处理、下载中、成功、失败、跳过、待校验、已导入 Eagle
- 已下载字节
- 重试次数
- 最后错误
- 创建与完成时间
- Live Photo 组 ID、照片/视频伴侣角色
- Eagle 项目 ID

选择锚点字段单独保存，不混进下载状态。

## 6. 文件写入与恢复规则

- 下载先写入 `.partial` 或临时扩展名。
- NAS/SMB 掉线、路径只读、空间不足或延迟异常时，立即暂停写入。
- 未完成文件不得标记为成功。
- 完成下载后先校验大小、哈希或工具可提供的完整性，再原子移动到 `Intake/待筛选`。
- 同一素材重复加入批次时，只追加批次关系，不重复下载。
- 目标已有同名文件时，不能覆盖；进入冲突命名或 Quarantine，等待用户确认。
- Live Photo 的照片和视频伴侣必须作为一组验收，一方失败则整组待处理。
- 删除永远单向隔离：不删除 iCloud 原片，不做 iCloud 和 NAS 的双向删除同步。

## 7. 最小可用搬运台骨架

已新增：

```text
tools/icloud-intake-workbench/
├── README.md
├── cli.js
├── lib/ledger.js
└── test/ledger.test.js
```

当前能力：

- 建立本地 JSON 台账。
- 记录批次、素材、状态、Live Photo 组、错误和目标路径。
- 记录“继续上次”选择锚点。
- 渲染本地静态首页，含“继续上次”按钮和本批进度。
- 本地 demo 已指向 `/Volumes/团队文件-MAX线上协作中台/icloud 待分类素材/`，并展示照片输出 `.jpg`、视频保持原格式、Live Photo 保留原始组件用于发布的规划。
- 自动测试覆盖重复素材、Live Photo 成组、锚点与下载状态分离、进度、同名冲突和首页渲染。

当前不做：

- 不安装 `icloudpd` 或 `osxphotos`。
- 不登录 iCloud。
- 不读取 Photos 图库。
- 不连接 NAS 或创建目录。
- 不下载文件。
- 不导入 Eagle。

## 8. 试点验收

试点规模：50-100 个混合样本。

必须覆盖：

- HEIC/JPEG/RAW
- 视频
- Live Photo
- 编辑后版本与未修改原片
- 同名文件
- 重复加入批次
- 浏览器关闭
- 电脑重启
- Apple 账号重新登录
- 网页结构变化后的降级行为
- 断网
- NAS/SMB 掉线
- 重复执行
- Eagle 导入后核验

通过标准：

- 跨天恢复后，下载队列能从未完成处继续。
- “继续上次”至少能稳定恢复到对应相簿/月和锚点素材。
- 未完成文件不会被误标成功。
- 重复素材不会重复下载。
- Live Photo 不会丢伴侣文件。
- 任何删除都不传播回 iCloud。

## 9. 分阶段实现计划

阶段 0：等待用户批准和信息确认。

- Apple 账号授权方式。
- 目标 NAS 路径。
- 试点相簿/批次。
- 是否允许安装 `icloudpd` 或 `osxphotos`。

阶段 1：接入下载核心。

- 优先试 `icloudpd --domain cn --album <待下载相簿>`。
- 外层搬运台负责台账、临时文件、NAS 熔断和 Eagle 交接。
- 不使用任何删除选项。

阶段 2：本地首页。

- 将静态首页升级为本地服务。
- 提供继续上次、暂停、继续、重试失败、导出报告。
- 显示本批总数、成功、失败、剩余、当前文件、目标目录和最近错误。

阶段 3：Eagle 交接。

- 下载完成后进入 `Intake/待筛选`。
- 用户确认后通过 Eagle 正常导入。
- 记录 Eagle 项目 ID 或批次标签。

阶段 4：浏览器扩展增强。

- 仅在 iCloud 网页结构稳定性通过试点后，增加锚点高亮或辅助定位。
- 若网页变化，降级到相簿/月和锚点缩略图。

## 10. 来源

- Apple：下载 iCloud 照片和视频 - https://support.apple.com/111762
- Apple：Photos 导出未修改原片 - https://support.apple.com/guide/photos/export-photos-videos-and-slideshows-pht6e157c5f/mac
- Apple Developer：Photos / PhotoKit - https://developer.apple.com/documentation/photos
- iCloud Photos Downloader / icloudpd - https://icloud-photos-downloader.github.io/icloud_photos_downloader/
- osxphotos - https://github.com/RhetTbull/osxphotos
