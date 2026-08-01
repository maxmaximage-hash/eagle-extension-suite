# 安全与隐私

请不要在公开 Issue 中提交：

- API Key、Cloudflare token、账号 Cookie 或 NAS 凭据；
- Eagle `.library`、团队 sidecar、素材原件或客户数据；
- `config.json`、`state.json`、`geo-tag-state.json`、缓存或完整诊断日志；
- Eagle `app.asar` 或任何宿主二进制。

发现凭据误提交时，应立即撤销该凭据，并从 Git 历史中清除；仅删除最新文件不足以消除泄露。

插件不应直接编辑 `.library` 内部文件。安装、升级和回滚仅允许操作两个登记插件目录与其受控备份目录。
