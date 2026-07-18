# Eagle 隐私打码编辑器接入交接文档

> 状态更新（2026-07-15）：本文原为接入前规划，现已由 `MAX Publisher 1.2.0` 完成实现。最终结果和真实文件清单请以同目录 `Eagle隐私打码1.2.0完成说明.md` 为准；本文中关于“保存隐私项目/图层”的旧规划已经取消，当前产品明确不保存打码状态。

> 交接日期：2026-07-15  
> 目标宿主：Eagle 插件 `MAX Publisher`  
> 当前共享模块：`@gravity/privacy-editor 1.0.0`  
> 本文用途：交给新的 Codex 对话或开发者，继续把朋友圈模拟器中的非破坏式隐私打码能力接入 Eagle，并逐步扩展为独立的图片/长截图打码编辑器。

## 1. 任务目标

不是把朋友圈模拟器聊天页面复制进 Eagle，而是：

1. 在 Eagle 当前插件里增加独立“隐私打码”工作区。
2. 直接读取 Eagle 当前选中的一张或多张图片。
3. 使用现有共享隐私模块完成模糊、马赛克、框选、移动、缩放、删除、预览显隐。
4. 打码图层与原图分离保存，随时重新打开、修改或删除，不破坏 Eagle 原图。
5. 按当前预览直接导出 JPG、PNG 或 WebP。
6. 后续扩展为：
   - 普通图片打码编辑器。
   - 微信长截图自动识别左右头像。
   - OCR 识别昵称、手机号、地址等隐私文字。
   - 批量套用隐私模板。
   - 水印与隐私打码的统一导出流水线。

这个动作在架构上叫“共享模块接入”或“宿主适配”。

## 2. 当前项目位置

### 2.1 Eagle 正式源码

```text
/Users/max/引力环球/朋友圈模拟器/Eagle线上展示
```

Eagle 插件源码：

```text
/Users/max/引力环球/朋友圈模拟器/Eagle线上展示/eagle-plugin
```

当前安装版：

```text
/Users/max/Library/Application Support/Eagle/Plugins/com.max.eagle-online-showcase
```

当前插件包：

```text
/Users/max/引力环球/朋友圈模拟器/Eagle线上展示/max-eagle-publisher.eagleplugin
```

当前插件信息：

- 插件 ID：`com.max.eagle-online-showcase`
- 插件版本：`1.1.0`
- 插件名称：`MAX 加水印导出`
- 本地开发预览：`http://127.0.0.1:8799/`

### 2.2 隐私编辑器唯一上游

```text
/Users/max/.codex/worktrees/d3f0/朋友圈模拟器/共享模块/gravity-privacy-editor/1.0.0
```

现有朋友圈模拟器安装副本：

```text
/Users/max/.codex/worktrees/d3f0/朋友圈模拟器/应用源码/src/modules/shared/vendor/gravity-privacy-editor/1.0.0
```

现有微信宿主适配参考：

```text
/Users/max/.codex/worktrees/d3f0/朋友圈模拟器/应用源码/src/modules/simulator/chat/index.jsx
```

禁止让 Eagle 在运行时 import 朋友圈模拟器或上述工作树路径。Eagle 必须安装自己的版本副本。

## 3. 当前共享模块已经具备的能力

`@gravity/privacy-editor 1.0.0` 已包含：

- `privacyLayer` 与 `privacyItem` Schema。
- 模糊和马赛克两种全局效果。
- 强度 `2—24`。
- 最高模糊强度 `22—24` 的平均色块隐私兜底。
- 任意数量矩形区域。
- 自由框选。
- 点选宿主元素。
- 区域移动、缩放、Delete 删除。
- 删除所选、清除全部。
- 预览显示/隐藏。
- 旧 item 中 `type / intensity` 向全局字段迁移。
- 画布捕获请求去旧留新。
- 宿主滚动或布局变化订阅。
- 可注入智能打码选项。

公开 API：

```js
PRIVACY_EDITOR_VERSION
PRIVACY_EFFECT_TYPES
createPrivacyId
createPrivacyLayer
normalizePrivacyItem
normalizePrivacyLayer
normalizeSmartMasks
patchPrivacyLayer
privacyLayerHasMasks
clampPrivacyRect
intersectPrivacyRects
logicalRectForElement
drawBlurredRegion
drawPixelatedRegion
drawPrivacyEffect
PrivacyCanvas
PrivacyEditor
PrivacyControlPanel
```

## 4. 当前尚不具备的能力

