#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
root_dir="$(cd "$project_dir/../.." && pwd)"
version="$(node -p "require('$project_dir/package.json').version")"
release_dir="$root_dir/releases/小红书整帖导入-Stable"
stage_dir="$release_dir/小红书整帖保存至Eagle"

mkdir -p "$stage_dir"
find "$release_dir" -maxdepth 1 -type f -delete
find "$stage_dir" -mindepth 1 -delete
for file in manifest.json core.js page-bridge.js content.js background.js README.md; do
  cp "$project_dir/$file" "$stage_dir/$file"
done
cp "$project_dir/HANDOFF.md" "$release_dir/另一台电脑安装说明.md"
echo "$stage_dir"
