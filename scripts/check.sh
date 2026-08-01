#!/bin/zsh
set -euo pipefail

readonly ROOT="${0:A:h:h}"
readonly MANIFEST="$ROOT/release-manifest.json"
readonly EAGLE_APP="${EAGLE_APP_PATH:-/Applications/Eagle.app}"
readonly PLUGIN_ROOT="$HOME/Library/Application Support/Eagle/Plugins"

fail() { print -u2 "检查失败：$1"; exit 1; }
sha256() { shasum -a 256 "$1" | awk '{print $1}'; }

[[ "$(uname -s)" == "Darwin" ]] || fail "当前发行只支持 macOS。"
[[ -d "$EAGLE_APP" ]] || fail "找不到 Eagle：$EAGLE_APP"
[[ -f "$MANIFEST" ]] || fail "缺少 release-manifest.json。"
command -v jq >/dev/null || fail "需要 jq。"

version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$EAGLE_APP/Contents/Info.plist" 2>/dev/null || true)
[[ -n "$version" ]] || fail "无法读取 Eagle 版本。"

print "Eagle: $version"
print "Eagle 状态: $(pgrep -x Eagle >/dev/null && print '运行中（只能检查，安装前必须正常退出）' || print '已退出')"
print "插件目录: $PLUGIN_ROOT"

for key in mediaOrganizer maxPublisher; do
  archive=$(jq -r ".artifacts.$key.file" "$MANIFEST")
  expected=$(jq -r ".artifacts.$key.sha256" "$MANIFEST")
  plugin_id=$(jq -r ".artifacts.$key.pluginId" "$MANIFEST")
  plugin_version=$(jq -r ".artifacts.$key.version" "$MANIFEST")
  [[ -f "$ROOT/$archive" ]] || fail "缺少安装包：$archive"
  actual=$(sha256 "$ROOT/$archive")
  [[ "$actual" == "$expected" ]] || fail "$archive SHA-256 不匹配。"
  print "$plugin_id: $plugin_version · SHA-256 通过"
  if [[ -f "$PLUGIN_ROOT/$plugin_id/manifest.json" ]]; then
    installed=$(jq -r '.version' "$PLUGIN_ROOT/$plugin_id/manifest.json")
    print "  当前安装: $installed"
  else
    print "  当前安装: 无"
  fi
done

asar="$EAGLE_APP/Contents/Resources/app.asar"
if [[ -f "$asar" ]]; then
  current=$(sha256 "$asar")
  supported=$(jq -r '.hostCompatibility.acceptedAppAsarSha256[]' "$MANIFEST" 2>/dev/null || true)
  if print -r -- "$supported" | grep -Fxq "$current"; then
    print "媒体智能整理宿主通信能力: 已支持"
  else
    print "媒体智能整理宿主通信能力: 不受支持（安装器将拒绝完整套件安装）"
  fi
else
  print "媒体智能整理宿主通信能力: 无法检查 app.asar"
fi

print "检查完成；没有写入插件、Eagle、Library、NAS 或配置。"
