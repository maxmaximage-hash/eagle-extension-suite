#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
root_dir="$(cd "$project_dir/../.." && pwd)"
version="$(node -p "require('$project_dir/package.json').version")"
release_dir="$root_dir/releases/网页媒体保存至Eagle-Stable"
stage_dir="$release_dir/eagle-web-media-importer"
archive="$release_dir/eagle-web-media-importer-v${version}.zip"

mkdir -p "$release_dir"
find "$release_dir" -mindepth 1 -delete
mkdir -p "$stage_dir"
for file in manifest.json core.js background.js content.js popup.html popup.js README.md; do
  cp "$project_dir/$file" "$stage_dir/$file"
done
/usr/bin/find "$stage_dir" -exec /usr/bin/touch -t 202608090000 {} +

(
  cd "$release_dir"
  /usr/bin/zip -q -X -r "$archive" "eagle-web-media-importer"
)

/usr/bin/shasum -a 256 "$archive"
echo "$stage_dir"
