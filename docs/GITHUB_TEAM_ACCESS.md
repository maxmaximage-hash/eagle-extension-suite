# GitHub 团队访问

本仓库默认按私有团队软件发布。仓库私有不会影响 Eagle 插件功能，只决定谁能克隆源码和安装包。

## 仓库管理员

在 GitHub 仓库的 `Settings → Collaborators and teams` 中添加团队成员或 GitHub Team。只需要安装的成员授予 `Read` 权限；负责维护代码的成员再按职责授予更高权限。

## 团队成员

成员先确认自己的 GitHub 账号已经获得仓库访问权限，然后在本机完成 GitHub 登录：

```bash
gh auth login
gh repo clone maxmaximage-hash/eagle-extension-suite
cd eagle-extension-suite
./scripts/check.sh
```

也可以把私有仓库链接交给已经登录同一 GitHub 账号的 Codex，并使用 [INSTALL_WITH_CODEX.md](INSTALL_WITH_CODEX.md) 中的完整指令。

## 凭据规则

- GitHub、Cloudflare 或其他 token 不要粘贴到 README、Issue、截图或提交中；
- Codex 应使用用户本机已经建立的登录状态，不把 token 写进仓库；
- 仓库访问权和 Cloudflare 发布权彼此独立；只使用排序、水印、马赛克、字体和本地导出，不需要 Cloudflare 权限；
- 离开团队时撤销 GitHub 仓库访问权；NAS 与 Eagle Library 权限仍需在存储系统中单独撤销。