不要把以下内容误认为共享模块已经完成：

- Eagle 当前选中项读取。
- Eagle 原图文件路径解析。
- 普通图片缩放、平移、适配窗口。
- 多图切换。
- 独立的图片打码项目存档。
- 原始分辨率的 Sharp 服务端导出。
- 自动识别微信头像。
- OCR。
- 人脸检测。
- 批量处理。
- 导出后自动加入 Eagle。

这些能力应分成“Eagle 宿主适配”和“共享模块后续版本”两类开发。

## 5. 不可破坏的模块边界

### 5.1 共享模块负责

- 隐私图层数据规范。
- 模糊/马赛克效果定义。
- 浏览器预览渲染。
- 通用编辑交互。
- 通用控制面板。
- 未来新增的宿主无关导出计划或 Node 渲染器。

### 5.2 Eagle 适配层负责

- `eagle.item.getSelected()`。
- Eagle item 到真实图片文件的解析。
- Eagle 通知、窗口、文件夹选择和访达打开。
- 图片列表与当前图片切换。
- 配置文件路径。
- 当前 Eagle Library 与 item ID 的绑定。
- 导出文件夹、命名冲突和是否重新加入 Eagle。
- 调用 Sharp 导出。

### 5.3 严格禁止

- Eagle 运行时引用朋友圈模拟器源码。
- 把微信 DOM 选择器复制进 Eagle 图片编辑器。
- 在 Eagle adapter 中重新发明一套 `privacyLayer`。
- 在 Eagle adapter 中长期保留第二套模糊/马赛克算法。
- 直接覆盖 Eagle 原图。
- 把用户 Eagle Library 图片打进插件安装包。
- 修改现有水印模块来承载隐私 Schema。

## 6. 推荐的 Eagle 文件结构

建议新增：

```text
Eagle线上展示/
├── eagle-plugin/
│   ├── adapters/
│   │   └── eagle/
│   │       ├── plugin.js
│   │       ├── privacy-editor.js
│   │       └── item-files.js
│   ├── modules/
│   │   └── vendor/
│   │       └── gravity-privacy-editor/
│   │           └── 1.0.0/
│   ├── privacy-app/
│   │   ├── main.jsx
│   │   ├── EaglePrivacyWorkspace.jsx
│   │   ├── image-adapter.js
│   │   └── privacy-workspace.css
│   ├── dist/
│   │   ├── privacy-editor.js
│   │   └── privacy-editor.css
│   ├── lib/
│   │   ├── config.js
│   │   ├── publisher.js
│   │   └── privacy-exporter.cjs
│   └── index.html
├── scripts/
│   ├── install-privacy-editor.cjs
│   └── build-privacy-editor.mjs
└── tests/
    ├── privacy-module-copy.test.cjs
    ├── privacy-state.test.cjs
    ├── privacy-adapter.test.cjs
    └── privacy-export.test.cjs
```

说明：

- `modules/vendor/.../1.0.0` 必须是上游的逐字节安装副本。
- `privacy-app/` 是 Eagle 专属图片编辑器 UI 和适配层，不属于共享核心。
- 当前 Eagle 主页面是普通 HTML + 浏览器脚本，而共享隐私编辑器是 React 组件，因此应增加一次明确的构建步骤，输出到 `dist/`。
- 不要为了避免构建而把 React 组件手工改写成另一套原生 DOM 编辑器。

## 7. 推荐接入方式

### 7.1 界面入口

在现有 `index.html` 左侧导航新增：

```text
隐私打码
```

对应新增独立：

```text
#view-privacy
```

第一阶段不要把隐私控件塞进现有水印表单。隐私打码是独立工作区，但未来真实导出流水线可以和水印组合。

### 7.2 页面布局

推荐三栏：

```text
┌────────────┬────────────────────────┬──────────────┐
│ 图片列表   │ 图片画布               │ 隐私控制面板 │
│ 当前选择项 │ 缩放、平移、框选       │ 模糊/马赛克  │
│            │                        │ 智能识别     │
└────────────┴────────────────────────┴──────────────┘
```

最低交互要求：

- 一屏完整显示当前图片。
- 支持放大、缩小、100%、适应窗口。
- 按住空格或使用明确工具进行画布平移。
- 框选与画布平移不能互相抢事件。
- 选区坐标永远按原图像素保存，不按屏幕缩放后的 CSS 像素保存。
- 切换图片时保留每张图片自己的隐私图层。

## 8. Eagle 当前可复用的宿主能力

