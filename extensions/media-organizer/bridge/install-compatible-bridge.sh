#!/bin/zsh
set -euo pipefail

print -u2 "拒绝执行：历史 bridge 安装器已永久禁用，不会写入 Eagle 宿主。仅允许通过 scripts/install-github-release.sh --install-plugin-only 安装插件文件。"
exit 1
