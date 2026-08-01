#!/bin/zsh
set -euo pipefail

readonly PLUGIN_ROOT="$HOME/Library/Application Support/Eagle/Plugins"
readonly BACKUP_PARENT="$HOME/Library/Application Support/Eagle/Backups/eagle-extension-suite"

fail() { print -u2 "回滚失败：$1"; exit 1; }

[[ "${1:-}" == "--backup" && -n "${2:-}" ]] || fail "用法：$0 --backup '<绝对回滚目录>'"
backup_dir="${2:A}"
case "$backup_dir" in
  "$BACKUP_PARENT"/*) ;;
  *) fail "回滚目录不在受控备份根：$BACKUP_PARENT" ;;
esac
[[ -d "$backup_dir" ]] || fail "回滚目录不存在：$backup_dir"
pgrep -x Eagle >/dev/null && fail "请先正常退出 Eagle。"

for plugin_id in com.max.eagle-photo-taken-sort com.max.eagle-online-showcase; do
  source_dir="$backup_dir/$plugin_id"
  [[ -d "$source_dir" ]] || { print "跳过 $plugin_id：备份中不存在"; continue; }
  target="$PLUGIN_ROOT/$plugin_id"
  failed_dir="$backup_dir/failed-current-$plugin_id"
  [[ -d "$target" ]] && mv "$target" "$failed_dir"
  mv "$source_dir" "$target"
  print "已恢复 $plugin_id"
done

print "回滚完成；未修改 Eagle 宿主、Library、NAS 素材、团队 sidecar 或配置。"
