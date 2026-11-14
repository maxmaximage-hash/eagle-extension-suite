#!/bin/zsh
set -euo pipefail

readonly RELEASE_TAG="v2026.11.14-eagle-complete-2"
readonly BUNDLE_URL="https://github.com/maxmaximage-hash/eagle-extension-suite/releases/download/${RELEASE_TAG}/eagle-complete-runtime-2026-11-14.tar.gz"
readonly EXPECTED_BUNDLE_SHA256=""
readonly WORK_ROOT="${TMPDIR:-/tmp}/eagle-complete-handoff-install.$$"
readonly DOWNLOAD="$WORK_ROOT/eagle-complete-runtime.tar.gz"
readonly EXTRACT="$WORK_ROOT/extract"
readonly APP_PATH="/Applications/Eagle.app"

fail() { print -u2 "安装失败：$1"; exit 1; }
cleanup() { rm -rf "$WORK_ROOT"; }
trap cleanup EXIT

[[ "$(uname -s)" == "Darwin" ]] || fail "此交接包只支持 macOS。"
command -v curl >/dev/null || fail "找不到 curl。"
command -v ditto >/dev/null || fail "找不到 ditto。"

mkdir -p "$WORK_ROOT" "$EXTRACT"
print "正在下载 Eagle 完整交接包……"
curl -fL --retry 3 --retry-delay 2 "$BUNDLE_URL" -o "$DOWNLOAD"
if [[ -n "$EXPECTED_BUNDLE_SHA256" ]]; then
  [[ "$(shasum -a 256 "$DOWNLOAD" | awk '{print $1}')" == "$EXPECTED_BUNDLE_SHA256" ]] || fail "交接包校验失败。"
fi

print "正在退出 Eagle……"
osascript -e 'tell application "Eagle" to quit' >/dev/null 2>&1 || true
for _ in {1..60}; do
  if ps -axo args= | rg -q '/Applications/Eagle.app/Contents/(MacOS/Eagle|Frameworks/Eagle Helper)'; then
    sleep 1
  else
    break
  fi
done
ps -axo args= | rg -q '/Applications/Eagle.app/Contents/(MacOS/Eagle|Frameworks/Eagle Helper)' && fail "Eagle 或 Eagle Helper 仍在运行。"

ditto -x -k --sequesterRsrc "$DOWNLOAD" "$EXTRACT"
[[ -d "$EXTRACT/Eagle.app" ]] || fail "交接包缺少 Eagle.app。"
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$EXTRACT/Eagle.app/Contents/Info.plist")" == "4.0.0" ]] || fail "交接包不是 Eagle 4.0.0。"
[[ "$(shasum -a 256 "$EXTRACT/Eagle.app/Contents/Resources/app.asar" | awk '{print $1}')" == "4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3" ]] || fail "交接包 app.asar 不是已验证桥接版本。"

readonly BACKUP="/Applications/Eagle.app.before-complete-handoff-$(date +%Y%m%d-%H%M%S)"
if [[ -d "$APP_PATH" ]]; then
  print "正在保留现有 Eagle.app：$BACKUP"
  sudo mv "$APP_PATH" "$BACKUP"
fi
print "正在安装完整 Eagle.app……"
sudo ditto --sequesterRsrc "$EXTRACT/Eagle.app" "$APP_PATH"
[[ "$(shasum -a 256 "$APP_PATH/Contents/Resources/app.asar" | awk '{print $1}')" == "4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3" ]] || fail "安装后 app.asar 校验失败。"

BRIDGE="$EXTRACT/bridge/install-compatible-bridge.sh"
PLUGIN="$EXTRACT/media-organizer/install-媒体智能整理-v2.5.22-qa.94.sh"
[[ -x "$BRIDGE" ]] || fail "缺少桥接安装脚本。"
[[ -x "$PLUGIN" ]] || fail "缺少媒体整理安装脚本。"
"$BRIDGE" --check
"$PLUGIN" --check
"$PLUGIN" --install-plugin

print "完整 Eagle 交接安装完成。"
print "原生排序面板环境已按桥接 app.asar 安装。"
print "如果 macOS 报告签名警告，请保留警告原文，不要执行 ad-hoc 重签。"