现有项目已经实际使用：

```js
eagle.item.getSelected()
eagle.item.get({ tags })
eagle.dialog.showOpenDialog()
eagle.dialog.showMessageBox()
eagle.notification.show()
eagle.shell.showItemInFolder()
eagle.shell.openExternal()
eagle.onPluginCreate()
eagle.window.show()
```

不要重新写一套 Eagle API 外壳。优先把当前 `plugin.js` 和 `publisher.js` 中已经验证过的 item、文件路径、通知和导出目录逻辑提取成可复用适配器。

当前原图解析逻辑位于：

```text
eagle-plugin/lib/publisher.js
```

包含：

- 优先读取 `item.filePath`。
- 必要时根据 Eagle Library 根目录解析 `images/{item.id}.info`。
- 排除 `metadata.json` 和缩略图。
- 解析真正原图扩展名。

建议把这部分提取到：

```text
eagle-plugin/adapters/eagle/item-files.js
```

水印导出与隐私编辑器共同调用，禁止复制两份。

## 9. 图片适配器契约

图片宿主没有微信消息滚动或 DOM 锚点，推荐统一使用：

```js
const IMAGE_PRIVACY_OPTIONS = {
  width: originalWidth,
  height: originalHeight,
  allowedAnchors: ["image"],
  defaultAnchor: "image",
  relativeAnchors: [],
  smartMasks: {
    detectedLeftAvatars: false,
    detectedRightAvatars: false,
    detectedText: false
  }
};
```

普通选区：

```js
{
  id: "稳定区域 ID",
  anchor: "image",
  messageId: "",
  x: 100,
  y: 320,
  width: 80,
  height: 80,
  order: 0
}
```

画布适配器职责：

```js
captureSource({ target, layer, width, height })
resolveRegions({ target, layer, source, width, height })
resolveSamples({ target, layer, region, source, width, height })
subscribeLayout({ target, onChange })
resolveItemRect({ target, item })
resolveVisibleRect({ target, rect, item })
createItemFromRect({ target, rect, preferredItem })
resolveElementMask({ target, clientX, clientY })
```

图片适配器中：

- `captureSource` 返回当前原图对应的 `HTMLImageElement` 或可绘制图像源。
- `resolveRegions` 直接把每个 item 映射成原图坐标矩形。
- `resolveSamples` 使用相同 source/destination rect。
- `resolveVisibleRect` 根据画布当前缩放和平移只决定编辑边界显示，不修改持久化坐标。
- 普通图片第一阶段可以不实现“点选元素”，只保留自由框选。

## 10. 状态保存方案

推荐新增：

```text
~/Library/Application Support/Eagle/MAX Publisher/privacy-editor.json
```

不要把全部隐私状态继续塞进当前 `config.json`，避免水印配置与图片项目无限膨胀。

建议结构：

```json
{
  "schemaVersion": 1,
  "moduleVersion": "1.0.0",
  "items": {
    "资料库标识:item-id": {
      "itemId": "Eagle item id",
      "libraryRoot": "当前资料库",
      "source": {
        "width": 1290,
        "height": 2796,
        "modifiedAt": 0,
        "fileSignature": ""
      },
      "privacyLayer": {
        "previewVisible": true,
        "effectType": "blur",
        "intensity": 12,
        "smartMasks": {},
        "items": []
      },
      "updatedAt": "ISO 时间"
    }
  }
}
```

规则：

- 隐私状态按 Library + item ID 隔离。
- 原图未改变时自动恢复。
- 原图尺寸相同但内容改变时提示用户确认是否保留旧区域。
- 原图宽高同比缩放时可以提供“按比例迁移区域”。
- 宽高比变化时默认不自动套用旧区域。
- 写入使用临时文件 + rename，保持原子保存。

## 11. 预览与真实导出的关键差异

### 11.1 浏览器预览

当前 `1.0.0` 的 `PrivacyCanvas` 足以完成 Eagle 窗口中的实时预览。

### 11.2 原始分辨率导出

不能直接假设浏览器 Canvas 可以稳定处理所有超长微信截图。长图可能触及浏览器画布尺寸、内存或编码上限。

Eagle 已安装：

```text
sharp 0.32.6
```

推荐把生产级 Node/Sharp 隐私导出先提升到共享模块新版本，例如：

```text
@gravity/privacy-editor 1.1.0
```

新增宿主无关接口：

```js
renderPrivacyBuffer(input, {
  layer,
  format,
  quality
})

renderPrivacyFile(inputPath, outputPath, {
  layer,
  format,
  quality
})
```

