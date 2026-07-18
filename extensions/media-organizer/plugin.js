"use strict";

const fs = require("fs");
const path = require("path");
const initialPluginPath = path.dirname(
  decodeURIComponent(window.location.pathname)
);
const {
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  mediaTypeForExtension,
  readMediaTakenAt
} = require(path.join(initialPluginPath, "lib", "media-time.js"));
const { createMediaSortRuntime } = require(
  path.join(initialPluginPath, "lib", "sort-core.js")
);
const { createRenameRuntime } = require(
  path.join(initialPluginPath, "lib", "rename-core.js")
);
const { createRenameBatchRuntime } = require(
  path.join(initialPluginPath, "lib", "rename-batch-core.js")
);
const { readMediaLocation } = require(
  path.join(initialPluginPath, "lib", "media-location.js")
);
const { createGeoResolver, loadGzipJson } = require(
  path.join(initialPluginPath, "lib", "geo-resolver.js")
);
const { createGeoTagService } = require(
  path.join(initialPluginPath, "lib", "geo-tag-service.js")
);
const { collectFolderMedia, createFolderTagPlan, normalizeTag } = require(
  path.join(initialPluginPath, "lib", "folder-tag-core.js")
);

const SORT_KEY = "PHOTO_TAKEN";
const META_KEY = "PHOTO_TAKEN";
const CACHE_VERSION = 2;
const backgroundSortRuntime = createMediaSortRuntime({
  imageExtensions: IMAGE_EXTENSIONS,
  videoExtensions: VIDEO_EXTENSIONS,
  language: "zh_CN"
});
const backgroundRenameRuntime = createRenameRuntime({
  isMedia: backgroundSortRuntime.isMedia
});
const renameBatchRuntime = createRenameBatchRuntime({
  sortRuntime: backgroundSortRuntime,
  renameRuntime: backgroundRenameRuntime
});

let pluginPath = initialPluginPath;
let cachePath = path.join(pluginPath, "photo-taken-cache.json");
let diagnosticPath = path.join(pluginPath, "diagnostic.log");
let renameBackupPath = path.join(pluginPath, "rename-batch-backup.json");
let cache = { version: CACHE_VERSION, libraryPath: null, items: {} };
let cacheSaveTimer = null;
let injectionReady = false;
let scanInProgress = null;
let monitorTimer = null;
let monitorInProgress = false;
let lastContextKey = "";
let startPromise = null;
let pluginCreatedAt = 0;
let startupWindowRequestHandled = false;
let renameBatchInProgress = null;
let lastRenameBatchId = "";
let geoTagService = null;
let geoPollTimer = null;
let geoPollInProgress = false;
let activeExceptionStatus = "no_gps";
let folderTagPreview = null;
let folderTagInProgress = false;
let folderTagScopeData = null;
let folderTagContextKey = "";
let folderTagRefreshTimer = null;
let folderTagInputTimer = null;
let folderTagRefreshRequest = 0;
let folderTagRefreshQueued = false;
let folderTagPendingContext = null;
let folderTagUiActive = false;
let currentGeoScanContextId = "";
let activeLocationTag = "";
let reviewEntries = [];
let reviewSelection = new Set();
let reviewSource = null;
let reviewBusy = false;
let reviewLoadToken = 0;
let reviewLastIndex = -1;

function setStatus(message) {
  const element = document.getElementById("status");
  if (element) {
    let displayMessage = String(message || "");
    if (displayMessage.startsWith("拍摄时间读取完成")) {
      displayMessage = displayMessage.split("；")[0];
    } else if (displayMessage.startsWith("菜单注入成功")) {
      displayMessage = "插件已连接";
    } else if (displayMessage.startsWith("菜单与排序自检通过")) {
      displayMessage = "插件运行正常";
    } else if (displayMessage.length > 42) {
      displayMessage = `${displayMessage.slice(0, 40)}…`;
    }
    element.textContent = displayMessage;
    element.title = String(message || "");
  }
  console.log(`[photo-taken-sort] ${message}`);
  fs.promises.appendFile(
    diagnosticPath,
    `${new Date().toISOString()} ${message}\n`,
    "utf8"
  ).catch(() => {});
}

async function readCache() {
  try {
    const raw = await fs.promises.readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.version === CACHE_VERSION && parsed.items) {
      cache = parsed;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("[photo-taken-sort] Unable to read cache:", error);
    }
  }
}

function scheduleCacheSave() {
  clearTimeout(cacheSaveTimer);
  cacheSaveTimer = setTimeout(async () => {
    const temporaryPath = `${cachePath}.tmp`;
    try {
      await fs.promises.writeFile(
        temporaryPath,
        JSON.stringify(cache),
        "utf8"
      );
      await fs.promises.rename(temporaryPath, cachePath);
    } catch (error) {
      console.warn("[photo-taken-sort] Unable to save cache:", error);
    }
  }, 500);
}

async function getTakenAt(item) {
  const extension = String(item.ext || "").toLowerCase();
  const mediaType = mediaTypeForExtension(extension);
  if (!mediaType) return null;

  let stat;
  try {
    stat = await fs.promises.stat(item.filePath);
  } catch {
    return null;
  }

  const signature = `${stat.size}:${Math.trunc(stat.mtimeMs)}`;
  const cached = cache.items[item.id];
  if (cached && cached.signature === signature) {
    return Number.isFinite(cached.takenAt) ? cached.takenAt : null;
  }

  let takenAt = null;
  try {
    takenAt = await readMediaTakenAt(item.filePath, extension);
  } catch (error) {
    console.warn(
      `[photo-taken-sort] ${mediaType} metadata read failed: ${item.filePath}`,
      error
    );
  }

  cache.items[item.id] = { signature, mediaType, takenAt };
  scheduleCacheSave();
  return takenAt;
}

async function mapWithConcurrency(items, concurrency, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    }
  );
  await Promise.all(runners);
  return results;
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function executeInMain(source) {
  if (!eagle.photoTakenSort || !eagle.photoTakenSort.execute) {
    throw new Error("Eagle photo taken sort bridge is not ready");
  }
  const result = await eagle.photoTakenSort.execute(
    `/* eagle-photo-taken-sort */\n${source}`
  );
  if (result && result.__error) {
    throw new Error(result.__error);
  }
  return result;
}

