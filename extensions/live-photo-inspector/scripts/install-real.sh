#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TARGET="${HOME}/Library/Application Support/Eagle/Plugins/com.max.eagle-live-photo-inspector"
mkdir -p "$(dirname "$TARGET")"
rm -rf "$TARGET"
cp -R "$ROOT" "$TARGET"
echo "Installed: $TARGET"
