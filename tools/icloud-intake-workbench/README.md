# iCloud Intake Workbench

This is a local ledger and dashboard skeleton for the iCloud Photos to NAS to Eagle intake workflow.

Current scope:

- Records batches, assets, Live Photo companion groups, target paths, retry/error state, and Eagle import state.
- Records the user's last selection anchor separately from download progress.
- Runs a local demo dashboard with a "continue last session" entry point.
- Refuses to treat duplicate batch membership as a new download.
- Plans conflict target names instead of silently overwriting existing filenames.

Non-goals in this skeleton:

- It does not log in to iCloud.
- It does not install or call `icloudpd`, `osxphotos`, browser extensions, or Apple APIs.
- It does not create NAS directories.
- It does not download, delete, import, or modify Eagle `.library` contents.

## Local Demo App

```bash
node tools/icloud-intake-workbench/server.js --port 4177
```

Open:

```text
http://127.0.0.1:4177
```

The demo uses local sample data at:

```text
~/.eagle-icloud-intake/demo-ledger.json
```

Demo target:

```text
/Volumes/团队文件-MAX线上协作中台/icloud 待分类素材/
```

Output policy:

- Photos are planned as `.jpg` for screening and lightweight editing.
- Videos keep their original video extension.
- Live Photos must preserve their original components, because `.jpg` is not a native Live Photo publishing master.
- The intended Live workflow is: edit the JPG cover on the Mac, then rebuild a publishable Live Photo from the edited cover plus the original motion video.
- `.livp` is an Eagle preview/management package, not the iPhone or Xiaohongshu publishing deliverable.
- Dragging `.livp` into macOS Photos is not expected to create a Live Photo; Apple Photos does not treat Eagle's `.livp` package as a public Live Photo import format.
- The publish workflow must import a photo plus a PhotoKit `pairedVideo` resource into Apple Photos, then verify that iPhone Photos recognizes it as Live before publishing from the mobile app.

The demo includes a Live asset workspace. Hovering the sample asset simulates motion preview; right-clicking opens separate cover, motion, Eagle `.livp`, iPhone Live Photo, JPG editor, and short-video actions. These are flow-only demo actions and do not write files.

## Apple Photos Return Path

Use `.livp` only for Eagle preview. For a publishable Live Photo, the workbench should keep the edited cover image and original motion video as paired source files, then pass them to a native macOS helper that calls PhotoKit:

```text
edited-cover.jpg or edited-cover.heic + original-motion.mov
  -> PHAssetCreationRequest.addResource(.photo)
  -> PHAssetCreationRequest.addResource(.pairedVideo)
  -> Apple Photos library
  -> verify iPhone shows the Live badge
```

This is a user-approved action because it writes to the Photos library. The local helper for the one-item pilot is:

```bash
swiftc -framework Photos tools/icloud-intake-workbench/macos/LivePhotoImporter.swift -o /tmp/LivePhotoImporter
/tmp/LivePhotoImporter \
  --image "/Users/max/Downloads/iCloud 照片/IMG_9264.JPG" \
  --movie "/Users/max/Downloads/iCloud 照片/IMG_9264.MOV" \
  --album "MAX Live Photo Import Test" \
  --dry-run
```

For real imports, package it as a `.app` with `tools/icloud-intake-workbench/macos/LivePhotoImporter.Info.plist` so macOS can show Photos authorization text. The helper can also verify a Photos asset by local identifier:

```bash
LivePhotoImporter --verify-id "<PHAsset localIdentifier>" --result-file /tmp/live-photo-verify-result.json
```

The first approved sample import of `/Users/max/Downloads/iCloud 照片/IMG_9264.JPG + IMG_9264.MOV` created a Photos asset whose verification reported `isLivePhoto=true` and resources `photo + pairedVideo`.

## Live Packaging

Scan a folder for Live component pairs:

```bash
node tools/icloud-intake-workbench/cli.js live-scan /tmp/ledger.json "/Volumes/团队文件-MAX线上协作中台/icloud 待分类素材"
```

Package matched pairs into Eagle-compatible `.livp` files:

```bash
node tools/icloud-intake-workbench/cli.js live-package /tmp/ledger.json "/Volumes/团队文件-MAX线上协作中台/icloud 待分类素材" \
  --output "/Volumes/团队文件-MAX线上协作中台/icloud 待分类素材/LivePackages"
```

The packager accepts uppercase iCloud names such as `IMG_9264.JPG` and `IMG_9264.MOV`, then writes normalized package entries such as `image.jpeg` and `motion.mov` so Eagle's Live Photo format extension can read them.

Export an Eagle `.livp` package back to editable components:

```bash
node tools/icloud-intake-workbench/cli.js live-export /tmp/ledger.json "/path/to/asset.livp" \
  --output "/tmp/live-export"
```

The exporter restores source filenames from `manifest.json` when available, writes the JPG/HEIC and MOV as separate files, and refuses to overwrite existing files unless `--overwrite` is passed. The 2026-07-26 Eagle sample `MS0KTJSY3J9BF` exported back to `IMG_9264.JPG + IMG_9264.MOV` with SHA-256 hashes matching the original iCloud download pair.

The demo buttons only change this local ledger:

- `继续上次`: opens the configured iCloud Photos entry URL in a new tab.
- `模拟搬运一步`: moves one demo item through the queue.
- `暂停` / `继续`: changes the batch status.
- `重试失败`: moves failed demo items back to pending.
- `设为锚点`: records the user's last selection anchor separately from download status.
- Live asset hover/right-click actions: demonstrate the planned edit and export routing without touching source media.

## Commands

```bash
node tools/icloud-intake-workbench/cli.js init /tmp/icloud-ledger.json
node tools/icloud-intake-workbench/cli.js batch /tmp/icloud-ledger.json pilot-001 \
  --title "50 item pilot" \
  --album "待下载-2026-07-试点" \
  --album-url "https://www.icloud.com.cn/photos" \
  --target "/Volumes/NAS/Eagle素材系统/Intake/pilot-001"
node tools/icloud-intake-workbench/cli.js add-item /tmp/icloud-ledger.json pilot-001 \
  --icloud-id "sample-asset-id" \
  --filename "IMG_0001.HEIC" \
  --media-type photo \
  --shot-at "2024-01-05T10:00:00Z" \
  --target-path "/Volumes/NAS/Eagle素材系统/Intake/pilot-001/IMG_0001.HEIC"
node tools/icloud-intake-workbench/cli.js anchor /tmp/icloud-ledger.json pilot-001 \
  --asset-key "icloud:sample-asset-id" \
  --filename "IMG_0001.HEIC" \
  --shot-at "2024-01-05" \
  --precision "album-or-month"
node tools/icloud-intake-workbench/cli.js dashboard /tmp/icloud-ledger.json /tmp/icloud-dashboard.html
```

## Test

```bash
node --test tools/icloud-intake-workbench/test/*.test.js
```