function injectionSource() {
  return `(() => {
    const SORT_KEY = ${JSON.stringify(SORT_KEY)};
    const API_VERSION = 33;
    const META_KEY = ${JSON.stringify(META_KEY)};
    const RULES_STORAGE_KEY = "eagle.photoTakenSort.rules.v2";
    const LEGACY_RULES_STORAGE_KEY = "eagle.photoTakenSort.rules.v1";
    const MANUAL_STORAGE_KEY = "eagle.photoTakenSort.manualEnabled";
    const LOCK_STORAGE_KEY = "eagle.photoTakenSort.folderLocks.v1";
    const META_STORAGE_KEY = "eagle.photoTakenSort.metaProfiles.v1";
    const RENAME_STORAGE_KEY = "eagle.photoTakenSort.autoRename.v1";
    const LABELS = {
      zh_CN: "多级拍摄时间排序",
      zh_TW: "多級拍攝時間排序",
      ja_JP: "多段階撮影日時",
      ko_KR: "다단계 촬영 시간",
      de_DE: "Mehrstufige Aufnahmezeit",
      es_ES: "Orden multinivel por captura",
      ru_RU: "Многоуровневая сортировка",
      en: "Multi-level Taken Time"
    };
    const UI_LABELS = {
      zh_CN: {
        title: "多级排序",
        edit: "编辑规则",
        applyTree: "应用到全部",
        applyTreeConfirm: "将当前多级排序规则一次性应用到 {count} 个文件夹？以后仍可单独修改任意子文件夹。",
        appliedTree: "已应用到 {count} 个文件夹",
        lockCurrent: "防止全局覆盖",
        lockedState: "已保护 {count} 个项目",
        unlockedState: "当前 {count} 个项目",
        lockSkipNotice: "，跳过 {count} 个已锁定文件夹",
        allFoldersLocked: "目标文件夹均已锁定，未做修改",
        applyMetaTree: "应用当前简介到本文件夹及全部子文件夹（{count}）",
        applyMetaTreeConfirm: "将“{type}”一次性应用到 {count} 个文件夹？以后仍可单独修改任意子文件夹。",
        appliedMetaTree: "已应用到 {count} 个文件夹",
        autoRename: "自动编号",
        previewRename: "预览当前文件夹",
        previewRenameEmpty: "当前文件夹无可重命名媒体",
        undoRename: "撤销上次重命名",
        renameIdle: "仅处理 1- / 2- 开头的媒体",
        renameTreeReady: "当前层无媒体；打开开关将下放到 {count} 个文件夹",
        renameReady: "人物 {people} · 环境 {environment} · 待改 {changes}",
        renameWaiting: "等待拍摄时间读取完成（{count}）",
        renameDone: "已按当前顺序重命名 {count} 个文件",
        renameUndone: "已撤销 {count} 个文件，并关闭自动重命名",
        renameTitle: "按当前顺序连续重命名",
        renameScene: "场景名：{scene}",
        renameSummary: "人物 {people} 个 · 环境 {environment} 个 · 忽略 {ignored} 个",
        renameWarning: "确认后将同时修改 Eagle 名称和实际文件名。自动模式开启后，拖动、删除或新增项目都会再次连续编号。",
        renamePending: "拍摄时间尚未读取完成，请稍后再试。",
        renameEmptyScene: "无法从当前文件夹名称提取场景名。",
        renameNoItems: "当前文件夹没有以 1- 或 2- 开头的图片或视频。",
        renameNoChanges: "当前名称已经连续，无需修改。",
        renameCancel: "取消",
        renameOnce: "重命名 {count} 个",
        renameEnable: "启用并重命名 {count} 个",
        renameEnableNoChanges: "启用自动重命名",
        applyRenameTree: "应用到全部",
        applyRenameTreeConfirm: "为当前文件夹及全部子文件夹开启自动编号，共 {count} 个文件夹？确认后会立即修改所有匹配媒体的 Eagle 名称和实际文件名。",
        renameTreeQueued: "已提交 {count} 个文件夹，正在后台处理",
        renameTreeRunning: "正在同步全部子文件夹…",
        renameTreePreparing: "正在读取文件夹 {current}/{total}",
        renameTreeMetadata: "正在读取拍摄时间 {current}/{total}",
        renameTreeSaving: "正在同步文件名 {current}/{total}（{percent}%）",
        renameTreeDone: "已同步 {folders} 个文件夹，重命名 {files} 个文件",
        renameTreePartial: "已处理 {folders} 个文件夹，成功 {files} 个，失败 {failed} 个",
        manual: "临时拖动",
        idle: "尚未手动调整",
        moved: "已临时调整 {count} 次",
        undo: "撤销上次拖动",
        reset: "恢复规则顺序",
        modalTitle: "多级排序规则",
        preset: "应用 1-/2- 分组预设",
        add: "添加一级",
        done: "完成",
        restore: "恢复默认",
        asc: "升序",
        desc: "降序",
        moveUp: "提高优先级",
        moveDown: "降低优先级",
        remove: "删除此级",
        groupDirectionLocked: "1- 分组始终排在 2- 分组之前",
        NAME_GROUP: "文件名前缀（1-/2- 分组）",
        NAME: "完整文件名",
        TAKEN_AT: "拍摄时间",
        MEDIA_KIND: "媒体类型（图片/视频/其他）",
        EXT: "文件扩展名",
        IMPORT: "添加日期",
        MTIME: "修改日期",
        BTIME: "创建日期",
        FILESIZE: "文件大小",
        RESOLUTION: "分辨率",
        RATING: "星级",
        DURATION: "时长",
        metaTaken: "相机拍摄时间",
        metaTags: "标签"
      },
      zh_TW: {
        title: "多級排序",
        edit: "編輯規則",
        applyTree: "套用到全部",
        applyTreeConfirm: "將目前多級排序規則一次性套用到 {count} 個資料夾？之後仍可單獨修改任意子資料夾。",
        appliedTree: "已套用到 {count} 個資料夾",
        lockCurrent: "防止全域覆蓋",
        lockedState: "已保護 {count} 個項目",
        unlockedState: "目前 {count} 個項目",
        lockSkipNotice: "，略過 {count} 個已鎖定資料夾",
        allFoldersLocked: "目標資料夾均已鎖定，未做修改",
        applyMetaTree: "套用目前簡介到本資料夾及全部子資料夾（{count}）",
        applyMetaTreeConfirm: "將「{type}」一次性套用到 {count} 個資料夾？之後仍可單獨修改任意子資料夾。",
        appliedMetaTree: "已套用到 {count} 個資料夾",
        autoRename: "自動編號",
        previewRename: "預覽目前資料夾",
        previewRenameEmpty: "目前資料夾無可重新命名媒體",
        undoRename: "復原上次重新命名",
        renameIdle: "僅處理 1- / 2- 開頭的媒體",
        renameTreeReady: "目前層無媒體；開啟開關將下放到 {count} 個資料夾",
        renameReady: "人物 {people} · 環境 {environment} · 待改 {changes}",
        renameWaiting: "等待拍攝時間讀取完成（{count}）",
        renameDone: "已按目前順序重新命名 {count} 個檔案",
        renameUndone: "已復原 {count} 個檔案，並關閉自動重新命名",
        renameTitle: "按目前順序連續重新命名",
        renameScene: "場景名：{scene}",
        renameSummary: "人物 {people} 個 · 環境 {environment} 個 · 忽略 {ignored} 個",
        renameWarning: "確認後將同時修改 Eagle 名稱和實際檔名。自動模式開啟後，拖動、刪除或新增項目都會再次連續編號。",
        renamePending: "拍攝時間尚未讀取完成，請稍後再試。",
        renameEmptyScene: "無法從目前資料夾名稱提取場景名。",
        renameNoItems: "目前資料夾沒有以 1- 或 2- 開頭的圖片或影片。",
        renameNoChanges: "目前名稱已經連續，無需修改。",
        renameCancel: "取消",
        renameOnce: "重新命名 {count} 個",
        renameEnable: "啟用並重新命名 {count} 個",
        renameEnableNoChanges: "啟用自動重新命名",
        applyRenameTree: "套用到全部",
        applyRenameTreeConfirm: "為目前資料夾及全部子資料夾開啟自動編號，共 {count} 個資料夾？確認後會立即修改所有符合媒體的 Eagle 名稱和實際檔名。",
        renameTreeQueued: "已提交 {count} 個資料夾，正在背景處理",
        renameTreeRunning: "正在同步全部子資料夾…",
        renameTreePreparing: "正在讀取資料夾 {current}/{total}",
        renameTreeMetadata: "正在讀取拍攝時間 {current}/{total}",
        renameTreeSaving: "正在同步檔名 {current}/{total}（{percent}%）",
        renameTreeDone: "已同步 {folders} 個資料夾，重新命名 {files} 個檔案",
        renameTreePartial: "已處理 {folders} 個資料夾，成功 {files} 個，失敗 {failed} 個",
        manual: "臨時拖動",
        idle: "尚未手動調整",
        moved: "已臨時調整 {count} 次",
        undo: "復原上次拖動",
        reset: "恢復規則順序",
        modalTitle: "多級排序規則",
        preset: "套用 1-/2- 分組預設",
        add: "新增一級",
        done: "完成",
        restore: "恢復預設",
        asc: "升序",
        desc: "降序",
        moveUp: "提高優先級",
        moveDown: "降低優先級",
        remove: "刪除此級",
        groupDirectionLocked: "1- 分組始終排在 2- 分組之前",
        NAME_GROUP: "檔名前綴（1-/2- 分組）",
        NAME: "完整檔名",
        TAKEN_AT: "拍攝時間",
        MEDIA_KIND: "媒體類型（圖片/影片/其他）",
        EXT: "副檔名",
        IMPORT: "加入日期",
        MTIME: "修改日期",
        BTIME: "建立日期",
        FILESIZE: "檔案大小",
        RESOLUTION: "解析度",
        RATING: "星級",
        DURATION: "時長",
        metaTaken: "相機拍攝時間",
        metaTags: "標籤"
      },
      en: {
        title: "Multi-level sort",
        edit: "Edit rules",
        applyTree: "Apply to all",
        applyTreeConfirm: "Apply the current rules once to {count} folders? Any descendant can still be changed independently later.",
        appliedTree: "Applied to {count} folders",
        lockCurrent: "Protect from global changes",
        lockedState: "Protected {count} items",
        unlockedState: "{count} current items",
        lockSkipNotice: ", skipped {count} locked folders",
        allFoldersLocked: "All target folders are locked; nothing changed",
        applyMetaTree: "Apply current info to this folder and descendants ({count})",
        applyMetaTreeConfirm: "Apply “{type}” once to {count} folders? Any descendant can still be changed independently later.",
        appliedMetaTree: "Applied to {count} folders",
        autoRename: "Automatic numbering",
        previewRename: "Preview current folder",
        previewRenameEmpty: "No matching media in current folder",
        undoRename: "Undo last rename",
        renameIdle: "Only 1- / 2- media files are included",
        renameTreeReady: "No media at this level; enabling applies to {count} folders",
        renameReady: "People {people} · Environment {environment} · Changes {changes}",
        renameWaiting: "Waiting for taken time ({count})",
        renameDone: "Renamed {count} files in the current order",
        renameUndone: "Restored {count} files and disabled automatic rename",
        renameTitle: "Continuous rename in current order",
        renameScene: "Scene: {scene}",
        renameSummary: "People {people} · Environment {environment} · Ignored {ignored}",
        renameWarning: "This changes both Eagle names and the actual filenames. While automatic mode is enabled, dragging, deleting, or importing items will renumber again.",
        renamePending: "Taken time is still loading. Try again shortly.",
        renameEmptyScene: "A scene name could not be derived from this folder name.",
        renameNoItems: "This folder has no image or video beginning with 1- or 2-.",
        renameNoChanges: "Names are already continuous.",
        renameCancel: "Cancel",
        renameOnce: "Rename {count}",
        renameEnable: "Enable and rename {count}",
        renameEnableNoChanges: "Enable automatic rename",
        applyRenameTree: "Apply to all",
        applyRenameTreeConfirm: "Enable automatic numbering for this folder and all descendants ({count} folders)? This immediately changes matching Eagle names and actual filenames.",
        renameTreeQueued: "Queued {count} folders for background processing",
        renameTreeRunning: "Synchronizing all descendant folders…",
        renameTreePreparing: "Reading folders {current}/{total}",
        renameTreeMetadata: "Reading taken time {current}/{total}",
        renameTreeSaving: "Synchronizing names {current}/{total} ({percent}%)",
        renameTreeDone: "Synchronized {folders} folders and renamed {files} files",
        renameTreePartial: "Processed {folders} folders: {files} succeeded, {failed} failed",
        manual: "Temporary drag",
        idle: "No temporary changes",
        moved: "{count} temporary moves",
        undo: "Undo last drag",
        reset: "Restore rule order",
        modalTitle: "Multi-level sort rules",
        preset: "Apply 1-/2- group preset",
        add: "Add level",
        done: "Done",
        restore: "Restore defaults",
        asc: "Ascending",
        desc: "Descending",
        moveUp: "Raise priority",
        moveDown: "Lower priority",
        remove: "Remove level",
        groupDirectionLocked: "The 1- group always stays before the 2- group",
        NAME_GROUP: "Filename prefix (1-/2- group)",
        NAME: "Full filename",
        TAKEN_AT: "Taken time",
        MEDIA_KIND: "Media kind",
        EXT: "File extension",
        IMPORT: "Date added",
        MTIME: "Date modified",
        BTIME: "Date created",
        FILESIZE: "File size",
        RESOLUTION: "Resolution",
        RATING: "Rating",
        DURATION: "Duration",
        metaTaken: "Camera capture time",
        metaTags: "Tags"
      }
    };
    const RULE_FIELDS = [
      "NAME_GROUP",
      "NAME",
      "TAKEN_AT",
      "MEDIA_KIND",
      "EXT",
      "IMPORT",
      "MTIME",
      "BTIME",
      "FILESIZE",
      "RESOLUTION",
      "RATING",
      "DURATION"
    ];
    const META_TYPES = new Set([
      "RESOLUTION",
      "FILESIZE",
      "TAGS",
      "RATING",
      "MTIME",
      "BTIME",
      META_KEY
    ]);
    const language = window.preferences?.general?.language || "en";
    const ui = UI_LABELS[language] || UI_LABELS.en;

    const bodyScope = window.angular && window.angular.element(document.body).scope();
    if (!bodyScope) return { ok: false, reason: "Angular body scope not ready" };

    const previousApi = window.__eaglePhotoTakenSort;
    if (previousApi && previousApi.version !== API_VERSION) {
      clearInterval(previousApi.menuTimer);
      clearTimeout(previousApi.rename?.timer);
      clearTimeout(previousApi.lockRecoveryTimer);
      clearTimeout(previousApi.protectedOrderCaptureTimer);
      clearTimeout(previousApi.dragCleanupTimer);
      for (const timer of previousApi.dragPostCleanupTimers || []) {
        clearTimeout(timer);
      }
      for (const method of [
        "sortData",
        "sortRawData",
        "changeOrderBy",
        "changeSortIncrease"
      ]) {
        if (previousApi.original && previousApi.original[method]) {
          bodyScope[method] = previousApi.original[method];
        }
      }
      if (previousApi.original && previousApi.original.onDropBoxItem) {
        window.onDropBoxItem = previousApi.original.onDropBoxItem;
      }
      if (previousApi.handlers) {
        for (const [eventName, handler] of Object.entries(
          previousApi.handlers
        )) {
          document.removeEventListener(eventName, handler, true);
        }
      }
      if (previousApi.windowHandlers) {
        for (const [eventName, handler] of Object.entries(
          previousApi.windowHandlers
        )) {
          window.removeEventListener(eventName, handler, true);
        }
      }
      document.body.classList.remove(
        "eagle-photo-sort-active",
        "eagle-photo-sort-dragging"
      );
      document.querySelectorAll(".eagle-photo-sort-folder-locked").forEach(
        (element) => element.classList.remove(
          "eagle-photo-sort-folder-locked"
        )
      );
      document.querySelectorAll(".eagle-photo-taken-settings").forEach(
        (element) => element.remove()
      );
      document.querySelectorAll(".eagle-photo-sort-modal").forEach(
        (element) => element.remove()
      );
      document.querySelectorAll(".eagle-photo-meta-tree-settings").forEach(
        (element) => element.remove()
      );
      document.querySelectorAll(".eagle-photo-rename-modal").forEach(
        (element) => element.remove()
      );
      document.querySelectorAll(".eagle-photo-taken-meta-value").forEach(
        (element) => element.remove()
      );
      document.querySelectorAll(
        '#layout-panel option[data-eagle-photo-taken-meta="true"]'
      ).forEach((element) => element.remove());
      document.getElementById("eagle-photo-sort-style")?.remove();
    }

    const api =
      previousApi && previousApi.version === API_VERSION
        ? previousApi
        : {
      timestamps: Object.create(null),
      original: {},
      version: API_VERSION
    };
    window.__eaglePhotoTakenSort = api;
    api.bodyScope = bodyScope;

    ${createMediaSortRuntime.toString()}
    const sortRuntime = createMediaSortRuntime({
      imageExtensions: ${JSON.stringify(IMAGE_EXTENSIONS)},
      videoExtensions: ${JSON.stringify(VIDEO_EXTENSIONS)},
      language
    });
    ${createRenameRuntime.toString()}
    const renameRuntime = createRenameRuntime({
      isMedia: sortRuntime.isMedia
    });

    function readLegacyRules() {
      try {
        return sortRuntime.normalizeRules(
          JSON.parse(localStorage.getItem(LEGACY_RULES_STORAGE_KEY))
        );
      } catch {
        return sortRuntime.normalizeRules(null);
      }
    }

    function readRulesStore() {
      try {
        const parsed = JSON.parse(localStorage.getItem(RULES_STORAGE_KEY));
        if (parsed && parsed.version === 2 && parsed.libraries) {
          parsed.defaultRules = sortRuntime.defaultRules.map((rule) => ({ ...rule }));
          return parsed;
        }
      } catch {}
      return {
        version: 2,
        defaultRules: readLegacyRules(),
        libraries: {}
      };
    }

    api.rulesStore = readRulesStore();
    api.rules = api.rulesStore.defaultRules.map((rule) => ({ ...rule }));
    api.rulesContextId = "";
    api.batchMessage = "";
    api.manual = api.manual || {
      contextId: "",
      order: [],
      history: [],
      moves: 0
    };

    function readLockStore() {
      try {
        const parsed = JSON.parse(localStorage.getItem(LOCK_STORAGE_KEY));
        if (parsed && parsed.version === 1 && parsed.libraries) return parsed;
      } catch {}
      return { version: 1, libraries: {} };
    }

    api.lockStore = readLockStore();

    function lockLibrary(create = true) {
      const libraryId = String(bodyScope.rootDir || "default");
      let library = api.lockStore.libraries[libraryId];
      if (!library && create) {
        library = { folders: {} };
        api.lockStore.libraries[libraryId] = library;
      }
      if (library && create) library.folders = library.folders || {};
      return library || { folders: {} };
    }

    function folderLockProfile(folderOrId = bodyScope.currentFolder) {
      const folderId = typeof folderOrId === "string"
        ? folderOrId
        : folderOrId?.id;
      if (!folderId) return null;
      return lockLibrary(false).folders?.[folderId] || null;
    }

    function folderLocked(folderOrId = bodyScope.currentFolder) {
      return !!folderLockProfile(folderOrId);
    }

    function persistLockStore() {
      localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(api.lockStore));
    }

    function updateCurrentProtectedOrder(order) {
      const profile = folderLockProfile();
      if (!profile || !Array.isArray(order)) return false;
      profile.order = order.map((id) => String(id));
      profile.rules = api.rules.map((rule) => ({ ...rule }));
      profile.sortIncrease = currentIncrease();
      profile.updatedAt = Date.now();
      persistLockStore();
      renderFolderLockMarkers();
      return true;
    }

    function scheduleProtectedOrderCapture(delay = 320) {
      clearTimeout(api.protectedOrderCaptureTimer);
      const folderId = String(bodyScope.currentFolder?.id || "");
      if (!folderId || !folderLocked(folderId)) return;
      api.protectedOrderCaptureTimer = setTimeout(() => {
        api.protectedOrderCaptureTimer = null;
        if (String(bodyScope.currentFolder?.id || "") !== folderId) return;
        const order = currentOrderSnapshot();
        if (!order.length) return;
        updateCurrentProtectedOrder(order);
        renderSettings();
        bodyScope.$evalAsync();
      }, delay);
    }

    function prepareProtectedLocalSort() {
      const profile = folderLockProfile();
      if (!profile) return false;
      profile.order = [];
      profile.rules = api.rules.map((rule) => ({ ...rule }));
      profile.sortIncrease = currentIncrease();
      profile.updatedAt = Date.now();
      persistLockStore();
      resetManualState();
      return true;
    }

    function folderIdFromSidebarItem(element) {
      const id = String(element?.id || "");
      return id.startsWith("folder-") ? id.slice(7) : "";
    }

    function renderFolderLockMarkers() {
      const lockedFolders = lockLibrary(false).folders || {};
      let visibleFolders = 0;
      let markedFolders = 0;
      document.querySelectorAll(
        "#sidebar-item-container .sidebar-folder-item[id^='folder-']"
      ).forEach((element) => {
        const folderId = folderIdFromSidebarItem(element);
        const locked = !!lockedFolders[folderId];
        element.classList.toggle(
          "eagle-photo-sort-folder-locked",
          locked
        );
        visibleFolders += 1;
        if (locked) markedFolders += 1;
      });
      return { visibleFolders, markedFolders };
    }

    function unlockedFolders(folders) {
      return (Array.isArray(folders) ? folders : []).filter(
        (folder) => !folderLocked(folder)
      );
    }

    function lockSkipMessage(count) {
      return count > 0
        ? ui.lockSkipNotice.replace("{count}", String(count))
        : "";
    }

    function setCurrentFolderLocked(locked, preferredOrder = []) {
      const folder = bodyScope.currentFolder;
      if (!folder?.id) return false;
      const library = lockLibrary(true);
      const releasedOrder = !locked
        ? folderLockProfile(folder)?.order?.slice() || []
        : [];
      if (locked) {
        syncManualContext();
        let order = Array.isArray(preferredOrder) && preferredOrder.length
          ? preferredOrder.slice()
          : currentOrderSnapshot();
        if (
          order.length === 0 &&
          api.lastUnlockedOrder?.contextId === currentContextId()
        ) {
          order = api.lastUnlockedOrder.order.slice();
        }
        library.folders[folder.id] = {
          order,
          rules: api.rules.map((rule) => ({ ...rule })),
          sortIncrease: currentIncrease(),
          lockedAt: Date.now()
        };
        folder.orderBy = SORT_KEY;
        bodyScope.currentOrderBy = SORT_KEY;
        saveCurrentContainer();
      } else {
        delete library.folders[folder.id];
      }
      persistLockStore();
      renderFolderLockMarkers();
      resetManualState();
      if (!locked && releasedOrder.length) {
        api.manual.contextId = currentContextId();
        api.manual.order = releasedOrder;
      }
      api.batchMessage = "";
      if (locked && library.folders[folder.id]?.order?.length === 0) {
        scheduleCurrentLockRecovery();
      }
      renderSettings();
      api.refresh?.();
      bodyScope.$evalAsync();
      return locked;
    }

    function scheduleCurrentLockRecovery() {
      if (api.lockRecoveryTimer) return;
      const folderId = String(bodyScope.currentFolder?.id || "");
      if (!folderId) return;
      api.lockRecoveryTimer = setTimeout(() => {
        api.lockRecoveryTimer = null;
        if (String(bodyScope.currentFolder?.id || "") !== folderId) return;
        const profile = folderLockProfile(folderId);
        if (!profile || profile.order?.length) return;
        const order = currentOrderSnapshot();
        if (order.length === 0) return;
        profile.order = order;
        persistLockStore();
        renderSettings();
        api.refresh?.();
        bodyScope.$evalAsync();
      }, 180);
    }

    function normalizeMetaType(type) {
      return META_TYPES.has(type) ? type : "RESOLUTION";
    }

    function readMetaStore() {
      try {
        const parsed = JSON.parse(localStorage.getItem(META_STORAGE_KEY));
        if (parsed && parsed.version === 1 && parsed.libraries) {
          parsed.defaultType = normalizeMetaType(parsed.defaultType);
          return parsed;
        }
      } catch {}
      return {
        version: 1,
        defaultType: normalizeMetaType(
          bodyScope.listMetaType || localStorage.getItem("eagle.list.meta.type")
        ),
        libraries: {}
      };
    }

    api.metaStore = readMetaStore();
    api.metaContextId = "";
    api.metaBatchMessage = "";

    function readRenameStore() {
      try {
        const parsed = JSON.parse(localStorage.getItem(RENAME_STORAGE_KEY));
        if (parsed && parsed.version === 1 && parsed.libraries) return parsed;
      } catch {}
      return { version: 1, libraries: {} };
    }

    api.renameStore = readRenameStore();
    api.rename = {
      contextId: "",
      lastSignature: "",
      lastTransaction: [],
      message: "",
      running: false,
      timer: null,
      batchRequest: null,
      batchId: "",
      batchStatus: null
    };

    function currentOrder() {
      if (bodyScope.currentFolder) return bodyScope.currentFolder.orderBy || "";
      if (bodyScope.currentSmartFolder) {
        return bodyScope.currentSmartFolder.orderBy || "";
      }
      return bodyScope.orderBy || "";
    }

    function currentIncrease() {
      if (bodyScope.currentFolder && bodyScope.currentFolder.orderBy) {
        return bodyScope.currentFolder.sortIncrease !== false;
      }
      if (bodyScope.currentSmartFolder && bodyScope.currentSmartFolder.orderBy) {
        return bodyScope.currentSmartFolder.sortIncrease !== false;
      }
      return bodyScope.sortIncrease !== false;
    }

    function currentFolderId() {
      return bodyScope.currentFolder?.id || "";
    }

    function currentContextId() {
      return (
        bodyScope.currentFolder?.id ||
        bodyScope.currentSmartFolder?.id ||
        bodyScope.rootDir ||
        "global"
      );
    }

    function renameLibrary(create = true) {
      const libraryId = String(bodyScope.rootDir || "default");
      let library = api.renameStore.libraries[libraryId];
      if (!library && create) {
        library = { folders: {} };
        api.renameStore.libraries[libraryId] = library;
      }
      if (library && create) library.folders = library.folders || {};
      return library || { folders: {} };
    }

    function renameEnabled() {
      const folderId = bodyScope.currentFolder?.id;
      if (!folderId) return false;
      return renameLibrary(false).folders?.[folderId] === true;
    }

    function setRenameEnabled(enabled) {
      const folderId = bodyScope.currentFolder?.id;
      if (!folderId) return false;
      const library = renameLibrary(true);
      if (enabled) library.folders[folderId] = true;
      else delete library.folders[folderId];
      localStorage.setItem(RENAME_STORAGE_KEY, JSON.stringify(api.renameStore));
      api.rename.lastSignature = "";
      if (!enabled) {
        clearTimeout(api.rename.timer);
        api.rename.timer = null;
      }
      renderSettings();
      return enabled;
    }

    function setRenameTreeEnabled(folders, enabled) {
      const library = renameLibrary(true);
      for (const folder of folders) {
        if (!folder?.id) continue;
        if (enabled) library.folders[folder.id] = true;
        else delete library.folders[folder.id];
      }
      localStorage.setItem(RENAME_STORAGE_KEY, JSON.stringify(api.renameStore));
      api.rename.lastSignature = "";
    }

    function syncRenameContext() {
      const contextId = currentContextId();
      if (api.rename.contextId === contextId) return false;
      clearTimeout(api.rename.timer);
      api.rename.timer = null;
      api.rename.contextId = contextId;
      api.rename.lastSignature = "";
      api.rename.lastTransaction = [];
      const batchRunning =
        api.rename.batchStatus?.state === "queued" ||
        api.rename.batchStatus?.state === "running";
      api.rename.message = batchRunning
        ? api.rename.batchStatus.message
        : "";
      api.rename.running = batchRunning;
      return true;
    }

    function metaLibrary(create = true) {
      const libraryId = String(bodyScope.rootDir || "default");
      let library = api.metaStore.libraries[libraryId];
      if (!library && create) {
        library = { folders: {}, smartFolders: {} };
        api.metaStore.libraries[libraryId] = library;
      }
      if (library && create) {
        library.folders = library.folders || {};
        library.smartFolders = library.smartFolders || {};
      }
      return library || { folders: {}, smartFolders: {} };
    }

    function currentMetaContextId() {
      const libraryId = String(bodyScope.rootDir || "default") + "|meta:";
      if (bodyScope.currentFolder) {
        return libraryId + "folder:" + bodyScope.currentFolder.id;
      }
      if (bodyScope.currentSmartFolder) {
        return libraryId + "smart:" + bodyScope.currentSmartFolder.id;
      }
      return libraryId + "global";
    }

    function metaTypeForCurrentContext() {
      const library = metaLibrary(false);
      let stored;
      if (bodyScope.currentFolder) {
        stored = library.folders?.[bodyScope.currentFolder.id];
      } else if (bodyScope.currentSmartFolder) {
        stored = library.smartFolders?.[bodyScope.currentSmartFolder.id];
      }
      return normalizeMetaType(stored || api.metaStore.defaultType);
    }

    function persistMetaStore() {
      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(api.metaStore));
    }

    function writeCurrentMetaType(type) {
      const normalized = normalizeMetaType(type);
      const library = metaLibrary(true);
      if (bodyScope.currentFolder) {
        library.folders[bodyScope.currentFolder.id] = normalized;
      } else if (bodyScope.currentSmartFolder) {
        library.smartFolders[bodyScope.currentSmartFolder.id] = normalized;
      } else {
        api.metaStore.defaultType = normalized;
      }
      persistMetaStore();
      return normalized;
    }

    function writeFolderMetaTypes(folders, type) {
      const normalized = normalizeMetaType(type);
      const library = metaLibrary(true);
      for (const folder of folders) {
        library.folders[folder.id] = normalized;
      }
      persistMetaStore();
      return normalized;
    }

    function syncMetaContext(force = false) {
      const contextId = currentMetaContextId();
      if (!force && api.metaContextId === contextId) return false;
      api.metaContextId = contextId;
      api.metaBatchMessage = "";
      setMetaType(metaTypeForCurrentContext(), { saveProfile: false });
      return true;
    }

    function libraryRules(create = true) {
      const libraryId = String(bodyScope.rootDir || "default");
      let library = api.rulesStore.libraries[libraryId];
      if (!library && create) {
        library = { folders: {}, smartFolders: {}, global: null };
        api.rulesStore.libraries[libraryId] = library;
      }
      if (library && create) {
        library.folders = library.folders || {};
        library.smartFolders = library.smartFolders || {};
        if (!("global" in library)) library.global = null;
      }
      return library || { folders: {}, smartFolders: {}, global: null };
    }

    function currentRulesContextId() {
      const libraryId = String(bodyScope.rootDir || "default") + "|";
      if (bodyScope.currentFolder) {
        return libraryId + "folder:" + bodyScope.currentFolder.id;
      }
      if (bodyScope.currentSmartFolder) {
        return libraryId + "smart:" + bodyScope.currentSmartFolder.id;
      }
      return libraryId + "global";
    }

    function rulesForCurrentContext() {
      const library = libraryRules(false);
      let stored;
      if (bodyScope.currentFolder) {
        stored = library.folders?.[bodyScope.currentFolder.id];
      } else if (bodyScope.currentSmartFolder) {
        stored = library.smartFolders?.[bodyScope.currentSmartFolder.id];
      } else {
        stored = library.global;
      }
      return sortRuntime.normalizeRules(
        stored || api.rulesStore.defaultRules
      );
    }

    function rulesForFolder(folder) {
      const library = libraryRules(false);
      return sortRuntime.normalizeRules(
        library.folders?.[folder?.id] || api.rulesStore.defaultRules
      );
    }

    function persistRulesStore() {
      localStorage.setItem(
        RULES_STORAGE_KEY,
        JSON.stringify(api.rulesStore)
      );
    }

    function writeCurrentRules(rules) {
      const normalized = sortRuntime.normalizeRules(rules);
      const library = libraryRules(true);
      if (bodyScope.currentFolder) {
        library.folders[bodyScope.currentFolder.id] = normalized;
      } else if (bodyScope.currentSmartFolder) {
        library.smartFolders[bodyScope.currentSmartFolder.id] = normalized;
      } else {
        library.global = normalized;
      }
      persistRulesStore();
      return normalized.map((rule) => ({ ...rule }));
    }

    function writeFolderRules(folders, rules) {
      const library = libraryRules(true);
      const normalized = sortRuntime.normalizeRules(rules);
      for (const folder of folders) {
        library.folders[folder.id] = normalized.map((rule) => ({ ...rule }));
      }
      persistRulesStore();
    }

    function syncRulesContext(force = false) {
      const contextId = currentRulesContextId();
      if (force || api.rulesContextId !== contextId) {
        api.rulesContextId = contextId;
        api.rules = rulesForCurrentContext();
        api.batchMessage = "";
      }
      return contextId;
    }

    function manualEnabled() {
      return localStorage.getItem(MANUAL_STORAGE_KEY) !== "false";
    }

    function resetManualState() {
      api.manual.order = [];
      api.manual.history = [];
      api.manual.moves = 0;
    }

    function syncManualContext() {
      const contextId = currentContextId();
      if (api.manual.contextId !== contextId) {
        api.manual.contextId = contextId;
        resetManualState();
      }
      syncRulesContext();
      return contextId;
    }

    function activeManualOrder() {
      syncManualContext();
      const lockedOrder = folderLockProfile()?.order;
      if (Array.isArray(lockedOrder)) return lockedOrder;
      if (
        currentOrder() !== SORT_KEY ||
        !manualEnabled() ||
        !bodyScope.currentFolder
      ) {
        return [];
      }
      return api.manual.order;
    }

    function sortConfig() {
      return {
        timestamps: api.timestamps,
        rules: api.rules,
        folderId: currentFolderId(),
        manualOrder: activeManualOrder()
      };
    }

    function saveRules(nextRules, refresh = true) {
      api.rules = writeCurrentRules(nextRules);
      api.batchMessage = "";
      resetManualState();
      const protectedFolder = prepareProtectedLocalSort();
      api.renderSettings?.();
      api.renderRuleRows?.();
      if (refresh) api.refresh?.();
      if (protectedFolder) scheduleProtectedOrderCapture();
      return api.rules;
    }

    function currentFolderTree() {
      return bodyScope.currentFolder
        ? sortRuntime.collectFolderTree(bodyScope.currentFolder)
        : [];
    }

    function applyRulesToCurrentTree() {
      const allFolders = currentFolderTree();
      const folders = unlockedFolders(allFolders);
      const lockedCount = allFolders.length - folders.length;
      if (allFolders.length === 0) return 0;
      if (folders.length === 0) {
        api.batchMessage = ui.allFoldersLocked;
        api.renderSettings?.();
        return 0;
      }
      const message = ui.applyTreeConfirm.replace(
        "{count}",
        String(folders.length)
      ) + lockSkipMessage(lockedCount);
      if (allFolders.length > 1 && !window.confirm(message)) return 0;

      const increase = currentIncrease();
      writeFolderRules(folders, api.rules);
      for (const folder of folders) {
        folder.orderBy = SORT_KEY;
        folder.sortIncrease = increase;
      }
      bodyScope.saveFolder();
      if (!folderLocked(bodyScope.currentFolder)) {
        bodyScope.currentOrderBy = SORT_KEY;
        bodyScope.currentSortIncrease = increase;
        resetManualState();
      }
      api.batchMessage = ui.appliedTree.replace(
        "{count}",
        String(folders.length)
      ) + lockSkipMessage(lockedCount);
      api.renderSettings?.();
      api.refresh?.();
      bodyScope.$evalAsync();
      return folders.length;
    }

    function applyRenameToCurrentTree() {
      const allFolders = currentFolderTree();
      const folders = unlockedFolders(allFolders);
      const lockedCount = allFolders.length - folders.length;
      if (allFolders.length === 0 || api.rename.running) return 0;
      if (folders.length === 0) {
        api.rename.batchStatus = {
          state: "done",
          message: ui.allFoldersLocked
        };
        renderSettings();
        return 0;
      }
      const message = ui.applyRenameTreeConfirm.replace(
        "{count}",
        String(folders.length)
      ) + lockSkipMessage(lockedCount);
      if (!window.confirm(message)) return 0;

      setRenameTreeEnabled(folders, true);

      const id = Date.now().toString(36) + "-" +
        Math.random().toString(36).slice(2, 9);
      api.rename.batchId = id;
      api.rename.batchRequest = {
        id,
        folders: folders.map((folder) => ({
          id: String(folder.id),
          name: String(folder.name || ""),
          rules: rulesForFolder(folder),
          manualOrder:
            folder.id === bodyScope.currentFolder?.id
              ? api.manual.order.slice()
              : []
        }))
      };
      api.rename.batchStatus = {
        state: "queued",
        message: ui.renameTreeQueued.replace(
          "{count}",
          String(folders.length)
        ) + lockSkipMessage(lockedCount)
      };
      api.rename.running = true;
      api.rename.message = api.rename.batchStatus.message;
      renderSettings();
      bodyScope.$evalAsync();
      return folders.length;
    }

    function claimRenameBatch(id) {
      if (!api.rename.batchRequest || api.rename.batchRequest.id !== id) {
        return null;
      }
      const request = api.rename.batchRequest;
      api.rename.batchRequest = null;
      api.rename.batchStatus = {
        state: "running",
        message: ui.renameTreeRunning
      };
      api.rename.message = ui.renameTreeRunning;
      renderSettings();
      return request;
    }

    function updateRenameBatchProgress(id, progress) {
      if (api.rename.batchId !== id || !progress) return false;
      const current = Math.max(0, Number(progress.current) || 0);
      const total = Math.max(0, Number(progress.total) || 0);
      const percent = total > 0
        ? Math.min(100, Math.round(current / total * 100))
        : 0;
      const template = progress.stage === "folders"
        ? ui.renameTreePreparing
        : progress.stage === "metadata"
          ? ui.renameTreeMetadata
          : ui.renameTreeSaving;
      const message = template
        .replace("{current}", String(current))
        .replace("{total}", String(total))
        .replace("{percent}", String(percent));
      api.rename.batchStatus = {
        state: "running",
        message,
        progress: { ...progress, current, total, percent }
      };
      api.rename.message = message;
      api.rename.running = true;
      renderSettings();
      return true;
    }

    function completeRenameBatch(id, result) {
      if (api.rename.batchId !== id) return false;
      const failed = Number(result?.failed || 0);
      const template = failed ? ui.renameTreePartial : ui.renameTreeDone;
      const message = template
        .replace("{folders}", String(result?.folders || 0))
        .replace("{files}", String(result?.renamed || 0))
        .replace("{failed}", String(failed));
      api.rename.batchStatus = {
        state: failed ? "partial" : "done",
        message,
        result
      };
      api.rename.message = message;
      api.rename.running = false;
      api.rename.lastSignature = "";
      api.refresh?.();
      renderSettings();
      return true;
    }

    function currentMetaLabel() {
      const select = document.querySelector(
        '#layout-panel select[ng-model*="listMetaType"]'
      );
      const selected = select && select.options[select.selectedIndex];
      if (selected?.textContent) return selected.textContent.trim();
      if (bodyScope.listMetaType === META_KEY) return ui.metaTaken;
      return bodyScope.listMetaType || ui.RESOLUTION;
    }

    function applyMetaToCurrentTree() {
      const folders = currentFolderTree();
      if (folders.length === 0) return 0;
      const type = normalizeMetaType(bodyScope.listMetaType);
      const message = ui.applyMetaTreeConfirm
        .replace("{type}", currentMetaLabel())
        .replace("{count}", String(folders.length));
      if (folders.length > 1 && !window.confirm(message)) return 0;

      writeFolderMetaTypes(folders, type);
      api.metaBatchMessage = ui.appliedMetaTree.replace(
        "{count}",
        String(folders.length)
      );
      renderMetaTreeSettings();
      return folders.length;
    }

    function saveCurrentContainer() {
      if (bodyScope.currentFolder || bodyScope.currentSmartFolder) {
        bodyScope.saveFolder();
      }
    }

    function activatePhotoSort() {
      const resetProtectedOrder = folderLocked() && currentOrder() !== SORT_KEY;
      if (bodyScope.currentFolder) {
        bodyScope.currentFolder.orderBy = SORT_KEY;
        if (bodyScope.currentFolder.sortIncrease === undefined) {
          bodyScope.currentFolder.sortIncrease = true;
        }
        saveCurrentContainer();
      } else if (bodyScope.currentSmartFolder) {
        bodyScope.currentSmartFolder.orderBy = SORT_KEY;
        if (bodyScope.currentSmartFolder.sortIncrease === undefined) {
          bodyScope.currentSmartFolder.sortIncrease = true;
        }
        saveCurrentContainer();
      } else {
        bodyScope.orderBy = SORT_KEY;
        localStorage.setItem(
          "eagle.list.orderBy." + bodyScope.rootDir,
          SORT_KEY
        );
      }

      bodyScope.currentOrderBy = SORT_KEY;
      bodyScope.currentSortIncrease = currentIncrease();
      api.selectionVersion = (api.selectionVersion || 0) + 1;
      syncManualContext();
      if (resetProtectedOrder) prepareProtectedLocalSort();
      api.ensureMenu?.();
      api.refresh?.();
      if (resetProtectedOrder) scheduleProtectedOrderCapture();
      bodyScope.$evalAsync();
      return true;
    }

    function setCustomIncrease(increase) {
      const normalized = increase !== false;
      const previous = currentIncrease();
      if (bodyScope.currentFolder) {
        bodyScope.currentFolder.sortIncrease = normalized;
        saveCurrentContainer();
      } else if (bodyScope.currentSmartFolder) {
        bodyScope.currentSmartFolder.sortIncrease = normalized;
        saveCurrentContainer();
      } else {
        bodyScope.sortIncrease = normalized;
        localStorage.setItem("eagle.list.sortIncrease", normalized);
        localStorage.setItem(
          "eagle.list.sortIncrease." + bodyScope.rootDir,
          normalized
        );
      }
      bodyScope.currentSortIncrease = normalized;
      if (previous !== normalized) {
        saveRules(
          api.rules.map((rule) => ({
            field: rule.field,
            direction:
              rule.field === "NAME_GROUP"
                ? "asc"
                : rule.direction === "desc"
                  ? "asc"
                  : "desc"
          }))
        );
      } else {
        api.refresh?.();
      }
      bodyScope.$evalAsync();
      return normalized;
    }

    if (!api.original.sortData) {
      api.original.sortData = bodyScope.sortData;
      bodyScope.sortData = function(data, orderBy) {
        if (orderBy !== SORT_KEY) {
          return api.original.sortData.call(this, data, orderBy);
        }
        const desired = sortRuntime.sortDesired(data, sortConfig());
        // Eagle reverses folder and smart-folder results after sortData.
        return currentIncrease() ? desired : desired.reverse();
      };
    }

    if (!api.original.sortRawData) {
      api.original.sortRawData = bodyScope.sortRawData;
      bodyScope.sortRawData = function(orderBy) {
        if (orderBy !== SORT_KEY) {
          return api.original.sortRawData.call(this, orderBy);
        }
        this.raw = sortRuntime.sortDesired(this.raw, sortConfig());
        this.currentOrderBy = SORT_KEY;
        this.currentSortIncrease = currentIncrease();
        return this.raw;
      };
    }

    if (!api.original.changeOrderBy) {
      api.original.changeOrderBy = bodyScope.changeOrderBy;
      bodyScope.changeOrderBy = function(orderBy) {
        if (orderBy === SORT_KEY) return activatePhotoSort();
        return api.original.changeOrderBy.call(this, orderBy);
      };
    }

    if (!api.original.changeSortIncrease) {
      api.original.changeSortIncrease = bodyScope.changeSortIncrease;
      bodyScope.changeSortIncrease = function(increase) {
        if (currentOrder() === SORT_KEY) {
          return setCustomIncrease(increase);
        }
        return api.original.changeSortIncrease.call(this, increase);
      };
    }

    function ensureStyle() {
      if (document.getElementById("eagle-photo-sort-style")) return;
      const style = document.createElement("style");
      style.id = "eagle-photo-sort-style";
      style.textContent = [
        ".eagle-photo-taken-settings{display:flex;flex-direction:column;gap:0;margin:4px 0;padding:0 10px;border-radius:6px;background:var(--color-dark-5,rgba(128,128,128,.08));box-sizing:border-box}",
        ".eagle-photo-sort-section{display:flex;flex-direction:column;gap:8px;padding:10px 0;box-sizing:border-box}",
        ".eagle-photo-sort-section+.eagle-photo-sort-section{border-top:1px solid rgba(128,128,128,.22)}",
        "#layout-panel.eagle-photo-sort-panel{width:380px;max-width:calc(100vw - 24px)}",
        ".eagle-photo-sort-header{display:flex;align-items:center;justify-content:space-between;gap:12px}",
        ".eagle-photo-sort-title{font-weight:600;color:var(--color-text-primary)}",
        ".eagle-photo-sort-summary{display:flex;flex-wrap:wrap;gap:5px;font-size:11px;line-height:1.4}",
        ".eagle-photo-sort-summary span{display:inline-flex;max-width:100%;padding:3px 6px;border-radius:4px;background:rgba(128,128,128,.12);color:var(--color-text-secondary);box-sizing:border-box;white-space:normal}",
        ".eagle-photo-sort-lock{display:flex;align-items:center;gap:7px;min-height:30px;padding:5px 7px;border:1px solid rgba(128,128,128,.28);border-radius:5px;font-size:12px;box-sizing:border-box}",
        ".eagle-photo-sort-lock[data-locked='true']{border-color:var(--color-primary,#1473e6);background:rgba(20,115,230,.1);color:var(--color-primary,#1473e6);font-weight:600}",
        ".eagle-photo-sort-lock input{margin:0}",
        ".eagle-photo-sort-lock-state{margin-left:auto;font-size:11px;font-weight:400;opacity:.75}",
        "#sidebar-item-container .sidebar-folder-item.eagle-photo-sort-folder-locked .badge{color:#ff3b30!important;font-weight:600}",
        "#sidebar-item-container .sidebar-folder-item.eagle-photo-sort-folder-locked .badge::before{content:'';display:inline-block;width:6px;height:6px;margin-right:5px;border-radius:50%;background:#ff3b30;box-shadow:0 0 0 1px rgba(255,59,48,.18);vertical-align:1px}",
        ".eagle-photo-sort-tree-row{display:flex;align-items:center;gap:8px}",
        ".eagle-photo-sort-tree{min-height:28px;flex:1;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;padding:4px 9px;text-align:left}",
        ".eagle-photo-sort-tree-result{font-size:11px;color:var(--color-positive,var(--color-text-secondary));white-space:nowrap}",
        ".eagle-photo-sort-actions{display:flex;align-items:center;gap:6px;min-height:28px}",
        ".eagle-photo-sort-actions button,.eagle-photo-sort-edit{height:28px;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;padding:0 9px}",
        ".eagle-photo-sort-actions button:disabled,.eagle-photo-sort-edit:disabled{opacity:.35}",
        ".eagle-photo-sort-manual{display:flex;align-items:center;gap:7px;min-height:28px;font-size:13px;font-weight:600}",
        ".eagle-photo-sort-manual input{margin:0}",
        ".eagle-photo-sort-state{font-size:11px;opacity:.72;flex:1}",
        ".eagle-photo-sort-rename{display:flex;align-items:center;gap:7px;min-height:28px;font-size:13px;font-weight:600}",
        ".eagle-photo-sort-rename input{margin:0}",
        ".eagle-photo-rename-actions{display:flex;align-items:center;gap:6px;min-height:28px}",
        ".eagle-photo-rename-preview,.eagle-photo-rename-undo{height:28px;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;padding:0 9px}",
        ".eagle-photo-rename-undo:disabled{opacity:.35}",
        ".eagle-photo-rename-state{font-size:11px;opacity:.72;flex:1;min-width:0}",
        ".eagle-photo-rename-tree-row{display:flex;align-items:center;gap:8px}",
        ".eagle-photo-rename-tree{min-height:30px;flex:1;border:1px solid var(--color-primary,#1473e6);border-radius:5px;background:rgba(20,115,230,.1);color:var(--color-primary,#1473e6);font:inherit;font-weight:600;padding:4px 9px;text-align:left}",
        ".eagle-photo-rename-tree:disabled{opacity:.4}",
        ".eagle-photo-rename-tree-result{font-size:11px;color:var(--color-positive,var(--color-text-secondary));line-height:1.4}",
        ".eagle-photo-taken-meta-value{white-space:nowrap}",
        "#layout-panel .eagle-photo-taken-meta-active .select-content{min-width:150px}",
        ".eagle-photo-meta-tree-settings{display:flex;align-items:center;gap:8px;min-height:28px}",
        ".eagle-photo-meta-tree-apply{min-height:28px;flex:1;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;padding:4px 9px;text-align:left}",
        ".eagle-photo-meta-tree-result{font-size:11px;color:var(--color-positive,var(--color-text-secondary));white-space:nowrap}",
        "body.eagle-photo-sort-active:not(.eagle-photo-sort-dragging) .box-sortable-helper{display:none!important}",
        "body.eagle-photo-sort-dragging .box:not(.selected):not(.pinned) .box-sortable-helper{display:block!important}",
        ".eagle-photo-sort-modal{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.34);display:flex;align-items:center;justify-content:center}",
        ".eagle-photo-rename-modal{position:fixed;inset:0;z-index:2147483601;background:rgba(0,0,0,.34);display:flex;align-items:center;justify-content:center}",
        ".eagle-photo-rename-dialog{width:min(720px,calc(100vw - 40px));max-height:calc(100vh - 60px);display:flex;flex-direction:column;background:var(--color-bg,#fff);color:inherit;border:1px solid rgba(128,128,128,.28);border-radius:8px;box-shadow:0 18px 60px rgba(0,0,0,.28);padding:18px;box-sizing:border-box}",
        ".eagle-photo-rename-head,.eagle-photo-rename-foot{display:flex;align-items:center;justify-content:space-between;gap:8px}",
        ".eagle-photo-rename-head h2{font-size:17px;margin:0}",
        ".eagle-photo-rename-summary{margin:10px 0 6px;font-size:12px;line-height:1.5}",
        ".eagle-photo-rename-warning{margin:0 0 10px;font-size:11px;line-height:1.5;opacity:.72}",
        ".eagle-photo-rename-list{overflow:auto;min-height:80px;max-height:440px;border-top:1px solid rgba(128,128,128,.22);border-bottom:1px solid rgba(128,128,128,.22)}",
        ".eagle-photo-rename-row{display:grid;grid-template-columns:minmax(0,1fr) 24px minmax(0,1fr);gap:8px;align-items:center;min-height:30px;padding:3px 6px;font-size:12px}",
        ".eagle-photo-rename-row:nth-child(even){background:rgba(128,128,128,.06)}",
        ".eagle-photo-rename-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".eagle-photo-rename-arrow{text-align:center;opacity:.55}",
        ".eagle-photo-rename-foot{margin-top:12px}",
        ".eagle-photo-rename-foot button{height:30px;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;padding:0 12px}",
        ".eagle-photo-rename-foot button[data-primary='true']{background:var(--color-primary,#1473e6);border-color:transparent;color:#fff}",
        ".eagle-photo-rename-foot button:disabled{opacity:.4}",
        ".eagle-photo-sort-dialog{width:min(620px,calc(100vw - 40px));max-height:calc(100vh - 60px);overflow:auto;background:var(--color-bg,#fff);color:inherit;border:1px solid rgba(128,128,128,.28);border-radius:8px;box-shadow:0 18px 60px rgba(0,0,0,.28);padding:18px}",
        ".eagle-photo-sort-dialog h2{font-size:17px;margin:0}",
        ".eagle-photo-sort-modal-head,.eagle-photo-sort-modal-foot{display:flex;align-items:center;justify-content:space-between;gap:8px}",
        ".eagle-photo-sort-modal-head{margin-bottom:14px}.eagle-photo-sort-modal-foot{margin-top:14px}",
        ".eagle-photo-sort-list{display:flex;flex-direction:column;gap:7px}",
        ".eagle-photo-sort-rule{display:grid;grid-template-columns:28px minmax(210px,1fr) 92px 28px 28px 28px;gap:6px;align-items:center}",
        ".eagle-photo-sort-rule select{height:30px;min-width:0;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;padding:0 8px;font:inherit}",
        ".eagle-photo-sort-rule button,.eagle-photo-sort-modal-foot button,.eagle-photo-sort-modal-head button{height:30px;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;padding:0 10px}",
        ".eagle-photo-sort-rule button{padding:0;font-size:14px}.eagle-photo-sort-rule button:disabled{opacity:.3}",
        ".eagle-photo-sort-priority{text-align:center;font-size:12px;opacity:.65}"
      ].join("");
      document.head.appendChild(style);
    }

    function renderSettings() {
      syncManualContext();
      document.querySelectorAll(".eagle-photo-taken-settings").forEach(
        (panel) => {
          panel.style.display = currentOrder() === SORT_KEY ? "" : "none";
          const summary = panel.querySelector(".eagle-photo-sort-summary");
          const rulesSignature = JSON.stringify(api.rules);
          if (summary && summary.dataset.rules !== rulesSignature) {
            summary.dataset.rules = rulesSignature;
            summary.replaceChildren(
              ...api.rules.map((rule, index) => {
                const item = document.createElement("span");
                item.textContent =
                  String(index + 1) + ". " + ui[rule.field] +
                  (rule.direction === "desc" ? " ↓" : " ↑");
                return item;
              })
            );
          }
          const checkbox = panel.querySelector(".eagle-photo-sort-manual input");
          const directItems = currentRenameItems();
          const hasDirectMedia = directItems.some((item) =>
            sortRuntime.isMedia(item)
          );
          const locked = folderLocked();
          const lockProfile = folderLockProfile();
          if (!locked) {
            const rememberedOrder = directItems.map(
              (item) => String(item.id)
            );
            panel._eaglePhotoSortOrder = rememberedOrder;
            if (rememberedOrder.length > 0) {
              api.lastUnlockedOrder = {
                contextId: currentContextId(),
                order: rememberedOrder
              };
            }
          }
          const lockRow = panel.querySelector(".eagle-photo-sort-lock");
          const lockCheckbox = lockRow?.querySelector("input");
          if (lockRow) {
            lockRow.style.display = hasDirectMedia ? "flex" : "none";
            lockRow.dataset.locked = locked ? "true" : "false";
          }
          if (lockCheckbox) {
            lockCheckbox.checked = locked;
            lockCheckbox.disabled = !bodyScope.currentFolder;
          }
          const lockState = panel.querySelector(".eagle-photo-sort-lock-state");
          if (lockState) {
            lockState.textContent = locked
              ? ui.lockedState.replace(
                  "{count}",
                  String(lockProfile?.order?.length || 0)
                )
              : ui.unlockedState.replace(
                  "{count}",
                  String(panel._eaglePhotoSortOrder?.length || 0)
                );
          }
          if (locked && !lockProfile?.order?.length && currentItems().length) {
            scheduleCurrentLockRecovery();
          }
          const edit = panel.querySelector(".eagle-photo-sort-edit");
          if (edit) edit.disabled = false;
          const manualSection = panel.querySelector(
            ".eagle-photo-sort-manual-section"
          );
          if (manualSection) {
            manualSection.style.display = hasDirectMedia ? "flex" : "none";
          }
          if (checkbox) {
            checkbox.checked = manualEnabled();
            checkbox.disabled = !bodyScope.currentFolder || !hasDirectMedia;
          }
          const treeButton = panel.querySelector(".eagle-photo-sort-tree");
          const treeResult = panel.querySelector(
            ".eagle-photo-sort-tree-result"
          );
          const treeCount = currentFolderTree().length;
          if (treeButton) {
            treeButton.style.display = treeCount > 1 ? "" : "none";
            treeButton.textContent = ui.applyTree.replace(
              "{count}",
              String(treeCount)
            );
            treeButton.title = ui.applyTreeConfirm.replace(
              "{count}",
              String(treeCount)
            );
          }
          if (treeResult) {
            treeResult.style.display = api.batchMessage ? "" : "none";
            treeResult.textContent = api.batchMessage;
          }
          const state = panel.querySelector(".eagle-photo-sort-state");
          if (state) {
            state.textContent = api.manual.moves
              ? ui.moved.replace("{count}", api.manual.moves)
              : ui.idle;
          }
          const undo = panel.querySelector('[data-manual-action="undo"]');
          const reset = panel.querySelector('[data-manual-action="reset"]');
          if (undo) undo.disabled = api.manual.history.length === 0;
          if (reset) {
            reset.disabled = locked
              ? !lockProfile?.order?.length
              : api.manual.order.length === 0;
          }
          const renameCheckbox = panel.querySelector(
            ".eagle-photo-sort-rename input"
          );
          if (renameCheckbox) {
            renameCheckbox.checked = renameEnabled();
            renameCheckbox.disabled =
              !bodyScope.currentFolder || api.rename.running;
          }
          const renamePlan = buildCurrentRenamePlan();
          const renameState = panel.querySelector(".eagle-photo-rename-state");
          if (renameState) {
            if (api.rename.message) {
              renameState.textContent = api.rename.message;
            } else if (renamePlan.pendingMetadata) {
              renameState.textContent = ui.renameWaiting.replace(
                "{count}",
                String(renamePlan.pendingMetadata)
              );
            } else if (renamePlan.error === "scene-name-empty") {
              renameState.textContent = ui.renameEmptyScene;
            } else if (renamePlan.entries.length) {
              renameState.textContent = ui.renameReady
                .replace("{people}", String(renamePlan.groups.people))
                .replace(
                  "{environment}",
                  String(renamePlan.groups.environment)
                )
                .replace("{changes}", String(renamePlan.changes.length));
            } else if (shouldRouteRenameToTree(renamePlan, treeCount)) {
              renameState.textContent = ui.renameTreeReady.replace(
                "{count}",
                String(treeCount)
              );
            } else {
              renameState.textContent = ui.renameIdle;
            }
          }
          const renamePreview = panel.querySelector(
            ".eagle-photo-rename-preview"
          );
          if (renamePreview) {
            renamePreview.textContent = renamePlan.entries.length
              ? ui.previewRename
              : ui.previewRenameEmpty;
            renamePreview.disabled =
              !bodyScope.currentFolder ||
              api.rename.running ||
              !renamePlan.entries.length;
          }
          const renameUndo = panel.querySelector(".eagle-photo-rename-undo");
          if (renameUndo) {
            renameUndo.disabled =
              api.rename.lastTransaction.length === 0 || api.rename.running;
          }
          const renameTree = panel.querySelector(".eagle-photo-rename-tree");
          if (renameTree) {
            renameTree.style.display = treeCount > 1 ? "" : "none";
            renameTree.textContent = ui.applyRenameTree.replace(
              "{count}",
              String(treeCount)
            );
            renameTree.title = ui.applyRenameTreeConfirm.replace(
              "{count}",
              String(treeCount)
            );
            renameTree.disabled = api.rename.running;
          }
          const renameTreeResult = panel.querySelector(
            ".eagle-photo-rename-tree-result"
          );
          if (renameTreeResult) {
            const message = api.rename.batchStatus?.message || "";
            renameTreeResult.style.display = message ? "" : "none";
            renameTreeResult.textContent = message;
          }
        }
      );
    }
    api.renderSettings = renderSettings;

    function clearManual(refresh = true) {
      const protectedFolder = prepareProtectedLocalSort();
      resetManualState();
      renderSettings();
      if (refresh) api.refresh?.();
      if (protectedFolder) scheduleProtectedOrderCapture();
      scheduleAutoRename();
    }

    function undoManual() {
      const previous = api.manual.history.pop();
      if (!previous) return;
      api.manual.order = previous;
      api.manual.moves = Math.max(0, api.manual.moves - 1);
      updateCurrentProtectedOrder(previous);
      renderSettings();
      api.refresh?.();
      scheduleAutoRename();
    }

    function createSelect(options, value) {
      const select = document.createElement("select");
      for (const entry of options) {
        const option = document.createElement("option");
        option.value = entry.value;
        option.textContent = entry.label;
        select.appendChild(option);
      }
      select.value = value;
      return select;
    }

    function ensureRulesModal() {
      let overlay = document.querySelector(".eagle-photo-sort-modal");
      if (overlay) return overlay;

      overlay = document.createElement("div");
      overlay.className = "eagle-photo-sort-modal";
      overlay.style.display = "none";

      const dialog = document.createElement("div");
      dialog.className = "eagle-photo-sort-dialog";

      const head = document.createElement("div");
      head.className = "eagle-photo-sort-modal-head";
      const title = document.createElement("h2");
      title.textContent = ui.modalTitle;
      const preset = document.createElement("button");
      preset.type = "button";
      preset.textContent = ui.preset;
      preset.addEventListener("click", () => {
        saveRules(sortRuntime.defaultRules);
      });
      head.append(title, preset);

      const list = document.createElement("div");
      list.className = "eagle-photo-sort-list";

      const foot = document.createElement("div");
      foot.className = "eagle-photo-sort-modal-foot";
      const footLeft = document.createElement("div");
      const restore = document.createElement("button");
      restore.type = "button";
      restore.textContent = ui.restore;
      restore.addEventListener("click", () => {
        saveRules(sortRuntime.defaultRules);
      });
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = ui.add;
      add.style.marginLeft = "7px";
      add.addEventListener("click", () => {
        if (api.rules.length >= 8) return;
        saveRules(api.rules.concat([{ field: "NAME", direction: "asc" }]));
      });
      footLeft.append(restore, add);
      const done = document.createElement("button");
      done.type = "button";
      done.textContent = ui.done;
      done.addEventListener("click", () => {
        overlay.style.display = "none";
      });
      foot.append(footLeft, done);

      dialog.append(head, list, foot);
      overlay.appendChild(dialog);
      overlay.addEventListener("mousedown", (event) => {
        if (event.target === overlay) overlay.style.display = "none";
      });
      document.body.appendChild(overlay);

      api.renderRuleRows = () => {
        list.replaceChildren();
        api.rules.forEach((rule, index) => {
          const row = document.createElement("div");
          row.className = "eagle-photo-sort-rule";
          const priority = document.createElement("div");
          priority.className = "eagle-photo-sort-priority";
          priority.textContent = String(index + 1);

          const field = createSelect(
            RULE_FIELDS.map((key) => ({ value: key, label: ui[key] })),
            rule.field
          );
          field.addEventListener("change", () => {
            const next = api.rules.map((entry) => ({ ...entry }));
            next[index].field = field.value;
            if (field.value === "NAME_GROUP") {
              next[index].direction = "asc";
            }
            saveRules(next);
          });

          const direction = createSelect([
            { value: "asc", label: ui.asc },
            { value: "desc", label: ui.desc }
          ], rule.direction);
          if (rule.field === "NAME_GROUP") {
            direction.value = "asc";
            direction.disabled = true;
            direction.title = ui.groupDirectionLocked;
          }
          direction.addEventListener("change", () => {
            const next = api.rules.map((entry) => ({ ...entry }));
            next[index].direction = direction.value;
            saveRules(next);
          });

          const up = document.createElement("button");
          up.type = "button";
          up.textContent = "↑";
          up.title = ui.moveUp;
          up.disabled = index === 0;
          up.addEventListener("click", () => {
            const next = api.rules.map((entry) => ({ ...entry }));
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            saveRules(next);
          });

          const down = document.createElement("button");
          down.type = "button";
          down.textContent = "↓";
          down.title = ui.moveDown;
          down.disabled = index === api.rules.length - 1;
          down.addEventListener("click", () => {
            const next = api.rules.map((entry) => ({ ...entry }));
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            saveRules(next);
          });

          const remove = document.createElement("button");
          remove.type = "button";
          remove.textContent = "×";
          remove.title = ui.remove;
          remove.disabled = api.rules.length === 1;
          remove.addEventListener("click", () => {
            saveRules(api.rules.filter((entry, ruleIndex) => {
              return ruleIndex !== index;
            }));
          });

          row.append(priority, field, direction, up, down, remove);
          list.appendChild(row);
        });
      };
      api.renderRuleRows();
      return overlay;
    }

    function openRulesModal() {
      const overlay = ensureRulesModal();
      api.renderRuleRows?.();
      overlay.style.display = "flex";
    }

    function ensureSettings(select) {
      const sortPanel = select.closest(".panel-item");
      if (!sortPanel || sortPanel.parentElement.querySelector(
        ".eagle-photo-taken-settings"
      )) {
        return;
      }

      const panel = document.createElement("div");
      panel.className = "eagle-photo-taken-settings";
      panel.style.display = "none";
      sortPanel.closest("#layout-panel")?.classList.add(
        "eagle-photo-sort-panel"
      );

      const header = document.createElement("div");
      header.className = "eagle-photo-sort-header";
      const title = document.createElement("div");
      title.className = "eagle-photo-sort-title";
      title.textContent = ui.title;

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "eagle-photo-sort-edit";
      edit.textContent = ui.edit;
      edit.addEventListener("click", openRulesModal);
      header.append(title, edit);

      const summary = document.createElement("div");
      summary.className = "eagle-photo-sort-summary";

      const lock = document.createElement("label");
      lock.className = "eagle-photo-sort-lock";
      const lockCheckbox = document.createElement("input");
      lockCheckbox.type = "checkbox";
      lockCheckbox.addEventListener("change", () => {
        api.lockActionToken = (api.lockActionToken || 0) + 1;
        const actionToken = api.lockActionToken;
        if (!lockCheckbox.checked) {
          setCurrentFolderLocked(false);
          return;
        }
        const folderId = String(bodyScope.currentFolder?.id || "");
        const preferredOrder = Array.isArray(panel._eaglePhotoSortOrder)
          ? panel._eaglePhotoSortOrder.slice()
          : [];
        lockCheckbox.disabled = true;
        setTimeout(() => {
          if (
            lockCheckbox.isConnected &&
            api.lockActionToken === actionToken &&
            String(bodyScope.currentFolder?.id || "") === folderId
          ) {
            setCurrentFolderLocked(true, preferredOrder);
          }
        }, 250);
      });
      const lockLabel = document.createTextNode(ui.lockCurrent);
      const lockState = document.createElement("span");
      lockState.className = "eagle-photo-sort-lock-state";
      lock.append(lockCheckbox, lockLabel, lockState);

      const treeRow = document.createElement("div");
      treeRow.className = "eagle-photo-sort-tree-row";
      const treeButton = document.createElement("button");
      treeButton.type = "button";
      treeButton.className = "eagle-photo-sort-tree";
      treeButton.addEventListener("click", applyRulesToCurrentTree);
      const treeResult = document.createElement("div");
      treeResult.className = "eagle-photo-sort-tree-result";
      treeRow.append(treeButton, treeResult);

      const manual = document.createElement("label");
      manual.className = "eagle-photo-sort-manual";
      const manualCheckbox = document.createElement("input");
      manualCheckbox.type = "checkbox";
      manualCheckbox.addEventListener("change", () => {
        localStorage.setItem(
          MANUAL_STORAGE_KEY,
          manualCheckbox.checked ? "true" : "false"
        );
        if (!manualCheckbox.checked) clearManual();
      });
      manual.append(manualCheckbox, document.createTextNode(ui.manual));

      const actions = document.createElement("div");
      actions.className = "eagle-photo-sort-actions";
      const state = document.createElement("div");
      state.className = "eagle-photo-sort-state";
      const undo = document.createElement("button");
      undo.type = "button";
      undo.dataset.manualAction = "undo";
      undo.textContent = "↶";
      undo.title = ui.undo;
      undo.addEventListener("click", undoManual);
      const reset = document.createElement("button");
      reset.type = "button";
      reset.dataset.manualAction = "reset";
      reset.textContent = "↺";
      reset.title = ui.reset;
      reset.addEventListener("click", () => clearManual());
      actions.append(state, undo, reset);

      const rename = document.createElement("label");
      rename.className = "eagle-photo-sort-rename";
      const renameCheckbox = document.createElement("input");
      renameCheckbox.type = "checkbox";
      renameCheckbox.addEventListener("change", () => {
        if (renameCheckbox.checked) {
          renameCheckbox.checked = false;
          const plan = buildCurrentRenamePlan();
          if (shouldRouteRenameToTree(plan)) {
            applyRenameToCurrentTree();
          } else {
            openRenamePreview({ enableAfter: true });
          }
        } else {
          setRenameEnabled(false);
        }
      });
      rename.append(renameCheckbox, document.createTextNode(ui.autoRename));

      const renameActions = document.createElement("div");
      renameActions.className = "eagle-photo-rename-actions";
      const renameState = document.createElement("div");
      renameState.className = "eagle-photo-rename-state";
      const renamePreview = document.createElement("button");
      renamePreview.type = "button";
      renamePreview.className = "eagle-photo-rename-preview";
      renamePreview.textContent = ui.previewRename;
      renamePreview.addEventListener("click", () => openRenamePreview());
      const renameUndo = document.createElement("button");
      renameUndo.type = "button";
      renameUndo.className = "eagle-photo-rename-undo";
      renameUndo.textContent = "↶";
      renameUndo.title = ui.undoRename;
      renameUndo.addEventListener("click", undoLastRename);
      renameActions.append(renameState, renamePreview, renameUndo);

      const renameTreeRow = document.createElement("div");
      renameTreeRow.className = "eagle-photo-rename-tree-row";
      const renameTree = document.createElement("button");
      renameTree.type = "button";
      renameTree.className = "eagle-photo-rename-tree";
      renameTree.addEventListener("click", applyRenameToCurrentTree);
      const renameTreeResult = document.createElement("div");
      renameTreeResult.className = "eagle-photo-rename-tree-result";
      renameTreeRow.append(renameTree, renameTreeResult);

      const sortSection = document.createElement("section");
      sortSection.className =
        "eagle-photo-sort-section eagle-photo-sort-rules-section";
      sortSection.append(
        header,
        summary,
        lock,
        treeRow
      );

      const manualSection = document.createElement("section");
      manualSection.className =
        "eagle-photo-sort-section eagle-photo-sort-manual-section";
      manualSection.append(
        manual,
        actions
      );

      const renameSection = document.createElement("section");
      renameSection.className =
        "eagle-photo-sort-section eagle-photo-sort-rename-section";
      renameSection.append(
        rename,
        renameActions,
        renameTreeRow
      );
      panel.append(sortSection, manualSection, renameSection);
      sortPanel.insertAdjacentElement("afterend", panel);
      renderSettings();
    }

    function addOption(select) {
      if (!select.querySelector('option[value="' + SORT_KEY + '"]')) {
        const option = document.createElement("option");
        option.value = SORT_KEY;
        option.textContent = LABELS[language] || LABELS.en;
        const anchor = select.querySelector('option[value="BTIME"]');
        if (anchor) anchor.insertAdjacentElement("afterend", option);
        else select.appendChild(option);
      }

      if (!select.dataset.eaglePhotoTakenBound) {
        select.dataset.eaglePhotoTakenBound = "true";
        select.addEventListener("change", (event) => {
          if (select.value !== SORT_KEY) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          activatePhotoSort();
        }, true);
      }

      const selectRoot = select.closest(".select");
      const content = selectRoot && selectRoot.querySelector(".select-content");
      if (content && !content.querySelector(".eagle-photo-taken-value")) {
        const value = document.createElement("div");
        value.className = "select-value eagle-photo-taken-value";
        value.style.display = "none";
        const existingIcon = content.querySelector(
          'img[src*="ic-prop-createdAt.svg"]'
        );
        if (existingIcon) value.appendChild(existingIcon.cloneNode(true));
        value.appendChild(
          document.createTextNode(LABELS[language] || LABELS.en)
        );
        content.appendChild(value);
      }

      const sync = () => {
        const selected = currentOrder() === SORT_KEY;
        const value = content && content.querySelector(
          ".eagle-photo-taken-value"
        );
        if (value) value.style.display = selected ? "" : "none";
        if (selected && select.value !== SORT_KEY) {
          select.value = SORT_KEY;
        }
      };
      if (!select.dataset.eaglePhotoTakenSyncBound) {
        select.dataset.eaglePhotoTakenSyncBound = "true";
        select.addEventListener("change", () => {
          setTimeout(sync, 0);
        });
      }
      sync();
      ensureSettings(select);
    }

    function formatTakenMeta(value) {
      if (!Number.isFinite(value)) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "—";
      const pad = (part) => String(part).padStart(2, "0");
      return (
        date.getFullYear() + "/" +
        pad(date.getMonth() + 1) + "/" +
        pad(date.getDate()) + " " +
        pad(date.getHours()) + ":" +
        pad(date.getMinutes())
      );
    }

    function renderTakenMeta() {
      if (bodyScope.listMetaType !== META_KEY) return 0;
      let rendered = 0;
      document.querySelectorAll("#box-list .box[data-box-id]").forEach(
        (box) => {
          const itemId = String(box.getAttribute("data-box-id") || "");
          const metas = box.querySelector(".metas");
          if (!itemId || !metas) return;
          metas.textContent = formatTakenMeta(api.timestamps[itemId]);
          rendered += 1;
        }
      );
      return rendered;
    }

    function setMetaType(type, options = {}) {
      const normalized = normalizeMetaType(type);
      const changed = bodyScope.listMetaType !== normalized;
      bodyScope.listMetaType = normalized;
      localStorage.setItem("eagle.list.meta.type", normalized);
      if (options.saveProfile) {
        writeCurrentMetaType(normalized);
        api.metaContextId = currentMetaContextId();
        api.metaBatchMessage = "";
      }
      document
        .querySelectorAll('#layout-panel select[ng-model*="listMetaType"]')
        .forEach((select) => {
          if (select.value !== normalized) select.value = normalized;
        });
      if (changed && typeof bodyScope.updateItemsView === "function") {
        bodyScope.updateItemsView(bodyScope.allData || []);
      }
      bodyScope.$evalAsync();
      setTimeout(renderTakenMeta, 0);
      setTimeout(renderTakenMeta, 120);
      renderMetaTreeSettings();
      return normalized;
    }

    function addMetaOption(select) {
      if (!select.querySelector('option[value="' + META_KEY + '"]')) {
        const option = document.createElement("option");
        option.value = META_KEY;
        option.textContent = ui.metaTaken;
        option.dataset.eaglePhotoTakenMeta = "true";
        const anchor = select.querySelector('option[value="MTIME"]');
        if (anchor) anchor.insertAdjacentElement("afterend", option);
        else select.appendChild(option);
      }

      if (!select.dataset.eaglePhotoTakenMetaBound) {
        select.dataset.eaglePhotoTakenMetaBound = "true";
        select.addEventListener("change", (event) => {
          const type = normalizeMetaType(select.value);
          event.preventDefault();
          event.stopImmediatePropagation();
          setMetaType(type, { saveProfile: true });
          setTimeout(() => {
            syncMetaOption(select);
            renderTakenMeta();
          }, 0);
        }, true);
      }

      const selectRoot = select.closest(".select");
      const content = selectRoot && selectRoot.querySelector(".select-content");
      if (content && !content.querySelector(".eagle-photo-taken-meta-value")) {
        const value = document.createElement("div");
        value.className = "select-value eagle-photo-taken-meta-value";
        value.style.display = "none";
        const existingIcon = content.querySelector(
          'img[src*="ic-prop-createdAt.svg"]'
        );
        if (existingIcon) value.appendChild(existingIcon.cloneNode(true));
        value.appendChild(document.createTextNode(ui.metaTaken));
        content.appendChild(value);
      }
      ensureMetaTreeSettings(select);
      syncMetaOption(select);
    }

    function syncMetaOption(select) {
      const selected = bodyScope.listMetaType === META_KEY;
      const selectRoot = select.closest(".select");
      const value = selectRoot?.querySelector(
        ".eagle-photo-taken-meta-value"
      );
      selectRoot?.classList.toggle("eagle-photo-taken-meta-active", selected);
      if (value) value.style.display = selected ? "flex" : "none";
      if (selected && select.value !== META_KEY) select.value = META_KEY;
    }

    function ensureMetaTreeSettings(select) {
      const panelItem = select.closest(".panel-item");
      if (!panelItem || panelItem.nextElementSibling?.classList.contains(
        "eagle-photo-meta-tree-settings"
      )) {
        return;
      }
      const row = document.createElement("div");
      row.className = "eagle-photo-meta-tree-settings";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "eagle-photo-meta-tree-apply";
      button.addEventListener("click", applyMetaToCurrentTree);
      const result = document.createElement("div");
      result.className = "eagle-photo-meta-tree-result";
      row.append(button, result);
      panelItem.insertAdjacentElement("afterend", row);
      renderMetaTreeSettings();
    }

    function renderMetaTreeSettings() {
      const count = currentFolderTree().length;
      document.querySelectorAll(".eagle-photo-meta-tree-settings").forEach(
        (row) => {
          row.style.display = count > 1 ? "flex" : "none";
          const button = row.querySelector(".eagle-photo-meta-tree-apply");
          if (button) {
            button.textContent = ui.applyMetaTree.replace(
              "{count}",
              String(count)
            );
          }
          const result = row.querySelector(".eagle-photo-meta-tree-result");
          if (result) {
            result.textContent = api.metaBatchMessage;
            result.style.display = api.metaBatchMessage ? "" : "none";
          }
        }
      );
    }

    function syncSettings() {
      renderSettings();
    }

    function itemFingerprint(items) {
      let xor = 0;
      let sum = 0;
      for (const item of items) {
        const id = String(item.id || "");
        let hash = 2166136261;
        for (let index = 0; index < id.length; index += 1) {
          hash ^= id.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        xor ^= hash;
        sum = (sum + (hash >>> 0)) >>> 0;
      }
      return items.length + ":" + (xor >>> 0) + ":" + sum;
    }

    function currentItems() {
      if (
        (bodyScope.currentFolder || bodyScope.currentSmartFolder) &&
        Array.isArray(bodyScope.raw)
      ) {
        return bodyScope.raw;
      }
      if (Array.isArray(bodyScope.allData) && bodyScope.allData.length > 0) {
        return bodyScope.allData;
      }
      return Array.isArray(bodyScope.raw) ? bodyScope.raw : [];
    }

    function currentRenameItems() {
      const folderId = bodyScope.currentFolder?.id;
      if (!folderId) return [];
      let items = currentItems().filter((item) => {
        return !Array.isArray(item.folders) || item.folders.includes(folderId);
      });
      const activeOrder = activeManualOrder();
      if (activeOrder.length) {
        items = sortRuntime.applyManualOrder(items, activeOrder);
      }
      return items;
    }

    function currentOrderSnapshot() {
      const items = currentRenameItems();
      if (items.length > 0) {
        return items.map((item) => String(item.id));
      }

      const order = [];
      const seen = new Set();
      document.querySelectorAll(
        "#box-list .box, .box[data-box-id], [id^='box-']"
      ).forEach(
        (box) => {
          const id = String(
            box.getAttribute("data-box-id") ||
            String(box.id || "").replace(/^box-/, "")
          );
          if (id && !seen.has(id)) {
            seen.add(id);
            order.push(id);
          }
        }
      );
      for (const item of currentItems()) {
        const id = String(item?.id || "");
        if (id && !seen.has(id)) {
          seen.add(id);
          order.push(id);
        }
      }
      const rawItems = Array.isArray(bodyScope.raw) ? bodyScope.raw : [];
      for (const item of rawItems) {
        const id = String(item?.id || "");
        if (id && !seen.has(id)) {
          seen.add(id);
          order.push(id);
        }
      }
      return order;
    }

    function buildCurrentRenamePlan() {
      const folder = bodyScope.currentFolder;
      if (!folder) {
        return {
          contextId: currentContextId(),
          sceneName: "",
          entries: [],
          changes: [],
          groups: { people: 0, environment: 0 },
          ignoredCount: 0,
          pendingMetadata: 0,
          error: "folder-required"
        };
      }
      const items = currentRenameItems();
      const plan = renameRuntime.buildPlan(items, { folderName: folder.name });
      const needsTakenAt =
        currentOrder() === SORT_KEY &&
        api.rules.some((rule) => rule.field === "TAKEN_AT");
      plan.pendingMetadata = needsTakenAt
        ? items.filter((item) => {
            return sortRuntime.isMedia(item) &&
              renameRuntime.groupFromName(item.name) &&
              !Object.prototype.hasOwnProperty.call(api.timestamps, item.id);
          }).length
        : 0;
      plan.contextId = currentContextId();
      return plan;
    }

    function shouldRouteRenameToTree(
      plan = buildCurrentRenamePlan(),
      treeOrCount = currentFolderTree()
    ) {
      const treeCount = Array.isArray(treeOrCount)
        ? treeOrCount.length
        : Number(treeOrCount || 0);
      return (
        treeCount > 1 &&
        Array.isArray(plan?.entries) &&
        plan.entries.length === 0
      );
    }

    function applyRenameEntries(entries, options = {}) {
      if (!Array.isArray(entries) || entries.length === 0) return 0;
      if (typeof ayncsImagesChange !== "function") {
        throw new Error("Eagle rename pipeline is unavailable");
      }
      const items = new Map(
        currentItems().map((item) => [String(item.id || ""), item])
      );
      const changed = [];
      const transaction = [];
      for (const entry of entries) {
        const item = items.get(String(entry.id));
        if (!item || !entry.newName || item.name === entry.newName) continue;
        const oldName = String(item.name || "");
        transaction.push({ id: String(item.id), oldName, newName: entry.newName });
        item.oldName = oldName;
        item.name = entry.newName;
        item.newName = entry.newName;
        changed.push(item);
      }
      if (!changed.length) return 0;

      api.rename.running = true;
      if (options.record !== false) api.rename.lastTransaction = transaction;
      ayncsImagesChange(changed);
      try {
        if (typeof bodyScope.updateItemsView === "function") {
          bodyScope.updateItemsView(changed);
        }
      } catch (error) {
        console.warn("Photo rename view update skipped", error);
      }
      bodyScope.$evalAsync();
      setTimeout(() => {
        api.rename.running = false;
        api.rename.lastSignature = renameRuntime.signature(
          buildCurrentRenamePlan()
        );
        renderTakenMeta();
        renderSettings();
        bodyScope.$evalAsync();
      }, 700);
      return changed.length;
    }

    function applyRenamePlan(plan, options = {}) {
      if (!plan || plan.contextId !== currentContextId()) return 0;
      if (plan.error || plan.pendingMetadata || !plan.entries.length) return 0;
      if (options.enableAfter) setRenameEnabled(true);
      const count = applyRenameEntries(plan.changes);
      api.rename.lastSignature = renameRuntime.signature(plan);
      api.rename.message = count
        ? ui.renameDone.replace("{count}", String(count))
        : ui.renameNoChanges;
      renderSettings();
      return count;
    }

    function undoLastRename() {
      const transaction = api.rename.lastTransaction.slice();
      if (!transaction.length || api.rename.running) return 0;
      setRenameEnabled(false);
      const count = applyRenameEntries(
        transaction.map((entry) => ({
          id: entry.id,
          newName: entry.oldName
        })),
        { record: false }
      );
      api.rename.lastTransaction = [];
      api.rename.message = ui.renameUndone.replace("{count}", String(count));
      renderSettings();
      return count;
    }

    function maybeAutoRename() {
      if (
        !renameEnabled() ||
        api.rename.running ||
        currentOrder() !== SORT_KEY ||
        !bodyScope.currentFolder
      ) {
        return false;
      }
      const plan = buildCurrentRenamePlan();
      const signature = renameRuntime.signature(plan);
      if (
        plan.error ||
        plan.pendingMetadata ||
        !plan.entries.length ||
        !signature
      ) {
        return false;
      }
      if (!plan.changes.length || signature === api.rename.lastSignature) {
        api.rename.lastSignature = signature;
        return false;
      }
      api.rename.lastSignature = signature;
      applyRenamePlan(plan);
      return true;
    }

    function scheduleAutoRename(delay = 650, restart = false) {
      if (!renameEnabled()) return;
      if (api.rename.timer && !restart) return;
      clearTimeout(api.rename.timer);
      api.rename.timer = setTimeout(() => {
        api.rename.timer = null;
        maybeAutoRename();
      }, delay);
    }

    function closeRenamePreview() {
      document.querySelector(".eagle-photo-rename-modal")?.remove();
    }

    function openRenamePreview(options = {}) {
      closeRenamePreview();
      const plan = buildCurrentRenamePlan();
      const overlay = document.createElement("div");
      overlay.className = "eagle-photo-rename-modal";
      const dialog = document.createElement("div");
      dialog.className = "eagle-photo-rename-dialog";

      const head = document.createElement("div");
      head.className = "eagle-photo-rename-head";
      const title = document.createElement("h2");
      title.textContent = ui.renameTitle;
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "×";
      close.title = ui.renameCancel;
      close.addEventListener("click", closeRenamePreview);
      head.append(title, close);

      const summary = document.createElement("div");
      summary.className = "eagle-photo-rename-summary";
      const scene = plan.sceneName || "—";
      summary.textContent =
        ui.renameScene.replace("{scene}", scene) + " · " +
        ui.renameSummary
          .replace("{people}", String(plan.groups.people))
          .replace("{environment}", String(plan.groups.environment))
          .replace("{ignored}", String(plan.ignoredCount));

      const warning = document.createElement("div");
      warning.className = "eagle-photo-rename-warning";
      if (plan.error === "scene-name-empty") {
        warning.textContent = ui.renameEmptyScene;
      } else if (plan.pendingMetadata) {
        warning.textContent = ui.renamePending;
      } else if (!plan.entries.length) {
        warning.textContent = ui.renameNoItems;
      } else if (!plan.changes.length) {
        warning.textContent = options.enableAfter
          ? ui.renameWarning
          : ui.renameNoChanges;
      } else {
        warning.textContent = ui.renameWarning;
      }

      const list = document.createElement("div");
      list.className = "eagle-photo-rename-list";
      for (const entry of plan.entries.slice(0, 300)) {
        const row = document.createElement("div");
        row.className = "eagle-photo-rename-row";
        const before = document.createElement("span");
        before.textContent = entry.oldName;
        before.title = entry.oldName;
        const arrow = document.createElement("span");
        arrow.className = "eagle-photo-rename-arrow";
        arrow.textContent = "→";
        const after = document.createElement("span");
        after.textContent = entry.newName;
        after.title = entry.newName;
        row.append(before, arrow, after);
        list.appendChild(row);
      }

      const foot = document.createElement("div");
      foot.className = "eagle-photo-rename-foot";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = ui.renameCancel;
      cancel.addEventListener("click", closeRenamePreview);
      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.dataset.primary = "true";
      const count = plan.changes.length;
      confirm.textContent = options.enableAfter
        ? (count
            ? ui.renameEnable.replace("{count}", String(count))
            : ui.renameEnableNoChanges)
        : ui.renameOnce.replace("{count}", String(count));
      confirm.disabled =
        !!plan.error ||
        !!plan.pendingMetadata ||
        !plan.entries.length ||
        (!options.enableAfter && !plan.changes.length);
      confirm.addEventListener("click", () => {
        const latest = buildCurrentRenamePlan();
        if (renameRuntime.signature(latest) !== renameRuntime.signature(plan)) {
          openRenamePreview(options);
          return;
        }
        applyRenamePlan(latest, options);
        closeRenamePreview();
      });
      foot.append(cancel, confirm);
      dialog.append(head, summary, warning, list, foot);
      overlay.appendChild(dialog);
      overlay.addEventListener("mousedown", (event) => {
        if (event.target === overlay) closeRenamePreview();
      });
      document.body.appendChild(overlay);
      return plan;
    }

    function ensureMenu() {
      ensureStyle();
      syncManualContext();
      syncMetaContext();
      syncRenameContext();
      document.body.classList.toggle(
        "eagle-photo-sort-active",
        currentOrder() === SORT_KEY &&
          manualEnabled() &&
          !!bodyScope.currentFolder
      );
      document
        .querySelectorAll('#layout-panel select[ng-change*="changeOrderBy"]')
        .forEach(addOption);
      document
        .querySelectorAll('#layout-panel select[ng-model*="listMetaType"]')
        .forEach(addMetaOption);
      document.querySelectorAll(".eagle-photo-taken-value").forEach((value) => {
        value.style.display = currentOrder() === SORT_KEY ? "" : "none";
      });
      renderTakenMeta();
      renderMetaTreeSettings();
      renderFolderLockMarkers();
      scheduleAutoRename();
      syncSettings();
    }

    api.ensureMenu = ensureMenu;
    api.activate = activatePhotoSort;
    api.applyToCurrentTree = applyRulesToCurrentTree;
    api.applyMetaToCurrentTree = applyMetaToCurrentTree;
    api.applyRenameToCurrentTree = applyRenameToCurrentTree;
    api.claimRenameBatch = claimRenameBatch;
    api.updateRenameBatchProgress = updateRenameBatchProgress;
    api.completeRenameBatch = completeRenameBatch;
    api.setCurrentFolderLocked = setCurrentFolderLocked;
    api.renderFolderLockMarkers = renderFolderLockMarkers;
    api.previewCurrentTree = () => currentFolderTree().map((folder) => ({
      id: folder.id,
      name: folder.name,
      orderBy: folder.orderBy || "",
      locked: folderLocked(folder),
      lockedItemCount: folderLockProfile(folder)?.order?.length || 0
    }));
    api.clearManual = clearManual;
    api.getRules = () => api.rules.map((rule) => ({ ...rule }));
    api.setRules = (rules) => saveRules(rules);
    api.previewRename = buildCurrentRenamePlan;
    api.openRenamePreview = openRenamePreview;
    api.undoLastRename = undoLastRename;
    api.current = () => {
      syncManualContext();
      const items = currentItems();
      const lockProfile = folderLockProfile();
      return {
        orderBy: currentOrder(),
        increase: currentIncrease(),
        folderLocked: !!lockProfile,
        lockedOrder: lockProfile?.order?.slice() || [],
        lockedAt: lockProfile?.lockedAt || null,
        rules: api.rules.map((rule) => ({ ...rule })),
        rulesContextId: api.rulesContextId,
        treeFolderCount: currentFolderTree().length,
        folderTree: currentFolderTree().map((folder) => ({
          id: folder.id,
          name: folder.name || "未命名文件夹"
        })),
        metaContextId: api.metaContextId,
        metaBatchMessage: api.metaBatchMessage,
        renameEnabled: renameEnabled(),
        renameBatchRequest: api.rename.batchRequest,
        renameBatchStatus: api.rename.batchStatus,
        renamePlan: (() => {
          const plan = buildCurrentRenamePlan();
          return {
            sceneName: plan.sceneName,
            groups: plan.groups,
            changes: plan.changes.length,
            ignoredCount: plan.ignoredCount,
            pendingMetadata: plan.pendingMetadata,
            error: plan.error
          };
        })(),
        manualEnabled: manualEnabled(),
        manualMoves: api.manual.moves,
        manualOrder: api.manual.order.slice(),
        dragStats: { ...(api.dragStats || {}) },
        contextId: currentContextId(),
        currentFolderId: bodyScope.currentFolder?.id || "",
        currentSmartFolderId: bodyScope.currentSmartFolder?.id || "",
        metaType: bodyScope.listMetaType || "",
        itemFingerprint: itemFingerprint(items),
        itemSourceCounts: {
          allData: Array.isArray(bodyScope.allData)
            ? bodyScope.allData.length
            : -1,
          raw: Array.isArray(bodyScope.raw) ? bodyScope.raw.length : -1
        },
        items: items.map((item) => ({
          id: item.id,
          ext: item.ext,
          filePath: item.filePath,
          name: item.name
        }))
      };
    };
    api.setTimestamps = (values) => {
      Object.assign(api.timestamps, values);
      renderTakenMeta();
      setTimeout(renderTakenMeta, 80);
      scheduleAutoRename();
      return Object.keys(values).length;
    };
    api.renderTakenMeta = renderTakenMeta;
    api.refresh = () => {
      ensureMenu();
      if (currentOrder() !== SORT_KEY) return false;
      bodyScope.currentOrderBy = SORT_KEY;
      bodyScope.currentSortIncrease = currentIncrease();
      if (!bodyScope.currentFolder && !bodyScope.currentSmartFolder) {
        bodyScope.sortRawData(SORT_KEY);
      }
      bodyScope.rebindRefresh();
      bodyScope.$evalAsync();
      return true;
    };

    function canHandleManualDrag() {
      return (
        currentOrder() === SORT_KEY &&
        manualEnabled() &&
        !!bodyScope.currentFolder
      );
    }

    function selectedIdsForDrag(sourceId) {
      const selected = Array.isArray(bodyScope.selected)
        ? bodyScope.selected
        : [];
      if (selected.some((item) => item.id === sourceId)) {
        return selected.map((item) => item.id);
      }
      return sourceId ? [sourceId] : [];
    }

    function setDropTargetsVisible(visible, selectedIds = []) {
      document.body.classList.toggle(
        "eagle-photo-sort-dragging",
        visible === true
      );
      const selected = new Set(selectedIds);
      document.querySelectorAll(".box-sortable-helper").forEach(
        (helper) => {
          const box = helper.closest(".box");
          const itemId = box?.getAttribute("data-box-id");
          const enabled =
            visible &&
            itemId &&
            !selected.has(itemId) &&
            !box.classList.contains("pinned");
          if (enabled) {
            helper.style.setProperty("display", "block", "important");
          } else {
            helper.style.removeProperty("display");
            helper.classList.remove("drag-over");
          }
        }
      );
    }

    function finishManualDrag(schedulePostCleanup = true) {
      clearTimeout(api.dragCleanupTimer);
      api.dragCleanupTimer = null;
      for (const timer of api.dragPostCleanupTimers || []) {
        clearTimeout(timer);
      }
      api.dragPostCleanupTimers = [];
      api.dragState = null;
      setDropTargetsVisible(false);
      if (schedulePostCleanup !== false) {
        api.dragPostCleanupTimers = [0, 120, 400].map((delay) =>
          setTimeout(() => setDropTargetsVisible(false), delay)
        );
      }
    }

    function applyManualOrderToGrid(
      nextItems,
      selectedIds,
      targetBox,
      insertAfter
    ) {
      if (
        !Array.isArray(nextItems) ||
        !Array.isArray(bodyScope.allData) ||
        !targetBox
      ) {
        return false;
      }
      const grid = typeof ig !== "undefined" ? ig : window.ig;
      if (!grid || typeof grid.moveElementsBefore !== "function") {
        return false;
      }

      const selected = new Set(selectedIds);
      const sourceElements = bodyScope.allData
        .filter((item) => selected.has(item.id))
        .map((item) => document.getElementById("box-" + item.id))
        .filter(Boolean);
      if (
        sourceElements.length !== selected.size ||
        sourceElements.includes(targetBox)
      ) {
        return false;
      }

      bodyScope.allData.splice(0, bodyScope.allData.length, ...nextItems);
      if (Array.isArray(bodyScope.filtereds)) {
        const pageItemCount = Number(bodyScope.len) * Number(bodyScope.page);
        const visibleCount = Number.isFinite(pageItemCount)
          ? pageItemCount
          : nextItems.length;
        bodyScope.filtereds.splice(
          0,
          bodyScope.filtereds.length,
          ...nextItems.slice(0, visibleCount)
        );
      }
      try {
        const moved = grid.moveElementsBefore(
          sourceElements,
          targetBox,
          insertAfter
        );
        if (!moved) return false;
      } catch (error) {
        console.warn("Photo drag grid update skipped", error);
        return false;
      }

      bodyScope.$evalAsync();
      setTimeout(renderTakenMeta, 0);
      setTimeout(renderTakenMeta, 120);
      return true;
    }

    function performManualDrop(event, selectedIds, options = {}) {
      if (!canHandleManualDrag()) return false;
      const helper = event?.target?.closest?.(".box-sortable-helper");
      const targetBox = helper?.closest?.(".box");
      const targetId = targetBox?.getAttribute("data-box-id");
      const visualItems = Array.isArray(bodyScope.allData)
        ? bodyScope.allData.slice()
        : [];
      if (!helper || !targetId || !selectedIds?.length) return false;

      const nextItems = sortRuntime.moveItems(
        visualItems,
        selectedIds,
        targetId,
        helper.classList.contains("right")
      );
      if (nextItems.every((item, index) => item === visualItems[index])) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      syncManualContext();
      const previousOrder = api.manual.order.length
        ? api.manual.order.slice()
        : visualItems.map((item) => item.id);
      api.manual.history.push(previousOrder);
      if (api.manual.history.length > 30) api.manual.history.shift();
      api.manual.order = nextItems.map((item) => item.id);
      updateCurrentProtectedOrder(api.manual.order);
      api.manual.moves += 1;
      api.dragStats.drops += 1;
      api.dragStats.lastDrop = {
        count: selectedIds.length,
        targetId,
        insertAfter: helper.classList.contains("right")
      };
      document.querySelectorAll(".box-sortable-helper.drag-over").forEach(
        (element) => element.classList.remove("drag-over")
      );
      setDropTargetsVisible(false);
      renderSettings();
      const updateGrid = options.updateGrid || applyManualOrderToGrid;
      const locallyUpdated = updateGrid(
        nextItems,
        selectedIds,
        targetBox,
        helper.classList.contains("right")
      );
      // Non-grid views still use Eagle's reliable full rebind as a fallback.
      if (!locallyUpdated && options.refresh !== false) api.refresh?.();
      if (options.autoRename !== false) scheduleAutoRename(350, true);
      return true;
    }

    finishManualDrag(false);
    if (api.handlers) {
      for (const [eventName, handler] of Object.entries(api.handlers)) {
        document.removeEventListener(eventName, handler, true);
      }
    }
    api.dragStats = { starts: 0, overs: 0, drops: 0, lastDrop: null };
    api.dragState = null;
    const dragStartHandler = (event) => {
      if (!canHandleManualDrag()) return;
      finishManualDrag(false);
      const sourceBox = event.target?.closest?.(".box");
      const sourceId = sourceBox?.getAttribute("data-box-id");
      if (!sourceId) return;
      api.dragState = {
        selectedIds: selectedIdsForDrag(sourceId),
        sourceId
      };
      setDropTargetsVisible(true, api.dragState.selectedIds);
      api.dragCleanupTimer = setTimeout(finishManualDrag, 5000);
      api.dragStats.starts += 1;
    };
    const dragOverHandler = (event) => {
      if (!canHandleManualDrag() || !api.dragState) return;
      const helper = event.target?.closest?.(".box-sortable-helper");
      if (!helper) return;
      const targetId = helper.closest(".box")?.getAttribute("data-box-id");
      if (api.dragState.selectedIds.includes(targetId)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      document.querySelectorAll(".box-sortable-helper.drag-over").forEach(
        (element) => {
          if (element !== helper) element.classList.remove("drag-over");
        }
      );
      helper.classList.add("drag-over");
      api.dragStats.overs += 1;
    };
    const dragLeaveHandler = (event) => {
      event.target?.closest?.(".box-sortable-helper")?.classList.remove(
        "drag-over"
      );
    };
    const dropHandler = (event) => {
      if (!api.dragState) return;
      const selectedIds = api.dragState.selectedIds.slice();
      try {
        performManualDrop(event, selectedIds);
      } finally {
        finishManualDrag();
      }
    };
    const dragEndHandler = finishManualDrag;
    const keyDownHandler = (event) => {
      if (event.key === "Escape" && api.dragState) finishManualDrag();
    };
    const visibilityHandler = () => {
      if (document.hidden && api.dragState) finishManualDrag();
    };
    api.handlers = {
      dragstart: dragStartHandler,
      dragover: dragOverHandler,
      dragleave: dragLeaveHandler,
      drop: dropHandler,
      dragend: dragEndHandler,
      keydown: keyDownHandler,
      visibilitychange: visibilityHandler
    };
    for (const [eventName, handler] of Object.entries(api.handlers)) {
      document.addEventListener(eventName, handler, true);
    }
    api.windowHandlers = {};

    api.original.onDropBoxItem =
      api.original.onDropBoxItem || window.onDropBoxItem;
    window.onDropBoxItem = function(event) {
      if (!canHandleManualDrag()) {
        return api.original.onDropBoxItem?.call(this, event);
      }
      const selectedIds =
        api.dragState?.selectedIds ||
        selectedIdsForDrag("");
      try {
        return performManualDrop(event, selectedIds);
      } finally {
        finishManualDrag();
      }
    };

    ensureMenu();
    api.runLayoutIntegrationTest = () => {
      const panel = document.querySelector(".eagle-photo-taken-settings");
      if (!panel) return { ok: false, reason: "settings panel missing" };
      const clone = panel.cloneNode(true);
      Object.assign(clone.style, {
        display: "flex",
        position: "fixed",
        left: "-10000px",
        top: "0",
        visibility: "hidden",
        width: "348px"
      });
      document.body.appendChild(clone);
      const children = Array.from(clone.children).filter(
        (element) => window.getComputedStyle(element).display !== "none"
      );
      const rectangles = children.map((element) =>
        element.getBoundingClientRect()
      );
      const noOverlap = rectangles.every((rectangle, index) => {
        const next = rectangles[index + 1];
        return !next || rectangle.bottom <= next.top + 0.5;
      });
      const result = {
        ok: noOverlap && clone.getBoundingClientRect().height >= 100,
        noOverlap,
        height: clone.getBoundingClientRect().height,
        childCount: children.length,
        usesFixedPanelItem: clone.classList.contains("panel-item")
      };
      clone.remove();
      return result;
    };
    api.runDragIntegrationTest = () => {
      if (!canHandleManualDrag()) {
        return { ok: false, reason: "temporary drag inactive" };
      }
      const visualItems = Array.isArray(bodyScope.allData)
        ? bodyScope.allData
        : [];
      const candidates = visualItems.filter((item) => {
        const box = document.getElementById("box-" + item.id);
        return box && !box.classList.contains("pinned");
      });
      if (candidates.length < 2) {
        return { ok: false, reason: "not enough rendered targets" };
      }
      const target = candidates[0];
      const source = candidates[1];
      const targetHelper = document.querySelector(
        '#box-' + target.id + ' .box-sortable-helper.left'
      );
      if (!targetHelper) {
        return { ok: false, reason: "drop target missing" };
      }

      const folderOrderBefore = currentOrder();
      const protectedOrderBefore = folderLockProfile()?.order?.slice() || null;
      const itemOrderBefore = JSON.stringify(
        candidates.slice(0, 2).map((item) => item.order || null)
      );
      const statsBefore = { ...api.dragStats };
      const refreshBefore = api.refresh;
      let refreshCalls = 0;
      api.refresh = () => {
        refreshCalls += 1;
        return false;
      };
      const fakeEvent = {
        target: targetHelper,
        prevented: false,
        stopped: false,
        immediateStopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; },
        stopImmediatePropagation() { this.immediateStopped = true; }
      };
      const moved = performManualDrop(
        fakeEvent,
        [source.id],
        { autoRename: false, updateGrid: () => true }
      );
      const localRefreshCalls = refreshCalls;
      resetManualState();
      const fallbackMoved = performManualDrop(
        fakeEvent,
        [source.id],
        { autoRename: false, updateGrid: () => false }
      );
      const fallbackRefreshCalls = refreshCalls - localRefreshCalls;
      const grid = typeof ig !== "undefined" ? ig : window.ig;
      const gridAvailable =
        !!grid && typeof grid.moveElementsBefore === "function";
      api.refresh = refreshBefore;
      const result = {
        ok:
          moved &&
          fallbackMoved &&
          api.manual.order[0] === source.id &&
          localRefreshCalls === 0 &&
          fallbackRefreshCalls === 1 &&
          gridAvailable &&
          currentOrder() === folderOrderBefore &&
          JSON.stringify(
            candidates.slice(0, 2).map((item) => item.order || null)
          ) === itemOrderBefore &&
          fakeEvent.prevented &&
          fakeEvent.immediateStopped,
        moved,
        targetId: target.id,
        sourceId: source.id,
        firstId: api.manual.order[0],
        gridAvailable,
        localRefreshCalls,
        fallbackRefreshCalls,
        refreshCalls,
        folderOrderBefore,
        folderOrderAfter: currentOrder(),
        itemOrderUnchanged:
          JSON.stringify(
            candidates.slice(0, 2).map((item) => item.order || null)
          ) === itemOrderBefore,
        eventCaptured: fakeEvent.prevented && fakeEvent.immediateStopped
      };
      if (protectedOrderBefore) {
        updateCurrentProtectedOrder(protectedOrderBefore);
      }
      resetManualState();
      api.dragStats = statsBefore;
      renderSettings();
      finishManualDrag();
      return result;
    };
    api.runTakenMetaIntegrationTest = () => {
      const options = document.querySelectorAll(
        '#layout-panel option[data-eagle-photo-taken-meta="true"]'
      );
      const closedValue = document.querySelector(
        "#layout-panel .eagle-photo-taken-meta-value"
      );
      const closedValueOk =
        bodyScope.listMetaType !== META_KEY ||
        (!!closedValue &&
          closedValue.style.display === "flex" &&
          closedValue.textContent.trim() === ui.metaTaken);
      const sample = new Date(2024, 0, 2, 3, 4, 0, 0).getTime();
      const candidate = currentItems().find((item) => {
        return sortRuntime.isMedia(item) &&
          document.getElementById("box-" + item.id)?.querySelector(".metas");
      });
      let renderedText = "";
      let domOk = true;
      if (candidate) {
        const itemId = String(candidate.id);
        const metas = document.getElementById("box-" + itemId).querySelector(
          ".metas"
        );
        const previousType = bodyScope.listMetaType;
        const previousHtml = metas.innerHTML;
        const hadTimestamp = Object.prototype.hasOwnProperty.call(
          api.timestamps,
          itemId
        );
        const previousTimestamp = api.timestamps[itemId];
        bodyScope.listMetaType = META_KEY;
        api.timestamps[itemId] = sample;
        renderTakenMeta();
        renderedText = metas.textContent;
        domOk = renderedText === "2024/01/02 03:04";
        bodyScope.listMetaType = previousType;
        if (hadTimestamp) api.timestamps[itemId] = previousTimestamp;
        else delete api.timestamps[itemId];
        metas.innerHTML = previousHtml;
      }
      return {
        ok:
          options.length > 0 &&
          formatTakenMeta(sample) === "2024/01/02 03:04" &&
          domOk &&
          closedValueOk,
        optionCount: options.length,
        formatted: formatTakenMeta(sample),
        closedValueOk,
        domChecked: !!candidate,
        renderedText,
        currentType: bodyScope.listMetaType || ""
      };
    };
    api.runLiveTakenOrderTest = () => {
      const items = currentItems();
      const takenRuleIndex = api.rules.findIndex(
        (rule) => rule.field === "TAKEN_AT"
      );
      const takenRule = takenRuleIndex >= 0 ? api.rules[takenRuleIndex] : null;
      let violations = 0;
      let previous = null;
      let missingStarted = false;
      let timestampCount = 0;
      for (const item of items) {
        const value = api.timestamps[String(item?.id || "")];
        if (!Number.isFinite(value)) {
          missingStarted = true;
          continue;
        }
        timestampCount += 1;
        if (takenRuleIndex === 0) {
          if (missingStarted) violations += 1;
          if (Number.isFinite(previous)) {
            if (takenRule.direction === "desc" && previous < value) {
              violations += 1;
            }
            if (takenRule.direction !== "desc" && previous > value) {
              violations += 1;
            }
          }
        }
        previous = value;
      }

      const boxes = Array.from(
        document.querySelectorAll("#box-list .box[data-box-id]")
      );
      const visible = boxes.map((box) => {
        const id = String(box.getAttribute("data-box-id") || "");
        const value = api.timestamps[id];
        return {
          id,
          takenAt: Number.isFinite(value) ? value : null,
          meta: box.querySelector(".metas")?.textContent?.trim() || ""
        };
      });
      let visibleViolations = 0;
      let previousVisible = null;
      let visibleMissingStarted = false;
      for (const entry of visible) {
        if (!Number.isFinite(entry.takenAt)) {
          visibleMissingStarted = true;
          continue;
        }
        if (visibleMissingStarted) visibleViolations += 1;
        if (Number.isFinite(previousVisible)) {
          if (takenRule?.direction === "desc" && previousVisible < entry.takenAt) {
            visibleViolations += 1;
          }
          if (takenRule?.direction !== "desc" && previousVisible > entry.takenAt) {
            visibleViolations += 1;
          }
        }
        previousVisible = entry.takenAt;
      }
      const visibleWithTimestamp = visible.filter(
        (entry) => Number.isFinite(entry.takenAt)
      ).length;
      return {
        ok:
          takenRuleIndex !== 0 ||
          (visibleWithTimestamp > 1
            ? visibleViolations === 0
            : violations === 0),
        direction: takenRule?.direction || "",
        takenRuleIndex,
        increase: currentIncrease(),
        rawCount: items.length,
        timestampCount,
        violations,
        visibleCount: visible.length,
        visibleWithTimestamp,
        visibleViolations,
        visibleWithRenderedMeta: visible.filter(
          (entry) => entry.meta && entry.meta !== "—"
        ).length,
        firstRaw: items.slice(0, 5).map((item) => ({
          id: String(item?.id || ""),
          name: String(item?.name || ""),
          takenAt: Number.isFinite(api.timestamps[String(item?.id || "")])
            ? api.timestamps[String(item?.id || "")]
            : null
        })),
        firstVisible: visible.slice(0, 5),
        lastVisible: visible.slice(-5)
      };
    };
    api.runRenameIntegrationTest = () => {
      const plan = renameRuntime.buildPlan([
        { id: "p2", name: "1-old7", ext: "jpg" },
        { id: "p1", name: "1-old6", ext: "jpg" },
        { id: "e1", name: "2-old5", ext: "mov" },
        { id: "doc", name: "1-document", ext: "pdf" }
      ], { folderName: "22-scene" });
      const names = plan.entries.map((entry) => entry.newName);
      const plannerOk =
        names.join(",") === "1-scene1,1-scene2,2-scene1" &&
        plan.ignoredCount === 1;
      const controlsOk = !!document.querySelector(
        ".eagle-photo-sort-rename input"
      ) && !!document.querySelector(".eagle-photo-rename-preview") &&
        !!document.querySelector(".eagle-photo-rename-tree");
      const treeRoutingOk =
        shouldRouteRenameToTree({ entries: [] }, 2) &&
        !shouldRouteRenameToTree({ entries: [{ id: "p1" }] }, 2) &&
        !shouldRouteRenameToTree({ entries: [] }, 1);
      return {
        ok:
          plannerOk &&
          controlsOk &&
          treeRoutingOk &&
          typeof ayncsImagesChange === "function",
        plannerOk,
        controlsOk,
        treeRoutingOk,
        pipelineAvailable: typeof ayncsImagesChange === "function",
        names
      };
    };
    api.runLockIntegrationTest = () => {
      const lockControl = document.querySelector(
        ".eagle-photo-sort-lock input"
      );
      const lockedOrder = sortRuntime.applyManualOrder([
        { id: "new", name: "0", ext: "jpg" },
        { id: "a", name: "1", ext: "jpg" },
        { id: "b", name: "2", ext: "jpg" },
        { id: "c", name: "3", ext: "jpg" }
      ], ["c", "a", "b"]).map((item) => item.id);
      const testId = "__eagle_photo_sort_lock_test__";
      const testLibrary = lockLibrary(true);
      const previousTestProfile = testLibrary.folders[testId];
      testLibrary.folders[testId] = { order: ["c", "a", "b"] };
      const filteredFolders = unlockedFolders([
        { id: testId },
        { id: "__eagle_photo_sort_unlocked_test__" }
      ]).map((folder) => folder.id);
      if (previousTestProfile) {
        testLibrary.folders[testId] = previousTestProfile;
      } else {
        delete testLibrary.folders[testId];
      }
      const currentFolder = bodyScope.currentFolder;
      const tree = currentFolderTree();
      const unlockedCount = unlockedFolders(tree).length;
      const lockedCount = tree.length - unlockedCount;
      const snapshotCount = currentOrderSnapshot().length;
      const sourceItemCount = currentItems().length;
      const markerStats = renderFolderLockMarkers();
      const markerRows = Array.from(document.querySelectorAll(
        "#sidebar-item-container .sidebar-folder-item[id^='folder-']"
      ));
      const markerStateOk = markerRows.every((element) => {
        return element.classList.contains(
          "eagle-photo-sort-folder-locked"
        ) === folderLocked(folderIdFromSidebarItem(element));
      });
      const localDragExpected =
        currentOrder() === SORT_KEY &&
        manualEnabled() &&
        !!bodyScope.currentFolder;
      const localDragPermissionOk =
        canHandleManualDrag() === localDragExpected;
      return {
        ok:
          !!lockControl &&
          lockedOrder.join(",") === "c,a,b,new" &&
          filteredFolders.join(",") ===
            "__eagle_photo_sort_unlocked_test__" &&
          folderIdFromSidebarItem({ id: "folder-test-id" }) === "test-id" &&
          markerStateOk &&
          localDragPermissionOk &&
          (sourceItemCount === 0 || snapshotCount > 0) &&
          unlockedCount + lockedCount === tree.length,
        controlPresent: !!lockControl,
        lockedOrder,
        filteredFolders,
        currentFolderLocked: folderLocked(currentFolder),
        treeFolderCount: tree.length,
        snapshotCount,
        sourceItemCount,
        markerStats,
        markerStateOk,
        localDragExpected,
        localDragPermissionOk,
        unlockedCount,
        lockedCount
      };
    };
    clearInterval(api.menuTimer);
    api.menuTimer = setInterval(ensureMenu, 500);
    const selfTestTimestamps = {
      "__photo_sort_test_old": 1000,
      "__photo_sort_test_new": 3000
    };
    const selfTest = sortRuntime.sortDesired([
      {
        id: "__photo_sort_test_document",
        name: "3-document",
        ext: "pdf",
        modificationTime: 100
      },
      {
        id: "__photo_sort_test_missing",
        name: "1-missing",
        ext: "jpg",
        modificationTime: 100
      },
      {
        id: "__photo_sort_test_new",
        name: "1-new",
        ext: "mov",
        modificationTime: 100
      },
      {
        id: "__photo_sort_test_old",
        name: "1-old",
        ext: "jpg",
        modificationTime: 100
      }
    ], {
      timestamps: selfTestTimestamps,
      rules: sortRuntime.defaultRules
    }).map((item) => item.id);
    const manualSelfTest = sortRuntime.moveItems(
      Array.from({ length: 52 }, (_, index) => ({
        id: String(index + 1)
      })),
      ["51"],
      "50",
      false
    ).slice(48, 52).map((item) => item.id);
    const folderTreeSelfTest = sortRuntime.collectFolderTree({
      id: "root",
      children: [
        { id: "a", children: [{ id: "a-1", children: [] }] },
        { id: "b", children: [] }
      ]
    }).map((folder) => folder.id);

    return {
      ok: true,
      itemCount: currentItems().length,
      optionCount: document.querySelectorAll(
        '#layout-panel option[value="' + SORT_KEY + '"]'
      ).length,
      settingsCount: document.querySelectorAll(
        ".eagle-photo-taken-settings"
      ).length,
      metaOptionCount: document.querySelectorAll(
        '#layout-panel option[data-eagle-photo-taken-meta="true"]'
      ).length,
      metaTreeButtonCount: document.querySelectorAll(
        ".eagle-photo-meta-tree-apply"
      ).length,
      currentOrder: currentOrder(),
      rules: api.rules,
      manualHooked: window.onDropBoxItem !== api.original.onDropBoxItem,
      dragCaptureHooked: Object.keys(api.handlers || {}).length >= 7,
      layoutSelfTest: api.runLayoutIntegrationTest(),
      takenMetaSelfTest: api.runTakenMetaIntegrationTest(),
      renameSelfTest: api.runRenameIntegrationTest(),
      lockSelfTest: api.runLockIntegrationTest(),
      folderTreeSelfTest,
      manualSelfTest,
      selfTest
    };
  })()`;
}