注意：

- Sharp 渲染器应进入共享模块上游的新版本。
- Eagle 只负责传入原图、隐私层和导出参数。
- 不要只在 `privacy-exporter.cjs` 长期维护第二套效果算法。
- 如果先做临时 PoC，完成后必须提升回共享模块并删除临时重复实现。

## 12. 隐私与水印的统一导出顺序

如果同一张图片既要打码又要加水印，固定顺序：

```text
Eagle 原图
→ 隐私打码压平
→ 水印压平
→ 最大尺寸调整
→ JPG / PNG / WebP 编码
→ 输出新文件
```

原因：

- 水印不能被后续马赛克误伤。
- 隐私打码必须作用于原始内容。
- 输出缩放应最后执行，保证打码位置基于原图像素稳定。

首版可以提供两个明确动作：

- `只导出打码图`
- `打码后继续套用当前水印导出`

## 13. 智能识别扩展

智能识别必须作为独立可选检测器：

```js
detect(image, context) -> Promise<Region[]>
```

检测结果示例：

```js
[
  {
    id: "detected-avatar-1",
    kind: "left-avatar",
    confidence: 0.96,
    rect: { x: 24, y: 430, width: 80, height: 80 }
  }
]
```

### 第一阶段

- 不开发 AI。
- 只做手动框选、移动、缩放和导出。

### 第二阶段：微信截图规则识别

- 根据长截图宽度估算微信头像尺寸。
- 在左侧和右侧固定边距带中寻找重复方形区域。
- 检测圆角头像外框、相似尺寸和纵向消息节奏。
- 检测结果先作为候选区域显示，用户确认后才写入普通 privacy items。

### 第三阶段

- OCR 识别顶部聊天名称、手机号、地址、订单号。
- 可选人脸检测。
- 检测器与共享打码核心继续隔离。

## 14. 版本策略

当前上游 `1.0.0` 发布后保持不可变。

Eagle 首次接入规则：

1. 复制 `1.0.0` 到 Eagle vendor 目录。
2. 建立逐文件 SHA256 校验测试。
3. Eagle adapter 不得修改 vendor 文件。
4. 共享核心需要新增能力时：
   - 先在根共享模块发布 `1.1.0`。
   - 补充模块测试。
   - Eagle 安装 `1.1.0` 新目录。
   - 修改 Eagle 包装入口。
   - 分别回归朋友圈模拟器与 Eagle。
5. 不覆盖旧版本目录。

## 15. package 与构建建议

Eagle 当前根项目没有 React 构建链。建议新增：

```json
{
  "scripts": {
    "build:privacy": "vite build --config vite.privacy.config.mjs",
    "test:privacy": "node --test tests/privacy-*.test.cjs",
    "package:plugin": "npm run build:privacy && cd eagle-plugin && zip -qr ../max-eagle-publisher.eagleplugin . -x '*.DS_Store'"
  }
}
```

依赖建议与共享包 peerDependencies 对齐：

```text
react 19.2.0
react-dom 19.2.0
@phosphor-icons/react 2.1.10
vite
@vitejs/plugin-react
```

不要升级现有 Sharp，除非独立验证字体、水印和当前导出测试全部通过。

## 16. 自动测试清单

至少新增：

### 模块副本

- 上游与 Eagle vendor 文件清单一致。
- 每个文件 SHA256 一致。
- 版本为 `1.0.0`。
- 共享源码不包含 Eagle、微信、MORROW 或绝对路径。

### Schema

- 空图层。
- 模糊/马赛克切换。
- 强度边界。
- 旧 item 迁移。
- 任意原图尺寸。
- 坐标裁切。

### Eagle adapter

- 当前未选择图片时提示。
- 单图、多图读取顺序正确。
- 非图片 item 过滤。
- item 原图路径解析。
- 切换 item 恢复各自 privacy layer。
- 删除 item 后状态清理策略明确。

### 导出

- JPG、PNG、WebP。
- 透明 PNG。
- EXIF 方向。
- 超长截图。
- 同名文件 rename/overwrite。
- 最高强度不得露出原图细节。
- 导出不修改原图。
- 隐私 + 水印的处理顺序。

### UI

- 适应窗口。
- 100%。
- 缩放和平移。
- 框选。
- 移动。
- 缩放选区。
- Delete。
- 删除所选。
- 清除全部。
- 预览隐藏后导出原图还是禁止导出，需要产品规则明确。
- 重开插件恢复图层。

