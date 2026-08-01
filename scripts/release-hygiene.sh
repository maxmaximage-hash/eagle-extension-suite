#!/bin/zsh
set -euo pipefail

readonly ROOT="${0:A:h:h}"
cd "$ROOT"

forbidden_paths=$(find . -type f \( \
  -name 'geo-tag-state.json' -o \
  -name 'photo-taken-cache.json' -o \
  -name 'rename-batch-backup.json' -o \
  -name 'config.json' -o \
  -name 'state.json' -o \
  -name 'app.asar' -o \
  -name '*.library' \
\) -not -path './.git/*' -not -path '*/node_modules/*' -print)

if [[ -n "$forbidden_paths" ]]; then
  print -u2 "发行包包含禁止文件："
  print -u2 -- "$forbidden_paths"
  exit 1
fi

if rg -n --hidden \
  -g '!.git' \
  -g '!.git/**' \
  -g '!docs/**' \
  -g '!README.md' \
  -g '!scripts/release-hygiene.sh' \
  -e '/Users/max/' \
  -e 'CLOUDFLARE_API_TOKEN[[:space:]]*=' \
  -e 'gh[pousr]_[A-Za-z0-9]{20,}' \
  -e 'sk-[A-Za-z0-9_-]{16,}' \
  .; then
  print -u2 "发行源码包含开发者绝对路径或疑似凭据。"
  exit 1
fi

print "发行卫生门禁通过。"
