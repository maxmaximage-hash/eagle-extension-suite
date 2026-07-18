#!/bin/zsh
set -euo pipefail

readonly ORIGINAL_SHA256="b04a2efdb8bc8d06910552f43f38c056e6964c8f74798e1b2849f1bffab8a1bd"
readonly BRIDGED_SHA256="4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3"
readonly APP_PATH="${EAGLE_APP_PATH:-/Applications/Eagle.app}"
readonly TARGET="$APP_PATH/Contents/Resources/app.asar"
readonly BACKUP="$HOME/Library/Application Support/Eagle/Backups/media-organizer-safe-bridge/Eagle-4.0.0-build23-original-app.asar"

sha256() { shasum -a 256 "$1" | awk '{print $1}'; }
fail() { print -u2 "拒绝执行：$1"; exit 1; }

[[ "${1:-}" == "--restore" ]] || fail "回退必须显式运行：$0 --restore"
[[ -f "$TARGET" ]] || fail "找不到当前 app.asar。"
[[ -f "$BACKUP" ]] || fail "找不到安装时生成的原始备份：$BACKUP"
[[ "$(sha256 "$TARGET")" == "$BRIDGED_SHA256" ]] || fail "当前 app.asar 不是本桥接的已知版本，不会覆盖。"
[[ "$(sha256 "$BACKUP")" == "$ORIGINAL_SHA256" ]] || fail "原始备份哈希不匹配。"
pgrep -x Eagle >/dev/null && fail "请先完全退出 Eagle。"

temporary="$TARGET.media-organizer-restoring.$$"
trap 'rm -f "$temporary"' EXIT
cp -p "$BACKUP" "$temporary"
[[ "$(sha256 "$temporary")" == "$ORIGINAL_SHA256" ]] || fail "临时回退文件校验失败。"
mv "$temporary" "$TARGET"
[[ "$(sha256 "$TARGET")" == "$ORIGINAL_SHA256" ]] || fail "回退后校验失败。"
print "已安全恢复 Eagle 4.0 build 23 原始 app.asar。插件文件和用户资料未改动。"