async function inject() {
  const result = await executeInMain(injectionSource());
  if (!result || !result.ok) {
    throw new Error(result ? result.reason : "Injection returned no result");
  }
  injectionReady = true;
  const testPassed =
    Array.isArray(result.selfTest) &&
    result.selfTest.join(",") ===
      "__photo_sort_test_old,__photo_sort_test_new," +
        "__photo_sort_test_missing,__photo_sort_test_document";
  const manualTestPassed =
    Array.isArray(result.manualSelfTest) &&
    result.manualSelfTest.join(",") === "49,51,50,52";
  const layoutTestPassed = result.layoutSelfTest?.ok === true;
  const takenMetaTestPassed = result.takenMetaSelfTest?.ok === true;
  const renameTestPassed = result.renameSelfTest?.ok === true;
  const lockTestPassed = result.lockSelfTest?.ok === true;
  const folderTreeTestPassed =
    Array.isArray(result.folderTreeSelfTest) &&
    result.folderTreeSelfTest.join(",") === "root,a,a-1,b";
  setStatus(
    `菜单注入成功：${result.optionCount} 个入口，排序自检${
      testPassed ? "通过" : "失败"
    }，界面布局${layoutTestPassed ? "通过" : "失败"}，拍摄时间简介${
      takenMetaTestPassed ? "自检通过" : "自检失败"
    }，连续重命名${renameTestPassed ? "自检通过" : "自检失败"}，全局保护${
      lockTestPassed ? "自检通过" : "自检失败"
    }，临时拖动${
      result.manualHooked &&
      result.dragCaptureHooked &&
      manualTestPassed &&
      folderTreeTestPassed
        ? "自检通过"
        : "自检失败"
    }，` +
      `当前列表 ${result.itemCount} 个文件`
  );
  return result;
}

