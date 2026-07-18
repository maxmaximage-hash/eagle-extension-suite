# Instagram 整帖保存至 Eagle

一个本地 Chrome 扩展：在 Instagram 帖子的大图或视频区域内右键，将该帖子中的所有图片和视频批量保存至指定 Eagle 文件夹。

## 安装

1. 在 Chrome 地址栏输入 `chrome://extensions/`
2. 打开右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本文件夹 `instagram-post-importer`
5. 刷新已经打开的 Instagram 页面

## 使用

1. 先打开 Eagle 应用和要使用的资源库
2. 在 Instagram 网页打开一条帖子
3. 在帖子的大图或视频区域内右键
4. 选择「保存整条帖子至 Eagle…」
5. 在文件夹选择器中选择目标文件夹，然后点击保存

官方 Eagle 扩展的「保存至 Eagle」仍用于保存当前单张；本扩展的新菜单项专门用于整帖批量导入。

可直接分发的 1.1.2 安装包保存在 `releases/instagram-post-to-eagle-v1.1.2.zip`。

## 已知边界

- 只能读取当前 Instagram 账号有权限查看的帖子
- Eagle 必须在本机运行；扩展通过 Eagle 的 `127.0.0.1:41595` 本地接口导入
- Instagram 的普通图片和直连视频可直接导入；如果 Instagram 将视频改为分片流，该视频可能无法导入
- Instagram 改版页面结构后，可能需要同步更新扩展
- 请只保存你有权使用的内容，并遵守 Instagram 条款及当地法律
