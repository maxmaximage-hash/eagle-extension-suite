# Gravity Font Manager 1.1.2

字体管理已经与 Eagle 业务逻辑分离，可在以后独立成 Mac 字体管理软件。

- `classifier.js`：中英文与无衬线、有衬线、手写分类算法。
- `classification.js`：人工校准表。
- `catalog.js`：当前 Mac 字体家族、字面、字重和真实字体路径目录。
- `metadata.js`：字体文件语言覆盖和元数据。
- `browser.js`：管理页、搜索、筛选、分类、隐藏与字重预览；公开浏览器全局 `GravityFontManager`。
- `index.js`：CommonJS 入口，版本为 `1.1.2`。

## 1.1.2

- 系统真实字体存在时移除同名字体的无路径兜底字面，保证预览与真实导出绑定到实际字体文件。

## 1.1.1

- 多语种字形覆盖不再把 Arial、Times New Roman 等有效拉丁字体错误排除出字体分类。

`GravityFontManager` 公开：`refresh()`、`render()`、`favorites()`、`toggleFavorite()`、`catalog()`、`resolveFace()`、`applyFace()`。水印编辑器只通过这些字体能力和共享目录工作，不自行维护第二份字体匹配规则。

收藏数据由宿主配置中的 `fontClassification.favorites: string[]` 持久化。收藏字体会在下拉顶部“收藏”分组和原分类中各显示一次；切换收藏只改变星标及收藏副本，不改变当前字体、菜单开合或当前滚动位置。键盘 `↑ / ↓` 仍按原始去重字体目录移动，并在第一项和最后一项停止。
