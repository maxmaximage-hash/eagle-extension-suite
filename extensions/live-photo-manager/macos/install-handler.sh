#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_NAME="用 Photoshop 打开 Live Photo 封面.app"
LEGACY_APP_NAME="MAX Live Photo 静态封面.app"
TARGET="${HOME}/Applications/${APP_NAME}"
LEGACY_TARGET="${HOME}/Applications/${LEGACY_APP_NAME}"
BACKUP_DIR="${HOME}/Library/Application Support/Eagle/Backups/live-photo-handler"
EXECUTABLE="live-photo-photoshop"

mkdir -p "${HOME}/Applications" "$BACKUP_DIR"
if [ -e "$TARGET" ]; then
  mv "$TARGET" "$BACKUP_DIR/${APP_NAME}.$(date +%Y%m%d-%H%M%S)"
fi
if [ -e "$LEGACY_TARGET" ]; then
  mv "$LEGACY_TARGET" "$BACKUP_DIR/${LEGACY_APP_NAME}.$(date +%Y%m%d-%H%M%S)"
fi

cp -R "$ROOT/$APP_NAME" "$TARGET"
if command -v swiftc >/dev/null 2>&1 && [ -f "$TARGET/Contents/Resources/main.swift" ]; then
  rm -f "$TARGET/Contents/MacOS/$EXECUTABLE"
  swiftc "$TARGET/Contents/Resources/main.swift" -o "$TARGET/Contents/MacOS/$EXECUTABLE" -framework AppKit
else
  chmod +x "$TARGET/Contents/MacOS/$EXECUTABLE"
fi

LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
if [ -x "$LSREGISTER" ]; then
  "$LSREGISTER" -u "$TARGET" >/dev/null 2>&1 || true
  "$LSREGISTER" -u "$LEGACY_TARGET" >/dev/null 2>&1 || true
  "$LSREGISTER" -u "$ROOT/$APP_NAME" >/dev/null 2>&1 || true
  "$LSREGISTER" -u "$ROOT/$LEGACY_APP_NAME" >/dev/null 2>&1 || true
  if [ -d "$BACKUP_DIR" ]; then
    find "$BACKUP_DIR" -type d -name '*.app' -prune -print0 | while IFS= read -r -d '' OLD_APP; do
      "$LSREGISTER" -u "$OLD_APP" >/dev/null 2>&1 || true
    done
  fi
  "$LSREGISTER" -f "$TARGET" >/dev/null 2>&1
fi

"$TARGET/Contents/MacOS/$EXECUTABLE" --version >/dev/null 2>&1 || true

# Eagle's Open With menu resolves the icon through its app-icon-temp cache.
# Seed the two expected sizes so the newly installed helper is rendered with
# its Photoshop icon immediately, including before Eagle rebuilds its cache.
ICON_CACHE="${HOME}/Library/Application Support/Eagle/app-icon-temp"
if command -v sips >/dev/null 2>&1 && [ -f "$TARGET/Contents/Resources/Photoshop.icns" ]; then
  mkdir -p "$ICON_CACHE"
  ICON_2X="$ICON_CACHE/${APP_NAME%.app}@2x.png"
  ICON_1X="$ICON_CACHE/${APP_NAME%.app}.png"
  sips -s format png "$TARGET/Contents/Resources/Photoshop.icns" --out "$ICON_2X" >/dev/null 2>&1 || true
  if [ -f "$ICON_2X" ]; then
    sips -z 512 512 "$ICON_2X" --out "$ICON_1X" >/dev/null 2>&1 || true
  fi
fi

echo "Installed: $TARGET"
