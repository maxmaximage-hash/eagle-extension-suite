#!/bin/zsh
set -euo pipefail

readonly ROOT="${0:A:h:h}"
readonly VERSION="20261115-eagle-complete-4"
readonly RELEASE_ROOT="$ROOT/releases/eagle-suite-v$VERSION"
readonly ASSET_ROOT="$RELEASE_ROOT/assets"
readonly PLUGIN_ROOT="$RELEASE_ROOT/plugins"

fail() {
  print -u2 "Eagle 全套发布包构建失败：$1"
  exit 1
}

sha256() {
  shasum -a 256 "$1" | awk '{print $1}'
}

copy_file() {
  local source="$1"
  local destination="$2"
  [[ -f "$source" ]] || fail "缺少文件：$source"
  mkdir -p "${destination:h}"
  cp -p "$source" "$destination"
}

zip_files() {
  local output="$1"
  local source_root="$2"
  shift 2
  local stage
  stage=$(mktemp -d "${TMPDIR:-/tmp}/eagle-suite-plugin.XXXXXX")
  for relative in "$@"; do
    [[ -e "$source_root/$relative" ]] || fail "插件运行文件缺失：$source_root/$relative"
    mkdir -p "$stage/${relative:h}"
    cp -R "$source_root/$relative" "$stage/$relative"
  done
  (
    cd "$stage"
    find . -name '.DS_Store' -delete
    find . -type f -print0 | sort -z | xargs -0 zip -X -q "$output"
  )
  rm -rf "$stage"
}

rm -rf "$RELEASE_ROOT"
mkdir -p "$ASSET_ROOT" "$PLUGIN_ROOT" "$RELEASE_ROOT/source"

# Eagle service plugins. Each archive contains only installable runtime files.
zip_files "$PLUGIN_ROOT/com.max.eagle-workbench-v1.4.eagleplugin" \
  "$ROOT/extensions/eagle-workbench" \
  manifest.json index.html app.js registry.js styles.css logo.svg

zip_files "$PLUGIN_ROOT/com.max.eagle-photo-taken-sort-v2.5.22-qa.98.eagleplugin" \
  "$ROOT/extensions/media-organizer" \
  index.html logo.png manifest.json package.json package-lock.json plugin.js data node_modules/exifr lib

zip_files "$PLUGIN_ROOT/com.max.eagle-live-photo-manager-v0.2.0-dev.11.eagleplugin" \
  "$ROOT/extensions/live-photo-manager" \
  manifest.json index.html app.js styles.css plugin.js server.js logo.png lib macos scripts

zip_files "$PLUGIN_ROOT/com.max.eagle-live-photo-inspector-v0.1.0.eagleplugin" \
  "$ROOT/extensions/live-photo-inspector" \
  manifest.json index.html renderer.js photo-metadata.js logo.png

zip_files "$PLUGIN_ROOT/com.max.eagle-avatar-source-publisher-v1.0.0.eagleplugin" \
  "$ROOT/extensions/avatar-source-publisher" \
  manifest.json index.html plugin.js lib contracts

# Publisher is built from its current source so the published asset matches this commit.
(
  cd "$ROOT/extensions/online-publisher"
  npm run package:plugin >/dev/null
)
copy_file "$ROOT/extensions/online-publisher/max-eagle-publisher-1.2.7.eagleplugin" \
  "$PLUGIN_ROOT/com.max.eagle-online-publisher-v1.2.7.eagleplugin"

# Browser extensions are shipped separately because Eagle does not install them as plugins.
zip_files "$ASSET_ROOT/instagram-post-importer-v1.1.2.zip" \
  "$ROOT/extensions/instagram-post-importer" \
  manifest.json background.js content.js README.md
zip_files "$ASSET_ROOT/xiaohongshu-post-importer-v1.0.0.zip" \
  "$ROOT/extensions/xiaohongshu-post-importer" \
  manifest.json background.js content.js core.js page-bridge.js README.md
zip_files "$ASSET_ROOT/web-media-importer-v2.4.4.zip" \
  "$ROOT/extensions/web-media-importer" \
  manifest.json background.js content.js core.js provider-adapters.js structured-media.js popup.html popup.js popup.css README.md

# The bridge is source and evidence only. The user's host app.asar is never put in the package.
mkdir -p "$ASSET_ROOT/bridge"
copy_file "$ROOT/extensions/media-organizer/bridge/rebuild-compatible-bridge.js" \
  "$ASSET_ROOT/bridge/rebuild-compatible-bridge.js"
