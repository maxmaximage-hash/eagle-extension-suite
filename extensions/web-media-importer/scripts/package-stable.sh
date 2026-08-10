#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
root_dir="$(cd "$project_dir/../.." && pwd)"
version="$(node -p "require('$project_dir/package.json').version")"
release_dir="$root_dir/releases/网页媒体保存至Eagle-Stable"
archive="$release_dir/eagle-web-media-importer-v${version}.zip"

mkdir -p "$release_dir"
stage_root="$(mktemp -d "$release_dir/.staging.XXXXXX")"
stage_dir="$stage_root/eagle-web-media-importer"
trap 'rm -rf "$stage_root"' EXIT
mkdir -p "$stage_dir"
for file in manifest.json core.js structured-media.js provider-adapters.js background.js content.js popup.html popup.css popup.js README.md; do
  cp "$project_dir/$file" "$stage_dir/$file"
done
mkdir -p "$stage_dir/icons"
for size in 16 32 48 128; do
  cp "$project_dir/icons/icon-${size}.png" "$stage_dir/icons/icon-${size}.png"
done
/usr/bin/find "$stage_dir" -exec /usr/bin/touch -t 202608090000 {} +

(
  cd "$stage_root"
  /usr/bin/zip -q -X -r "$archive" "eagle-web-media-importer"
)

/usr/bin/shasum -a 256 "$archive"
echo "$archive"
