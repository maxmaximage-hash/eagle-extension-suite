# 小红书整帖保存至 Eagle

当前稳定版本：`1.0.0`

这是一个独立 Chrome 扩展，用于在小红书单条笔记页把整帖静态图片保存到 Eagle。普通图片和 Live 图的静态图片都会转换为 JPG 后作为图片项目导入。

## 本机加载

1. 打开 Eagle 和目标资源库。
2. Chrome 打开 `chrome://extensions/`，启用右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择发布目录中的 `小红书整帖保存至Eagle` 文件夹。
4. 刷新已经打开的小红书页面。
5. 打开一条笔记详情，使用以下任一入口：
   - 页面右下角“整篇存 Eagle”；
   - Chrome 顶部扩展按钮；
   - 小红书图片右键菜单里的“整篇存 Eagle”；
   - Chrome 原生右键菜单里的“小红书：保存整篇静态图片至 Eagle…”。
6. 选择 Eagle 文件夹。

## 当前导入语义

- 只处理当前账号有权打开的单条笔记。
- 保存作者、正文、来源链接和静态图片。
- 普通图片和 Live 静态图片都会转换为 JPG。
- 转换后的 JPG 通过 Eagle 本地路径接口导入。
- 转换后的 JPG 会保存在 Chrome 下载目录下的 `Eagle-XHS-JPG-Cache`，再交给 Eagle 导入。
- 本机该目录已设置为 Finder 隐藏；JPG 文件会在导入成功 30 分钟后自动删除，文件夹本身可能保留为空文件夹。
- 延迟清理是为了等待 Eagle 异步读取文件，避免导入时报 `ENOENT`。
- 当前不会保留 HEIC/HEIF、ZIP 或 LIVP。
- 不修改 Eagle.app，不写 Eagle `.library` 内部文件。

## 验证

- 执行 `npm test`。
- 执行 `npm run check`。
- 在 Chrome 重新加载扩展后，用普通多图和含 Live 图的笔记做真实 Eagle 验收，确认 Eagle 中项目格式为 JPG。
