#!/bin/zsh
set -euo pipefail

readonly ROOT="${0:A:h:h}"
readonly MANIFEST="$ROOT/release-manifest.json"
readonly EAGLE_APP="${EAGLE_APP_PATH:-/Applications/Eagle.app}"
readonly TARGET="$EAGLE_APP/Contents/Resources/app.asar"
readonly BACKUP_DIR="$HOME/Library/Application Support/Eagle/Backups/eagle-extension-suite/host"
readonly BACKUP="$BACKUP_DIR/Eagle-4.0.0-build23-original-app.asar"

fail() { print -u2 "宿主桥安装失败：$1"; exit 1; }
sha256() { shasum -a 256 "$1" | awk '{print $1}'; }

[[ "${1:-}" == "--check" || "${1:-}" == "--install" ]] || \
  fail "参数仅支持 --check 或 --install。"
[[ -f "$MANIFEST" ]] || fail "缺少 release-manifest.json。"
[[ -d "$EAGLE_APP" ]] || fail "找不到 Eagle：$EAGLE_APP"
[[ -f "$TARGET" ]] || fail "找不到 Eagle app.asar。"
command -v jq >/dev/null || fail "需要 jq。"
command -v node >/dev/null || fail "需要 Node.js。"

version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$EAGLE_APP/Contents/Info.plist" 2>/dev/null || true)
[[ "$version" == "$(jq -r '.hostCompatibility.eagleVersions[0]' "$MANIFEST")" ]] || \
  fail "只支持发行清单指定的 Eagle 版本，当前为 ${version:-未知}。"

original=$(jq -r '.hostCompatibility.originalAppAsarSha256' "$MANIFEST")
generated=$(jq -r '.hostCompatibility.generatedBridgeSha256' "$MANIFEST")
current=$(sha256 "$TARGET")
accepted=$(jq -r '.hostCompatibility.acceptedAppAsarSha256[]' "$MANIFEST")

if print -r -- "$accepted" | grep -Fxq "$current"; then
  print "Eagle 宿主通信桥：已安装（$current）"
  exit 0
fi
[[ "$current" == "$original" ]] || \
  fail "app.asar 指纹未知（$current）；不会覆盖或尝试修补。"

if [[ "$1" == "--check" ]]; then
  print "Eagle 宿主通信桥：可受控安装"
  print "当前原版指纹：$current"
  print "安装后目标指纹：$generated"
  print "计划回滚文件：$BACKUP"
  exit 0
fi

pgrep -x Eagle >/dev/null && fail "请先正常退出 Eagle，并确认进程完全关闭。"
mkdir -p "$BACKUP_DIR"
if [[ -f "$BACKUP" ]]; then
  [[ "$(sha256 "$BACKUP")" == "$original" ]] || fail "既有宿主回滚文件指纹异常。"
else
  cp -p "$TARGET" "$BACKUP"
  [[ "$(sha256 "$BACKUP")" == "$original" ]] || fail "宿主回滚文件校验失败。"
fi

temporary="$TARGET.eagle-extension-suite-installing.$$"
trap 'rm -f "$temporary"' EXIT
node "$ROOT/scripts/patch-host-bridge.mjs" "$TARGET" "$temporary" >/dev/null
[[ "$(sha256 "$temporary")" == "$generated" ]] || fail "本机生成的通信桥指纹不匹配。"
target_mode=$(stat -f '%Lp' "$TARGET" 2>/dev/null || print '644')
chmod "$target_mode" "$temporary"
mv "$temporary" "$TARGET"
[[ "$(sha256 "$TARGET")" == "$generated" ]] || fail "通信桥安装后校验失败；请立即执行宿主回滚。"
print "Eagle 宿主通信桥安装完成。"
print "宿主回滚文件：$BACKUP"
print "未读取或修改任何 Library、NAS 素材、团队 sidecar 或插件配置。"