async function getCurrentContext() {
  return executeInMain(`window.__eaglePhotoTakenSort?.current?.() || null`);
}

async function pushTimestamps(values) {
  const serialized = JSON.stringify(values).replace(/</g, "\\u003c");
  return executeInMain(
    `window.__eaglePhotoTakenSort?.setTimestamps(${serialized}) || 0`
  );
}

async function refreshMainList() {
  return executeInMain(`window.__eaglePhotoTakenSort?.refresh?.() || false`);
}

async function claimMainRenameBatch(id) {
  return executeInMain(
    `window.__eaglePhotoTakenSort?.claimRenameBatch?.(${JSON.stringify(id)}) || null`
  );
}

async function completeMainRenameBatch(id, result) {
  const serialized = JSON.stringify(result).replace(/</g, "\\u003c");
  return executeInMain(
    `window.__eaglePhotoTakenSort?.completeRenameBatch?.(` +
      `${JSON.stringify(id)},${serialized}) || false`
  );
}

async function updateMainRenameBatchProgress(id, progress) {
  const serialized = JSON.stringify(progress).replace(/</g, "\\u003c");
  return executeInMain(
    `window.__eaglePhotoTakenSort?.updateRenameBatchProgress?.(` +
      `${JSON.stringify(id)},${serialized}) || false`
  );
}

