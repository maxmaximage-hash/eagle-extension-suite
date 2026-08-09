# MAX Publisher 协作规则

## 运行

```bash
npm ci
npm test
npm run build:privacy
npm run preview
```

打包：

```bash
npm run package:plugin
```

## 验证

- 所有 Node 测试通过。
- 隐私编辑器构建通过。
- 插件包版本与 manifest 一致。
- 在 Eagle 中验证真实图片的水印、打码、字体和导出。
- 发布操作只写入 `~/引力环球/Eagle线上发布数据`，不写回 Eagle 原图。

## 约束

- 不把线上发布图片、gallery、Wrangler 状态或 Eagle 配置提交到 Git。
- 不覆盖 Eagle 原图。
- 共享模块 vendor 版本必须与上游版本锁匹配。
- 不在文档中记录 Cloudflare 凭证、令牌或敏感项目配置。
- 完成任务后更新 `TASKS.md`，重要决定写入 `DECISIONS.md`。