copy_file "$ROOT/extensions/media-organizer/bridge/bridge-manifest.json" \
  "$ASSET_ROOT/bridge/bridge-manifest.json"
copy_file "$ROOT/extensions/media-organizer/bridge/README.md" \
  "$ASSET_ROOT/bridge/README.md"
copy_file "$ROOT/extensions/media-organizer/bridge/package.json" \
  "$ASSET_ROOT/bridge/package.json"
copy_file "$ROOT/extensions/media-organizer/bridge/package-lock.json" \
  "$ASSET_ROOT/bridge/package-lock.json"
readonly BRIDGED_APP_ASAR="/Applications/Eagle.app/Contents/Resources/app.asar"
readonly BRIDGED_APP_ASAR_SHA256="4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3"
if [[ -f "$BRIDGED_APP_ASAR" ]]; then
  current_bridge_hash=$(sha256 "$BRIDGED_APP_ASAR")
  if [[ "$current_bridge_hash" == "$BRIDGED_APP_ASAR_SHA256" ]]; then
    copy_file "$BRIDGED_APP_ASAR" \
      "$ASSET_ROOT/bridge/Eagle-4.0.0-build23-bridged-app.asar"
    print -r -- "$current_bridge_hash  Eagle-4.0.0-build23-bridged-app.asar" > \
      "$ASSET_ROOT/bridge/app.asar.sha256"
  fi
fi

cat > "$RELEASE_ROOT/SYNC-INSTRUCTIONS.md" <<EOF
# Eagle Extension Suite $VERSION

本包对应 Git commit \`$(git -C "$ROOT" rev-parse HEAD)\`。

1. 先完全退出 Eagle。
2. 将 \`plugins/*.eagleplugin\` 解压到 \`~/Library/Application Support/Eagle/Plugins/<插件 ID>/\`，每个压缩包的根目录就是插件目录内容。
3. 浏览器扩展解压 \`assets/*.zip\` 后，在 Chrome 的扩展管理页加载对应目录。
4. 需要媒体智能整理主网格桥接时，先在 \`assets/bridge\` 执行 \`npm ci\`，再运行 \`node rebuild-compatible-bridge.js --check\` 检查本机。发布包同时提供经过 SHA256 校验的 Eagle 4.0.0 Build23 桥接宿主资产，只有指纹匹配时才使用它。

包内没有 Eagle Library、NAS 素材、运行状态、诊断日志或备份。桥接 app.asar 只作为独立、带 SHA256 的宿主资产提供。
EOF

cat > "$RELEASE_ROOT/PLUGIN-REGISTRY.json" <<EOF
{
  "schemaVersion": 1,
  "release": "$VERSION",
  "commit": "$(git -C "$ROOT" rev-parse HEAD)",
  "plugins": [
    {"id":"com.max.eagle-workbench","version":"1.4","asset":"plugins/com.max.eagle-workbench-v1.4.eagleplugin"},
    {"id":"com.max.eagle-photo-taken-sort","version":"2.5.22-qa.98","asset":"plugins/com.max.eagle-photo-taken-sort-v2.5.22-qa.98.eagleplugin"},
    {"id":"com.max.eagle-live-photo-manager","version":"0.2.0-dev.11","asset":"plugins/com.max.eagle-live-photo-manager-v0.2.0-dev.11.eagleplugin"},
    {"id":"com.max.eagle-live-photo-inspector","version":"0.1.0","asset":"plugins/com.max.eagle-live-photo-inspector-v0.1.0.eagleplugin"},
    {"id":"com.max.eagle-avatar-source-publisher","version":"1.0.0","asset":"plugins/com.max.eagle-avatar-source-publisher-v1.0.0.eagleplugin"},
    {"id":"com.max.eagle-online-showcase","version":"1.2.7","asset":"plugins/com.max.eagle-online-publisher-v1.2.7.eagleplugin"}
  ],
  "browserExtensions": [
    {"name":"Instagram 整帖保存至 Eagle","version":"1.1.2","asset":"assets/instagram-post-importer-v1.1.2.zip"},
    {"name":"小红书整帖保存至 Eagle","version":"1.0.0","asset":"assets/xiaohongshu-post-importer-v1.0.0.zip"},
    {"name":"网页媒体保存至 Eagle","version":"2.4.4","asset":"assets/web-media-importer-v2.4.4.zip"}
  ]
}
EOF

(
  cd "$RELEASE_ROOT"
  find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS
)

print "Eagle 全套发布包已生成：$RELEASE_ROOT"
