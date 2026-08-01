#!/bin/zsh
set -euo pipefail

readonly ROOT="${0:A:h:h}"
readonly MANIFEST="$ROOT/release-manifest.json"
readonly EAGLE_APP="${EAGLE_APP_PATH:-/Applications/Eagle.app}"
readonly TARGET="$EAGLE_APP/Contents/Resources/app.asar"
readonly BACKUP="$HOME/Library/Application Support/Eagle/Backups/eagle-extension-suite/host/Eagle-4.0.0-build23-original-app.asar"

fail() { print -u2 "宿主桥回滚失败：$1"; exit 1; }
sha256() { shasum -a 256 "$1" | awk '{print $1}'; }

[[ "${1:-}" == "--restore" ]] || fail "必须显式运行：$0 --restore"
[[ -f "$TARGET" ]] || fail "找不到当前 Eagle app.asar。"
[[ -f "$BACKUP" ]] || fail "找不到宿主回滚文件：$BACKUP"
command -v jq >/dev/null || fail "需要 jq。"
pgrep -x Eagle >/dev/null && fail "请先正常退出 Eagle，并确认进程完全关闭。"

original=$(jq -r '.hostCompatibility.originalAppAsarSha256' "$MANIFEST")
current=$(sha256 "$TARGET")
accepted=$(jq -r '.hostCompatibility.acceptedAppAsarSha256[]' "$MANIFEST")
print -r -- "$accepted" | grep -Fxq "$current" || \
  fail "当前 app.asar 不是本发行支持的桥接版本，不会覆盖。"
[[ "$(sha256 "$BACKUP")" == "$original" ]] || fail "宿主回滚文件指纹不匹配。"

temporary="$TARGET.eagle-extension-suite-restoring.$$"
trap 'rm -f "$temporary"' EXIT
cp -p "$BACKUP" "$temporary"
[[ "$(sha256 "$temporary")" == "$original" ]] || fail "临时回滚文件校验失败。"
mv "$temporary" "$TARGET"
[[ "$(sha256 "$TARGET")" == "$original" ]] || fail "宿主回滚后校验失败。"
print "Eagle 宿主已恢复为官方原版指纹。插件、Library、NAS 素材和团队 sidecar 未改动。"