async function writeRenameBatchBackup(request, plan) {
  if (!plan.changes.length) return;
  const backup = {
    version: 1,
    createdAt: new Date().toISOString(),
    libraryPath: cache.libraryPath,
    requestId: request.id,
    folders: request.folders.map((folder) => ({
      id: folder.id,
      name: folder.name
    })),
    changes: plan.changes.map((entry) => ({
      id: entry.id,
      folderId: entry.folderId,
      oldName: entry.oldName,
      newName: entry.newName
    }))
  };
  const temporaryPath = `${renameBackupPath}.tmp`;
  await fs.promises.writeFile(
    temporaryPath,
    JSON.stringify(backup, null, 2),
    "utf8"
  );
  await fs.promises.rename(temporaryPath, renameBackupPath);
}

async function processRenameBatch(request) {
  const folders = Array.isArray(request?.folders) ? request.folders : [];
  const itemsByFolder = Object.create(null);
  const itemsById = new Map();
  let folderFailures = 0;

  setStatus(`正在准备 ${folders.length} 个文件夹的连续重命名`);
  await updateMainRenameBatchProgress(request.id, {
    stage: "folders",
    current: 0,
    total: folders.length
  });
  for (let folderIndex = 0; folderIndex < folders.length; folderIndex += 1) {
    const folder = folders[folderIndex];
    try {
      const items = await withTimeout(
        eagle.item.get({ folders: [folder.id] }),
        30000,
        `Read folder ${folder.id}`
      );
      const directItems = items.filter((item) => {
        return !Array.isArray(item.folders) || item.folders.includes(folder.id);
      });
      itemsByFolder[folder.id] = directItems;
      for (const item of directItems) {
        if (item?.id && !itemsById.has(String(item.id))) {
          itemsById.set(String(item.id), item);
        }
      }
    } catch (error) {
      folderFailures += 1;
      itemsByFolder[folder.id] = [];
      console.warn(`[photo-taken-sort] Unable to read folder ${folder.id}`, error);
    }
    const folderProcessed = folderIndex + 1;
    if (
      folderProcessed === folders.length ||
      folderProcessed % 5 === 0
    ) {
      setStatus(`正在读取文件夹 ${folderProcessed}/${folders.length}`);
      await updateMainRenameBatchProgress(request.id, {
        stage: "folders",
        current: folderProcessed,
        total: folders.length
      });
    }
  }

  const timestamps = Object.create(null);
  const mediaItems = Array.from(itemsById.values()).filter((item) => {
    return mediaTypeForExtension(item.ext) &&
      backgroundRenameRuntime.groupFromName(item.name);
  });
  let metadataProcessed = 0;
  await updateMainRenameBatchProgress(request.id, {
    stage: "metadata",
    current: 0,
    total: mediaItems.length
  });
  await mapWithConcurrency(mediaItems, 6, async (item) => {
    try {
      timestamps[item.id] = await withTimeout(
        getTakenAt(item),
        20000,
        `Read metadata ${item.id}`
      );
    } catch (error) {
      timestamps[item.id] = null;
      console.warn(
        `[photo-taken-sort] Metadata timeout for ${item.id}`,
        error
      );
    }
    metadataProcessed += 1;
    if (metadataProcessed % 50 === 0 || metadataProcessed === mediaItems.length) {
      setStatus(
        `正在读取全局重命名拍摄时间 ${metadataProcessed}/${mediaItems.length}`
      );
    }
    if (
      metadataProcessed % 100 === 0 ||
      metadataProcessed === mediaItems.length
    ) {
      await updateMainRenameBatchProgress(request.id, {
        stage: "metadata",
        current: metadataProcessed,
        total: mediaItems.length
      });
    }
  });

  const plan = renameBatchRuntime.buildPlan(
    folders,
    itemsByFolder,
    timestamps
  );
  await writeRenameBatchBackup(request, plan);

  let renamed = 0;
  let saveFailures = 0;
  let processed = 0;
  await updateMainRenameBatchProgress(request.id, {
    stage: "saving",
    current: 0,
    total: plan.changes.length
  });
  await mapWithConcurrency(plan.changes, 4, async (entry) => {
    const item = itemsById.get(String(entry.id));
    try {
      if (!item) throw new Error(`Item ${entry.id} is unavailable`);
      item.name = entry.newName;
      await withTimeout(
        item.save(),
        20000,
        `Save item ${entry.id}`
      );
      renamed += 1;
    } catch (error) {
      saveFailures += 1;
      console.warn(`[photo-taken-sort] Rename failed for ${entry.id}`, error);
    } finally {
      processed += 1;
      if (processed % 25 === 0 || processed === plan.changes.length) {
        setStatus(`正在同步文件名 ${processed}/${plan.changes.length}`);
      }
      if (processed % 50 === 0 || processed === plan.changes.length) {
        await updateMainRenameBatchProgress(request.id, {
          stage: "saving",
          current: processed,
          total: plan.changes.length
        });
      }
    }
  });

  const result = {
    folders: plan.folderCount,
    renamed,
    failed: saveFailures + folderFailures + plan.errorCount,
    skippedConflicts: plan.conflictIds.length,
    unchanged: Math.max(0, mediaItems.length - plan.changes.length)
  };
  setStatus(
    `全局连续重命名完成：${result.folders} 个文件夹，` +
      `${result.renamed} 个文件，${result.failed} 个失败，` +
      `${result.skippedConflicts} 个共享冲突已跳过`
  );
  return result;
}

