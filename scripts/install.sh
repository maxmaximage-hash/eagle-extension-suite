#!/bin/zsh
set -euo pipefail

readonly ROOT="${0:A:h:h}"
readonly MANIFEST="$ROOT/release-manifest.json"
readonly EAGLE_APP="${EAGLE_APP_PATH:-/Applications/Eagle.app}"
readonly PLUGIN_ROOT="$HOME/Library/Application Support/Eagle/Plugins"
readonly BACKUP_PARENT="$HOME/Library/Application Support/Eagle/Backups/eagle-extension-suite"

fail() { print -u2 "安装失败：$1"; exit 1; }
sha256() { shasum -a 256 "$1" | awk '{print $1}'; }

[[ "${1:-}" == "--install" ]] || fail "必须显式运行：$0 --install"
"$ROOT/scripts/check.sh"
pgrep -x Eagle >/dev/null && fail "请先正常退出 Eagle，确认进程完全关闭后重试。"

asar="$EAGLE_APP/Contents/Resources/app.asar"
[[ -f "$asar" ]] || fail "找不到 Eagle app.asar，无法确认宿主兼容性。"
current_asar=$(sha256 "$asar")
accepted=$(jq -r '.hostCompatibility.acceptedAppAsarSha256[]' "$MANIFEST")
print -r -- "$accepted" | grep -Fxq "$current_asar" || fail "宿主通信能力不受支持；本安装器不会修改 Eagle app.asar。"

timestamp=$(date +%Y%m%d-%H%M%S)
backup_dir="$BACKUP_PARENT/$timestamp"
stage_dir=$(mktemp -d "$TMPDIR/eagle-extension-suite.XXXXXX")
typeset -A staged_for target_for backup_for version_for touched_for
keys=(mediaOrganizer maxPublisher)
committed=0
mutation_started=0

rollback_on_exit() {
  if (( mutation_started == 1 && committed == 0 )); then
    for key in $keys; do
      [[ "${touched_for[$key]:-0}" == "1" ]] || continue
      target="${target_for[$key]:-}"
      backup="${backup_for[$key]:-}"
      [[ -n "$target" ]] || continue
      if [[ -d "$target" ]]; then
        mkdir -p "$backup_dir"
        mv "$target" "$backup_dir/failed-new-${target:t}" 2>/dev/null || true
      fi
      if [[ -n "$backup" && -d "$backup" ]]; then
        mv "$backup" "$target" 2>/dev/null || true
      fi
    done
  fi
  rm -rf "$stage_dir"
}
trap rollback_on_exit EXIT
mkdir -p "$PLUGIN_ROOT"

for key in $keys; do
  archive=$(jq -r ".artifacts.$key.file" "$MANIFEST")
  plugin_id=$(jq -r ".artifacts.$key.pluginId" "$MANIFEST")
  plugin_version=$(jq -r ".artifacts.$key.version" "$MANIFEST")
  target="$PLUGIN_ROOT/$plugin_id"
  staged="$stage_dir/$plugin_id"
  for existing_manifest in "$PLUGIN_ROOT"/*/manifest.json(N); do
    existing_id=$(jq -r '.id // empty' "$existing_manifest" 2>/dev/null || true)
    existing_dir="${existing_manifest:h}"
    if [[ "$existing_id" == "$plugin_id" && "$existing_dir" != "$target" ]]; then
      fail "发现同 ID 插件位于非规范目录：$existing_dir。为防止双来源，安装已停止。"
    fi
  done
  mkdir -p "$staged"
  ditto -x -k "$ROOT/$archive" "$staged"
  [[ -f "$staged/manifest.json" ]] || fail "$archive 内缺少 manifest.json。"
  [[ "$(jq -r '.id' "$staged/manifest.json")" == "$plugin_id" ]] || fail "$archive 插件 ID 错误。"
  [[ "$(jq -r '.version' "$staged/manifest.json")" == "$plugin_version" ]] || fail "$archive 版本错误。"
  staged_for[$key]="$staged"
  target_for[$key]="$target"
  backup_for[$key]="$backup_dir/$plugin_id"
  version_for[$key]="$plugin_version"
done

# 两个安装包都已在临时目录完成校验后，才开始触碰现有插件。
mkdir -p "$backup_dir"
mutation_started=1
for key in $keys; do
  target="${target_for[$key]}"
  backup="${backup_for[$key]}"
  if [[ -d "$target" ]]; then
    mv "$target" "$backup"
    touched_for[$key]=1
  fi
done

for key in $keys; do
  staged="${staged_for[$key]}"
  target="${target_for[$key]}"
  plugin_id="${target:t}"
  plugin_version="${version_for[$key]}"
  touched_for[$key]=1
  mv "$staged" "$target"
  [[ "$(jq -r '.id' "$target/manifest.json")" == "$plugin_id" ]] || fail "$plugin_id 安装后 ID 复核失败。"
  [[ "$(jq -r '.version' "$target/manifest.json")" == "$plugin_version" ]] || fail "$plugin_id 安装后版本复核失败。"
  print "已安装 $plugin_id $plugin_version"
done

committed=1

print "安装完成。回滚目录：$backup_dir"
print "本脚本没有启动 Eagle，也没有读取或修改任何 .library、NAS 素材或配置。"