## 17. 首轮开发顺序

不要一次把自动识别、批量处理和水印组合全部做完。

### Phase 0：模块安装

- 安装 `@gravity/privacy-editor 1.0.0` Eagle 副本。
- 建立哈希验证。
- 新增 React 构建入口。
- 在插件增加空的“隐私打码”页面。

### Phase 1：单图手动编辑

- 读取当前选中的第一张图片。
- 显示完整图片。
- 原图坐标框选、移动、缩放和删除。
- 模糊/马赛克与强度。
- 保存/恢复 privacy layer。

### Phase 2：真实导出

- 先把 Node/Sharp 导出提升为共享模块新版本。
- JPG/PNG/WebP 导出。
- 访达显示。
- 不覆盖原图。

### Phase 3：多图

- 左侧选中图片列表。
- 每张图独立状态。
- 批量导出。

### Phase 4：智能头像

- 微信长截图左右头像候选识别。
- 候选确认。
- 手动补充和撤销。

### Phase 5：水印组合

- 隐私打码后套用当前水印。
- 共享一套输出目录、质量和同名策略。

## 18. 首轮验收标准

Phase 1 完成必须满足：

- 在 Eagle 选中图片后打开隐私页面能立即显示。
- 原图不被修改。
- 选区坐标按原图像素保存。
- 缩放窗口后选区仍对准同一内容。
- 模糊和马赛克是全局效果，不混用。
- 强度 24 不泄露隐私细节。
- 关闭重开插件后选区恢复。
- 多个 Eagle item 的隐私状态不串图。
- 现有水印、字体、线上发布功能不回归。
- `npm test`、隐私专项测试和插件打包通过。

## 19. 当前风险

1. 共享模块 React 版本与 Eagle 当前无构建链之间存在接入成本。
2. 超长截图不能只依赖浏览器 Canvas 导出。
3. Eagle item 的真实文件路径可能因资料库位置和 item 类型不同而变化，必须复用当前已验证的 fallback。
4. 保存状态不能只按 item ID；不同资料库可能出现相同 ID 或迁移场景。
5. 透明图片、旋转方向和超大图片必须进入真实导出测试。
6. 自动头像识别只能作为候选，不应未经用户确认直接永久保存或导出。
7. 当前插件包体已经包含 Sharp，新增 React bundle 后需观察安装包大小和启动速度。

## 20. 新 Codex 对话开场指令

可以把下面整段直接交给新的开发对话：

```text
请继续把 @gravity/privacy-editor 接入现有 Eagle MAX Publisher。

Eagle 项目：
/Users/max/引力环球/朋友圈模拟器/Eagle线上展示

Eagle 插件源码：
/Users/max/引力环球/朋友圈模拟器/Eagle线上展示/eagle-plugin

交接文档：
/Users/max/引力环球/朋友圈模拟器/Eagle线上展示/Eagle隐私打码编辑器接入交接文档.md

共享隐私模块唯一上游：
/Users/max/.codex/worktrees/d3f0/朋友圈模拟器/共享模块/gravity-privacy-editor/1.0.0

微信宿主适配参考：
/Users/max/.codex/worktrees/d3f0/朋友圈模拟器/应用源码/src/modules/simulator/chat/index.jsx

先阅读 Eagle 项目 README、package.json、manifest.json、adapters/eagle/README.md、现有测试和交接文档。

第一轮只做 Phase 0：
1. 把 1.0.0 作为不可修改的版本化 vendor 副本安装到 Eagle。
2. 建立上游与 Eagle 副本逐字节一致的自动验证。
3. 给 Eagle 增加 React 隐私编辑器构建入口。
4. 在现有插件左侧增加“隐私打码”页面骨架。
5. 不修改现有水印、字体、线上发布行为。
6. 不开发自动识别，不开发真实 Sharp 导出，不覆盖正式安装版。
7. 完成后运行现有 npm test、新隐私测试和插件预览，记录修改文件、结果和风险。

不要让 Eagle 运行时引用朋友圈模拟器源码，不要复制第二套隐私 Schema 或模糊/马赛克算法。
```

## 21. 本次交接状态

- 只完成接入设计与交接。
- 尚未修改 Eagle 源码。
- 尚未复制隐私模块到 Eagle。
- 尚未增加 React/Vite 构建链。
- 尚未打包或覆盖 Eagle 正式插件。
- 朋友圈模拟器与 MORROW 未因本交接文档发生代码变化。
