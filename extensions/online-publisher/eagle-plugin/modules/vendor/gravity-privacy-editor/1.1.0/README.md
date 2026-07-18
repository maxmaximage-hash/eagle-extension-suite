# Gravity Privacy Editor 1.1.0

`@gravity/privacy-editor` 是可移植的非破坏式隐私打码模块。它提供统一的隐私图层数据、模糊/马赛克浏览器渲染器、可刷新的画布、框选/拖动/缩放编辑器和通用控制面板，但不绑定微信、朋友圈、MORROW、Electron、Finder 或任何固定图片目录。

## 当前能力

- 全局模糊或马赛克效果与强度。
- 矩形与椭圆区域。
- 选中区域显示四角与四边共八个缩放控制点；控制点保持固定屏幕尺寸，可从任意方向自由调整区域大小。
- 所有区域严格共享同一种模糊/马赛克效果与同一强度，区域数据不保存独立效果参数。
- 高强度马赛克按选区尺寸进入隐私安全档：22–24 档逐步压缩到约 4、3、2 个长边采样格，避免狭长眼睛区域在最大强度下仍保留轮廓。
- 任意数量的矩形区域、区域顺序和预览显隐。
- 旧区域内 `type / intensity` 到全局字段的兼容迁移。
- 最高模糊强度使用区域平均色块，避免重新露出隐私细节。
- 通用画布刷新、旧捕获丢弃、滚动或布局变化时即时重绘和延迟重新捕获。
- 自由框选、点选元素、移动、缩放、Delete 删除和智能区域辅助边界。
- 区域移动与八方向缩放使用窗口级稳定指针会话；即使宿主连续重渲染选区节点，拖动也不会中断。
- 可配置的控制面板，宿主可注入自己的智能选项。

## 模块边界

共享模块负责：

- `privacyLayer` 与 `privacyItem` Schema。
- 几何裁切、画布坐标换算和效果绘制。
- `PrivacyCanvas`、`PrivacyEditor`、`PrivacyControlPanel`。
- `node.cjs` 提供基于 Sharp 的原始分辨率隐私压平渲染。
- 捕获、区域解析、滚动订阅和元素点选的适配契约。

宿主适配器负责：

- 从真实 DOM 或导入图片生成捕获源。
- 把业务元素转换为打码区域。
- 定义智能规则，例如我方头像、对方头像、聊天名称。
- 定义滚动区、裁切区和跟随对象。
- 保存、打开、导入图片和导出成品。

模块不得写死：

- 微信 DOM 选择器、消息 ID、头像方向或聊天滚动结构。
- 朋友圈项目库、聊天记录目录或 MORROW Library。
- Electron IPC、浏览器 API 路由或 Finder 行为。

## 数据结构

```js
{
  previewVisible: true,
  effectType: "blur",
  intensity: 12,
  smartMasks: {
    selfAvatars: true,
    peerAvatars: false
  },
  items: [
    {
      id: "稳定区域 ID",
      anchor: "screen",
      messageId: "",
      x: 20,
      y: 40,
      width: 80,
      height: 48,
      shape: "ellipse",
      order: 0
    }
  ]
}
```

`smartMasks` 是宿主定义的布尔规则字典，共享包只保存与切换，不理解具体业务含义。

## React 适配示例

```jsx
<PrivacyCanvas
  targetRef={screenRef}
  layer={privacyLayer}
  width={430}
  height={932}
  captureSource={captureSource}
  resolveRegions={resolveRegions}
  resolveSamples={resolveSamples}
  subscribeLayout={subscribeLayout}
/>

<PrivacyEditor
  targetRef={screenRef}
  layer={privacyLayer}
  tool="draw"
  resolveItemRect={resolveItemRect}
  resolveVisibleRect={resolveVisibleRect}
  resolveSmartRegions={resolveSmartRegions}
  createItemFromRect={createItemFromRect}
  resolveElementMask={resolveElementMask}
/>
```

## 未来扩展

图片打码编辑器不需要修改共享核心，只需新增图片宿主适配器：

1. 导入普通图片或长截图作为捕获源。
2. 使用原图像素尺寸作为画布坐标。
3. 通过检测器返回左右头像、名称或其他隐私区域。
4. 把检测结果写入 `smartMasks` 对应的动态区域解析器。
5. 继续使用同一个控制面板、编辑器、渲染器和预览即导出逻辑。

自动检测器应作为独立可选能力，通过 `detect(image) -> regions[]` 契约接入；共享打码模块本身不绑定人脸模型、OCR 或微信截图识别算法。

## Node 原图导出

```js
const { renderPrivacyBuffer } = require("./node.cjs");

const result = await renderPrivacyBuffer(inputPathOrBuffer, {
  layer: privacyLayer,
});
```

返回 `{ buffer, width, height, layer }`。浏览器和 Node 共同调用 `calculateMosaicGrid()`，使用完全一致的强度与采样格映射；Node 端使用两阶段 Sharp 缩放生成真实马赛克，避免连续 `resize()` 覆盖缩小步骤。
