#!/bin/zsh
set -euo pipefail

readonly ROOT="${0:A:h:h}"
readonly RELEASE_ROOT="$ROOT/releases"
readonly HANDOFF="$RELEASE_ROOT/Eagle-跨电脑安装与开发接力"
readonly PUBLISHER="$ROOT/extensions/online-publisher"
readonly ORGANIZER="$ROOT/extensions/media-organizer"
readonly INSTAGRAM="$ROOT/extensions/instagram-post-importer"
readonly LIVE_ASAR="/Applications/Eagle.app/Contents/Resources/app.asar"
readonly BRIDGED_SHA256="4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3"

sha256() { shasum -a 256 "$1" | awk '{print $1}'; }
fail() { print -u2 "构建失败：$1"; exit 1; }

git -C "$ROOT" diff --quiet && git -C "$ROOT" diff --cached --quiet || fail "请先提交源码和文档，再生成最终交接包。"
[[ -f "$LIVE_ASAR" ]] || fail "找不到已审计的桥接 app.asar。"
[[ "$(sha256 "$LIVE_ASAR")" == "$BRIDGED_SHA256" ]] || fail "当前 app.asar 不再是已审计桥接版本。"

rm -rf "$HANDOFF"
mkdir -p "$HANDOFF/01-一键可装" "$HANDOFF/02-需要一次手动加载" \
  "$HANDOFF/03-宿主兼容安装/bridge/payload" "$HANDOFF/04-开发接力"

cp "$PUBLISHER/max-eagle-publisher.eagleplugin" \
  "$HANDOFF/01-一键可装/MAX-Publisher-v1.2.5.eagleplugin"

(
  cd "$INSTAGRAM"
  zip -qr "$HANDOFF/02-需要一次手动加载/Instagram-整帖导入-v1.1.2-Chrome.zip" \
    manifest.json background.js content.js README.md
)

(
  cd "$ORGANIZER"
  zip -qr "$HANDOFF/03-宿主兼容安装/媒体智能整理-v2.4.1.eagleplugin" \
    manifest.json index.html plugin.js logo.png lib data node_modules/exifr \
    -x '*.DS_Store'
)

cp "$ORGANIZER/bridge/install-compatible-bridge.sh" \
  "$HANDOFF/03-宿主兼容安装/bridge/"
cp "$ORGANIZER/bridge/restore-compatible-bridge.sh" \
  "$HANDOFF/03-宿主兼容安装/bridge/"
cp "$ORGANIZER/bridge/bridge-manifest.json" \
  "$HANDOFF/03-宿主兼容安装/bridge/"
cp "$ORGANIZER/bridge/README.md" \
  "$HANDOFF/03-宿主兼容安装/bridge/桥接审计说明.md"
cp "$LIVE_ASAR" \
  "$HANDOFF/03-宿主兼容安装/bridge/payload/Eagle-4.0.0-build23-bridged-app.asar"

git -C "$ROOT" bundle create "$HANDOFF/04-开发接力/EAGLE-extensions-source.bundle" --all
git -C "$ROOT" rev-parse HEAD > "$HANDOFF/04-开发接力/提交哈希.txt"
git -C "$ROOT" log -n 12 --date=iso-strict --pretty=format:'%H %ad %s' \
  > "$HANDOFF/04-开发接力/最近提交清单.txt"

cp "$ROOT/HANDOFF.md" "$HANDOFF/00-请先阅读-中文交接说明.md"

(
  cd "$HANDOFF"
  find . -type f ! -name SHA256SUMS.txt -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS.txt
)

"$ROOT/scripts/verify-cross-computer-handoff.sh" "$HANDOFF"
print "交接目录已生成：$HANDOFF"
