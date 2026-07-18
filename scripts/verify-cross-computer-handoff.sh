#!/bin/zsh
set -euo pipefail

readonly ROOT="${0:A:h:h}"
readonly HANDOFF="${1:-$ROOT/releases/Eagle-跨电脑安装与开发接力}"
readonly ORIGINAL_SHA256="b04a2efdb8bc8d06910552f43f38c056e6964c8f74798e1b2849f1bffab8a1bd"
readonly BRIDGED_SHA256="4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3"

fail() { print -u2 "验证失败：$1"; exit 1; }
[[ -d "$HANDOFF" ]] || fail "找不到交接目录：$HANDOFF"

(
  cd "$HANDOFF"
  shasum -a 256 -c SHA256SUMS.txt
)

publisher="$HANDOFF/01-一键可装/MAX-Publisher-v1.2.5.eagleplugin"
instagram="$HANDOFF/02-需要一次手动加载/Instagram-整帖导入-v1.1.2-Chrome.zip"
organizer="$HANDOFF/03-宿主兼容安装/媒体智能整理-v2.4.1.eagleplugin"
payload="$HANDOFF/03-宿主兼容安装/bridge/payload/Eagle-4.0.0-build23-bridged-app.asar"
bundle="$HANDOFF/04-开发接力/EAGLE-extensions-source.bundle"

unzip -tq "$publisher" >/dev/null
unzip -tq "$instagram" >/dev/null
unzip -tq "$organizer" >/dev/null
unzip -p "$publisher" manifest.json | grep -q '"version": "1.2.5"' || fail "MAX Publisher 版本不匹配。"
unzip -p "$instagram" manifest.json | grep -q '"version": "1.1.2"' || fail "Instagram 扩展版本不匹配。"
unzip -p "$organizer" manifest.json | grep -q '"version": "2.4.1"' || fail "媒体智能整理版本不匹配。"
[[ "$(shasum -a 256 "$payload" | awk '{print $1}')" == "$BRIDGED_SHA256" ]] || fail "桥接载荷指纹错误。"
[[ "$(shasum -a 256 "$ROOT/extensions/media-organizer/backups/Eagle-4.0.0-build23-app.asar" | awk '{print $1}')" == "$ORIGINAL_SHA256" ]] || fail "原始恢复备份指纹错误。"
git bundle verify "$bundle" >/dev/null

tmpdir=$(mktemp -d /tmp/eagle-handoff-verify.XXXXXX)
trap 'rm -rf "$tmpdir"' EXIT
git clone -q "$bundle" "$tmpdir/repository"
expected=$(tr -d '[:space:]' < "$HANDOFF/04-开发接力/提交哈希.txt")
actual=$(git -C "$tmpdir/repository" rev-parse HEAD)
[[ "$actual" == "$expected" ]] || fail "Git bundle 检出提交与清单不一致。"

print "交接包验证通过：压缩包、版本、哈希、桥接载荷和 Git bundle 均有效。"
