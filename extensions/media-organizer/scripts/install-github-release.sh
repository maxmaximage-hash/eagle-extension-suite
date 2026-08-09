#!/bin/zsh
set -euo pipefail

readonly EXPECTED_HOST_VERSION="4.0.0"
readonly EXPECTED_PLUGIN_ID="com.max.eagle-photo-taken-sort"
readonly EXPECTED_PLUGIN_VERSION="2.5.22-qa.71"
readonly ORIGINAL_SHA256="b04a2efdb8bc8d06910552f43f38c056e6964c8f74798e1b2849f1bffab8a1bd"
readonly BRIDGED_SHA256="4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3"
readonly SCRIPT_DIR="${0:A:h}"
readonly ARCHIVE_NAME="媒体智能整理-v2.5.22-qa.71-github.eagleplugin"
readonly CHECKSUM_NAME="媒体智能整理-v2.5.22-qa.71-github.SHA256SUMS"
readonly APP_PATH="${EAGLE_APP_PATH:-/Applications/Eagle.app}"
readonly HOST_ASAR="$APP_PATH/Contents/Resources/app.asar"
readonly ARCHIVE="${PLUGIN_ARCHIVE:-$SCRIPT_DIR/$ARCHIVE_NAME}"
readonly CHECKSUM_FILE="${PLUGIN_CHECKSUM_FILE:-$SCRIPT_DIR/$CHECKSUM_NAME}"
readonly PLUGIN_ROOT="${EAGLE_PLUGIN_ROOT:-$HOME/Library/Application Support/Eagle/Plugins}"
readonly TARGET="$PLUGIN_ROOT/$EXPECTED_PLUGIN_ID"
readonly BACKUP_ROOT="$HOME/Library/Application Support/Eagle/Backups/media-organizer-plugin"
readonly STATE_ROOT="$HOME/Library/Application Support/Eagle/PluginData/$EXPECTED_PLUGIN_ID"

MODE="check"

fail() {
  print -u2 "拒绝执行：$1"
  exit 1
}

sha256() {
  shasum -a 256 "$1" | awk '{print $1}'
}

case "${1:-}" in
  ""|--check) MODE="check" ;;
  --install-plugin) MODE="install" ;;
  *) fail "参数仅支持 --check 或 --install-plugin" ;;
esac

[[ -d "$APP_PATH" ]] || fail "找不到 Eagle：$APP_PATH"
[[ -f "$HOST_ASAR" ]] || fail "找不到 Eagle 宿主文件"

host_version=$(
  /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' \
    "$APP_PATH/Contents/Info.plist" 2>/dev/null || true
)
[[ "$host_version" == "$EXPECTED_HOST_VERSION" ]] || \
  fail "Eagle 版本是 ${host_version:-未知}，只接受已审计的 4.0.0 宿主"

host_hash=$(sha256 "$HOST_ASAR")
if [[ "$host_hash" != "$BRIDGED_SHA256" ]]; then
  if [[ "$host_hash" == "$ORIGINAL_SHA256" ]]; then
    fail "通信桥不存在或未经审计；本安装器不会修改 Eagle host"
  fi
  fail "通信桥不存在或未经审计（宿主哈希未知）；本安装器不会修改 Eagle host"
fi

[[ -f "$ARCHIVE" ]] || fail "找不到插件包：$ARCHIVE"
[[ -f "$CHECKSUM_FILE" ]] || fail "找不到校验和文件：$CHECKSUM_FILE"
expected_archive_hash=$(awk -v name="$ARCHIVE_NAME" '$2 == name { print $1 }' "$CHECKSUM_FILE")
[[ -n "$expected_archive_hash" ]] || fail "校验和文件缺少插件包记录"
[[ "$(sha256 "$ARCHIVE")" == "$expected_archive_hash" ]] || fail "插件包 SHA-256 校验失败"
archive_entries=$(unzip -Z1 "$ARCHIVE")
[[ -n "$archive_entries" ]] || fail "插件包为空"
print -r -- "$archive_entries" | grep -Eq '(^/|(^|/)\.\.(/|$))' && \
  fail "插件包包含不安全路径"
print -r -- "$archive_entries" | grep -Eqi \
  '(^|/)(backups?|recovery|qa-library|team-state-backups)(/|$)|(^|/)(geo-tag-state|photo-taken-cache|rename-batch-backup|diagnostic)\.(json|log)$|(^|/)defaults/sort-state/' && \
  fail "插件包包含运行状态、备份或测试资料"
print -r -- "$archive_entries" | grep -Eqi 'app\.asar|bridge/payload' && \
  fail "插件包不得包含 Eagle host 或桥接载荷"

manifest_file=$(mktemp "${TMPDIR:-/tmp}/media-organizer-manifest.XXXXXX")
trap 'rm -f "$manifest_file"' EXIT
unzip -p "$ARCHIVE" manifest.json > "$manifest_file"
plugin_id=$(/usr/bin/plutil -extract id raw -o - "$manifest_file" 2>/dev/null || true)
plugin_version=$(/usr/bin/plutil -extract version raw -o - "$manifest_file" 2>/dev/null || true)
[[ "$plugin_id" == "$EXPECTED_PLUGIN_ID" ]] || fail "插件 ID 不匹配"
[[ "$plugin_version" == "$EXPECTED_PLUGIN_VERSION" ]] || fail "插件版本不匹配"

