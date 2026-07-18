# Instagram 整帖导入协作规则

## 运行与安装

- Chrome 打开 `chrome://extensions/` 并启用开发者模式。
- 使用“加载已解压的扩展程序”选择本目录。
- 修改后在扩展页重新加载，并刷新 Instagram 页面。

## 验证

- `background.js` 和 `content.js` 必须通过 JavaScript 语法检查。
- 右键菜单只在 Instagram 帖子媒体区域承担整帖导入，不替换 Eagle 官方单张保存功能。
- 必须在 Eagle 正常运行且本地接口可用时做一次真实多媒体帖子验收。
- 不能因为代码检查通过就把真实导入标记为已完成。

## 约束

- 不绕过 Instagram 账号权限，也不实现规避平台限制的行为。
- 不直接修改 Eagle `.library` 内部文件，只使用公开的本地接口。
- 处理用户内容时保留来源链接，并提示遵守内容权利和平台规则。
- 完成任务后更新 `TASKS.md`；产品边界变化写入 `DECISIONS.md`。