async function handleRenameBatchRequest(request) {
  if (
    !request?.id ||
    request.id === lastRenameBatchId ||
    renameBatchInProgress
  ) {
    return false;
  }
  const claimed = await claimMainRenameBatch(request.id);
  if (!claimed) return false;
  lastRenameBatchId = request.id;
  renameBatchInProgress = (async () => {
    let result;
    try {
      result = await processRenameBatch(claimed);
    } catch (error) {
      console.error("[photo-taken-sort] Global rename failed", error);
      setStatus(`全局连续重命名失败：${error.message}`);
      result = {
        folders: claimed.folders?.length || 0,
        renamed: 0,
        failed: 1,
        skippedConflicts: 0,
        error: error.message
      };
    }
    await completeMainRenameBatch(claimed.id, result);
    await refreshMainList();
  })().finally(() => {
    renameBatchInProgress = null;
  });
  await renameBatchInProgress;
  return true;
}

async function runMainIntegrationChecks() {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return executeInMain(`({
    layout: window.__eaglePhotoTakenSort?.runLayoutIntegrationTest?.() || null,
    drag: window.__eaglePhotoTakenSort?.runDragIntegrationTest?.() || null,
    takenMeta: window.__eaglePhotoTakenSort?.runTakenMetaIntegrationTest?.() || null,
    liveOrder: window.__eaglePhotoTakenSort?.runLiveTakenOrderTest?.() || null,
    lock: window.__eaglePhotoTakenSort?.runLockIntegrationTest?.() || null
  })`);
}

