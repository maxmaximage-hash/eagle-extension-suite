#!/bin/zsh
set -euo pipefail

readonly ROOT="${0:A:h:h}"
readonly VERSION="20261117-suite-sync-1"
readonly RELEASE_ROOT="$ROOT/releases/eagle-suite-v$VERSION"
readonly ASSET_ROOT="$RELEASE_ROOT/assets"
readonly PLUGIN_ROOT="$RELEASE_ROOT/plugins"

fail() {
  print -u2 "Eagle 全套发布包构建失败：$1"
  exit 1
}

command -v python3 >/dev/null || fail "从源码构建整套 ZIP 需要 Python 3；下载发布包安装不需要 Python。"

sha256() {
  shasum -a 256 "$1" | awk '{print $1}'
}

manifest_field() {
  node -e 'const fs=require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1],"utf8"))[process.argv[2]])' "$1" "$2"
}

readonly WORKBENCH_VERSION=$(manifest_field "$ROOT/extensions/eagle-workbench/manifest.json" version)
readonly MEDIA_VERSION=$(manifest_field "$ROOT/extensions/media-organizer/manifest.json" version)
readonly LIVE_VERSION=$(manifest_field "$ROOT/extensions/live-photo-manager/manifest.json" version)
readonly INSPECTOR_VERSION=$(manifest_field "$ROOT/extensions/live-photo-inspector/manifest.json" version)
readonly AVATAR_VERSION=$(manifest_field "$ROOT/extensions/avatar-source-publisher/manifest.json" version)
readonly PUBLISHER_VERSION=$(manifest_field "$ROOT/extensions/online-publisher/eagle-plugin/manifest.json" version)
readonly INSTAGRAM_VERSION=$(manifest_field "$ROOT/extensions/instagram-post-importer/manifest.json" version)
readonly XIAOHONGSHU_VERSION=$(manifest_field "$ROOT/extensions/xiaohongshu-post-importer/manifest.json" version)
readonly WEB_VERSION=$(manifest_field "$ROOT/extensions/web-media-importer/manifest.json" version)

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
mkdir -p "$ASSET_ROOT" "$PLUGIN_ROOT"

# Eagle service plugins. Each archive contains only installable runtime files.
zip_files "$PLUGIN_ROOT/com.max.eagle-workbench-v$WORKBENCH_VERSION.eagleplugin" \
  "$ROOT/extensions/eagle-workbench" \
  manifest.json index.html app.js delivery.js delivery-entry.js registry.js styles.css logo.svg

# Reuse the clean media runtime allowlist; never archive caches nested under lib/.
zsh "$ROOT/extensions/media-organizer/scripts/build-github-release.sh" >/dev/null
copy_file "$ROOT/extensions/media-organizer/releases/媒体智能整理-v$MEDIA_VERSION-github.eagleplugin" \
  "$PLUGIN_ROOT/com.max.eagle-photo-taken-sort-v$MEDIA_VERSION.eagleplugin"
copy_file "$ROOT/extensions/media-organizer/releases/install-媒体智能整理-v$MEDIA_VERSION.sh" \
  "$ASSET_ROOT/install-媒体智能整理-v$MEDIA_VERSION.sh"
copy_file "$ROOT/extensions/media-organizer/releases/媒体智能整理-v$MEDIA_VERSION-github.SHA256SUMS" \
  "$ASSET_ROOT/媒体智能整理-v$MEDIA_VERSION-github.SHA256SUMS"
# The installer resolves this canonical archive name beside its checksum file.
copy_file "$ROOT/extensions/media-organizer/releases/媒体智能整理-v$MEDIA_VERSION-github.eagleplugin" \
  "$ASSET_ROOT/媒体智能整理-v$MEDIA_VERSION-github.eagleplugin"

zip_files "$PLUGIN_ROOT/com.max.eagle-live-photo-manager-v$LIVE_VERSION.eagleplugin" \
  "$ROOT/extensions/live-photo-manager" \
  manifest.json index.html app.js styles.css plugin.js server.js logo.png lib macos scripts

zip_files "$PLUGIN_ROOT/com.max.eagle-live-photo-inspector-v$INSPECTOR_VERSION.eagleplugin" \
  "$ROOT/extensions/live-photo-inspector" \
  manifest.json index.html renderer.js photo-metadata.js logo.png

zip_files "$PLUGIN_ROOT/com.max.eagle-avatar-source-publisher-v$AVATAR_VERSION.eagleplugin" \
  "$ROOT/extensions/avatar-source-publisher" \
  manifest.json index.html plugin.js lib contracts

# Publisher is built from its current source so the published asset matches this commit.
(
  cd "$ROOT/extensions/online-publisher"
  npm run package:plugin >/dev/null
)
copy_file "$ROOT/extensions/online-publisher/max-eagle-publisher-$PUBLISHER_VERSION.eagleplugin" \
  "$PLUGIN_ROOT/com.max.eagle-online-showcase-v$PUBLISHER_VERSION.eagleplugin"

# Browser extensions are shipped separately because Eagle does not install them as plugins.
zip_files "$ASSET_ROOT/instagram-post-importer-v$INSTAGRAM_VERSION.zip" \
  "$ROOT/extensions/instagram-post-importer" \
  manifest.json background.js content.js README.md
