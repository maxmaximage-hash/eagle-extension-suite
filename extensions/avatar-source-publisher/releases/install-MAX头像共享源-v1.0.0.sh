#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
ARCHIVE="$SCRIPT_DIR/MAX头像共享源-v1.0.0.eagleplugin"
EAGLE_PLUGIN_ROOT="${HOME}/Library/Application Support/Eagle/Plugins"
BACKUP_ROOT="${HOME}/Library/Application Support/Eagle/Backups/eagle-avatar-source-publisher"
EXPECTED_ID="com.max.eagle-avatar-source-publisher"
EXPECTED_VERSION="1.0.0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --archive) ARCHIVE="$2"; shift 2 ;;
    --plugin-root) EAGLE_PLUGIN_ROOT="$2"; shift 2 ;;
    --backup-root) BACKUP_ROOT="$2"; shift 2 ;;
    *) print -u2 "Unknown option: $1"; exit 64 ;;
  esac
done

[[ -f "$ARCHIVE" ]] || { print -u2 "Archive is unavailable: $ARCHIVE"; exit 1; }
mkdir -p "$EAGLE_PLUGIN_ROOT"

matching_sources=()
while IFS= read -r manifest; do
  plugin_id=$(/usr/bin/plutil -extract id raw -o - "$manifest" 2>/dev/null || true)
  [[ "$plugin_id" == "$EXPECTED_ID" ]] && matching_sources+=("${manifest:h}")
done < <(find "$EAGLE_PLUGIN_ROOT" -mindepth 2 -maxdepth 2 -name manifest.json -type f -print)

TARGET="$EAGLE_PLUGIN_ROOT/$EXPECTED_ID"
if (( ${#matching_sources[@]} > 1 )); then
  print -u2 "Blocked: more than one installed source has ID $EXPECTED_ID"
  print -u2 "${(F)matching_sources}"
  exit 1
fi
if (( ${#matching_sources[@]} == 1 )) && [[ "${matching_sources[1]}" != "$TARGET" ]]; then
  print -u2 "Blocked: existing ID source is outside the canonical Plugins directory: ${matching_sources[1]}"
  exit 1
fi

STAGE=$(mktemp -d "$EAGLE_PLUGIN_ROOT/.avatar-source-stage.XXXXXX")
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT
unzip -q "$ARCHIVE" -d "$STAGE"

staged_id=$(/usr/bin/plutil -extract id raw -o - "$STAGE/manifest.json" 2>/dev/null || true)
staged_version=$(/usr/bin/plutil -extract version raw -o - "$STAGE/manifest.json" 2>/dev/null || true)
[[ "$staged_id" == "$EXPECTED_ID" ]] || { print -u2 "Blocked: unexpected plugin ID"; exit 1; }
[[ "$staged_version" == "$EXPECTED_VERSION" ]] || { print -u2 "Blocked: unexpected plugin version"; exit 1; }

BACKUP=""
if [[ -e "$TARGET" ]]; then
  timestamp=$(date +%Y%m%d-%H%M%S)
  BACKUP="$BACKUP_ROOT/$timestamp/$EXPECTED_ID"
  mkdir -p "${BACKUP:h}"
  mv "$TARGET" "$BACKUP"
fi

if ! mv "$STAGE" "$TARGET"; then
  [[ -n "$BACKUP" && -e "$BACKUP" ]] && mv "$BACKUP" "$TARGET"
  print -u2 "Install failed; restored the prior plugin source when present."
  exit 1
fi
trap - EXIT
print "Installed $EXPECTED_ID $EXPECTED_VERSION at $TARGET"
if pgrep -x Eagle >/dev/null 2>&1; then
  print "Eagle is running; the service starts after Eagle reloads this plugin or the next normal Eagle launch."
fi
