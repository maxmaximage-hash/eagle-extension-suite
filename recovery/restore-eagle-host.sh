#!/bin/zsh
set -euo pipefail

readonly ROOT="${0:A:h:h}"
readonly BRIDGE_RESTORE="$ROOT/extensions/media-organizer/bridge/restore-compatible-bridge.sh"
readonly APP_PATH="${EAGLE_APP_PATH:-/Applications/Eagle.app}"
readonly TARGET="$APP_PATH/Contents/Resources/app.asar"
readonly BACKUP="$HOME/Library/Application Support/Eagle/Backups/media-organizer-safe-bridge/Eagle-4.0.0-build23-original-app.asar"
readonly EVIDENCE="$HOME/Library/Application Support/Eagle/Backups/media-organizer-safe-bridge/bridge-evidence.json"

fail() {
  print -u2 "恢复未完成：$1"
  exit 1
}

print "Eagle 主程序恢复任务"
print "目标：$TARGET"
print "Library、NAS 素材和插件源码不会被删除或修改。"

[[ -d "$APP_PATH" ]] || fail "找不到 Eagle.app：$APP_PATH"
[[ -f "$TARGET" ]] || fail "找不到 Eagle app.asar：$TARGET"

if pgrep -x Eagle >/dev/null 2>&1; then
  fail "Eagle 仍在运行；请先完全退出 Eagle，再重新执行本脚本。"
fi

if [[ ! -f "$BACKUP" ]]; then
  print -u2 "找不到原始 app.asar 备份：$BACKUP"
  if [[ -f "$EVIDENCE" ]]; then
    print -u2 "检测到 bridge-evidence.json，但没有原始备份；不会覆盖未知文件。"
  fi
  print -u2 "请重新安装官方 Eagle 4.0.0，安装完成后先确认 Eagle 原生启动。"
  exit 2
fi

zsh "$BRIDGE_RESTORE" --restore
print "Eagle 主程序恢复完成。现在请先直接打开 Eagle 验证原生界面。"