zip_files "$ASSET_ROOT/xiaohongshu-post-importer-v$XIAOHONGSHU_VERSION.zip" \
  "$ROOT/extensions/xiaohongshu-post-importer" \
  manifest.json background.js content.js core.js page-bridge.js README.md
zip_files "$ASSET_ROOT/web-media-importer-v$WEB_VERSION.zip" \
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
copy_file "$ROOT/extensions/media-organizer/bridge/restore-compatible-bridge.sh" \
  "$ASSET_ROOT/bridge/restore-compatible-bridge.sh"

cat > "$RELEASE_ROOT/SYNC-INSTRUCTIONS.md" <<EOF
# Eagle Extension Suite $VERSION

本包对应 Git commit \`$(git -C "$ROOT" rev-parse HEAD)\`。

1. 先完全退出 Eagle。
2. 将 \`plugins/*.eagleplugin\` 解压到 \`~/Library/Application Support/Eagle/Plugins/<插件 ID>/\`，每个压缩包的根目录就是插件目录内容。
3. 浏览器扩展解压 \`assets/*.zip\` 后，在 Chrome 的扩展管理页加载对应目录。
4. 媒体服务安装优先使用 \`assets/install-媒体智能整理-v$MEDIA_VERSION.sh\`，同目录已包含对应包和校验文件。当前宿主已满足审计指纹时运行 \`--check\` 再按其提示安装；原始未桥接宿主仅接受 \`--install-plugin-only\`，该模式不提供主网格排序接入。
5. 跨电脑的主网格通信兼容性必须按仓库 \`docs/CROSS-COMPUTER-HANDOFF.md\` 在目标电脑核验。\`assets/bridge\` 只提供可审计源码、指纹说明和恢复脚本，不分发或覆盖当前电脑的 Eagle 宿主。
6. 工作台是统一管理入口；排序与人物/环境图重命名位于 Eagle 布局面板；媒体智能整理窗口只保留标签。复制文件夹仍未完成真实 Eagle 验收，不列为已交付功能。

包内没有 Eagle 主程序、Library、NAS 素材、用户文案配置、运行状态、诊断日志或备份。软件内置模板保留用户指定正文与教程；客户分享链接和本机验收记录不公开分发。
EOF

node - "$ROOT" "$RELEASE_ROOT" "$VERSION" <<'NODE'
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process");
const [root, output, release] = process.argv.slice(2);
const read = (directory) => JSON.parse(fs.readFileSync(path.join(root, "extensions", directory, "manifest.json"), "utf8"));
const pluginDirectories = ["eagle-workbench", "media-organizer", "live-photo-manager", "live-photo-inspector", "avatar-source-publisher", "online-publisher/eagle-plugin"];
const plugins = pluginDirectories.map(directory => {const m=read(directory); return {id:m.id, version:m.version, asset:`plugins/${m.id}-v${m.version}.eagleplugin`};});
const browserExtensions = ["instagram-post-importer", "xiaohongshu-post-importer", "web-media-importer"].map(directory => {const m=read(directory); return {name:m.name, version:m.version, asset:`assets/${directory}-v${m.version}.zip`};});
const registry = require(path.join(root, "extensions/eagle-workbench/registry.js"));
const version = suffix => registry.MODULES.find(item => item.id.endsWith(suffix)).version;
fs.writeFileSync(path.join(output, "PLUGIN-REGISTRY.json"), JSON.stringify({schemaVersion:1, release, commit:cp.execFileSync("git", ["rev-parse", "HEAD"], {cwd:root, encoding:"utf8"}).trim(), products:{workbench:registry.WORKBENCH_VERSION, deliveryCopy:version(":delivery-copy"), sorting:version(":sorting"), selectedRename:version(":media-rename"), metadataTags:version(":metadata")}, plugins, browserExtensions, pending:["复制文件夹：尚未通过真实 Eagle 验收"]}, null, 2)+"\n");
NODE

# Include the exact committed source, never a copy of the working directory.
git -C "$ROOT" archive --format=zip --prefix=eagle-extension-suite/ \
  --output="$ASSET_ROOT/eagle-extension-suite-source.zip" HEAD

(
  cd "$RELEASE_ROOT"
  find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS
)

print "Eagle 全套发布包已生成：$RELEASE_ROOT"
readonly SUITE_ARCHIVE="$ROOT/releases/eagle-suite-v$VERSION.zip"
rm -f "$SUITE_ARCHIVE"
python3 - "$RELEASE_ROOT" "$SUITE_ARCHIVE" <<'PY'
from pathlib import Path
import sys, zipfile
release, archive = map(Path, sys.argv[1:])
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as output:
    for filename in sorted(release.rglob("*")):
        if filename.is_file():
            output.write(filename, str(filename.relative_to(release.parent)))
PY
(
  cd "$ROOT/releases"
  shasum -a 256 "${SUITE_ARCHIVE:t}" > "${SUITE_ARCHIVE:t}.SHA256SUMS"
)
print "$SUITE_ARCHIVE"
print "$SUITE_ARCHIVE.SHA256SUMS"
