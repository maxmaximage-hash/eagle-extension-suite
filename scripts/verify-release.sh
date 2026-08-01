#!/bin/zsh
set -euo pipefail

readonly ROOT="${0:A:h:h}"
readonly MANIFEST="$ROOT/release-manifest.json"

fail() { print -u2 "发行校验失败：$1"; exit 1; }
sha256() { shasum -a 256 "$1" | awk '{print $1}'; }

command -v jq >/dev/null || fail "需要 jq。"
command -v unzip >/dev/null || fail "需要 unzip。"
[[ -f "$MANIFEST" ]] || fail "缺少 release-manifest.json。"

for key in mediaOrganizer maxPublisher; do
  archive=$(jq -r ".artifacts.$key.file" "$MANIFEST")
  expected=$(jq -r ".artifacts.$key.sha256" "$MANIFEST")
  plugin_id=$(jq -r ".artifacts.$key.pluginId" "$MANIFEST")
  plugin_version=$(jq -r ".artifacts.$key.version" "$MANIFEST")
  [[ -f "$ROOT/$archive" ]] || fail "缺少安装包：$archive"
  [[ "$(sha256 "$ROOT/$archive")" == "$expected" ]] || fail "$archive SHA-256 不匹配。"
  unzip -tq "$ROOT/$archive" >/dev/null || fail "$archive 压缩完整性失败。"
  actual_id=$(unzip -p "$ROOT/$archive" manifest.json | jq -r '.id')
  actual_version=$(unzip -p "$ROOT/$archive" manifest.json | jq -r '.version')
  [[ "$actual_id" == "$plugin_id" ]] || fail "$archive 插件 ID 不匹配。"
  [[ "$actual_version" == "$plugin_version" ]] || fail "$archive 版本不匹配。"
  print "$plugin_id $plugin_version · SHA-256、manifest、压缩完整性通过"
done

print "发行安装包校验完成。"
