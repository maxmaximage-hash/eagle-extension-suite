#!/bin/zsh
set -euo pipefail

readonly EXPECTED_VERSION="4.0.0"
readonly ORIGINAL_SHA256="b04a2efdb8bc8d06910552f43f38c056e6964c8f74798e1b2849f1bffab8a1bd"
readonly BRIDGED_SHA256="4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3"
readonly SCRIPT_DIR="${0:A:h}"
readonly APP_PATH="${EAGLE_APP_PATH:-/Applications/Eagle.app}"
readonly TARGET="$APP_PATH/Contents/Resources/app.asar"
readonly PAYLOAD="$SCRIPT_DIR/payload/Eagle-4.0.0-build23-bridged-app.asar"
readonly BACKUP_DIR="$HOME/Library/Application Support/Eagle/Backups/media-organizer-safe-bridge"
readonly BACKUP="$BACKUP_DIR/Eagle-4.0.0-build23-original-app.asar"

sha256() { shasum -a 256 "$1" | awk '{print $1}'; }
fail() { print -u2 "拒绝执行：$1"; exit 1; }

[[ -d "$APP_PATH" ]] || fail "找不到 Eagle：$APP_PATH"
[[ -f "$TARGET" ]] || fail "找不到 app.asar：$TARGET"

version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_PATH/Contents/Info.plist" 2>/dev/null || true)
[[ "$version" == "$EXPECTED_VERSION" ]] || fail "宿主版本是 ${version:-未知}，仅支持 Eagle 4.0.0 build 23。"

current_hash=$(sha256 "$TARGET")
case "$current_hash" in
  "$ORIGINAL_SHA256") state="original" ;;
  "$BRIDGED_SHA256") state="bridged" ;;
  *) fail "app.asar 哈希未知（$current_hash），不会硬覆盖。" ;;
esac

if [[ "${1:-}" == "--check" || -z "${1:-}" ]]; then
  print "兼容性检查通过：Eagle $version，app.asar 状态为 $state。"
  [[ -z "${1:-}" ]] && print "本次只检查，安装需显式运行：$0 --install"
  exit 0
fi

[[ "${1:-}" == "--install" ]] || fail "参数仅支持 --check 或 --install。"
[[ "$state" == "original" ]] || { print "通信桥已安装，无需重复操作。"; exit 0; }
[[ -f "$PAYLOAD" ]] || fail "交接包缺少桥接载荷：$PAYLOAD"
[[ "$(sha256 "$PAYLOAD")" == "$BRIDGED_SHA256" ]] || fail "桥接载荷哈希不匹配。"
pgrep -x Eagle >/dev/null && fail "请先完全退出 Eagle。"

mkdir -p "$BACKUP_DIR"
if [[ -f "$BACKUP" ]]; then
  [[ "$(sha256 "$BACKUP")" == "$ORIGINAL_SHA256" ]] || fail "现有回退备份哈希异常：$BACKUP"
else
  cp -p "$TARGET" "$BACKUP"
  [[ "$(sha256 "$BACKUP")" == "$ORIGINAL_SHA256" ]] || fail "新建回退备份校验失败。"
fi

temporary="$TARGET.media-organizer-installing.$$"
trap 'rm -f "$temporary"' EXIT
cp -p "$PAYLOAD" "$temporary"
[[ "$(sha256 "$temporary")" == "$BRIDGED_SHA256" ]] || fail "临时文件校验失败。"
mv "$temporary" "$TARGET"
[[ "$(sha256 "$TARGET")" == "$BRIDGED_SHA256" ]] || fail "安装后校验失败，请立即运行回退脚本。"
print "通信桥安装完成。原始文件已保存到：$BACKUP"
