#!/bin/sh
set -eu

APP_NAME="用 Photoshop 打开 Live Photo 封面.app"
LEGACY_APP_NAME="MAX Live Photo 静态封面.app"
TARGET="${HOME}/Applications/${APP_NAME}"
LEGACY_TARGET="${HOME}/Applications/${LEGACY_APP_NAME}"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

if [ -x "$LSREGISTER" ]; then
  "$LSREGISTER" -u "$TARGET" >/dev/null 2>&1 || true
  "$LSREGISTER" -u "$LEGACY_TARGET" >/dev/null 2>&1 || true
fi
if [ -e "$TARGET" ]; then
  rm -rf "$TARGET"
fi
if [ -e "$LEGACY_TARGET" ]; then
  rm -rf "$LEGACY_TARGET"
fi
echo "Removed: $TARGET"
