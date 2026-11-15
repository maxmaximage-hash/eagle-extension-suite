#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const asar = require("@electron/asar");

const EXPECTED_VERSION = "4.0.0";
const ORIGINAL_SHA256 = "b04a2efdb8bc8d06910552f43f38c056e6964c8f74798e1b2849f1bffab8a1bd";
const SORTING_BRIDGED_SHA256 = "4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3";
const LIVE_BRIDGE_MARKER = "max-live-photo.native-action";

function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function patchOnce(file, needle, replacement, label) {
  const source = fs.readFileSync(file, "utf8");
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(`${label} 原始结构不匹配（命中 ${count} 次）`);
  fs.writeFileSync(file, source.replace(needle, replacement), "utf8");
}
function patchPattern(file, pattern, replacement, label) {
  const source = fs.readFileSync(file, "utf8");
  const matches = source.match(pattern) || [];
  if (matches.length !== 1) throw new Error(`${label} 原始结构不匹配（命中 ${matches.length} 次）`);
  fs.writeFileSync(file, source.replace(pattern, replacement), "utf8");
}
function pluginRootFromTree(root) {
  return path.join(root, "app/js/plugin");
}
function applyPluginApiPatch(root) {
  const ipc = path.join(pluginRootFromTree(root), "ipc.js");
  patchOnce(ipc, "    'library-changed': [],\n", "    'library-changed': [],\n    'max-live-photo.native-action': [],\n", "plugin/ipc callbacks");
  patchOnce(ipc,
    "        ipcRenderer.on('theme-changed', (event, params) => {",
    "        ipcRenderer.on('max-live-photo.native-action', (event, params) => {\n            callbacks['max-live-photo.native-action'].forEach((callback) => {\n                if (callback) callback(params);\n            });\n        });\n\n        ipcRenderer.on('theme-changed', (event, params) => {",
    "plugin/ipc native-action listener");
  const api = path.join(pluginRootFromTree(root), "api.js");
  patchOnce(api,
    "\tonLibraryChanged: (callback) => { pluginIPC.addCallback('library-changed', callback); },\n\tphotoTakenSort:",
    "\tonLibraryChanged: (callback) => { pluginIPC.addCallback('library-changed', callback); },\n\tonNativeAction: (callback) => { pluginIPC.addCallback('max-live-photo.native-action', callback); },\n\tsendNativeActionResult: (payload) => { ipcRenderer.send('max-live-photo.native-action-result', payload); },\n\tphotoTakenSort:",
    "plugin/api native-action methods");
}
function applyBackgroundPatch(root) {
  const file = path.join(root, "app/js/background.js");
  patchOnce(file,
    "var pluginModule = require(`${appRoot}/app/js/plugin`);\n",
    "var pluginModule = require(`${appRoot}/app/js/plugin`);\n\nfunction collapseNativeLivePhotoDrop(files) {\n    if (!Array.isArray(files) || files.length < 2) return { files: files || [], pairs: [] };\n    try {\n        const plugin = pluginModule?.installedPluginMaps?.['com.max.eagle-live-photo-manager'];\n        if (!plugin?.path) return { files, pairs: [] };\n        const adapter = require(path.join(plugin.path, 'lib', 'native-drop-adapter.js'));\n        const stage = path.join(EAGLE_THUMBNAIL_TEMP_PATH, 'live-photo-drop', `${Date.now()}-${Math.random().toString(16).slice(2)}`);\n        return adapter.groupLiveDropFiles(files, { stageDirectory: stage });\n    } catch (error) {\n        ipcRenderer.send('electron-log', `[live-photo] fail-open pair grouping: ${error.stack || error}`);\n        return { files, pairs: [] };\n    }\n}\n",
    "background live grouping helper");
  patchOnce(file,
    "ipcRenderer.on('upload-local-files', function(event, params) {\n    if (!params.files || params.files.length <= 0) return;\n    console.time(\"ipc.upload-files\");\n    var source = tokenSource();\n    var token = source.token;\n    taskTokens.push(source);\n    uploadFileQueue(params.files, 0, token);\n    console.timeEnd(\"ipc.upload-files\");\n});",
    "ipcRenderer.on('upload-local-files', function(event, params) {\n    if (!params.files || params.files.length <= 0) return;\n    console.time(\"ipc.upload-files\");\n    var source = tokenSource();\n    var token = source.token;\n    taskTokens.push(source);\n    const grouped = collapseNativeLivePhotoDrop(params.files);\n    uploadFileQueue(grouped.files, 0, token);\n    console.timeEnd(\"ipc.upload-files\");\n});",
    "background upload grouping");
  patchOnce(file,
    "        if (file.cutMode) image.cutMode = true;\n        if (file.merged) image.merged = true;\n\n        addToProcessQueue(image);",
    "        if (file.cutMode) image.cutMode = true;\n        if (file.merged) image.merged = true;\n        if (file.maxLivePair) image.maxLivePair = file.maxLivePair;\n\n        if (image.maxLivePair) {\n            pluginModule.broadcast('max-live-photo.native-action', {\n                type: 'register',\n                requestId: image.id,\n                itemId: image.id,\n                stem: image.maxLivePair.stem,\n                imagePath: image.maxLivePair.imagePath,\n                moviePath: image.maxLivePair.moviePath,\n                packagePath: image.maxLivePair.packagePath\n            });\n        }\n        addToProcessQueue(image);",
    "background native registration");
}
function applyUploadUiPatch(root) {
  const file = path.join(root, "app/app.bundle.js");
  patchOnce(file,
    "        $scope.uploadFiles = function($files, folder) {\n\n            if ($files.length === 0) {",
    "        $scope.uploadFiles = function($files, folder) {\n\n            if (Array.isArray($files) && $files.length > 1) {\n                try {\n                    const plugin = pluginModule?.installedPluginMaps?.['com.max.eagle-live-photo-manager'];\n                    if (plugin?.path) {\n                        const adapter = require(path.join(plugin.path, 'lib', 'native-drop-adapter.js'));\n                        const stage = path.join(EAGLE_THUMBNAIL_TEMP_PATH, 'live-photo-drop', `${Date.now()}-${Math.random().toString(16).slice(2)}`);\n                        $files = adapter.groupLiveDropFiles($files, { stageDirectory: stage }).files;\n                    }\n                } catch (error) {\n                    console.warn('[live-photo] fail-open UI pair grouping', error);\n                }\n            }\n\n            if ($files.length === 0) {",
    "app.bundle upload grouping");
  patchOnce(file,
    "                if (file.cutMode) image.cutMode = true;\n                if (file.merged) image.merged = true;\n\n                images.push(image);",
    "                if (file.cutMode) image.cutMode = true;\n                if (file.merged) image.merged = true;\n                if (file.maxLivePair) image.maxLivePair = file.maxLivePair;\n\n                images.push(image);",
    "app.bundle pair metadata");
}
function applyContextMenuPatch(root) {
  const file = path.join(root, "app/app.bundle.js");
  patchOnce(file,
    "            const isDetailMode = $scope.isDetailMode;\n            const isInFolderList = !!$scope.currentFolder;\n",
    "            const isDetailMode = $scope.isDetailMode;\n            const isInFolderList = !!$scope.currentFolder;\n            const liveItems = items.filter((candidate) => String(candidate.ext || '').toLowerCase() === 'livp');\n            const livePhotoService = pluginModule?.installedPluginMaps?.['com.max.eagle-live-photo-manager'];\n            const livePhotoServiceEnabled = !!livePhotoService && !pluginModule.isPluginDisabled(livePhotoService.manifest.id);\n",
    "context menu Live Photo state");
  patchOnce(file,
    "                    // 导出\n                    {\n                        label: i18n.__(\"context.image.export\"),",
    "                    // MAX Live Photo 导出动作只追加到原生右键菜单；选择、拖动和预览仍由 Eagle 处理。\n                    {\n                        visible: livePhotoServiceEnabled && liveItems.length > 0,\n                        label: 'Live Photo',\n                        keywords: 'live photo heic mov livp export',\n                        submenu: {\n                            items: [\n                                { label: '导出静态照片', click: () => pluginModule.broadcast('max-live-photo.native-action', { type: 'export', mode: 'image', itemIds: liveItems.map((entry) => entry.id), requestId: `export-image-${Date.now()}` }) },\n                                { label: '导出动态视频', click: () => pluginModule.broadcast('max-live-photo.native-action', { type: 'export', mode: 'movie', itemIds: liveItems.map((entry) => entry.id), requestId: `export-movie-${Date.now()}` }) },\n                                { label: '导出照片与视频', click: () => pluginModule.broadcast('max-live-photo.native-action', { type: 'export', mode: 'components', itemIds: liveItems.map((entry) => entry.id), requestId: `export-components-${Date.now()}` }) },\n                                { label: '导出 Live Photo 原件', click: () => pluginModule.broadcast('max-live-photo.native-action', { type: 'export', mode: 'livp', itemIds: liveItems.map((entry) => entry.id), requestId: `export-livp-${Date.now()}` }) }\n                            ]\n                        }\n                    },\n                    // 导出\n                    {\n                        label: i18n.__(\"context.image.export\"),",
    "context menu Live Photo actions");
}
function applyHoverPatch(root) {
  const file = path.join(root, "app/js/hover-preview/video-hover-preview.js");
  patchOnce(file,
    "// MP4 文件悬停自动播放\nvar mouseoverVideoTimeout;\nvar updateVideoCursorInterval;\nvar videoHoverSelector = EagleConfig.VIDEO_FORMATS.map(function(ext) {\n    return '.box.ext-' + ext + ' .thumbnail';\n}).join(', ');",
    "// 视频与 Live Photo 悬停自动播放。Live Photo 先从 ZIP 中提取 motion.mov。\nvar mouseoverVideoTimeout;\nvar updateVideoCursorInterval;\nvar livePhotoHoverCache = {};\nfunction getLivePhotoHoverUrl(image) {\n    if (!image || String(image.ext).toLowerCase() !== 'livp') return $bodyScope.getRawUrl(image);\n    if (livePhotoHoverCache[image.id] && fs.existsSync(livePhotoHoverCache[image.id])) return URL_MODULE.pathToFileURL(livePhotoHoverCache[image.id]).href;\n    var rawPath = FileUrlHelper.getRawPath(image);\n    var cacheDir = path.join(EAGLE_THUMBNAIL_TEMP_PATH, 'livp-hover');\n    var cachePath = path.join(cacheDir, `${image.id}.mov`);\n    fs.mkdirSync(cacheDir, { recursive: true });\n    if (!fs.existsSync(cachePath)) {\n        var AdmZip = require(appRoot + '/node_modules/adm-zip');\n        var zip = new AdmZip(rawPath);\n        var entry = zip.getEntries().find(function(candidate) { return path.extname(candidate.entryName).toLowerCase() === '.mov'; });\n        if (!entry) throw new Error('Live Photo package has no MOV entry');\n        var tempPath = `${cachePath}.${process.pid}.tmp`;\n        fs.writeFileSync(tempPath, entry.getData());\n        fs.renameSync(tempPath, cachePath);\n    }\n    livePhotoHoverCache[image.id] = cachePath;\n    return URL_MODULE.pathToFileURL(cachePath).href;\n}\nvar videoHoverExtensions = EagleConfig.VIDEO_FORMATS.slice();\nvideoHoverExtensions.push('livp');\nvar videoHoverSelector = videoHoverExtensions.map(function(ext) {\n    return '.box.ext-' + ext + ' .thumbnail';\n}).join(', ');",
    "hover Live Photo adapter");
  patchOnce(file,
    "        var $image = $box.find(\"img\");\n        $box.find(\".video-progress-bar\").remove();",
    "        var $image = $box.find(\"img\");\n        var hoverMediaUrl;\n        try { hoverMediaUrl = getLivePhotoHoverUrl(image); } catch (error) { console.warn('[live-photo] hover extraction failed', error); return; }\n        $box.find(\".video-progress-bar\").remove();",
    "hover media URL");
  patchOnce(file, "src: $bodyScope.getRawUrl(image),", "src: hoverMediaUrl,", "hover native video src");
  patchOnce(file, "mpvElement.src = $bodyScope.getRawUrl(image);", "mpvElement.src = hoverMediaUrl;", "hover mpv video src");
  patchOnce(file, "$(\"#box-container\").on('mouseleave', videoHoverSelector, removeBoxVideoPlayer);", "$(\"#box-container\").on('mouseleave', videoHoverSelector, removeBoxVideoPlayer);", "hover leave marker");
}
function verifyPatchedTree(root) {
  const ipc = fs.readFileSync(path.join(root, 'app/js/plugin/ipc.js'), 'utf8');
  const api = fs.readFileSync(path.join(root, 'app/js/plugin/api.js'), 'utf8');
  const bg = fs.readFileSync(path.join(root, 'app/js/background.js'), 'utf8');
  const bundle = fs.readFileSync(path.join(root, 'app/app.bundle.js'), 'utf8');
  const hover = fs.readFileSync(path.join(root, 'app/js/hover-preview/video-hover-preview.js'), 'utf8');
  for (const [label, source] of [['ipc', ipc], ['api', api], ['background', bg], ['bundle', bundle], ['hover', hover]]) {
    if (!source.includes(LIVE_BRIDGE_MARKER) && label !== 'hover') throw new Error(`${label} 缺少 Live Photo 桥标记`);
  }
  if (!hover.includes('getLivePhotoHoverUrl') || !bundle.includes("label: 'Live Photo'")) throw new Error('Live Photo hover/context patch missing');
}
function applyPatch(root) {
  applyPluginApiPatch(root);
  applyBackgroundPatch(root);
  applyUploadUiPatch(root);
  applyContextMenuPatch(root);
  applyHoverPatch(root);
}
async function rebuild(target, output) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-live-bridge-stage-'));
  try {
    await asar.extractAll(target, stage);
    applyPatch(stage);
    verifyPatchedTree(stage);
    await asar.createPackage(stage, output);
    const check = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-live-bridge-check-'));
    try { await asar.extractAll(output, check); verifyPatchedTree(check); }
    finally { fs.rmSync(check, { recursive: true, force: true }); }
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}
async function main() {
  const appPath = process.env.EAGLE_APP_PATH || '/Applications/Eagle.app';
  const target = path.join(appPath, 'Contents/Resources/app.asar');
  const mode = process.argv[2] || '--check';
  if (!fs.existsSync(target)) throw new Error(`找不到 Eagle app.asar：${target}`);
  const current = sha256(target);
  if (mode === '--check') {
    if (![ORIGINAL_SHA256, SORTING_BRIDGED_SHA256].includes(current)) throw new Error(`当前 app.asar 指纹未知：${current}`);
    console.log(`兼容性检查通过：Eagle ${EXPECTED_VERSION}，当前为${current === ORIGINAL_SHA256 ? '原始' : '排序桥'}版本。`);
    return;
  }
  if (mode !== '--install') throw new Error('参数仅支持 --check 或 --install');
  if (require('child_process').spawnSync('pgrep', ['-x', 'Eagle'], { stdio: 'ignore' }).status === 0) throw new Error('Eagle 仍在运行；请先完全退出 Eagle');
  if (![ORIGINAL_SHA256, SORTING_BRIDGED_SHA256].includes(current)) throw new Error(`只接受已审计 app.asar，当前指纹为：${current}`);
  const backupDir = path.join(process.env.HOME || os.homedir(), 'Library/Application Support/Eagle/Backups/live-photo-native-bridge');
  const backup = path.join(backupDir, 'Eagle-4.0.0-original-app.asar');
  fs.mkdirSync(backupDir, { recursive: true });
  if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
  if (sha256(backup) !== SORTING_BRIDGED_SHA256 && sha256(backup) !== ORIGINAL_SHA256) throw new Error('已有 app.asar 备份指纹不匹配');
  const output = `${target}.rebuilding.${process.pid}`;
  await rebuild(target, output);
  fs.renameSync(output, target);
  const evidence = { schemaVersion: 1, hostVersion: EXPECTED_VERSION, originalSha256: ORIGINAL_SHA256, previousSha256: current, installedSha256: sha256(target), backup, marker: LIVE_BRIDGE_MARKER, createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(backupDir, 'bridge-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(`Live Photo 原生桥已安装：${target}`);
  console.log(`当前指纹：${sha256(target)}`);
}
if (require.main === module) main().catch((error) => { console.error(`拒绝执行：${error.message || error}`); process.exitCode = 1; });
module.exports = { applyPatch, verifyPatchedTree, ORIGINAL_SHA256, SORTING_BRIDGED_SHA256 };
