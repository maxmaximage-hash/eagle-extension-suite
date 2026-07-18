#!/bin/zsh
set -euo pipefail

project_root="${0:A:h:h}"
backup="$project_root/backups/Eagle-4.0.0-build23-app.asar"
target="/Applications/Eagle.app/Contents/Resources/app.asar"

if [[ ! -f "$backup" ]]; then
  print -u2 "找不到备份：$backup"
  exit 1
fi

osascript -e 'tell application "Eagle" to quit' || true
for _ in {1..40}; do
  pgrep -x Eagle >/dev/null || break
  sleep 0.5
done

cp -p "$backup" "$target"
rm -rf "$HOME/Library/Application Support/Eagle/Plugins/com.max.eagle-photo-taken-sort"
open -a Eagle

print "已恢复 Eagle 4.0 build 23 原始 app.asar，并移除照片拍摄时间排序插件。"
