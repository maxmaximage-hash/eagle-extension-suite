# MAX Publisher 1.2.6 跨电脑发行证据

- 插件 ID：`com.max.eagle-online-showcase`
- 安装包：`max-eagle-publisher.eagleplugin`
- SHA-256：`d9e4ddad3e8cf19b070475132e2112ea4849db1db7eb37c90965c8bc450cda57`
- 自动验证：`npm test`，81/81 通过；`npm run build:privacy` 通过；`npm run package:plugin` 通过。
- 包结构：manifest 版本为 `1.2.6`；不含 Wrangler 状态、发布图片、`gallery.json`、本机配置、开发者绝对路径或内嵌 Cloudflare 凭证。
- 运行时依赖：包内保留 `node_modules`，供 Eagle 离线使用 `sharp`、`fontkit` 及其依赖；这不是开发环境依赖目录，也不包含发布业务数据。
- 字体行为：首次运行由当前 Mac 的 `system_profiler` 发现字体文件，按真实 PostScript 字面选择多字重；未安装的已保存字体降级到可用字体，不能作为已安装字体显示。
- 回滚：保留 1.2.5 已安装包作为基线。真实 Eagle 冒烟若失败，恢复 1.2.5，并记录触发条件和该版本 SHA-256。
- 未执行：未安装或重启 Eagle，未操作 Eagle Library、NAS、真实线上发布数据，也未部署 Cloudflare。
