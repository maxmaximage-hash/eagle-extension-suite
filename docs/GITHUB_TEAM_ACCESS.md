# GitHub 团队访问

本仓库已经公开。任何人都可以查看、克隆源码和下载 Release 安装包，不需要管理员单独添加读取权限。

## 仓库管理员

公开访问只提供读取和下载。需要提交代码、管理 Issue 或发布新版本的成员，仍应在 GitHub 仓库的 `Settings → Collaborators and teams` 中按职责授予写入权限。

## 团队成员

团队成员可以直接克隆，不要求 GitHub 登录：

```bash
gh repo clone maxmaximage-hash/eagle-extension-suite
cd eagle-extension-suite
./scripts/check.sh
```

也可以直接把公开仓库链接交给 Codex，并使用 [INSTALL_WITH_CODEX.md](INSTALL_WITH_CODEX.md) 中的完整指令。

## 凭据规则

- GitHub、Cloudflare 或其他 token 不要粘贴到 README、Issue、截图或提交中；
- Codex 应使用用户本机已经建立的登录状态，不把 token 写进仓库；
- 仓库访问权和 Cloudflare 发布权彼此独立；只使用排序、水印、马赛克、字体和本地导出，不需要 Cloudflare 权限；
- 离开团队时撤销 GitHub 仓库访问权；NAS 与 Eagle Library 权限仍需在存储系统中单独撤销。
