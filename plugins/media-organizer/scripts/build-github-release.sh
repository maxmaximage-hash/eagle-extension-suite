#!/bin/zsh
set -euo pipefail

readonly SCRIPT_DIR="${0:A:h}"
readonly ROOT="${SCRIPT_DIR:h}"
readonly RELEASE_DIR="$ROOT/releases"
readonly ARCHIVE_NAME="媒体智能整理-v2.5.22-qa.27-github.eagleplugin"
readonly INSTALLER_NAME="install-媒体智能整理-v2.5.22-qa.27.sh"
readonly CHECKSUM_NAME="媒体智能整理-v2.5.22-qa.27-github.SHA256SUMS"
readonly ARCHIVE="$RELEASE_DIR/$ARCHIVE_NAME"
readonly INSTALLER="$RELEASE_DIR/$INSTALLER_NAME"
readonly CHECKSUM="$RELEASE_DIR/$CHECKSUM_NAME"
readonly RELEASE_TIMESTAMP="202607290000"

RUNTIME_FILES=(
  index.html
  logo.png
  manifest.json
  package.json
  package-lock.json
  plugin.js
  node_modules/exifr/LICENSE
  node_modules/exifr/package.json
  node_modules/exifr/dist/full.umd.js
)

fail() {
  print -u2 "发行包构建失败：$1"
  exit 1
}

copy_file() {
  local relative="$1"
  [[ -f "$ROOT/$relative" ]] || fail "缺少运行文件：$relative"
  mkdir -p "$(dirname "$STAGE/$relative")"
  cp -p "$ROOT/$relative" "$STAGE/$relative"
}

copy_tree() {
  local relative="$1"
  [[ -d "$ROOT/$relative" ]] || fail "缺少运行目录：$relative"
  mkdir -p "$STAGE/$relative"
  cp -R "$ROOT/$relative/." "$STAGE/$relative/"
}

STAGE=$(mktemp -d "${TMPDIR:-/tmp}/media-organizer-release.XXXXXX")
trap 'rm -rf "$STAGE"' EXIT

for relative in $RUNTIME_FILES; do
  copy_file "$relative"
done

for source in "$ROOT"/lib/*.js; do
  copy_file "lib/${source:t}"
done
copy_tree data

FORBIDDEN_RUNTIME_FILES=(
  geo-tag-state.json
  photo-taken-cache.json
  media-location-cache.json
  rename-batch-backup.json
)
for relative in $FORBIDDEN_RUNTIME_FILES; do
  [[ ! -e "$STAGE/$relative" ]] || fail "发行包不得包含运行状态：$relative"
done

find "$STAGE" -name '.DS_Store' -delete
find "$STAGE" -exec touch -t "$RELEASE_TIMESTAMP" {} +

mkdir -p "$RELEASE_DIR"
rm -f "$ARCHIVE" "$INSTALLER" "$CHECKSUM"
(
  cd "$STAGE"
  find . -type f -print | LC_ALL=C sort | zip -X -q "$ARCHIVE" -@
)
cp -p "$ROOT/scripts/install-github-release.sh" "$INSTALLER"
chmod 755 "$INSTALLER"
(
  cd "$RELEASE_DIR"
  shasum -a 256 "$ARCHIVE_NAME" "$INSTALLER_NAME" > "$CHECKSUM_NAME"
)

print "$ARCHIVE"
print "$INSTALLER"
print "$CHECKSUM"