matching_sources=()
if [[ -d "$PLUGIN_ROOT" ]]; then
  while IFS= read -r candidate_manifest; do
    candidate_id=$(/usr/bin/plutil -extract id raw -o - "$candidate_manifest" 2>/dev/null || true)
    if [[ "$candidate_id" == "$EXPECTED_PLUGIN_ID" ]]; then
      matching_sources+=("${candidate_manifest:h}")
    fi
  done < <(find "$PLUGIN_ROOT" -mindepth 2 -maxdepth 2 -name manifest.json -type f -print)
fi
if (( ${#matching_sources} > 1 )); then
  fail "发现多个同 ID 插件来源；请先人工核对，安装器不会自动删除"
fi
if (( ${#matching_sources} == 1 )) && [[ "${matching_sources[1]}" != "$TARGET" ]]; then
  fail "同 ID 插件位于非规范目录；请先人工核对，安装器不会创建第二来源"
fi

print "兼容性检查通过：Eagle $host_version，已存在审计桥，插件 $plugin_version。"
if [[ "$MODE" == "check" ]]; then
  print "本次只检查；安装插件需在 Eagle 完全退出后显式运行：$0 --install-plugin"
  exit 0
fi

pgrep -x Eagle >/dev/null && fail "Eagle 仍在运行；不会替换插件"

mkdir -p "$PLUGIN_ROOT" "$BACKUP_ROOT" "$STATE_ROOT"
for state_name in \
  photo-taken-cache.json \
  diagnostic.log \
  rename-batch-backup.json \
  rename-batch-cancel.json \
  rename-recovery-request.json; do
  legacy_state="$TARGET/$state_name"
  durable_state="$STATE_ROOT/$state_name"
  if [[ -f "$legacy_state" && ! -e "$durable_state" ]]; then
    temporary_state="$durable_state.install-migrate.$$.tmp"
    cp -p "$legacy_state" "$temporary_state"
    if ! ln "$temporary_state" "$durable_state" 2>/dev/null; then
      [[ -e "$durable_state" ]] || fail "运行状态迁移失败：$state_name"
    fi
    rm -f "$temporary_state"
  fi
done
legacy_team_backup_root="$TARGET/team-state-backups"
durable_team_backup_root="$STATE_ROOT/team-state-backups"
if [[ -d "$legacy_team_backup_root" ]]; then
  while IFS= read -r -d '' legacy_team_backup; do
    relative_team_backup="${legacy_team_backup#$legacy_team_backup_root/}"
    durable_team_backup="$durable_team_backup_root/$relative_team_backup"
    [[ -e "$durable_team_backup" ]] && continue
    mkdir -p "${durable_team_backup:h}"
    temporary_team_backup="$durable_team_backup.install-migrate.$$.tmp"
    cp -p "$legacy_team_backup" "$temporary_team_backup"
    if ! ln "$temporary_team_backup" "$durable_team_backup" 2>/dev/null; then
      [[ -e "$durable_team_backup" ]] || fail "团队排序备份迁移失败：$relative_team_backup"
    fi
    rm -f "$temporary_team_backup"
  done < <(find "$legacy_team_backup_root" -type f -print0)
fi
stage=$(mktemp -d "$PLUGIN_ROOT/.media-organizer-stage.XXXXXX")
backup=""
cleanup() {
  [[ -n "${stage:-}" && -d "$stage" ]] && rm -rf "$stage"
}
trap cleanup EXIT
unzip -q "$ARCHIVE" -d "$stage"

staged_id=$(/usr/bin/plutil -extract id raw -o - "$stage/manifest.json" 2>/dev/null || true)
staged_version=$(/usr/bin/plutil -extract version raw -o - "$stage/manifest.json" 2>/dev/null || true)
[[ "$staged_id" == "$EXPECTED_PLUGIN_ID" ]] || fail "解包后插件 ID 校验失败"
[[ "$staged_version" == "$EXPECTED_PLUGIN_VERSION" ]] || fail "解包后版本校验失败"

if [[ -e "$TARGET" ]]; then
  backup="$BACKUP_ROOT/$EXPECTED_PLUGIN_ID-$(date +%Y%m%d-%H%M%S)"
  mv "$TARGET" "$backup"
fi

if ! mv "$stage" "$TARGET"; then
  [[ -n "$backup" && -e "$backup" && ! -e "$TARGET" ]] && mv "$backup" "$TARGET"
  fail "插件替换失败；已尝试恢复原安装"
fi
stage=""

installed_id=$(/usr/bin/plutil -extract id raw -o - "$TARGET/manifest.json" 2>/dev/null || true)
installed_version=$(/usr/bin/plutil -extract version raw -o - "$TARGET/manifest.json" 2>/dev/null || true)
if [[ "$installed_id" != "$EXPECTED_PLUGIN_ID" || "$installed_version" != "$EXPECTED_PLUGIN_VERSION" ]]; then
  rm -rf "$TARGET"
  [[ -n "$backup" && -e "$backup" ]] && mv "$backup" "$TARGET"
  fail "安装后身份校验失败；已恢复原安装"
fi

print "插件已安装：$TARGET"
[[ -n "$backup" ]] && print "旧插件回滚点：$backup"
print "Eagle host 未被修改。"