async function scanCurrentItems(context) {
  if (scanInProgress) return scanInProgress;

  scanInProgress = (async () => {
    let sourceItems = Array.isArray(context.items) ? context.items : [];
    if (context.currentFolderId) {
      try {
        const folderItems = await withTimeout(
          eagle.item.get({
            folders: [context.currentFolderId],
            fields: ["id", "ext", "filePath", "name", "folders"]
          }),
          60000,
          `Read current folder ${context.currentFolderId}`
        );
        const directFolderItems = folderItems.filter((item) => {
          return !Array.isArray(item.folders) ||
            item.folders.some(
              (folderId) => String(folderId) === String(context.currentFolderId)
            );
        });
        if (directFolderItems.length || sourceItems.length === 0) {
          sourceItems = directFolderItems;
        }
        setStatus(
          `拍摄时间数据源：文件夹 ${context.currentFolderId} ` +
            `${folderItems.length} 个项目，直接项目 ${directFolderItems.length} 个`
        );
      } catch (error) {
        console.warn(
          `[photo-taken-sort] Unable to read full folder ${context.currentFolderId}`,
          error
        );
      }
    }
    const contextItems = sourceItems.filter(
      (item) => item.id && mediaTypeForExtension(item.ext)
    );
    const items = contextItems.filter((item) => item.filePath);
    setStatus(
      `拍摄时间待读取：${contextItems.length} 个媒体，` +
        `${items.length} 个具有文件路径`
    );
    const values = {};
    let processed = 0;
    let withTakenAt = 0;

    setStatus(`正在读取拍摄时间 0/${items.length}`);
    await mapWithConcurrency(items, 6, async (item) => {
      values[item.id] = await getTakenAt(item);
      if (Number.isFinite(values[item.id])) withTakenAt += 1;
      processed += 1;
      if (processed % 25 === 0 || processed === items.length) {
        setStatus(`正在读取拍摄时间 ${processed}/${items.length}`);
      }
    });

    await pushTimestamps(values);
    await refreshMainList();
    const checks = await runMainIntegrationChecks();
    const dragCheckLabel = checks?.drag?.ok
      ? "通过"
      : checks?.drag?.reason === "temporary drag inactive"
        ? "当前视图不适用"
        : "待列表渲染";
    setStatus(`拍摄时间现场验证：${JSON.stringify(checks?.liveOrder || {})}`);
    setStatus(
      `拍摄时间读取完成：${withTakenAt} 个有拍摄时间，` +
        `${items.length - withTakenAt} 个没有拍摄时间；` +
        `界面${checks?.layout?.ok ? "通过" : "失败"}，` +
        `简介${
          checks?.takenMeta?.ok && checks.takenMeta.domChecked
            ? "实测通过"
            : checks?.takenMeta?.ok
              ? "结构通过"
              : "失败"
        }，` +
        `临时拖动链路${dragCheckLabel}` +
        (context.folderLocked ? "（全局保护已开启）" : "")
    );
  })().finally(() => {
    scanInProgress = null;
  });

  return scanInProgress;
}

async function runSelectedItemSmokeTest() {
  const selectedItems = await eagle.item.getSelected();
  const item = selectedItems.find((candidate) =>
    mediaTypeForExtension(candidate.ext)
  );
  if (!item) {
    setStatus("菜单与排序自检通过；当前没有选中的图片或视频可做实测");
    return;
  }

  const takenAt = await getTakenAt(item);
  setStatus(
    takenAt
      ? `媒体拍摄时间实测通过：${item.name}.${item.ext} -> ${new Date(
          takenAt
        ).toLocaleString()}`
      : `媒体拍摄时间实测完成：${item.name}.${item.ext} 没有可用拍摄时间`
  );
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
}

function setReviewMessage(message = "", type = "") {
  const element = document.getElementById("review-message");
  if (!element) return;
  element.textContent = message;
  element.className = `review-message${type ? ` ${type}` : ""}`;
}

function updateReviewActions() {
  const count = reviewSelection.size;
  const tag = normalizeTag(document.getElementById("review-tag-input")?.value);
  setText("review-selected-count", `已选择 ${count} 个`);
  const apply = document.getElementById("apply-review-tag");
  if (apply) {
    apply.disabled = reviewBusy || count === 0 || !tag;
    const action = reviewSource?.type === "location"
      ? "修改选中照片"
      : "为选中照片添加地点";
    apply.textContent = count > 0
      ? `${action}（${count}）`
      : action;
  }
  const selectAll = document.getElementById("review-select-all");
  if (selectAll) selectAll.disabled = reviewBusy || reviewEntries.length === 0;
  const clear = document.getElementById("review-clear-selection");
  if (clear) clear.disabled = reviewBusy || count === 0;
}

function renderReviewGrid(emptyMessage = "暂无媒体") {
  const panel = document.getElementById("media-review");
  const grid = document.getElementById("review-grid");
  if (!panel || !grid) return;
  panel.hidden = false;
  grid.replaceChildren();
  setText("review-count", `${reviewEntries.length} 个媒体`);
  if (!reviewEntries.length) {
    const empty = document.createElement("div");
    empty.className = "exception-empty";
    empty.textContent = emptyMessage;
    grid.appendChild(empty);
  } else {
    reviewEntries.forEach((entry, index) => {
      const tile = document.createElement("button");
      tile.className = "review-tile";
      tile.type = "button";
      tile.dataset.itemId = String(entry.id);
      tile.dataset.reviewIndex = String(index);
      tile.title = String(entry.name || "媒体");
      tile.setAttribute("aria-label", `选择 ${entry.name || "媒体"}`);
      tile.setAttribute("aria-pressed", "false");
      const image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      if (entry.thumbnailURL) image.src = entry.thumbnailURL;
      const check = document.createElement("span");
      check.className = "review-check";
      check.textContent = "✓";
      tile.append(image, check);
      grid.appendChild(tile);
    });
  }
  updateReviewActions();
}

