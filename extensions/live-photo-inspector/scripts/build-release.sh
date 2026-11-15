#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/manifest.json').version")"
OUT="$ROOT/releases"
mkdir -p "$OUT"
STAGE="$(mktemp -d /tmp/max-live-photo-inspector.XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT
cp -R "$ROOT/manifest.json" "$ROOT/index.html" "$ROOT/renderer.js" "$ROOT/photo-metadata.js" "$ROOT/logo.png" "$STAGE/"
(cd "$STAGE" && zip -X -q -r "$OUT/MAX Live Photo 静态照片信息-v$VERSION.eagleplugin" .)
echo "$OUT/MAX Live Photo 静态照片信息-v$VERSION.eagleplugin"
