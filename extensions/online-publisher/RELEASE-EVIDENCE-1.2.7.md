# MAX Publisher 1.2.7 安全发行证据

- 插件 ID：`com.max.eagle-online-showcase`
- 安装包：`max-eagle-publisher-1.2.7.eagleplugin`
- SHA-256：`1855587315be1bc2bdd773226312405173a01920da31dd26e6f3388960617a02`
- 依赖修复：直接生产依赖 `sharp` 从 0.32.6 精确升级为 0.35.3，修复 GHSA-f88m-g3jw-g9cj。
- 开发与线上发布工具链：根开发依赖 `wrangler` 从 4.107.0 精确升级为 4.118.0，移除其 `miniflare` 间接引入的 `sharp` 小于 0.35 高危链路。
- 自动验证：`npm test`，82/82 通过，其中包括 WebP、JPEG、PNG、水印、模糊/马赛克、字体渲染和 sharp 锁定门禁；`npm run build:privacy` 与 `npm run package:plugin` 均通过。
- 审计：根项目 `npm audit --json`（含开发依赖）与 Eagle 插件 `npm audit --omit=dev --json` 均为 exit 0、全部漏洞级别为 0。插件审计依赖计数为 prod 18、optional 27、total 44。
- 包结构：manifest 为 1.2.7；不含 Wrangler 状态、发布图片、`gallery.json`、本机配置、开发者绝对路径或内嵌 Cloudflare 凭证。
- 回滚：`RELEASE-EVIDENCE-1.2.6.md` 和 1.2.6 包保持不变。若 1.2.7 真实 Eagle 冒烟失败，恢复 1.2.6，不回退到含已知高危 sharp 的版本。
- 未执行：未安装或重启 Eagle，未操作 Eagle Library、NAS、真实线上发布数据，也未发布 GitHub 或 Cloudflare。