function syncReviewSelection() {
  document.querySelectorAll("#review-grid [data-item-id]").forEach((tile) => {
    const selected = reviewSelection.has(String(tile.dataset.itemId));
    tile.classList.toggle("selected", selected);
    tile.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  updateReviewActions();
}

function resetMediaReview({ hide = true, message = "" } = {}) {
  reviewLoadToken += 1;
  reviewEntries = [];
  reviewSelection = new Set();
  reviewSource = null;
  reviewLastIndex = -1;
  activeLocationTag = "";
  const panel = document.getElementById("media-review");
  const grid = document.getElementById("review-grid");
  if (panel) panel.hidden = hide;
  if (grid) grid.replaceChildren();
  setText("review-count", "0 个媒体");
  setReviewMessage(message);
  updateReviewActions();
}

async function loadReviewEntries(source, title, loader) {
  const token = ++reviewLoadToken;
  reviewSource = source;
  reviewEntries = [];
  reviewSelection = new Set();
  reviewLastIndex = -1;
  setText("review-title", title);
  setReviewMessage("正在读取缩略图...");
  renderReviewGrid("正在读取...");
  try {
    const entries = await loader();
    if (token !== reviewLoadToken) return;
    reviewEntries = entries || [];
    renderReviewGrid("这个分类中没有媒体");
    setReviewMessage(
      reviewEntries.length
        ? "点击缩略图选择；按住 Shift 可以连续选择。"
        : ""
    );
  } catch (error) {
    if (token !== reviewLoadToken) return;
    reviewEntries = [];
    renderReviewGrid(`读取失败：${error.message}`);
    setReviewMessage(`读取失败：${error.message}`, "error");
  }
}

async function loadLocationItems(tag) {
  activeLocationTag = String(tag || "");
  if (!activeLocationTag || !geoTagService) return;
  document.querySelectorAll("[data-location-tag]").forEach((row) => {
    row.classList.toggle("active", row.dataset.locationTag === activeLocationTag);
  });
  document.querySelectorAll("[data-exception-status]").forEach((button) => {
    button.classList.remove("active");
  });
  const input = document.getElementById("review-tag-input");
  if (input) input.value = "";
  setText("review-editor-label", "识别有误时，改为");
  await loadReviewEntries(
    { type: "location", value: activeLocationTag },
    `“${activeLocationTag}”中的媒体`,
    () => geoTagService.listResultItemsByTag(activeLocationTag)
  );
}

function renderCurrentGeoResults(snapshot) {
  const wrap = document.getElementById("current-scan-result");
  if (!wrap) return;
  const sameContext = currentGeoScanContextId &&
    currentGeoScanContextId === folderTagScopeData?.contextId;
  if (snapshot?.resultKind !== "current" || !sameContext) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const stats = snapshot.resultStats || {};
  const locations = snapshot.resultLocations || [];
  setText("current-result-total", stats.total || 0);
  setText(
    "current-result-located",
    (stats.suggested || 0) + (stats.tagged || 0) + (stats.existing || 0)
  );
  setText("current-result-added", stats.suggested || 0);
  setText("current-result-no-gps", stats.noGps || 0);
  setText("current-result-unresolved", stats.unresolved || 0);

  const list = document.getElementById("location-distribution");
  if (list) {
    list.replaceChildren();
    if (!locations.length) {
      const empty = document.createElement("div");
      empty.className = "location-empty";
      empty.textContent = snapshot.active
        ? "正在识别地点..."
        : "本次没有识别出地点标签。";
      list.appendChild(empty);
    }
    for (const location of locations) {
      const row = document.createElement("button");
      row.className = "location-row";
      if (location.tag === activeLocationTag) row.classList.add("active");
      row.type = "button";
      row.dataset.locationTag = location.tag;
      const body = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = location.tag;
      const detail = document.createElement("small");
      const confirmed = (location.added || 0) + (location.existing || 0);
      detail.textContent = `待确认 ${location.suggested || 0} 个 · 已有 ${confirmed} 个`;
      body.append(name, detail);
      const count = document.createElement("span");
      count.className = "location-row-count";
      count.textContent = String(location.total);
      row.append(body, count);
      list.appendChild(row);
    }
  }
  const confirm = document.getElementById("confirm-auto-locations");
  if (confirm) {
    const suggested = stats.suggested || 0;
    confirm.disabled = snapshot.active || suggested === 0;
    confirm.textContent = suggested
      ? `确认并添加自动标签（${suggested}）`
      : "自动标签已完成，无需再次添加";
  }
}

function renderGeoSnapshot(snapshot = geoTagService?.getSnapshot()) {
  if (!snapshot) return;
  const { stats, resultStats, progress } = snapshot;
  const enabled = document.getElementById("geo-enabled");
  if (enabled) enabled.checked = snapshot.globalEnabled;
  setText("stat-tagged", stats.tagged);
  setText("stat-existing", stats.existing);
  setText("stat-pending", stats.pending);
  setText("stat-no-gps", stats.noGps);
  setText("stat-unresolved", stats.unresolved);
  setText("tab-no-gps", resultStats?.noGps || 0);
  setText("tab-unresolved", resultStats?.unresolved || 0);
  const checked = Math.max(0, stats.total - stats.pending);
  setText("overall-checked", checked);
  setText("overall-total", stats.total);
  const overallBar = document.getElementById("overall-progress-bar");
  if (overallBar) {
    overallBar.style.width = `${stats.total ? Math.round(checked / stats.total * 100) : 0}%`;
  }
  setText(
    "pending-explanation",
    stats.pending
      ? `这 ${stats.pending} 个项目在启用自动地域标签前就已存在于图库中，但插件还没有检查它们的拍摄地点。`
      : "整个图库已经处理完成；以后新导入的文件由上方开关自动识别。"
  );

  for (const id of ["scan-existing", "scan-current", "retry-exceptions"]) {
    const button = document.getElementById(id);
    if (button) button.disabled = snapshot.active;
  }
  const scanExistingButton = document.getElementById("scan-existing");
  if (scanExistingButton) {
    scanExistingButton.disabled = snapshot.active || stats.pending === 0;
    scanExistingButton.textContent = stats.pending
      ? `继续处理未识别项目（${stats.pending}）`
      : "整个图库已经处理完成";
  }
  const retryButton = document.getElementById("retry-exceptions");
  if (retryButton) {
    retryButton.disabled = snapshot.active || stats.unresolved === 0;
  }

  const currentProgress = [
    "current",
    "current-confirm",
    "manual-correction"
  ].includes(progress?.kind);
  const progressWrap = document.getElementById("geo-progress");
  const currentProgressWrap = document.getElementById("current-geo-progress");
  if (progressWrap) {
    progressWrap.classList.toggle("visible", Boolean(progress) && !currentProgress);
  }
  if (currentProgressWrap) {
    currentProgressWrap.classList.toggle("visible", Boolean(progress) && currentProgress);
  }
  if (progress) {
    const kindNames = {
      automatic: "正在处理新导入媒体",
      historical: "正在处理整个图库",
      current: "正在扫描当前文件夹",
      retry: "正在重新检查未识别文件",
      "current-confirm": "正在添加确认后的自动标签",
      "manual-correction": "正在批量修改地点"
    };
    const completeNames = {
      automatic: "新导入媒体处理完成",
      historical: "整个图库处理完成",
      current: "当前文件夹扫描完成",
      retry: "未识别文件检查完成",
      "current-confirm": "自动标签添加完成",
      "manual-correction": "地点修改完成"
    };
    const label = progress.stage === "complete"
      ? completeNames[progress.kind] || "地域标签处理完成"
      : kindNames[progress.kind] || "正在处理地域标签";
    setText("progress-text", label);
    setText("progress-count", `${progress.current} / ${progress.total}`);
    setText("current-progress-text", label);
    setText("current-progress-count", `${progress.current} / ${progress.total}`);
    const bar = document.getElementById("progress-bar");
    const currentBar = document.getElementById("current-progress-bar");
    if (bar) {
      const percentage = progress.total
        ? Math.min(100, Math.round(progress.current / progress.total * 100))
        : 100;
      bar.style.width = `${percentage}%`;
      if (currentBar) currentBar.style.width = `${percentage}%`;
    }
  }

  updateCurrentScanButton(snapshot);
  renderCurrentGeoResults(snapshot);

  setText(
    "status",
    snapshot.active
      ? "地域标签处理中"
      : snapshot.globalEnabled
        ? "新导入自动处理：已开启"
        : "新导入自动处理：已关闭"
  );
}

async function loadExceptionList(status = activeExceptionStatus) {
  if (!geoTagService) return;
  activeExceptionStatus = status;
  activeLocationTag = "";
  document.querySelectorAll("[data-location-tag]").forEach((row) => {
    row.classList.remove("active");
  });
  document.querySelectorAll("[data-exception-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.exceptionStatus === status);
  });
  const input = document.getElementById("review-tag-input");
  if (input) input.value = "";
  setText("review-editor-label", "为选中照片添加地点");
  const title = status === "unresolved"
    ? "未能识别地点的媒体"
    : "没有 GPS 的媒体";
  await loadReviewEntries(
    { type: "exception", value: status },
    title,
    () => geoTagService.listExceptions(status)
  );
}

function clearExceptionList(message = "暂无项目") {
  resetMediaReview({ hide: true, message });
}

async function reloadReviewSource() {
  const source = reviewSource;
  if (!source) return;
  if (source.type === "location") {
    await loadLocationItems(source.value);
  } else {
    await loadExceptionList(source.value);
  }
}

async function confirmAutomaticLocations() {
  if (reviewBusy || !geoTagService) return;
  reviewBusy = true;
  updateReviewActions();
  setReviewMessage("正在添加已确认的自动地点标签...");
  try {
    const result = await geoTagService.confirmCurrentSuggestions();
    const snapshot = geoTagService.getSnapshot();
    renderGeoSnapshot(snapshot);
    await reloadReviewSource();
    setReviewMessage(
      result.failed
        ? `已添加 ${result.succeeded} 个，${result.failed} 个失败。`
        : `完成：已添加 ${result.succeeded} 个自动地点标签。`,
      result.failed ? "error" : "success"
    );
    await loadTagSuggestions();
  } catch (error) {
    setReviewMessage(`添加失败：${error.message}`, "error");
  } finally {
    reviewBusy = false;
    updateReviewActions();
  }
}

async function applyReviewLocation() {
  if (reviewBusy || !geoTagService) return;
  const tag = normalizeTag(document.getElementById("review-tag-input")?.value);
  const ids = Array.from(reviewSelection);
  if (!tag || !ids.length) return;

  reviewBusy = true;
  updateReviewActions();
  setReviewMessage(`正在把 ${ids.length} 个媒体修改为“${tag}”...`);
  try {
    const result = await geoTagService.assignManualLocation(ids, tag);
    renderGeoSnapshot();
    await reloadReviewSource();
    setReviewMessage(
      result.failed
        ? `已修改 ${result.succeeded} 个，${result.failed} 个失败。`
        : `完成：已把 ${result.succeeded} 个媒体的地点修改为“${tag}”。`,
      result.failed ? "error" : "success"
    );
    await loadTagSuggestions();
  } catch (error) {
    setReviewMessage(`修改失败：${error.message}`, "error");
  } finally {
    reviewBusy = false;
    updateReviewActions();
  }
}

function setFolderTagProgress(label, current = 0, total = 0, visible = true) {
  const wrap = document.getElementById("folder-tag-progress");
  if (wrap) wrap.classList.toggle("visible", visible);
  setText("folder-tag-progress-text", label);
  setText("folder-tag-progress-count", `${current} / ${total}`);
  const bar = document.getElementById("folder-tag-progress-bar");
  if (bar) {
    bar.style.width = `${total ? Math.round(current / total * 100) : 0}%`;
  }
}

function setFolderTagBusy(busy) {
  folderTagInProgress = busy;
  const apply = document.getElementById("apply-folder-tag");
  if (apply) apply.disabled = busy || !folderTagPreview?.tag ||
    folderTagPreview.changes.length === 0;
  updateCurrentScanButton();
}

function clearFolderTagPreview(message = "") {
  folderTagPreview = null;
  const preview = document.getElementById("folder-tag-preview");
  if (preview) preview.hidden = false;
  setText("folder-tag-preview-title", "正在统计当前范围...");
  setText("folder-tag-folder-count", "—");
  setText("folder-tag-media-count", "—");
  setText("folder-tag-existing-count", "—");
  setText("folder-tag-change-count", "—");
  const apply = document.getElementById("apply-folder-tag");
  if (apply) {
    apply.disabled = true;
    apply.textContent = "正在统计...";
  }
  setText("folder-tag-message", message);
}

function folderTagScopeFromContext(context) {
  const folders = Array.isArray(context?.folderTree) ? context.folderTree : [];
  if (!folders.length) {
    throw new Error("请先在 Eagle 主窗口打开一个普通文件夹");
  }
  return {
    contextId: String(context.contextId || ""),
    folders,
    root: folders[0]
  };
}

async function currentFolderTagScope(context = null) {
  return folderTagScopeFromContext(context || await getCurrentContext());
}

function folderTagContextKeyFor(context) {
  const folders = Array.isArray(context?.folderTree) ? context.folderTree : [];
  return `${String(context?.contextId || "")}:` +
    folders.map((folder) => String(folder.id || "")).join(",");
}

function renderFolderTagTarget(scope, loading = false) {
  const childCount = Math.max(0, scope.folders.length - 1);
  const label = childCount
    ? `${scope.root.name}，以及下面的 ${childCount} 个子文件夹`
    : `${scope.root.name}（当前文件夹没有子文件夹）`;
  setText("folder-tag-target", loading ? `${label}，正在统计...` : label);
  setText("geo-current-target", label);
  setText(
    "geo-current-count",
    loading
      ? `${scope.folders.length} 个文件夹 · 正在统计图片和视频...`
      : `${scope.folders.length} 个文件夹`
  );
  updateCurrentScanButton();
}

function currentFolderMediaItems() {
  if (!folderTagScopeData) return [];
  return collectFolderMedia(
    folderTagScopeData.folders,
    folderTagScopeData.itemsByFolder,
    (item) => Boolean(mediaTypeForExtension(item.ext))
  );
}

function updateCurrentScanButton(snapshot = geoTagService?.getSnapshot()) {
  const button = document.getElementById("scan-current");
  if (!button) return;
  const mediaCount = currentFolderMediaItems().length;
  const ready = Boolean(folderTagScopeData) && !folderTagInProgress;
  button.disabled = !ready || Boolean(snapshot?.active) || mediaCount === 0;
  if (!ready) {
    button.textContent = "正在统计当前范围...";
  } else if (!mediaCount) {
    button.textContent = "当前范围没有图片或视频";
  } else {
    button.textContent = `扫描并预览（${mediaCount}）`;
  }
  if (ready) {
    setText(
      "geo-current-count",
      `${folderTagScopeData.folders.length} 个文件夹 · ${mediaCount} 个图片和视频`
    );
  }
}

function renderFolderTagPreview(preview) {
  const element = document.getElementById("folder-tag-preview");
  if (!element || !preview) return;
  element.hidden = false;
  setText(
    "folder-tag-preview-title",
    preview.tag ? `当前范围 · “${preview.tag}”` : "当前范围"
  );
  setText("folder-tag-folder-count", preview.folderCount);
  setText("folder-tag-media-count", preview.mediaCount);
  setText("folder-tag-existing-count", preview.tag ? preview.alreadyTagged : "—");
  setText("folder-tag-change-count", preview.tag ? preview.changes.length : "—");
  const apply = document.getElementById("apply-folder-tag");
  if (apply) {
    apply.disabled = folderTagInProgress || !preview.tag ||
      preview.changes.length === 0;
    if (!preview.tag) {
      apply.textContent = "输入地点标签后可添加";
    } else if (!preview.mediaCount) {
      apply.textContent = "当前范围没有图片或视频";
    } else {
      apply.textContent = preview.changes.length
        ? `给 ${preview.changes.length} 个媒体添加 ${preview.tag}`
        : "全部媒体已经有这个标签";
    }
  }
}

function rebuildFolderTagPreview() {
  if (folderTagInProgress) {
    clearTimeout(folderTagInputTimer);
    folderTagInputTimer = setTimeout(rebuildFolderTagPreview, 150);
    return;
  }
  if (!folderTagScopeData) return;
  const input = document.getElementById("folder-tag-input");
  const tag = normalizeTag(input?.value);
  const plan = createFolderTagPlan(
    folderTagScopeData.folders,
    folderTagScopeData.itemsByFolder,
    tag,
    (item) => Boolean(mediaTypeForExtension(item.ext))
  );
  folderTagPreview = {
    ...plan,
    contextId: folderTagScopeData.contextId,
    rootName: folderTagScopeData.root.name
  };
  renderFolderTagPreview(folderTagPreview);
  updateCurrentScanButton();
  if (!plan.mediaCount) {
    setText("folder-tag-message", "这个文件夹范围内没有图片或视频。");
  } else if (!tag) {
    setText("folder-tag-message", "输入地点标签后，已有标签和需要添加的数量会立即更新。");
  } else {
    setText("folder-tag-message", "数量已自动更新；点击蓝色按钮才会真正写入标签。");
  }
}

function drainFolderTagRefreshQueue() {
  if (!folderTagRefreshQueued) return false;
  const context = folderTagPendingContext;
  folderTagRefreshQueued = false;
  folderTagPendingContext = null;
  requestFolderTagRefresh(context, 0);
  return true;
}

async function refreshCurrentFolderTag(context, requestId) {
  if (folderTagInProgress) {
    folderTagRefreshQueued = true;
    folderTagPendingContext = context;
    return;
  }

  setFolderTagBusy(true);
  try {
    const scope = await currentFolderTagScope(context);
    if (requestId !== folderTagRefreshRequest) return;
    renderFolderTagTarget(scope, true);
    const itemsByFolder = Object.create(null);
    let completed = 0;
    setFolderTagProgress("正在读取文件夹", 0, scope.folders.length, true);
    await mapWithConcurrency(scope.folders, 4, async (folder) => {
      const items = await withTimeout(
        eagle.item.get({ folders: [folder.id] }),
        30000,
        `Read folder ${folder.id}`
      );
      itemsByFolder[folder.id] = items.filter(
        (item) => !Array.isArray(item.folders) || item.folders.includes(folder.id)
      );
      completed += 1;
      if (requestId === folderTagRefreshRequest) {
        setFolderTagProgress(
          "正在读取文件夹",
          completed,
          scope.folders.length,
          true
        );
      }
    });

    if (requestId !== folderTagRefreshRequest) return;
    folderTagScopeData = {
      folders: scope.folders,
      itemsByFolder,
      contextId: scope.contextId,
      root: scope.root
    };
    renderFolderTagTarget(scope);
    rebuildFolderTagPreview();
    setFolderTagProgress("范围读取完成", scope.folders.length, scope.folders.length, false);
  } catch (error) {
    if (requestId === folderTagRefreshRequest) {
      folderTagScopeData = null;
      clearFolderTagPreview(error.message);
      setText("folder-tag-target", error.message);
      setFolderTagProgress("读取失败", 0, 0, false);
    }
  } finally {
    setFolderTagBusy(false);
    if (!drainFolderTagRefreshQueue() && folderTagPreview) {
      renderFolderTagPreview(folderTagPreview);
    }
  }
}

function requestFolderTagRefresh(context, delay = 180) {
  clearTimeout(folderTagRefreshTimer);
  const requestId = ++folderTagRefreshRequest;
  folderTagPendingContext = context;
  folderTagScopeData = null;
  currentGeoScanContextId = "";
  activeLocationTag = "";
  const currentResult = document.getElementById("current-scan-result");
  if (currentResult) currentResult.hidden = true;
  resetMediaReview({ hide: true });
  try {
    const scope = folderTagScopeFromContext(context);
    renderFolderTagTarget(scope, true);
    clearFolderTagPreview("正在自动统计当前文件夹范围...");
    setText("folder-tag-folder-count", scope.folders.length);
  } catch (error) {
    clearFolderTagPreview(error.message);
    setText("folder-tag-target", error.message);
    return;
  }
  if (folderTagInProgress) {
    folderTagRefreshQueued = true;
    return;
  }
  folderTagRefreshTimer = setTimeout(() => {
    refreshCurrentFolderTag(context, requestId).catch((error) => {
      console.warn("[photo-taken-sort] Folder tag refresh failed", error);
    });
  }, delay);
}

function syncFolderTagContext(context, force = false) {
  if (!folderTagUiActive || document.visibilityState === "hidden") return;
  const key = folderTagContextKeyFor(context);
  if (!force && key === folderTagContextKey) return;
  folderTagContextKey = key;
  requestFolderTagRefresh(context);
}

async function updateFolderTagTarget(force = false) {
  try {
    syncFolderTagContext(await getCurrentContext(), force);
  } catch (error) {
    clearFolderTagPreview(error.message);
    setText("folder-tag-target", error.message);
  }
}

async function applyCurrentFolderTag() {
  if (folderTagInProgress || !folderTagPreview) return;
  const currentTag = normalizeTag(document.getElementById("folder-tag-input")?.value);
  if (currentTag !== folderTagPreview.tag) {
    rebuildFolderTagPreview();
    return;
  }

  try {
    const scope = await currentFolderTagScope();
    if (scope.contextId !== folderTagPreview.contextId) {
      clearFolderTagPreview("Eagle 当前文件夹已经改变，正在自动更新数量...");
      await updateFolderTagTarget(true);
      return;
    }
  } catch (error) {
    clearFolderTagPreview(error.message);
    return;
  }

  const changes = folderTagPreview.changes.slice();
  if (!changes.length) return;
  setFolderTagBusy(true);
  let completed = 0;
  let succeeded = 0;
  const successfulIds = [];
  const failures = [];
  setFolderTagProgress("正在添加文件夹地点标签", 0, changes.length, true);
  await mapWithConcurrency(changes, 4, async (entry) => {
    try {
      entry.item.tags = Array.from(
        new Set([...(entry.item.tags || []), folderTagPreview.tag])
      );
      await withTimeout(entry.item.save(), 20000, `Save tag ${entry.id}`);
      succeeded += 1;
      successfulIds.push(entry.id);
    } catch (error) {
      failures.push(entry);
      console.warn(`[photo-taken-sort] Folder tag failed for ${entry.id}`, error);
    } finally {
      completed += 1;
      if (completed % 10 === 0 || completed === changes.length) {
        setFolderTagProgress(
          "正在添加文件夹地点标签",
          completed,
          changes.length,
          true
        );
      }
    }
  });

  if (successfulIds.length) {
    try {
      await geoTagService?.markManualTags(successfulIds, folderTagPreview.tag);
    } catch (error) {
      console.warn("[photo-taken-sort] Unable to update manual tag ledger", error);
    }
  }
  folderTagPreview.alreadyTagged += succeeded;
  folderTagPreview.changes = failures;
  renderFolderTagPreview(folderTagPreview);
  setText(
    "folder-tag-message",
    failures.length
      ? `已添加 ${succeeded} 个，${failures.length} 个写入失败，可再次应用重试。`
      : `完成：已为 ${succeeded} 个图片或视频添加“${folderTagPreview.tag}”。`
  );
  setFolderTagProgress("添加完成", completed, changes.length, false);
  setFolderTagBusy(false);
  if (!drainFolderTagRefreshQueue()) renderFolderTagPreview(folderTagPreview);
  renderGeoSnapshot();
  await loadTagSuggestions();
}

async function loadTagSuggestions() {
  const list = document.getElementById("location-tag-options");
  if (!list) return;
  try {
    const tags = await eagle.tag.get();
    const knownTags = geoTagService?.locationTagSuggestions(
      (tags || []).map((tag) => tag?.name).filter(Boolean)
    ) || [];
    const currentTags = (geoTagService?.getSnapshot()?.resultLocations || [])
      .map((location) => location.tag)
      .filter(Boolean);
    const orderedTags = Array.from(new Set([...currentTags, ...knownTags]));
    list.replaceChildren();
    for (const tag of orderedTags) {
      const option = document.createElement("option");
      option.value = tag;
      list.appendChild(option);
    }
  } catch (error) {
    console.warn("[photo-taken-sort] Unable to load tag suggestions", error);
  }
}

function bindGeoUi() {
  const root = document.body;
  if (!root || root.dataset.geoUiBound === "true") return;
  root.dataset.geoUiBound = "true";
  document.getElementById("geo-enabled")?.addEventListener("change", async (event) => {
    await geoTagService?.setGlobalEnabled(event.target.checked);
    renderGeoSnapshot();
  });
  document.getElementById("scan-existing")?.addEventListener("click", async () => {
    clearExceptionList("正在处理整个图库中尚未识别的项目...");
    currentGeoScanContextId = "";
    await geoTagService?.scanExisting();
    renderGeoSnapshot();
    await loadExceptionList();
  });
  document.getElementById("scan-current")?.addEventListener("click", async () => {
    const context = await getCurrentContext();
    if (!folderTagScopeData || context?.contextId !== folderTagScopeData.contextId) {
      setStatus("当前文件夹正在同步，请稍后再试");
      await updateFolderTagTarget(true);
      return;
    }
    const ids = currentFolderMediaItems().map((item) => String(item.id));
    if (!ids.length) {
      setStatus("当前文件夹及全部子文件夹没有可扫描的图片或视频");
      return;
    }
    currentGeoScanContextId = String(context.contextId || "");
    activeLocationTag = "";
    clearExceptionList("正在扫描当前文件夹...");
    await geoTagService?.scanCurrent(ids);
    const snapshot = geoTagService?.getSnapshot();
    renderGeoSnapshot(snapshot);
    await loadTagSuggestions();
    const firstLocation = snapshot?.resultLocations?.[0];
    if (firstLocation) {
      await loadLocationItems(firstLocation.tag);
    } else if (snapshot?.resultStats?.noGps) {
      await loadExceptionList("no_gps");
    } else if (snapshot?.resultStats?.unresolved) {
      await loadExceptionList("unresolved");
    } else {
      resetMediaReview({ hide: true });
    }
  });
  document.getElementById("retry-exceptions")?.addEventListener("click", async () => {
    clearExceptionList("正在重新检查未能识别的文件...");
    await geoTagService?.retryExceptions();
    renderGeoSnapshot();
    await loadExceptionList();
  });
  document.querySelectorAll("[data-exception-status]").forEach((button) => {
    button.addEventListener("click", () => loadExceptionList(button.dataset.exceptionStatus));
  });
  document.getElementById("location-distribution")?.addEventListener(
    "click",
    async (event) => {
      const row = event.target.closest("[data-location-tag]");
      if (row) await loadLocationItems(row.dataset.locationTag);
    }
  );
  document.getElementById("confirm-auto-locations")?.addEventListener(
    "click",
    confirmAutomaticLocations
  );
  document.getElementById("review-grid")?.addEventListener("click", (event) => {
    const tile = event.target.closest("[data-item-id]");
    if (!tile || reviewBusy) return;
    const index = Number(tile.dataset.reviewIndex);
    const id = String(tile.dataset.itemId);
    if (event.shiftKey && reviewLastIndex >= 0 && Number.isFinite(index)) {
      const start = Math.min(reviewLastIndex, index);
      const end = Math.max(reviewLastIndex, index);
      for (let cursor = start; cursor <= end; cursor += 1) {
        const entry = reviewEntries[cursor];
        if (entry?.id) reviewSelection.add(String(entry.id));
      }
    } else if (reviewSelection.has(id)) {
      reviewSelection.delete(id);
    } else {
      reviewSelection.add(id);
    }
    reviewLastIndex = index;
    syncReviewSelection();
  });
  document.getElementById("review-select-all")?.addEventListener("click", () => {
    reviewSelection = new Set(reviewEntries.map((entry) => String(entry.id)));
    syncReviewSelection();
  });
  document.getElementById("review-clear-selection")?.addEventListener("click", () => {
    reviewSelection.clear();
    reviewLastIndex = -1;
    syncReviewSelection();
  });
  document.getElementById("review-tag-input")?.addEventListener("input", (event) => {
    delete event.currentTarget.dataset.pickerPreviousValue;
    updateReviewActions();
    setReviewMessage(reviewSelection.size
      ? "确认地点后，将只修改当前选中的媒体。"
      : "请先选择要修改的媒体。"
    );
  });
  document.getElementById("review-tag-input")?.addEventListener("blur", (event) => {
    const input = event.currentTarget;
    setTimeout(() => {
      const previousValue = input.dataset.pickerPreviousValue;
      if (
        document.activeElement !== input &&
        previousValue !== undefined &&
        !input.value
      ) {
        input.value = previousValue;
        delete input.dataset.pickerPreviousValue;
        updateReviewActions();
      }
    }, 120);
  });
  document.getElementById("review-tag-input")?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const input = event.currentTarget;
    const previousValue = input.dataset.pickerPreviousValue;
    if (previousValue !== undefined && !input.value) {
      input.value = previousValue;
      delete input.dataset.pickerPreviousValue;
      updateReviewActions();
    }
  });
  document.getElementById("review-tag-picker")?.addEventListener("click", () => {
    const input = document.getElementById("review-tag-input");
    if (!input) return;
    if (input.value) {
      input.dataset.pickerPreviousValue = input.value;
      input.value = "";
      updateReviewActions();
    }
    input.focus({ preventScroll: true });
    try {
      input.showPicker?.();
    } catch (error) {
      console.warn("[photo-taken-sort] Unable to open location picker", error);
    }
  });
  document.getElementById("apply-review-tag")?.addEventListener(
    "click",
    applyReviewLocation
  );
  document.getElementById("apply-folder-tag")?.addEventListener(
    "click",
    applyCurrentFolderTag
  );
  document.getElementById("folder-tag-input")?.addEventListener("input", () => {
    clearTimeout(folderTagInputTimer);
    setText("folder-tag-message", "正在根据新标签更新数量...");
    folderTagInputTimer = setTimeout(rebuildFolderTagPreview, 120);
  });
  document.addEventListener("visibilitychange", () => {
    folderTagUiActive = document.visibilityState !== "hidden";
    if (folderTagUiActive) updateFolderTagTarget(true);
  });
}

async function initializeGeoTagService() {
  const dataPath = path.join(pluginPath, "data");
  const resolver = createGeoResolver({
    cities: loadGzipJson(path.join(dataPath, "china-cities.json.gz")),
    specialRegions: loadGzipJson(
      path.join(dataPath, "china-special-regions.json.gz")
    ),
    countries: loadGzipJson(path.join(dataPath, "world-countries.json.gz"))
  });
  geoTagService = createGeoTagService({
    eagle,
    pluginPath,
    resolver,
    mediaTypeForExtension,
    readMediaLocation,
    onProgress: () => renderGeoSnapshot(),
    onStateChange: renderGeoSnapshot,
    log: console
  });
  await geoTagService.initialize(eagle.library?.path);
  bindGeoUi();
  renderGeoSnapshot();
  await loadTagSuggestions();
}

async function runGeoPoll() {
  if (
    geoPollInProgress ||
    !geoTagService ||
    renameBatchInProgress ||
    scanInProgress
  ) {
    return;
  }
  geoPollInProgress = true;
  try {
    const result = await geoTagService.poll();
    if (result) {
      renderGeoSnapshot();
      await loadExceptionList();
    }
  } catch (error) {
    console.warn("[photo-taken-sort] Geo tag poll retry:", error);
  } finally {
    geoPollInProgress = false;
  }
}

function contextNeedsTakenAt(context) {
  return Boolean(
    context && (
      context.metaType === META_KEY ||
      (
        context.orderBy === SORT_KEY &&
        (context.rules || []).some((rule) => rule.field === "TAKEN_AT")
      )
    )
  );
}

async function monitor() {
  if (monitorInProgress) return;
  monitorInProgress = true;
  try {
    if (!injectionReady) await inject();
    const context = await getCurrentContext();
    if (!context) return;
    syncFolderTagContext(context);

    if (context.renameBatchRequest) {
      await handleRenameBatchRequest(context.renameBatchRequest);
    }

    const contextKey =
      `${context.contextId}:${context.orderBy}:${context.metaType}:` +
      `${context.itemFingerprint}:${context.folderLocked}:` +
      JSON.stringify(context.rules || []);
    const needsTakenAt = contextNeedsTakenAt(context);
    const canResolveItems =
      context.items.length > 0 ||
      !!context.currentFolderId ||
      !!context.currentSmartFolderId;
    if (
      needsTakenAt &&
      canResolveItems &&
      contextKey !== lastContextKey
    ) {
      lastContextKey = contextKey;
      await scanCurrentItems(context);
    } else if (needsTakenAt && !canResolveItems) {
      lastContextKey = "";
    } else if (!needsTakenAt) {
      lastContextKey = contextKey;
    }
  } catch (error) {
    injectionReady = false;
    console.warn("[photo-taken-sort] Monitor retry:", error);
  } finally {
    monitorInProgress = false;
  }
}

async function start() {
  await readCache();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const result = await inject();
      setStatus(`已集成到排列方式，当前列表 ${result.itemCount} 个文件`);
      await runSelectedItemSmokeTest();
      await eagle.window.hide();
      break;
    } catch (error) {
      setStatus(
        `等待 Eagle 主窗口 (${attempt + 1}/20)：${error.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }

  clearInterval(monitorTimer);
  monitorTimer = setInterval(monitor, 500);
  await monitor();
}

eagle.onPluginCreate((plugin) => {
  pluginCreatedAt = Date.now();
  startupWindowRequestHandled = false;
  pluginPath = plugin.path;
  cachePath = path.join(pluginPath, "photo-taken-cache.json");
  diagnosticPath = path.join(pluginPath, "diagnostic.log");
  renameBackupPath = path.join(pluginPath, "rename-batch-backup.json");
  fs.promises.writeFile(diagnosticPath, "", "utf8").catch(() => {});
  startPromise = (async () => {
    await initializeGeoTagService();
    await start();
    clearInterval(geoPollTimer);
    geoPollTimer = setInterval(runGeoPoll, 8000);
  })().catch((error) => {
    setStatus(`启动失败：${error.message}`);
    console.error(error);
  });
});

eagle.onLibraryChanged((libraryPath) => {
  const normalizedPath = path.normalize(libraryPath);
  if (
    cache.libraryPath &&
    path.normalize(cache.libraryPath) !== normalizedPath
  ) {
    cache.items = {};
  }
  cache.libraryPath = normalizedPath;
  lastContextKey = "";
  scheduleCacheSave();
  geoTagService?.switchLibrary(normalizedPath).catch((error) => {
    console.warn("[photo-taken-sort] Unable to switch geo tag library", error);
  });
});

eagle.onPluginRun(async () => {
  const automaticStartupRequest =
    !startupWindowRequestHandled &&
    pluginCreatedAt > 0 &&
    Date.now() - pluginCreatedAt < 5000;
  startupWindowRequestHandled = true;
  if (automaticStartupRequest) {
    setStatus("已忽略 Eagle 启动时的自动窗口请求");
    await eagle.window.hide();
    return;
  }
  try {
    setStatus("收到用户打开插件窗口请求");
    if (startPromise) {
      await startPromise;
    } else {
      await inject();
    }
    const context = await getCurrentContext();
    if (contextNeedsTakenAt(context)) {
      lastContextKey = "";
      await scanCurrentItems(context);
    }
    renderGeoSnapshot();
    await loadExceptionList();
    folderTagUiActive = true;
    await eagle.window.show();
    await updateFolderTagTarget(true);
  } catch (error) {
    setStatus(`重新连接失败：${error.message}`);
    await eagle.window.show();
  }
});
