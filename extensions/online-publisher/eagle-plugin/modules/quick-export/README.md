# Gravity Quick Export 1.0.0

水印页与隐私打码页共用的唯一快速导出浏览器控制器。它负责导出目录、按质量/按文件大小、同名处理、进度和结果回调，不理解水印或隐私业务；宿主通过 `exportItems()` 注入真实渲染流程。

公开入口：

```js
GravityQuickExport.mount(container, options)
```
