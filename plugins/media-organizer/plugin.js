"use strict";

const fs = require("fs");
const os = require("os");
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
const { createCollectionRuntime } = require(
  path.join(initialPluginPath, "lib", "collection-core.js")
);
const { createRenameRuntime } = require(
  path.join(initialPluginPath, "lib", "rename-core.js")
);
const { createSortingSystemRuntime } = require(
  path.join(initialPluginPath, "lib", "sorting-system-core.js")
);
const { createOrderCoordinator } = require(
  path.join(initialPluginPath, "lib", "order-coordinator-core.js")
);
const { createManualMoveRuntime } = require(
  path.join(initialPluginPath, "lib", "manual-move-core.js")
);
const {
  MOVE_APPLICATION_STAGES,
  createManualMoveApplicationRuntime
} = require(
  path.join(initialPluginPath, "lib", "manual-move-application-core.js")
);
const { createRenameBatchRuntime } = require(
  path.join(initialPluginPath, "lib", "rename-batch-core.js")
);
const { createFolderTreeBatchRuntime } = require(
  path.join(initialPluginPath, "lib", "folder-tree-batch-core.js")
);
const { createFolderLevelRuntime } = require(
  path.join(initialPluginPath, "lib", "folder-level-core.js")
);
const { createTeamSortStateRuntime } = require(
  path.join(initialPluginPath, "lib", "team-sort-state-core.js")
);
const { createTeamStateSyncRuntime, fingerprint: teamStateFingerprint } = require(
  path.join(initialPluginPath, "lib", "team-state-sync-core.js")
);
const { createTeamStateFileRuntime } = require(
  path.join(initialPluginPath, "lib", "team-state-file-core.js")
);
const {
  createScanContextKey,
  shouldRefreshAfterMetadataScan
} = require(
  path.join(initialPluginPath, "lib", "monitor-core.js")
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
const { createRenameCommandQueue } = require(
  path.join(initialPluginPath, "lib", "rename-command-queue.js")
);
const { createRenameLifecycleRuntime } = require(
  path.join(initialPluginPath, "lib", "rename-lifecycle-core.js")
);
const {
  createSortingModuleFacade
} = require(path.join(initialPluginPath, "lib", "sorting-module-facade.js"));
const {
  createEventOwnership,
  applyEventOwnership
} = require(path.join(initialPluginPath, "lib", "event-ownership.js"));
const { createHostInputAdapter } = require(
  path.join(initialPluginPath, "lib", "host-input-adapter.js")
);
const { createSmartDragTargetResolver } = require(
  path.join(initialPluginPath, "lib", "smart-drag-target-resolver.js")
);
const { createDragFeedbackController } = require(
  path.join(initialPluginPath, "lib", "drag-feedback-controller.js")
);
const { createCollectionSettingsRenderer } = require(
  path.join(initialPluginPath, "lib", "collection-settings-renderer.js")
);
const { createSmartCollectionLifecycleController } = require(
  path.join(initialPluginPath, "lib", "smart-collection-lifecycle-core.js")
);
const { createSmartCollectionPresenter } = require(
  path.join(initialPluginPath, "lib", "smart-collection-presenter.js")
);

// PHOTO_TAKEN is the legacy custom key and remains the persisted multi-level
// mode for existing folders. The single taken-time mode has its own key.
const SORT_KEY = "PHOTO_TAKEN";
const TAKEN_SORT_KEY = "PHOTO_TAKEN_AT";
const META_KEY = "PHOTO_TAKEN";
const CACHE_VERSION = 2;
const CANONICAL_PLUGIN_DIRECTORY = "com.max.eagle-photo-taken-sort";
const backgroundSortRuntime = createMediaSortRuntime({
  imageExtensions: IMAGE_EXTENSIONS,
  videoExtensions: VIDEO_EXTENSIONS,
  language: "zh_CN"
});
const backgroundCollectionRuntime = createCollectionRuntime();
const backgroundRenameRuntime = createRenameRuntime({
  isMedia: backgroundSortRuntime.isMedia
});
const backgroundOrderCoordinator = createOrderCoordinator({
  sortRuntime: backgroundSortRuntime
});
const backgroundSortingSystemRuntime = createSortingSystemRuntime({
  sortRuntime: backgroundSortRuntime,
  renameRuntime: backgroundRenameRuntime,
  orderCoordinator: backgroundOrderCoordinator
});
const renameBatchRuntime = createRenameBatchRuntime({
  sortRuntime: backgroundSortRuntime,
  renameRuntime: backgroundRenameRuntime,
  sortingSystemRuntime: backgroundSortingSystemRuntime
});

let pluginPath = initialPluginPath;
let cachePath = path.join(pluginPath, "photo-taken-cache.json");
let diagnosticPath = path.join(pluginPath, "diagnostic.log");
let renameBackupPath = path.join(pluginPath, "rename-batch-backup.json");
let renameCancelPath = path.join(pluginPath, "rename-batch-cancel.json");
let renameRecoveryPath = path.join(pluginPath, "rename-recovery-request.json");
let teamSortStatePath = path.join(
  pluginPath,
  "defaults",
  "sort-state",
  "team.eagle-sort-state.json"
);
const teamSortStateRuntime = createTeamSortStateRuntime();
const teamStateFileRuntime = createTeamStateFileRuntime();
const teamStateWriterId = `${os.hostname()}:${process.pid}`;
let teamStateSelectionOverride = null;
let teamStateSyncRuntime = null;
let teamStateSyncInProgress = false;
let teamStateStatus = {
  source: "none",
  message: "尚未读取团队状态",
  path: ""
};
let cache = { version: CACHE_VERSION, libraryPath: null, items: {} };
let cacheSaveTimer = null;
let injectionReady = false;
let scanInProgress = null;
let scanGeneration = 0;
let latestContextId = "";
let monitorTimer = null;
let monitorInProgress = false;
let lastContextKey = "";
let lastObservedOrderBy = "";
let pendingSmartScanIdentity = "";
let lastTeamImportReport = "";
let lastHostInputDiagnosticSequence = 0;
let lastHostInputDiagnosticAdapterId = "";
let lastMoveDiagnosticSequence = 0;
let lastMoveDiagnosticRuntimeId = "";
let failureDiagnosticSignature = "";
let failureDiagnosticAt = 0;
let startPromise = null;
let pluginCreatedAt = 0;
let startupWindowRequestHandled = false;
let mainBridgeAllowed = false;
let runtimeInstanceAllowed =
  path.basename(path.normalize(initialPluginPath)) === CANONICAL_PLUGIN_DIRECTORY;
let serviceStartTimer = null;
let libraryStabilizeTimer = null;
let renameRecoveryInProgress = null;
let lastRenameRecoveryRequestId = "";
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
let sortingModuleFacade = null;
let sortingModuleLifecycle = null;

// The injected Eagle-side bridge uses the same pure ownership implementation.
// Only this self-contained source crosses the host bridge; it contains no
// collection, rename, or DOM business rules.
const EVENT_OWNERSHIP_SOURCE = [
  'const NATIVE = "eagle";',
  'const SORTING = "sorting";',
  `const createEventOwnership = ${createEventOwnership.toString()};`,
  `const applyEventOwnership = ${applyEventOwnership.toString()};`
].join("\n");
const RENAME_LIFECYCLE_SOURCE =
  `const createRenameLifecycleRuntime = ${createRenameLifecycleRuntime.toString()};`;
const HOST_INPUT_ADAPTER_SOURCE =
  `const createHostInputAdapter = ${createHostInputAdapter.toString()};`;
const SMART_DRAG_TARGET_RESOLVER_SOURCE =
  `const createSmartDragTargetResolver = ${createSmartDragTargetResolver.toString()};`;
const DRAG_FEEDBACK_CONTROLLER_SOURCE =
  `const createDragFeedbackController = ${createDragFeedbackController.toString()};`;
const COLLECTION_SETTINGS_RENDERER_SOURCE =
  `const createCollectionSettingsRenderer = ${createCollectionSettingsRenderer.toString()};`;
const SMART_COLLECTION_LIFECYCLE_SOURCE =
  `const createSmartCollectionLifecycleController = ${createSmartCollectionLifecycleController.toString()};`;
const SMART_COLLECTION_PRESENTER_SOURCE =
  `const createSmartCollectionPresenter = ${createSmartCollectionPresenter.toString()};`;
const MANUAL_MOVE_APPLICATION_SOURCE = [
  `const MOVE_APPLICATION_STAGES = ${JSON.stringify(MOVE_APPLICATION_STAGES)};`,
  `const createManualMoveApplicationRuntime = ${createManualMoveApplicationRuntime.toString()};`
].join("\n");

function createSortingHostPort() {
  const encode = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  return {
    readCollection(context = {}) {
      return executeInMain(
        `window.__eaglePhotoTakenSort?.getCollectionSnapshot?.(${encode(context)}) || null`
      );
    },
    writeManualView(command = {}) {
      return executeInMain(
        `window.__eaglePhotoTakenSort?.writeManualView?.(${encode(command)}) || null`
      );
    },
    requestHostConfirmation(command = {}) {
      return executeInMain(
        `window.__eaglePhotoTakenSort?.requestHostConfirmation?.(${encode(command)}) || null`
      );
    }
  };
}

function ensureSortingModuleFacade() {
  if (sortingModuleFacade) return sortingModuleFacade;
  sortingModuleFacade = createSortingModuleFacade({
    host: createSortingHostPort(),
    legacy: {
      start: async () => {
        await executeInMain(
          "window.__eaglePhotoTakenSort?.startSortingModule?.() || false"
        );
      },
      stop: async () => {
        await executeInMain(
          "window.__eaglePhotoTakenSort?.stopSortingModule?.() || false"
        );
      }
    }
  });
  sortingModuleLifecycle = sortingModuleFacade;
  return sortingModuleFacade;
}

const renameCommandQueue = createRenameCommandQueue({
  execute: executeRenameCommand
});

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

async function persistDiagnosticFailure(phase, error) {
  const detail = String(
    error?.stack || error?.message || error || "Unknown runtime failure"
  );
  const signature = `${String(phase || "RUNTIME_FAILURE")}:${detail}`;
  const now = Date.now();
  if (
    signature === failureDiagnosticSignature &&
    now - failureDiagnosticAt < 60_000
  ) {
    if (error && typeof error === "object") {
      error.__eaglePhotoDiagnosticLogged = true;
    }
    return false;
  }
  const safePhase = String(phase || "RUNTIME_FAILURE").replace(
    /[^\w-]+/g,
    "_"
  );
  try {
    await fs.promises.appendFile(
      diagnosticPath,
      `${new Date(now).toISOString()} ${safePhase} ${detail.replace(
        /\r?\n/g,
        " | "
      )}\n`,
      "utf8"
    );
    failureDiagnosticSignature = signature;
    failureDiagnosticAt = now;
    if (error && typeof error === "object") {
      error.__eaglePhotoDiagnosticLogged = true;
    }
    return true;
  } catch (diagnosticError) {
    console.warn(
      "[photo-taken-sort] Unable to persist runtime failure:",
      diagnosticError
    );
    return false;
  }
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

  const hostSignature = itemCacheSignature(item);
  const cached = cache.items[item.id];
  if (
    cached &&
    hostSignature &&
    (cached.hostSignature === hostSignature || cached.signature === hostSignature)
  ) {
    return Number.isFinite(cached.takenAt) ? cached.takenAt : null;
  }

  let stat;
  try {
    stat = await fs.promises.stat(item.filePath);
  } catch {
    return null;
  }

  const signature = `${stat.size}:${Math.trunc(stat.mtimeMs)}`;
  if (cached && cached.signature === signature) {
    if (hostSignature && cached.hostSignature !== hostSignature) {
      cached.hostSignature = hostSignature;
      scheduleCacheSave();
    }
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

  cache.items[item.id] = { signature, hostSignature, mediaType, takenAt };
  scheduleCacheSave();
  return takenAt;
}

function itemCacheSignature(item) {
  const size = Number(item?.size);
  const modified = Number(item?.mtime ?? item?.modificationTime);
  if (!Number.isFinite(size) || !Number.isFinite(modified)) return "";
  return `${Math.trunc(size)}:${Math.trunc(modified)}`;
}

function cachedTakenAt(item) {
  const cached = cache.items[String(item?.id || "")];
  const hostSignature = itemCacheSignature(item);
  if (
    !cached ||
    !hostSignature ||
    (cached.hostSignature !== hostSignature && cached.signature !== hostSignature)
  ) {
    return { hit: false, value: null };
  }
  return {
    hit: true,
    value: Number.isFinite(cached.takenAt) ? cached.takenAt : null
  };
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

async function mainLibraryReadiness() {
  try {
    return await executeInMain(`(() => {
      const scope = window.angular && window.angular.element(document.body).scope();
      const hash = String(window.location.hash || "");
      const libraryId = String(scope?.rootDir || "");
      return {
        ready: Boolean(scope && libraryId && hash.includes("view=")),
        hash,
        libraryId
      };
    })()`);
  } catch (error) {
    return {
      ready: false,
      hash: "",
      libraryId: "",
      reason: error?.message || String(error)
    };
  }
}

async function currentLibraryFolders() {
  try {
    const folders = await eagle.folder.getAll();
    return Array.isArray(folders) ? folders : [];
  } catch (error) {
    console.warn("[photo-taken-sort] Unable to read folder inventory", error);
    return [];
  }
}

async function readVerifiedTeamState(filePath, options = {}) {
  try {
    const parsed = JSON.parse(await fs.promises.readFile(filePath, "utf8"));
    const verification = teamSortStateRuntime.verifyState(parsed);
    if (!verification.ok) {
      return {
        state: null,
        verification,
        source: options.source || "file",
        path: filePath,
        blocked: true
      };
    }
    const folders = options.folders || await currentLibraryFolders();
    const compatibility = teamSortStateRuntime.targetLibraryCompatibility(
      parsed,
      folders
    );
    if (!compatibility.ok && options.allowMismatch !== true) {
      return {
        state: null,
        verification: {
          ok: false,
          reason: compatibility.reason,
          compatibility
        },
        source: options.source || "file",
        path: filePath,
        blocked: true
      };
    }
    return {
      state: parsed,
      verification: { ...verification, compatibility },
      source: options.source || "file",
      path: filePath,
      blocked: false
    };
  } catch (error) {
    return {
      state: null,
      verification: {
        ok: false,
        reason: error?.code === "ENOENT"
          ? "no-state-file"
          : error?.message || String(error)
      },
      source: options.source || "file",
      path: filePath,
      blocked: error?.code !== "ENOENT"
    };
  }
}

async function selectTeamStateForCurrentLibrary() {
  if (teamStateSelectionOverride) {
    const selected = teamStateSelectionOverride;
    teamStateSelectionOverride = null;
    return selected;
  }

  const libraryPath = eagle.library?.path || "";
  const folders = await currentLibraryFolders();
  const sidecarPath = teamSortStateRuntime.statePathForLibrary(libraryPath);
  if (sidecarPath) {
    const sidecar = await readVerifiedTeamState(sidecarPath, {
      source: "library-sidecar",
      folders
    });
    if (sidecar.state || sidecar.blocked) return sidecar;
  }

  const bundled = await readVerifiedTeamState(teamSortStatePath, {
    source: "bundled-default",
    folders,
    allowMismatch: true
  });
  return bundled;
}

function injectionSource(teamStateSelection = null) {
  let renameCancelRequest = null;
  try {
    const parsed = JSON.parse(fs.readFileSync(renameCancelPath, "utf8"));
    if (parsed && parsed.version === 1) renameCancelRequest = parsed;
  } catch {}
  const teamSortState = teamStateSelection?.state || null;
  const teamSortVerify = teamStateSelection?.verification || {
    ok: false,
    reason: "no-state-file"
  };
  const teamSortSource = teamStateSelection?.source || "none";
  return `(() => {
    const SORT_KEY = ${JSON.stringify(SORT_KEY)};
    const TAKEN_SORT_KEY = ${JSON.stringify(TAKEN_SORT_KEY)};
    const API_VERSION = 104;
    const AUTO_RENAME_QUIET_MS = 400;
    const META_KEY = ${JSON.stringify(META_KEY)};
    const RENAME_CANCEL_REQUEST = ${JSON.stringify(renameCancelRequest)};
    const TEAM_SORT_STATE = ${JSON.stringify(teamSortState)};
    const TEAM_SORT_VERIFY = ${JSON.stringify(teamSortVerify)};
    const TEAM_SORT_SOURCE = ${JSON.stringify(teamSortSource)};
    const RULES_STORAGE_KEY = "eagle.photoTakenSort.rules.v2";
    const LEGACY_RULES_STORAGE_KEY = "eagle.photoTakenSort.rules.v1";
    const LEGACY_MANUAL_ENABLED_STORAGE_KEY = "eagle.photoTakenSort.manualEnabled";
    const MANUAL_MODE_STORAGE_KEY = "eagle.photoTakenSort.manualMode.v1";
    const MANUAL_STORAGE_KEY = "eagle.photoTakenSort.manualViews.v2";
    const LEGACY_LOCK_STORAGE_KEY = "eagle.photoTakenSort.folderLocks.v1";
    const LEGACY_PROTECTION_STORAGE_KEY = "eagle.photoTakenSort.protection.v2";
    const LOCK_STORAGE_KEY = "eagle.photoTakenSort.sortingLocks.v3";
    const META_STORAGE_KEY = "eagle.photoTakenSort.metaProfiles.v1";
    const RENAME_STORAGE_KEY = "eagle.photoTakenSort.autoRename.v1";
    ${EVENT_OWNERSHIP_SOURCE}
    ${RENAME_LIFECYCLE_SOURCE}
    ${HOST_INPUT_ADAPTER_SOURCE}
    ${SMART_DRAG_TARGET_RESOLVER_SOURCE}
    ${DRAG_FEEDBACK_CONTROLLER_SOURCE}
    ${COLLECTION_SETTINGS_RENDERER_SOURCE}
    ${SMART_COLLECTION_LIFECYCLE_SOURCE}
    ${SMART_COLLECTION_PRESENTER_SOURCE}
    ${MANUAL_MOVE_APPLICATION_SOURCE}
    const renameLifecycleRuntime = createRenameLifecycleRuntime();
    const sortingWindowId = String(
      window.__eaglePhotoSortWindowId ||
      (window.__eaglePhotoSortWindowId =
        "eagle-window-" + Math.random().toString(36).slice(2))
    );
    const sortingOwnership = createEventOwnership({
      enabled: true,
      windowId: sortingWindowId,
      hostAppId: "eagle"
    });
    const LABELS = {
      zh_CN: "多级排序",
      zh_TW: "多級排序",
      ja_JP: "多段階並べ替え",
      ko_KR: "다단계 정렬",
      de_DE: "Mehrstufige Sortierung",
      es_ES: "Orden multinivel",
      ru_RU: "Многоуровневая сортировка",
      en: "Multi-level Sorting"
    };
    const TAKEN_LABELS = {
      zh_CN: "拍摄时间排序",
      zh_TW: "拍攝時間排序",
      ja_JP: "撮影時間順",
      ko_KR: "촬영 시간 정렬",
      de_DE: "Aufnahmezeit",
      es_ES: "Ordenar por fecha de captura",
      ru_RU: "Сортировка по времени съёмки",
      en: "Taken-time sorting"
    };
    const UI_LABELS = {
      zh_CN: {
        title: "多级排序规则",
        takenSort: "拍摄时间排序",
        edit: "编辑规则",
        applyTree: "应用到全部",
        applyTreeConfirm: "将当前排列方式、升降序及相关规则一次性应用到 {count} 个文件夹？以后仍可单独修改任意子文件夹。",
        appliedTree: "已应用到 {count} 个文件夹",
        appliedTreePartial: "已应用到 {count} 个文件夹，{failed} 个失败",
        applyTreeFailed: "应用失败：{reason}",
        applyManualTreeConfirm: "将手动拖动{action}到当前文件夹及全部子文件夹，共 {count} 个？",
        appliedManualTree: "手动拖动已{action}：{count} 个文件夹",
        appliedManualTreePartial: "手动拖动已{action}：{count} 个文件夹，{failed} 个失败",
        applyManualTreeFailed: "手动拖动应用失败：{reason}",
        manualTreeOn: "开启",
        manualTreeOff: "关闭",
        libraryUnavailable: "资源库暂不可用：{reason}",
        lockCurrent: "排序锁定",
        lockedState: "已锁定；先关闭才能修改排序、拖动或编号",
        unlockedState: "锁定后不可修改当前层顺序",
        descendantLockedState: "下级已锁定 {count} 个文件夹",
        lockSkipNotice: "，跳过 {count} 个已保护文件夹",
        allFoldersLocked: "目标文件夹均已锁定，未做修改",
        applyMetaTree: "应用到全部",
        applyMetaTreeConfirm: "将“{type}”一次性应用到 {count} 个文件夹？以后仍可单独修改任意子文件夹。",
        appliedMetaTree: "已应用到 {count} 个文件夹",
        appliedMetaTreePartial: "已应用到 {count} 个文件夹，{failed} 个失败",
        applyMetaTreeFailed: "简介应用失败：{reason}",
        autoRename: "自动编号",
        previewRename: "预览当前文件夹",
        previewRenameEmpty: "当前文件夹无可重命名媒体",
        undoRename: "撤销上次重命名",
        renameIdle: "仅处理 1- / 2- 开头的媒体",
        renameTreeReady: "当前层无媒体；先勾选自动编号，再点应用到全部处理 {count} 个文件夹",
        renameTreeRequiresEnable: "请先勾选自动编号，再点击应用到全部",
        renameReady: "人物 {people} · 环境 {environment} · 待改 {changes}",
        renameDone: "已按当前顺序重命名 {count} 个文件",
        renameUndone: "已撤销 {count} 个文件，并关闭自动重命名",
        renameTitle: "按当前顺序连续重命名",
        renameScene: "场景名：{scene}",
        renameSummary: "人物 {people} 个 · 环境 {environment} 个 · 忽略 {ignored} 个",
        renameWarning: "确认后将同时修改 Eagle 名称和实际文件名。自动模式开启后，拖动、删除或新增项目都会再次连续编号。",
        renameEmptyScene: "无法从当前文件夹名称提取场景名。",
        renameNoItems: "当前文件夹没有以 1- 或 2- 开头的图片或视频。",
        renameNoChanges: "当前名称已经连续，无需修改。",
        renameCancel: "取消",
        renameOnce: "重命名 {count} 个",
        renameEnable: "启用并重命名 {count} 个",
        renameEnableNoChanges: "启用自动重命名",
        applyRenameTree: "应用到全部",
        applyRenameTreeConfirm: "为当前文件夹及全部子文件夹开启自动编号，共 {count} 个文件夹？确认后会立即修改所有匹配媒体的 Eagle 名称和实际文件名。",
        renameTreeQueued: "开关已同步 {total} 个文件夹；已提交 {count} 个执行编号，正在后台处理",
        renameTreeStateOnly: "开关已同步 {total} 个文件夹；{protected} 个受保护文件夹未执行编号",
        renameTreeRunning: "正在同步全部子文件夹…",
        renameTreePreparing: "正在读取文件夹 {current}/{total}",
        renameTreeMetadata: "正在读取拍摄时间 {current}/{total}",
        renameTreeSaving: "正在同步文件名 {current}/{total}（{percent}%）",
        renameTreeDone: "已同步 {folders} 个文件夹，重命名 {files} 个文件",
        renameTreePartial: "已处理 {folders} 个文件夹，成功 {files} 个，失败 {failed} 个",
        manual: "手动拖动",
        idle: "尚未手动调整",
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
        NAME: "文件名（自然排序）",
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
        title: "多級排序規則",
        takenSort: "拍攝時間排序",
        edit: "編輯規則",
        applyTree: "套用到全部",
        applyTreeConfirm: "將目前排列方式、升降序及相關規則一次性套用到 {count} 個資料夾？之後仍可單獨修改任意子資料夾。",
        appliedTree: "已套用到 {count} 個資料夾",
        appliedTreePartial: "已套用到 {count} 個資料夾，{failed} 個失敗",
        applyTreeFailed: "套用失敗：{reason}",
        applyManualTreeConfirm: "將臨時拖動{action}到目前資料夾及全部子資料夾，共 {count} 個？",
        appliedManualTree: "臨時拖動已{action}：{count} 個資料夾",
        appliedManualTreePartial: "臨時拖動已{action}：{count} 個資料夾，{failed} 個失敗",
        applyManualTreeFailed: "臨時拖動套用失敗：{reason}",
        manualTreeOn: "開啟",
        manualTreeOff: "關閉",
        libraryUnavailable: "資料庫暫不可用：{reason}",
        lockCurrent: "防止全域覆蓋",
        lockedState: "目前集合的排序設定已保護",
        unlockedState: "目前集合的排序設定未保護",
        descendantLockedState: "下層已保護 {count} 個資料夾",
        lockSkipNotice: "，略過 {count} 個已保護資料夾",
        allFoldersLocked: "目標資料夾均已鎖定，未做修改",
        applyMetaTree: "套用到全部",
        applyMetaTreeConfirm: "將「{type}」一次性套用到 {count} 個資料夾？之後仍可單獨修改任意子資料夾。",
        appliedMetaTree: "已套用到 {count} 個資料夾",
        appliedMetaTreePartial: "已套用到 {count} 個資料夾，{failed} 個失敗",
        applyMetaTreeFailed: "簡介套用失敗：{reason}",
        autoRename: "自動命名/編號",
        previewRename: "預覽目前資料夾",
        previewRenameEmpty: "目前資料夾無可重新命名媒體",
        undoRename: "復原上次重新命名",
        renameIdle: "僅處理 1- / 2- 開頭的媒體",
        renameTreeReady: "目前層無媒體；請先勾選自動編號，再點套用到全部處理 {count} 個資料夾",
        renameTreeRequiresEnable: "請先勾選自動編號，再點套用到全部",
        renameReady: "人物 {people} · 環境 {environment} · 待改 {changes}",
        renameDone: "已按目前順序重新命名 {count} 個檔案",
        renameUndone: "已復原 {count} 個檔案，並關閉自動重新命名",
        renameTitle: "按目前順序連續重新命名",
        renameScene: "場景名：{scene}",
        renameSummary: "人物 {people} 個 · 環境 {environment} 個 · 忽略 {ignored} 個",
        renameWarning: "確認後將同時修改 Eagle 名稱和實際檔名。自動模式開啟後，拖動、刪除或新增項目都會再次連續編號。",
        renameEmptyScene: "無法從目前資料夾名稱提取場景名。",
        renameNoItems: "目前資料夾沒有以 1- 或 2- 開頭的圖片或影片。",
        renameNoChanges: "目前名稱已經連續，無需修改。",
        renameCancel: "取消",
        renameOnce: "重新命名 {count} 個",
        renameEnable: "啟用並重新命名 {count} 個",
        renameEnableNoChanges: "啟用自動重新命名",
        applyRenameTree: "套用到全部",
        applyRenameTreeConfirm: "為目前資料夾及全部子資料夾開啟自動編號，共 {count} 個資料夾？確認後會立即修改所有符合媒體的 Eagle 名稱和實際檔名。",
        renameTreeQueued: "開關已同步 {total} 個資料夾；已提交 {count} 個執行編號，正在背景處理",
        renameTreeStateOnly: "開關已同步 {total} 個資料夾；{protected} 個受保護資料夾未執行編號",
        renameTreeRunning: "正在同步全部子資料夾…",
        renameTreePreparing: "正在讀取資料夾 {current}/{total}",
        renameTreeMetadata: "正在讀取拍攝時間 {current}/{total}",
        renameTreeSaving: "正在同步檔名 {current}/{total}（{percent}%）",
        renameTreeDone: "已同步 {folders} 個資料夾，重新命名 {files} 個檔案",
        renameTreePartial: "已處理 {folders} 個資料夾，成功 {files} 個，失敗 {failed} 個",
        manual: "臨時拖動",
        idle: "尚未手動調整",
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
        NAME: "檔名（自然排序）",
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
        title: "Multi-level sorting rules",
        takenSort: "Taken-time sorting",
        edit: "Edit rules",
        applyTree: "Apply to all",
        applyTreeConfirm: "Apply the current arrangement, direction, and related rules once to {count} folders? Any descendant can still be changed independently later.",
        appliedTree: "Applied to {count} folders",
        appliedTreePartial: "Applied to {count} folders, {failed} failed",
        applyTreeFailed: "Apply failed: {reason}",
        applyManualTreeConfirm: "Turn manual drag {action} for the current folder and every descendant ({count} folders)?",
        appliedManualTree: "Manual drag turned {action} for {count} folders",
        appliedManualTreePartial: "Manual drag turned {action} for {count} folders, {failed} failed",
        applyManualTreeFailed: "Manual drag apply failed: {reason}",
        manualTreeOn: "on",
        manualTreeOff: "off",
        libraryUnavailable: "Library unavailable: {reason}",
        lockCurrent: "Protect from global changes",
        lockedState: "Sorting configuration protected",
        unlockedState: "Sorting configuration not protected",
        descendantLockedState: "{count} protected descendant folders",
        lockSkipNotice: ", skipped {count} protected folders",
        allFoldersLocked: "All target folders are locked; nothing changed",
        applyMetaTree: "Apply to all",
        applyMetaTreeConfirm: "Apply “{type}” once to {count} folders? Any descendant can still be changed independently later.",
        appliedMetaTree: "Applied to {count} folders",
        appliedMetaTreePartial: "Applied to {count} folders, {failed} failed",
        applyMetaTreeFailed: "Info apply failed: {reason}",
        autoRename: "Automatic naming/numbering",
        previewRename: "Preview current folder",
        previewRenameEmpty: "No matching media in current folder",
        undoRename: "Undo last rename",
        renameIdle: "Only 1- / 2- media files are included",
        renameTreeReady: "No media at this level; tick automatic numbering, then apply to all {count} folders",
        renameTreeRequiresEnable: "Tick automatic numbering before applying to all",
        renameReady: "People {people} · Environment {environment} · Changes {changes}",
        renameDone: "Renamed {count} files in the current order",
        renameUndone: "Restored {count} files and disabled automatic rename",
        renameTitle: "Continuous rename in current order",
        renameScene: "Scene: {scene}",
        renameSummary: "People {people} · Environment {environment} · Ignored {ignored}",
        renameWarning: "This changes both Eagle names and the actual filenames. While automatic mode is enabled, dragging, deleting, or importing items will renumber again.",
        renameEmptyScene: "A scene name could not be derived from this folder name.",
        renameNoItems: "This folder has no image or video beginning with 1- or 2-.",
        renameNoChanges: "Names are already continuous.",
        renameCancel: "Cancel",
        renameOnce: "Rename {count}",
        renameEnable: "Enable and rename {count}",
        renameEnableNoChanges: "Enable automatic rename",
        applyRenameTree: "Apply to all",
        applyRenameTreeConfirm: "Enable automatic numbering for this folder and all descendants ({count} folders)? This immediately changes matching Eagle names and actual filenames.",
        renameTreeQueued: "Enabled {total} folders; queued numbering for {count} folders",
        renameTreeStateOnly: "Enabled {total} folders; numbering skipped for {protected} protected folders",
        renameTreeRunning: "Synchronizing all descendant folders…",
        renameTreePreparing: "Reading folders {current}/{total}",
        renameTreeMetadata: "Reading taken time {current}/{total}",
        renameTreeSaving: "Synchronizing names {current}/{total} ({percent}%)",
        renameTreeDone: "Synchronized {folders} folders and renamed {files} files",
        renameTreePartial: "Processed {folders} folders: {files} succeeded, {failed} failed",
        manual: "Temporary drag",
        idle: "No temporary changes",
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
        NAME: "Filename (natural)",
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
    if (
      previousApi &&
      previousApi.version === API_VERSION &&
      previousApi.integrationResult
    ) {
      return {
        ...previousApi.integrationResult,
        reused: true,
        initializedAt: previousApi.initializedAt
      };
    }
    if (previousApi && previousApi.version !== API_VERSION) {
      clearInterval(previousApi.menuTimer);
      clearTimeout(previousApi.rename?.timer);
      clearTimeout(previousApi.lockRecoveryTimer);
      clearTimeout(previousApi.protectedOrderCaptureTimer);
      clearTimeout(previousApi.dragCleanupTimer);
      clearTimeout(previousApi.rename?.visibleMaskTimer);
      previousApi.rename?.visibleMaskObserver?.disconnect?.();
      for (const timer of previousApi.dragPostCleanupTimers || []) {
        clearTimeout(timer);
      }
      for (const method of [
        "sortData",
        "sortRawData",
        "changeOrderBy",
        "changeSortIncrease",
        "changeFolderName"
      ]) {
        if (previousApi.original && previousApi.original[method]) {
          bodyScope[method] = previousApi.original[method];
        }
      }
      if (previousApi.original && previousApi.original.onDropBoxItem) {
        window.onDropBoxItem = previousApi.original.onDropBoxItem;
      }
      if (
        previousApi.original?.subFolderSortableUpdate &&
        bodyScope.subFolderSortableOptions
      ) {
        bodyScope.subFolderSortableOptions.update =
          previousApi.original.subFolderSortableUpdate;
        delete bodyScope.subFolderSortableOptions.__eaglePhotoManualWrapped;
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
      document.querySelectorAll(".eagle-photo-collection-actions").forEach(
        (element) => element.remove()
      );
      document.querySelectorAll(
        ".eagle-photo-sort-protection-settings"
      ).forEach((element) => element.remove());
      document.querySelectorAll(".eagle-photo-meta-tree-settings").forEach(
        (element) => element.remove()
      );
      document.querySelectorAll(".eagle-photo-order-tree-settings").forEach(
        (element) => element.remove()
      );
      document.querySelectorAll(".eagle-photo-rename-modal").forEach(
        (element) => element.remove()
      );
      document.querySelectorAll(".eagle-photo-taken-meta-value").forEach(
        (element) => element.remove()
      );
      document.querySelectorAll(".eagle-photo-taken-time-value").forEach(
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
    api.moveDiagnostics = [];
    api.moveDiagnosticSequence = 0;
    api.moveDiagnosticRuntimeId = sortingWindowId + ":" + Date.now();

    function recordMoveDiagnostic(stage, payload = {}) {
      api.moveDiagnosticSequence += 1;
      api.moveDiagnostics.push({
        runtimeId: api.moveDiagnosticRuntimeId,
        sequence: api.moveDiagnosticSequence,
        at: Date.now(),
        stage: String(stage || ""),
        contextId: currentContextId(),
        ...payload
      });
      if (api.moveDiagnostics.length > 64) api.moveDiagnostics.shift();
    }

    ${createMediaSortRuntime.toString()}
    const sortRuntime = createMediaSortRuntime({
      imageExtensions: ${JSON.stringify(IMAGE_EXTENSIONS)},
      videoExtensions: ${JSON.stringify(VIDEO_EXTENSIONS)},
      language
    });
    ${createCollectionRuntime.toString()}
    const collectionRuntime = createCollectionRuntime();
    ${createRenameRuntime.toString()}
    const renameRuntime = createRenameRuntime({
      isMedia: sortRuntime.isMedia
    });
    ${createOrderCoordinator.toString()}
    const orderCoordinator = createOrderCoordinator({ sortRuntime });
    ${createManualMoveRuntime.toString()}
    const manualMoveRuntime = createManualMoveRuntime({
      sortRuntime,
      orderCoordinator
    });
    ${createSortingSystemRuntime.toString()}
    const sortingSystemRuntime = createSortingSystemRuntime({
      sortRuntime,
      renameRuntime,
      orderCoordinator
    });
    ${createFolderTreeBatchRuntime.toString()}
    const folderTreeBatchRuntime = createFolderTreeBatchRuntime({
      collectFolderTree: sortRuntime.collectFolderTree
    });
    ${createFolderLevelRuntime.toString()}
    const folderLevelRuntime = createFolderLevelRuntime();
    ${createTeamSortStateRuntime.toString()}
    const teamSortStateRuntime = createTeamSortStateRuntime();
    const collectionSettingsRenderer = createCollectionSettingsRenderer();
    let smartCollectionLifecycleController = null;
    let smartCollectionPresenter = null;
    let smartCollectionObserver = null;
    let smartCollectionObserverTarget = null;
    let smartHostObservationQueued = false;

    function parseStoredJson(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    }

    function importTeamSortState() {
      if (!TEAM_SORT_STATE) {
        return TEAM_SORT_VERIFY?.reason
          ? { imported: false, reason: TEAM_SORT_VERIFY.reason }
          : { imported: false, reason: "no-state-file" };
      }
      const payloadSha256 = TEAM_SORT_VERIFY?.payloadSha256 ||
        TEAM_SORT_STATE.integrity?.payloadSha256 || "";
      const libraryId = String(bodyScope.rootDir || "default");
      if (!teamSortStateRuntime.isLibraryReady(libraryId)) {
        return { imported: false, reason: "library-not-ready", libraryId };
      }
      const mapped = teamSortStateRuntime.mappedEntries(
        TEAM_SORT_STATE,
        libraryId,
        { includeAutoRename: false }
      );
      const riskEntries = [];
      let autoRenamePausedFolderCount = 0;
      if (mapped.skipped.includes(RENAME_STORAGE_KEY)) {
        const renameStore = parseStoredJson(
          RENAME_STORAGE_KEY,
          { version: 1, libraries: {} }
        );
        renameStore.version = 1;
        const renameLibrary = teamSortStateRuntime.resolveLibraryStore(
          renameStore,
          libraryId,
          true
        );
        renameLibrary.folders = renameLibrary.folders || {};
        autoRenamePausedFolderCount = Object.keys(renameLibrary.folders).length;
        renameLibrary.folders = {};
        riskEntries.push({ key: RENAME_STORAGE_KEY, value: renameStore });
      }
      const marker = parseStoredJson(
        teamSortStateRuntime.TEAM_IMPORT_MARKER_KEY,
        { version: 1, imports: {} }
      );
      marker.version = 1;
      marker.imports = marker.imports || {};
      const mappedStatePresent = mapped.entries.every((entry) => {
        if (!entry.value?.libraries) return true;
        return teamSortStateRuntime.containsMappedLibrary(
          parseStoredJson(entry.key, null),
          entry.value,
          libraryId
        );
      });
      const previousImport = marker.imports[libraryId];
      if (
        previousImport?.payloadSha256 === payloadSha256 &&
        mappedStatePresent
      ) {
        return {
          imported: false,
          reason: "already-imported",
          payloadSha256,
          libraryId,
          source: TEAM_SORT_SOURCE,
          summary: marker.imports[libraryId]
        };
      }
      const backup = parseStoredJson(
        teamSortStateRuntime.TEAM_IMPORT_BACKUP_KEY,
        { version: 1, backups: [] }
      );
      backup.version = 1;
      backup.backups = Array.isArray(backup.backups) ? backup.backups : [];
      backup.backups.push({
        createdAt: Date.now(),
        payloadSha256,
        sourceLibraryId: mapped.sourceLibraryId,
        targetLibraryId: libraryId,
        values: Object.fromEntries([...mapped.entries, ...riskEntries].map((entry) => [
          entry.key,
          localStorage.getItem(entry.key)
        ]))
      });
      backup.backups = backup.backups.slice(-8);
      localStorage.setItem(
        teamSortStateRuntime.TEAM_IMPORT_BACKUP_KEY,
        JSON.stringify(backup)
      );

      for (const entry of mapped.entries) {
        const mergedValue = entry.value?.libraries
          ? teamSortStateRuntime.mergeMappedValue(
            parseStoredJson(entry.key, null),
            entry.value
          )
          : entry.value;
        const value = typeof mergedValue === "string"
          ? mergedValue
          : JSON.stringify(mergedValue);
        localStorage.setItem(entry.key, value);
      }
      for (const entry of riskEntries) {
        localStorage.setItem(entry.key, JSON.stringify(entry.value));
      }

      const summary = {
        importedAt: Date.now(),
        payloadSha256,
        sourceLibraryId: mapped.sourceLibraryId,
        targetLibraryId: libraryId,
        source: TEAM_SORT_SOURCE,
        repaired: previousImport?.payloadSha256 === payloadSha256,
        autoRenamePausedFolderCount,
        keyCount: mapped.entries.length,
        skippedKeys: mapped.skipped,
        ruleFolderCount: teamSortStateRuntime.countMappedFolders(
          mapped.entries,
          RULES_STORAGE_KEY
        ),
        protectedFolderCount: teamSortStateRuntime.countMappedFolders(
          mapped.entries,
          LOCK_STORAGE_KEY
        ),
        metaFolderCount: teamSortStateRuntime.countMappedFolders(
          mapped.entries,
          META_STORAGE_KEY
        ),
        missingFolderCount:
          TEAM_SORT_VERIFY?.compatibility?.missing?.length || 0
      };
      marker.imports[libraryId] = summary;
      localStorage.setItem(
        teamSortStateRuntime.TEAM_IMPORT_MARKER_KEY,
        JSON.stringify(marker)
      );
      return { imported: true, ...summary };
    }

    function exportTeamStorage() {
      const libraryId = String(bodyScope.rootDir || "default");
      const storage = {};
      for (const key of teamSortStateRuntime.storageKeysForLibrary(libraryId)) {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        try {
          storage[key] = JSON.parse(raw);
        } catch {
          storage[key] = raw;
        }
      }
      return { libraryId, storage };
    }

    api.teamImportResult = importTeamSortState();
    api.exportTeamStorage = exportTeamStorage;

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
    api.manualTreeMessage = "";
    api.manual = api.manual || {
      contextId: "",
      order: [],
      relations: [],
      legacyOrder: [],
      history: [],
      targetKind: "",
      revision: 0
    };
    api.manual.relations = Array.isArray(api.manual.relations)
      ? api.manual.relations
      : [];
    api.manual.legacyOrder = Array.isArray(api.manual.legacyOrder)
      ? api.manual.legacyOrder
      : Array.isArray(api.manual.order) ? api.manual.order.slice() : [];
    api.manual.order = Array.isArray(api.manual.order)
      ? api.manual.order
      : api.manual.legacyOrder.slice();

    function currentCollection() {
      return collectionRuntime.fromContext({
        currentFolder: bodyScope.currentFolder,
        currentSmartFolder: bodyScope.currentSmartFolder,
        locationHash: window.location.hash,
        rootDir: bodyScope.rootDir
      });
    }

    function currentLibraryId() {
      return String(bodyScope.rootDir || "default");
    }

    function readLockStore() {
      const existing = parseStoredJson(
        LOCK_STORAGE_KEY,
        collectionRuntime.emptyStore()
      );
      const legacyV1 = parseStoredJson(
        LEGACY_LOCK_STORAGE_KEY,
        { version: 1, libraries: {} }
      );
      const legacyV2 = parseStoredJson(
        LEGACY_PROTECTION_STORAGE_KEY,
        collectionRuntime.emptyStore()
      );
      const legacyMigration = collectionRuntime.migrateLegacyProtection(
        legacyV1,
        legacyV2
      );
      const visibleMigration = collectionRuntime.mergeLegacyProtectionIntoLocks(
        legacyMigration.store,
        existing
      );
      api.protectionMigration = {
        protectedCount: legacyMigration.protectedCount,
        ignoredLegacyOrderCount: legacyMigration.ignoredOrderCount,
        importedAsVisibleProtection: visibleMigration.importedCount,
        preservedVisibleProtection: visibleMigration.preservedCount,
        suppressedVisibleProtection: visibleMigration.suppressedCount,
        promotedToHardLock: visibleMigration.importedCount
      };
      api.legacyProtectionStore = legacyMigration.store;
      localStorage.setItem(
        LOCK_STORAGE_KEY,
        JSON.stringify(visibleMigration.store)
      );
      return visibleMigration.store;
    }

    function readManualStore() {
      const parsed = parseStoredJson(
        MANUAL_STORAGE_KEY,
        collectionRuntime.emptyStore()
      );
      return parsed?.version === collectionRuntime.COLLECTION_STATE_VERSION
        ? parsed
        : collectionRuntime.emptyStore();
    }

    function readManualModeStore() {
      const parsed = parseStoredJson(
        MANUAL_MODE_STORAGE_KEY,
        collectionRuntime.emptyStore()
      );
      return parsed?.version === collectionRuntime.COLLECTION_STATE_VERSION
        ? parsed
        : collectionRuntime.emptyStore();
    }

    api.lockStore = readLockStore();
    api.manualStore = readManualStore();
    api.manualModeStore = readManualModeStore();
    if (api.teamImportResult?.imported) {
      api.teamImportResult.legacyConfigProtectedFolderCount =
        api.protectionMigration?.protectedCount || 0;
      api.teamImportResult.ignoredLegacyOrderCount =
        api.protectionMigration?.ignoredLegacyOrderCount || 0;
    }

    function lockLibrary(create = true) {
      return collectionRuntime.ensureLibrary(
        api.lockStore,
        currentLibraryId(),
        create
      ) || { folders: {}, smartFolders: {}, global: null };
    }

    function collectionForFolder(folderOrId) {
      const id = typeof folderOrId === "string" ? folderOrId : folderOrId?.id;
      return collectionRuntime.create("normal", {
        id,
        name: typeof folderOrId === "object" ? folderOrId?.name : ""
      }, currentLibraryId());
    }

    function folderLockProfile(folderOrId, create = false) {
      const collection = folderOrId === undefined
        ? currentCollection()
        : collectionForFolder(folderOrId);
      return collectionRuntime.profile(
        api.lockStore,
        currentLibraryId(),
        collection,
        create
      );
    }

    function folderLocked(folderOrId) {
      return folderLockProfile(folderOrId)?.locked === true;
    }

    function legacyConfigProtected(folderOrId) {
      const collection = folderOrId === undefined
        ? currentCollection()
        : collectionForFolder(folderOrId);
      return collectionRuntime.profile(
        api.legacyProtectionStore,
        currentLibraryId(),
        collection,
        false
      )?.protected === true;
    }

    function folderBatchProtected(folderOrId) {
      const profile = folderLockProfile(folderOrId);
      if (profile?.legacySuppressed === true) return false;
      return profile?.locked === true || legacyConfigProtected(folderOrId);
    }

    function persistLockStore() {
      localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(api.lockStore));
    }

    function persistManualStore() {
      localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(api.manualStore));
    }

    function persistManualModeStore() {
      localStorage.setItem(
        MANUAL_MODE_STORAGE_KEY,
        JSON.stringify(api.manualModeStore)
      );
    }

    function sortConfigSnapshot() {
      return {
        orderBy: currentOrder() || bodyScope.currentOrderBy || bodyScope.orderBy || "",
        sortIncrease: currentIncrease(),
        rules: api.rules.map((rule) => ({
          ...rule,
          ...(rule.options ? { options: { ...rule.options } } : {})
        })),
        updatedAt: Date.now()
      };
    }

    function applySortConfigToLockProfile(profile, snapshot) {
      if (!profile || !snapshot) return profile;
      profile.locked = true;
      profile.config = {
        orderBy: snapshot.orderBy || "",
        sortIncrease: snapshot.sortIncrease !== false,
        rules: sortRuntime.normalizeRules(snapshot.rules)
      };
      profile.updatedAt = snapshot.updatedAt || Date.now();
      return profile;
    }

    function updateCurrentProtectedSortConfig() {
      const profile = folderLockProfile();
      if (!profile) return false;
      applySortConfigToLockProfile(profile, sortConfigSnapshot());
      persistLockStore();
      renderFolderLockMarkers();
      return true;
    }

    // Protection never captures or returns visible item order. Manual order is
    // persisted separately and only changes after an explicit drag.
    function prepareProtectedLocalSort() {
      return updateCurrentProtectedSortConfig();
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
        const locked = lockedFolders[folderId]?.locked === true;
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

    function lockedFoldersInTree(includeCurrent = true) {
      const tree = currentFolderTree();
      return tree.filter((folder, index) => {
        if (!includeCurrent && index === 0) return false;
        return folderBatchProtected(folder);
      });
    }

    function folderDisplayName(entryOrFolder) {
      const folder = entryOrFolder?.folder || entryOrFolder;
      return String(folder?.name || entryOrFolder?.name || folder?.id || "");
    }

    function summarizeSkippedFolders(skipped) {
      const entries = Array.isArray(skipped) ? skipped : [];
      if (entries.length === 0) return "";
      const names = [];
      const seen = new Set();
      for (const entry of entries) {
        const name = folderDisplayName(entry);
        if (!name || seen.has(name)) continue;
        seen.add(name);
        names.push(name);
        if (names.length >= 6) break;
      }
      if (names.length === 0) return "";
      const more = entries.length > names.length
        ? "等 " + String(entries.length) + " 个"
        : "";
      return "：" + names.join("、") + more;
    }

    function lockSkipMessage(skippedOrCount) {
      const skipped = Array.isArray(skippedOrCount) ? skippedOrCount : [];
      const count = Array.isArray(skippedOrCount)
        ? skippedOrCount.length
        : Number(skippedOrCount) || 0;
      return count > 0
        ? ui.lockSkipNotice.replace("{count}", String(count)) +
            summarizeSkippedFolders(skipped)
        : "";
    }

    function stabilizeAutoRenameAfterProtectionToggle() {
      if (!api.rename) return;
      clearTimeout(api.rename.timer);
      api.rename.timer = null;
      api.rename.lastSignature = renameRuntime.signature(
        buildCurrentRenamePlan()
      );
    }

    function setCurrentFolderLocked(locked) {
      const collection = currentCollection();
      if (!collection.id || collection.kind === "global") return false;
      if (locked) {
        collectionRuntime.setProfile(
          api.lockStore,
          currentLibraryId(),
          collection,
          {
            locked: true,
            mode: "hard",
            lockedAt: Date.now(),
            updatedAt: Date.now()
          }
        );
      } else {
        if (legacyConfigProtected()) {
          collectionRuntime.setProfile(
            api.lockStore,
            currentLibraryId(),
            collection,
            {
              locked: false,
              mode: "legacy-suppressed",
              legacySuppressed: true,
              updatedAt: Date.now()
            }
          );
        } else {
          collectionRuntime.deleteProfile(
            api.lockStore,
            currentLibraryId(),
            collection
          );
        }
      }
      persistLockStore();
      stabilizeAutoRenameAfterProtectionToggle();
      renderFolderLockMarkers();
      api.batchMessage = "";
      renderProtectionSettings();
      renderSettings();
      return locked;
    }

    function setLockTreeEnabled(enabled) {
      const tree = currentFolderTree();
      if (tree.length <= 1) return 0;
      const message = (enabled ? "锁定" : "解除锁定") +
        "当前文件夹及全部后代，共 " + String(tree.length) + " 个文件夹？";
      if (!window.confirm(message)) return 0;
      for (const folder of tree) {
        const collection = collectionForFolder(folder);
        if (enabled) {
          collectionRuntime.setProfile(
            api.lockStore,
            currentLibraryId(),
            collection,
            {
              locked: true,
              mode: "hard",
              lockedAt: Date.now(),
              updatedAt: Date.now()
            }
          );
        } else {
          if (legacyConfigProtected(folder)) {
            collectionRuntime.setProfile(
              api.lockStore,
              currentLibraryId(),
              collection,
              {
                locked: false,
                mode: "legacy-suppressed",
                legacySuppressed: true,
                updatedAt: Date.now()
              }
            );
          } else {
            collectionRuntime.deleteProfile(
              api.lockStore,
              currentLibraryId(),
              collection
            );
          }
        }
      }
      persistLockStore();
      stabilizeAutoRenameAfterProtectionToggle();
      renderFolderLockMarkers();
      renderSettings();
      return tree.length;
    }

    function setManualTreeEnabled(enabled) {
      const tree = currentFolderTree();
      if (tree.length <= 1) return 0;
      const targetCount = tree.length;
      const action = enabled ? ui.manualTreeOn : ui.manualTreeOff;
      const message = formatBatchMessage(ui.applyManualTreeConfirm, {
        action,
        count: targetCount
      });
      if (!window.confirm(message)) return 0;

      const result = folderTreeBatchRuntime.applyToFolderTree(tree, {
        snapshot: (folder) => {
          const profile = manualModeProfile(folder);
          return profile
            ? { hadProfile: true, profile: { ...profile } }
            : { hadProfile: false, profile: null };
        },
        apply: (folder) => {
          const collection = collectionForFolder(folder);
          if (!collection.id || collection.kind === "global") {
            throw new Error("文件夹 ID 无效");
          }
          if (enabled) {
            collectionRuntime.setProfile(
              api.manualModeStore,
              currentLibraryId(),
              collection,
              { enabled: true, inherited: true, updatedAt: Date.now() }
            );
          } else {
            collectionRuntime.deleteProfile(
              api.manualModeStore,
              currentLibraryId(),
              collection
            );
          }
        }
      });

      try {
        persistManualModeStore();
      } catch (error) {
        folderTreeBatchRuntime.rollbackApplied(
          result,
          (folder, snapshot) => {
            const collection = collectionForFolder(folder);
            if (snapshot?.hadProfile) {
              collectionRuntime.setProfile(
                api.manualModeStore,
                currentLibraryId(),
                collection,
                snapshot.profile
              );
            } else {
              collectionRuntime.deleteProfile(
                api.manualModeStore,
                currentLibraryId(),
                collection
              );
            }
          }
        );
        api.manualTreeMessage = formatBatchMessage(
          ui.applyManualTreeFailed,
          { reason: error?.message || String(error) }
        );
        renderSettings();
        bodyScope.$evalAsync();
        return 0;
      }

      const counts = folderTreeBatchRuntime.counts(result);
      const resultTemplate = counts.failed
        ? ui.appliedManualTreePartial
        : ui.appliedManualTree;
      api.manualTreeMessage = formatBatchMessage(resultTemplate, {
        action,
        count: counts.applied,
        failed: counts.failed
      });
      renderSettings();
      bodyScope.$evalAsync();
      return counts.applied;
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
      pendingAfterRun: false,
      pendingManualPlan: null,
      batchRequest: null,
      batchId: "",
      batchStatus: null,
      visibleContextId: "",
      visibleNames: Object.create(null),
      visibleMaskTimer: null,
      visibleMaskObserver: null
    };

    function applyStartupRenameCancel() {
      if (!RENAME_CANCEL_REQUEST) return null;
      const libraryId = String(bodyScope.rootDir || "default");
      if (
        RENAME_CANCEL_REQUEST.libraryId &&
        RENAME_CANCEL_REQUEST.libraryId !== libraryId
      ) {
        return {
          applied: false,
          reason: "library-mismatch",
          libraryId
        };
      }
      const library = renameLibrary(true);
      const cleared = Object.keys(library.folders || {}).length;
      library.folders = {};
      localStorage.setItem(RENAME_STORAGE_KEY, JSON.stringify(api.renameStore));
      return {
        applied: true,
        cleared,
        libraryId,
        reason: RENAME_CANCEL_REQUEST.reason || ""
      };
    }

    api.renameCancelResult = applyStartupRenameCancel();

    function currentOrder() {
      if (currentCollection().kind === "smart") {
        return bodyScope.currentSmartFolder?.orderBy ||
          bodyScope.currentOrderBy ||
          bodyScope.orderBy ||
          "";
      }
      if (bodyScope.currentFolder) return bodyScope.currentFolder.orderBy || "";
      return bodyScope.orderBy || "";
    }

    function currentIncrease() {
      if (currentCollection().kind === "smart") {
        if (bodyScope.currentSmartFolder?.orderBy) {
          return bodyScope.currentSmartFolder.sortIncrease !== false;
        }
        if (bodyScope.currentSortIncrease !== undefined) {
          return bodyScope.currentSortIncrease !== false;
        }
        return bodyScope.sortIncrease !== false;
      }
      if (bodyScope.currentFolder && bodyScope.currentFolder.orderBy) {
        return bodyScope.currentFolder.sortIncrease !== false;
      }
      return bodyScope.sortIncrease !== false;
    }

    function isPluginSort(orderBy = currentOrder()) {
      return orderBy === SORT_KEY || orderBy === TAKEN_SORT_KEY;
    }

    function isMultiSort(orderBy = currentOrder()) {
      return orderBy === SORT_KEY;
    }

    function settingsOrder() {
      const select = document.querySelector(
        '#layout-panel select[ng-change*="changeOrderBy"]'
      );
      return select?.value || currentOrder();
    }

    function isMultiSortSelected() {
      return settingsOrder() === SORT_KEY;
    }

    function currentFolderId() {
      return currentCollection().kind === "normal"
        ? bodyScope.currentFolder?.id || ""
        : "";
    }

    function currentContextId() {
      return currentCollection().key;
    }

    function renameLibrary(create = true) {
      const libraryId = String(bodyScope.rootDir || "default");
      const library = teamSortStateRuntime.resolveLibraryStore(
        api.renameStore,
        libraryId,
        create
      );
      if (library && create) library.folders = library.folders || {};
      return library || { folders: {} };
    }

    function renameEnabled() {
      if (currentCollection().kind !== "normal") return false;
      const folderId = bodyScope.currentFolder?.id;
      if (!folderId) return false;
      const profile = renameLibrary(false).folders?.[folderId];
      const targetKind =
        folderLevelRuntime.directChildren(bodyScope.currentFolder).length > 0
        ? "direct-folders"
        : "direct-media";
      if (profile === true) return targetKind === "direct-media";
      return profile?.enabled === true &&
        (profile.targetKind === targetKind ||
          profile.targetKind === "all-level-targets");
    }

    function inheritedRenameExecutionBlocked() {
      if (currentCollection().kind !== "normal") return false;
      const folderId = bodyScope.currentFolder?.id;
      if (!folderId) return false;
      const profile = renameLibrary(false).folders?.[folderId];
      return profile?.inherited === true && folderBatchProtected();
    }

    function setRenameEnabled(enabled) {
      if (currentCollection().kind !== "normal") return false;
      const folderId = bodyScope.currentFolder?.id;
      if (!folderId) return false;
      if (folderLocked()) return renameEnabled();
      const library = renameLibrary(true);
      const targetKind =
        folderLevelRuntime.directChildren(bodyScope.currentFolder).length > 0
        ? "direct-folders"
        : "direct-media";
      if (enabled) {
        library.folders[folderId] = {
          enabled: true,
          targetKind,
          confirmedAt: Date.now()
        };
      }
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
        if (enabled) {
          library.folders[folder.id] = {
            enabled: true,
            targetKind: "all-level-targets",
            confirmedAt: Date.now(),
            inherited: true
          };
        }
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
      api.rename.message =
        api.rename.batchStatus?.sourceContextId === contextId
          ? api.rename.batchStatus.message
          : "";
      api.rename.running = renameLifecycleRuntime.isActiveForContext(
        api.rename.batchStatus,
        contextId
      );
      return true;
    }

    function renameBatchStatusForCurrentContext() {
      return api.rename.batchStatus?.sourceContextId === currentContextId()
        ? api.rename.batchStatus
        : null;
    }

    function metaLibrary(create = true) {
      const libraryId = String(bodyScope.rootDir || "default");
      const library = teamSortStateRuntime.resolveLibraryStore(
        api.metaStore,
        libraryId,
        create
      );
      if (library && create) {
        library.folders = library.folders || {};
        library.smartFolders = library.smartFolders || {};
      }
      return library || { folders: {}, smartFolders: {} };
    }

    function currentMetaContextId() {
      const libraryId = String(bodyScope.rootDir || "default") + "|meta:";
      const collection = currentCollection();
      if (collection.kind === "smart") return libraryId + "smart:" + collection.id;
      if (collection.kind === "normal") return libraryId + "folder:" + collection.id;
      return libraryId + "global";
    }

    function metaTypeForCurrentContext() {
      const library = metaLibrary(false);
      let stored;
      const collection = currentCollection();
      if (collection.kind === "smart") stored = library.smartFolders?.[collection.id];
      else if (collection.kind === "normal") stored = library.folders?.[collection.id];
      return normalizeMetaType(stored || api.metaStore.defaultType);
    }

    function persistMetaStore() {
      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(api.metaStore));
    }

    function writeCurrentMetaType(type) {
      const normalized = normalizeMetaType(type);
      const library = metaLibrary(true);
      const collection = currentCollection();
      if (collection.kind === "smart") library.smartFolders[collection.id] = normalized;
      else if (collection.kind === "normal") library.folders[collection.id] = normalized;
      else {
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
      const library = teamSortStateRuntime.resolveLibraryStore(
        api.rulesStore,
        libraryId,
        create
      );
      if (library && create) {
        library.folders = library.folders || {};
        library.smartFolders = library.smartFolders || {};
        if (!("global" in library)) library.global = null;
      }
      return library || { folders: {}, smartFolders: {}, global: null };
    }

    function currentRulesContextId() {
      const libraryId = String(bodyScope.rootDir || "default") + "|";
      const collection = currentCollection();
      if (collection.kind === "smart") return libraryId + "smart:" + collection.id;
      if (collection.kind === "normal") return libraryId + "folder:" + collection.id;
      return libraryId + "global";
    }

    function ensureTeamSortStateForCurrentLibrary() {
      const libraryId = String(bodyScope.rootDir || "default");
      if (!teamSortStateRuntime.isLibraryReady(libraryId)) return false;
      if (api.teamImportLibraryId === libraryId) return false;
      api.teamImportLibraryId = libraryId;
      const result = importTeamSortState();
      api.teamImportResult = result;
      if (!result.imported) return false;

      api.lockStore = readLockStore();
      api.rulesStore = readRulesStore();
      api.metaStore = readMetaStore();
      api.rulesContextId = "";
      api.metaContextId = "";
      syncRulesContext(true);
      syncMetaContext(true);
      renderSettings();
      return true;
    }

    function rulesForCurrentContext() {
      const library = libraryRules(false);
      let stored;
      const collection = currentCollection();
      if (collection.kind === "smart") stored = library.smartFolders?.[collection.id];
      else if (collection.kind === "normal") stored = library.folders?.[collection.id];
      else {
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
      const collection = currentCollection();
      if (collection.kind === "smart") library.smartFolders[collection.id] = normalized;
      else if (collection.kind === "normal") library.folders[collection.id] = normalized;
      else {
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

    function manualModeProfile(folderOrId) {
      const collection = folderOrId === undefined
        ? currentCollection()
        : collectionForFolder(folderOrId);
      return collectionRuntime.profile(
        api.manualModeStore,
        currentLibraryId(),
        collection,
        false
      );
    }

    function manualEnabled(folderOrId) {
      const collection = folderOrId === undefined
        ? currentCollection()
        : collectionForFolder(folderOrId);
      return collection.kind !== "global";
    }

    function setManualEnabled(enabled, folderOrId) {
      const collection = folderOrId === undefined
        ? currentCollection()
        : collectionForFolder(folderOrId);
      if (!collection.id || collection.kind === "global") return false;
      if (folderLocked(folderOrId)) return manualEnabled(folderOrId);
      // Manual drag is an intrinsic capability of every collection. The
      // legacy toggle is retained as a no-op migration surface only.
      api.manualTreeMessage = "";
      return true;
    }

    function resetManualState() {
      api.manual.order = [];
      api.manual.relations = [];
      api.manual.legacyOrder = [];
      api.manual.history = [];
      api.manual.targetKind = "";
      api.manual.revision = 0;
      api.manual.mode = "automatic";
    }

    function syncManualContext() {
      const contextId = currentContextId();
      let contextChanged = false;
      if (api.manual.contextId !== contextId) {
        contextChanged = true;
        api.hostInputAdapter?.contextChanged();
        api.clearSmartDragFeedback?.();
        api.manual.contextId = contextId;
        api.manualTreeMessage = "";
        resetManualState();
        const stored = collectionRuntime.profile(
          api.manualStore,
          currentLibraryId(),
          currentCollection(),
          false
        );
        if (Array.isArray(stored?.relations) || stored?.schemaVersion >= 3) {
          api.manual.relations = Array.isArray(stored.relations)
            ? orderCoordinator.normalizeManualOverlay(stored.relations)
            : [];
          api.manual.legacyOrder = Array.isArray(stored.legacyFullOrder)
            ? stored.legacyFullOrder.map(String)
            : Array.isArray(stored.order) ? stored.order.map(String) : [];
          api.manual.order = api.manual.legacyOrder.slice();
          api.manual.targetKind = String(stored.targetKind || "direct-media");
          api.manual.revision = Math.max(
            0,
            Number(stored.revision || stored.updatedAt) || 0
          );
          api.manual.mode = api.manual.relations.length ? "overlay" : "automatic";
        } else if (Array.isArray(stored?.order)) {
          // Preserve the old full manual view as history, but do not let it
          // override a newly computed plugin sort after migration.
          api.manual.legacyOrder = stored.order.map(String);
          api.manual.order = api.manual.legacyOrder.slice();
          api.manual.targetKind = String(stored.targetKind || "direct-media");
          api.manual.revision = Math.max(
            0,
            Number(stored.revision || stored.updatedAt) || 0
          );
          api.manual.mode = "automatic";
          collectionRuntime.setProfile(
            api.manualStore,
            currentLibraryId(),
            currentCollection(),
            {
              schemaVersion: 3,
              mode: "automatic",
              relations: [],
              legacyFullOrder: api.manual.legacyOrder.slice(),
              order: api.manual.legacyOrder.slice(),
              targetKind: api.manual.targetKind,
              revision: api.manual.revision,
              migratedAt: Date.now(),
              updatedAt: Date.now()
            }
          );
          persistManualStore();
        } else {
          api.manual.mode = "automatic";
        }
      }
      syncRulesContext();
      if (contextChanged) {
        beginSmartCollectionLifecycle();
        scheduleSmartHostObservation();
      }
      return contextId;
    }

    function activeManualOrder() {
      syncManualContext();
      return [];
    }

    function activeManualOverlay() {
      syncManualContext();
      if (
        currentCollection().kind === "global" ||
        api.manual.targetKind === "direct-folders"
      ) {
        return [];
      }
      return api.manual.relations;
    }

    function currentSortMode(orderBy = currentOrder()) {
      syncManualContext();
      return isPluginSort(orderBy)
        ? "automatic"
        : "native";
    }

    function manualOrderForFolder(folderOrId) {
      return [];
    }

    function manualOverlayForFolder(folderOrId) {
      const collection = collectionForFolder(folderOrId);
      const profile = collectionRuntime.profile(
        api.manualStore,
        currentLibraryId(),
        collection,
        false
      );
      return profile?.targetKind === "direct-folders"
        ? []
        : orderCoordinator.normalizeManualOverlay(profile?.relations);
    }

    function persistCurrentManualOrder() {
      const collection = currentCollection();
      if (collection.kind === "global") return false;
      if (
        api.manual.relations.length === 0 &&
        api.manual.legacyOrder.length === 0
      ) {
        collectionRuntime.deleteProfile(
          api.manualStore,
          currentLibraryId(),
          collection
        );
      } else {
        collectionRuntime.setProfile(
          api.manualStore,
          currentLibraryId(),
          collection,
          {
            schemaVersion: 3,
            mode: api.manual.relations.length ? "overlay" : "automatic",
            relations: api.manual.relations.map((relation) => ({ ...relation })),
            legacyFullOrder: api.manual.legacyOrder.map(String),
            // Keep the v2 field for older team-state readers; it is no
            // longer treated as an active override by this version.
            order: api.manual.legacyOrder.map(String),
            targetKind: api.manual.targetKind || "direct-media",
            revision: api.manual.revision || Date.now(),
            updatedAt: Date.now()
          }
        );
      }
      persistManualStore();
      return true;
    }

    function sortConfig() {
      return {
        timestamps: api.timestamps,
        rules: api.rules,
        collectionId: currentCollection().id,
        manualOrder: [],
        manualOverlay: activeManualOverlay(),
        sortMode: currentSortMode()
      };
    }

    function sortConfigFor(orderBy = currentOrder()) {
      if (orderBy !== TAKEN_SORT_KEY) return sortConfig();
      return {
        timestamps: api.timestamps,
        rules: [{
          field: "TAKEN_AT",
          direction: currentIncrease() ? "asc" : "desc"
        }],
        collectionId: currentCollection().id,
        manualOrder: [],
        manualOverlay: activeManualOverlay(),
        sortMode: currentSortMode(orderBy)
      };
    }

    function resolveHostOrder(items, orderBy, pluginSort) {
      const collection = currentCollection();
      if (collection.kind === "global") {
        return Array.isArray(items) ? items.slice() : [];
      }
      const config = sortConfigFor(orderBy);
      return sortingSystemRuntime.resolveOrder({
        collection,
        contextId: currentContextId(),
        targetKind: "direct-media",
        items,
        pluginSort: pluginSort === true,
        timestamps: config.timestamps,
        rules: config.rules,
        manualOrder: [],
        manualOverlay: activeManualOverlay(),
        sortMode: currentSortMode(orderBy),
        locked: folderLocked()
      }).finalItems;
    }

    function applyManualOverlay(items, orderBy = currentOrder()) {
      return resolveHostOrder(items, orderBy, false);
    }

    function saveRules(nextRules, refresh = true) {
      if (folderLocked()) return api.rules;
      api.rules = writeCurrentRules(nextRules);
      api.batchMessage = "";
      const protectedCollection = prepareProtectedLocalSort();
      api.renderSettings?.();
      api.renderRuleRows?.();
      api.renderInlineRuleRows?.();
      if (refresh) api.refresh?.();
      if (protectedCollection) updateCurrentProtectedSortConfig();
      return api.rules;
    }

    function currentFolderTree() {
      return currentCollection().kind === "normal" && bodyScope.currentFolder
        ? sortRuntime.collectFolderTree(bodyScope.currentFolder)
        : [];
    }

    function currentLevelTarget() {
      const collection = currentCollection();
      const hasChildren =
        collection.kind === "normal" &&
        folderLevelRuntime.directChildren(bodyScope.currentFolder).length > 0;
      return folderLevelRuntime.currentTarget({
        folder: collection.kind === "normal" ? bodyScope.currentFolder : null,
        directMedia: hasChildren ? [] : currentRenameItems(),
        showSubfolderContent: bodyScope.showSubfolderContent === true,
        collectionKind: collection.kind
      });
    }

    function currentLevelAvailability(directMedia) {
      const collection = currentCollection();
      const hasChildren =
        collection.kind === "normal" &&
        folderLevelRuntime.directChildren(bodyScope.currentFolder).length > 0;
      const resolvedMedia = Array.isArray(directMedia)
        ? directMedia
        : collection.kind === "smart"
          ? currentRenameItems()
          : hasChildren ? [] : currentRenameItems();
      return folderLevelRuntime.actionAvailability({
        folder: collection.kind === "normal" ? bodyScope.currentFolder : null,
        directMedia: resolvedMedia,
        showSubfolderContent: bodyScope.showSubfolderContent === true,
        collectionKind: collection.kind,
        locked: folderLocked()
      });
    }

    function libraryAvailability() {
      const rawLibraryPath = String(bodyScope.rootDir || "");
      let libraryPath = rawLibraryPath;
      try {
        libraryPath = decodeURIComponent(rawLibraryPath);
      } catch {}
      if (!libraryPath) return { ok: true };
      let runtimeRequire = null;
      try {
        runtimeRequire = typeof require === "function"
          ? require
          : typeof window.require === "function"
            ? window.require
            : null;
      } catch {}
      if (!runtimeRequire) return { ok: true };
      try {
        const nodeFs = runtimeRequire("fs");
        if (!nodeFs.existsSync(libraryPath)) {
          return { ok: false, reason: libraryPath + " 不存在或暂时离线" };
        }
        nodeFs.accessSync(libraryPath, nodeFs.constants.R_OK);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          reason: (error?.message || String(error)).replace(
            rawLibraryPath,
            libraryPath
          )
        };
      }
    }

    function firstBatchFailure(result) {
      const failure = result?.failures?.[0];
      if (!failure) return "";
      const name = failure.name || failure.id || "";
      return name
        ? name + " - " + failure.error
        : failure.error;
    }

    function formatBatchMessage(template, values) {
      let message = template;
      for (const [key, value] of Object.entries(values || {})) {
        message = message.replace(
          new RegExp("\\{" + key + "\\}", "g"),
          String(value)
        );
      }
      return message;
    }

    function currentSortState() {
      return {
        orderBy: currentOrder() || bodyScope.currentOrderBy || bodyScope.orderBy || "",
        increase:
          bodyScope.currentSortIncrease !== undefined
            ? bodyScope.currentSortIncrease !== false
            : currentIncrease(),
        rules: api.rules.map((rule) => ({ ...rule }))
      };
    }

    function restoreFolderSort(folder, snapshot) {
      if (!folder || !snapshot) return;
      if (snapshot.hadOrderBy) folder.orderBy = snapshot.orderBy;
      else delete folder.orderBy;
      if (snapshot.hadSortIncrease) {
        folder.sortIncrease = snapshot.sortIncrease;
      } else {
        delete folder.sortIncrease;
      }
      const collection = collectionForFolder(folder);
      if (snapshot.hadLockProfile) {
        collectionRuntime.setProfile(
          api.lockStore,
          currentLibraryId(),
          collection,
          snapshot.lockProfile
        );
      } else if (snapshot.protected) {
        collectionRuntime.deleteProfile(
          api.lockStore,
          currentLibraryId(),
          collection
        );
      }
    }

    function applySortToCurrentTree() {
      if (currentCollection().kind === "smart") {
        if (folderLocked()) {
          applySortConfigToLockProfile(folderLockProfile(), sortConfigSnapshot());
          persistLockStore();
          api.batchMessage = "配置已同步；当前智能文件夹受保护，未执行排序";
          api.renderSettings?.();
          return 1;
        }
        if (isMultiSort()) writeCurrentRules(api.rules);
        saveCurrentContainer();
        if (folderLocked()) updateCurrentProtectedSortConfig();
        api.batchMessage = "已应用到当前智能文件夹（仅此智能视图）";
        api.renderSettings?.();
        api.refresh?.();
        return 1;
      }
      const allFolders = currentFolderTree();
      if (allFolders.length === 0) return 0;
      const availability = libraryAvailability();
      if (!availability.ok) {
        api.batchMessage = formatBatchMessage(ui.libraryUnavailable, {
          reason: availability.reason
        });
        api.renderSettings?.();
        renderOrderTreeSettings();
        return 0;
      }
      const state = currentSortState();
      const targetCount = allFolders.length;
      const message = ui.applyTreeConfirm.replace(
        "{count}",
        String(targetCount)
      );
      if (allFolders.length > 1 && !window.confirm(message)) return 0;

      const result = folderTreeBatchRuntime.applyToFolderTree(allFolders, {
        snapshot: (folder) => {
          const lockProfile = folderLockProfile(folder);
          return {
            orderBy: folder.orderBy,
            sortIncrease: folder.sortIncrease,
            protected: folderBatchProtected(folder),
            hadOrderBy: Object.prototype.hasOwnProperty.call(folder, "orderBy"),
            hadSortIncrease: Object.prototype.hasOwnProperty.call(
              folder,
              "sortIncrease"
            ),
            hadLockProfile: !!lockProfile,
            lockProfile: lockProfile ? JSON.parse(JSON.stringify(lockProfile)) : null
          };
        },
        apply: (folder) => {
          if (folderBatchProtected(folder)) {
            const profile = folderLockProfile(folder, true);
            applySortConfigToLockProfile(profile, {
              orderBy: state.orderBy,
              sortIncrease: state.increase,
              rules: state.rules,
              updatedAt: Date.now()
            });
          } else {
            folder.orderBy = state.orderBy;
            folder.sortIncrease = state.increase;
          }
        }
      });
      let saveFailed = "";
      if (result.applied.some((entry) => !entry.snapshot?.protected)) {
        try {
          bodyScope.saveFolder();
        } catch (error) {
          saveFailed = error?.message || String(error);
          folderTreeBatchRuntime.rollbackApplied(result, restoreFolderSort);
        }
      }

      try {
        persistLockStore();
      } catch (error) {
        saveFailed = saveFailed || error?.message || String(error);
      }
      if (saveFailed) {
        api.batchMessage = formatBatchMessage(ui.applyTreeFailed, {
          reason: saveFailed
        });
        api.renderSettings?.();
        renderOrderTreeSettings();
        return 0;
      }

      if (state.orderBy === SORT_KEY && result.applied.length > 0) {
        try {
          writeFolderRules(
            result.applied.map((entry) => entry.folder),
            state.rules
          );
        } catch (error) {
          result.failures.push({
            id: "rules-store",
            name: "rules-store",
            error: error?.message || String(error)
          });
        }
      }
      if (!folderLocked(bodyScope.currentFolder)) {
        bodyScope.currentOrderBy = state.orderBy;
        bodyScope.currentSortIncrease = state.increase;
        resetManualState();
      }
      const counts = folderTreeBatchRuntime.counts(result);
      const resultTemplate = counts.failed
        ? ui.appliedTreePartial
        : ui.appliedTree;
      api.batchMessage = formatBatchMessage(resultTemplate, {
        count: counts.applied,
        failed: counts.failed
      });
      if (counts.failed && counts.applied === 0) {
        api.batchMessage = formatBatchMessage(ui.applyTreeFailed, {
          reason: firstBatchFailure(result)
        });
      }
      api.renderSettings?.();
      renderOrderTreeSettings();
      if (!folderLocked()) api.refresh?.();
      bodyScope.$evalAsync();
      return counts.applied;
    }

    const applyRulesToCurrentTree = applySortToCurrentTree;

    function applyRenameToCurrentTree() {
      const allFolders = currentFolderTree();
      const sourceContextId = currentContextId();
      if (allFolders.length === 0 || api.rename.running || folderLocked()) return 0;
      if (!renameEnabled()) {
        api.rename.batchStatus = {
          state: "idle",
          sourceContextId,
          message: ui.renameTreeRequiresEnable
        };
        api.rename.message = api.rename.batchStatus.message;
        renderSettings();
        return 0;
      }
      const availability = libraryAvailability();
      if (!availability.ok) {
        api.rename.batchStatus = {
          state: "failed",
          sourceContextId,
          message: formatBatchMessage(ui.libraryUnavailable, {
            reason: availability.reason
          })
        };
        api.rename.message = api.rename.batchStatus.message;
        renderSettings();
        return 0;
      }
      const targetPreview = folderTreeBatchRuntime.applyToFolderTree(
        allFolders,
        {
          skipFolder: (folder) => folderBatchProtected(folder) ? "locked" : ""
        }
      );
      const folders = targetPreview.applied.map((entry) => entry.folder);
      const message = ui.applyRenameTreeConfirm.replace(
        "{count}",
        String(allFolders.length)
      ) + lockSkipMessage(targetPreview.skipped);
      if (!window.confirm(message)) return 0;

      // Configuration reaches every descendant. Protection only removes a
      // folder from this execution batch; it does not block switch propagation.
      setRenameTreeEnabled(allFolders, true);

      if (folders.length === 0) {
        api.rename.batchStatus = {
          state: "done",
          sourceContextId,
          message: ui.renameTreeStateOnly
            .replace("{total}", String(allFolders.length))
            .replace("{protected}", String(targetPreview.skipped.length))
        };
        api.rename.message = api.rename.batchStatus.message;
        renderSettings();
        return allFolders.length;
      }

      if (folders.some((folder) => folder.id === bodyScope.currentFolder?.id)) {
        beginVisibleRenameMask(buildCurrentRenamePlan());
      }
      const id = Date.now().toString(36) + "-" +
        Math.random().toString(36).slice(2, 9);
      api.rename.batchId = id;
      api.rename.batchRequest = {
        id,
        sourceContextId,
        collectionId: String(bodyScope.currentFolder?.id || sourceContextId),
        snapshotVersion: String(api.manual.revision || Date.now()),
        snapshotIdentity: String(sourceContextId) + ":" +
          folders.map((folder) => String(folder.id)).sort().join(","),
        signature: JSON.stringify(folders.map((folder) => ({
          id: String(folder.id),
          manualOverlay: manualOverlayForFolder(folder),
          rules: rulesForFolder(folder)
        }))),
        folders: folders.map((folder) => ({
          id: String(folder.id),
          name: String(folder.name || ""),
          rules: rulesForFolder(folder),
          manualOrder: manualOrderForFolder(folder),
          manualOverlay: manualOverlayForFolder(folder)
        }))
      };
      api.rename.batchStatus = {
        state: "queued",
        sourceContextId,
        message: ui.renameTreeQueued.replace(
          "{count}",
          String(folders.length)
        ).replace(
          "{total}",
          String(allFolders.length)
        ) + lockSkipMessage(targetPreview.skipped)
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
        sourceContextId: request.sourceContextId,
        message: ui.renameTreeRunning
      };
      api.rename.running = renameLifecycleRuntime.isActiveForContext(
        api.rename.batchStatus,
        currentContextId()
      );
      api.rename.message = currentContextId() === request.sourceContextId
        ? ui.renameTreeRunning
        : "";
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
        sourceContextId: api.rename.batchStatus?.sourceContextId || "",
        message,
        progress: { ...progress, current, total, percent }
      };
      api.rename.message = currentContextId() ===
        api.rename.batchStatus.sourceContextId ? message : "";
      api.rename.running = renameLifecycleRuntime.isActiveForContext(
        api.rename.batchStatus,
        currentContextId()
      );
      renderSettings();
      return true;
    }

    function completeRenameBatch(id, result) {
      if (api.rename.batchId !== id) return false;
      const rerunAfterQuietPeriod = api.rename.pendingAfterRun === true;
      api.rename.pendingAfterRun = false;
      const failed = Number(result?.failed || 0);
      const template = failed ? ui.renameTreePartial : ui.renameTreeDone;
      const message = template
        .replace("{folders}", String(result?.folders || 0))
        .replace("{files}", String(result?.renamed || 0))
        .replace("{failed}", String(failed)) +
        (failed && result?.error ? "；" + String(result.error) : "");
      api.rename.batchStatus = {
        state: failed ? "partial" : "done",
        sourceContextId: api.rename.batchStatus?.sourceContextId || "",
        message,
        result
      };
      api.rename.message = currentContextId() ===
        api.rename.batchStatus.sourceContextId ? message : "";
      api.rename.running = renameLifecycleRuntime.isActiveForContext(
        api.rename.batchStatus,
        currentContextId()
      );
      if (failed) {
        // The host queue will restore the request for a retry. Never leave a
        // failed command's signature claiming a task that did not complete.
        api.rename.lastSignature = "";
        setTimeout(() => finishVisibleRenameMask(false), 250);
      } else if (!rerunAfterQuietPeriod) {
        finishVisibleRenameMask(true);
      } else {
        renderVisibleRenameMask();
      }
      // Native item renames already update the active Eagle cards. Rebinding the
      // entire current folder here invalidates thumbnail URLs while Eagle is
      // settling the two-phase rename and produces a visible blank-grid flash.
      // Tree batches may affect folders that are not currently rendered, so
      // they keep one explicit refresh after the batch has fully completed.
      if (result?.mode !== "current-folder") api.refresh?.();
      renderSettings();
      if (rerunAfterQuietPeriod) {
        scheduleAutoRename("manual-drop-continuation", AUTO_RENAME_QUIET_MS, true);
      }
      return true;
    }

    function acknowledgeRenameEnqueue(id, signature) {
      if (
        !api.rename.batchRequest ||
        api.rename.batchRequest.id !== id
      ) {
        return false;
      }
      api.rename.lastSignature = String(
        signature || api.rename.batchRequest.signature || ""
      );
      api.rename.batchStatus = {
        ...(api.rename.batchStatus || {}),
        state: "accepted",
        message: "已确认进入编号队列"
      };
      api.rename.message = currentContextId() ===
        api.rename.batchStatus.sourceContextId
        ? api.rename.batchStatus.message
        : "";
      api.rename.running = renameLifecycleRuntime.isActiveForContext(
        api.rename.batchStatus,
        currentContextId()
      );
      renderSettings();
      return true;
    }

    function rejectRenameEnqueue(id, result = {}) {
      if (
        !api.rename.batchRequest ||
        api.rename.batchRequest.id !== id
      ) {
        return false;
      }
      const request = api.rename.batchRequest;
      const rejection = renameLifecycleRuntime.enqueueRejection({
        request,
        result
      });
      api.rename.batchRequest = null;
      api.rename.pendingAfterRun = false;
      api.rename.batchStatus = {
        state: rejection.state,
        sourceContextId: rejection.sourceContextId,
        message: rejection.reason === "duplicate-signature"
          ? "当前顺序已处理，无需重复编号"
          : "编号未进入队列，可重试：" + rejection.reason
      };
      api.rename.lastSignature = rejection.reason === "duplicate-signature"
        ? rejection.signature
        : "";
      api.rename.running = renameLifecycleRuntime.isActiveForContext(
        api.rename.batchStatus,
        currentContextId()
      );
      api.rename.message = currentContextId() === rejection.sourceContextId
        ? api.rename.batchStatus.message
        : "";
      finishVisibleRenameMask(false);
      renderSettings();
      return true;
    }

    function restoreRenameBatch(request, reason) {
      if (!request?.id || api.rename.batchRequest) return false;
      api.rename.batchRequest = request;
      api.rename.batchId = request.id;
      api.rename.batchStatus = {
        state: "retryable-failure",
        sourceContextId: request.sourceContextId || "",
        message: "编号未完成，可重试：" + String(reason || "未知错误")
      };
      api.rename.running = renameLifecycleRuntime.isActiveForContext(
        api.rename.batchStatus,
        currentContextId()
      );
      api.rename.lastSignature = "";
      api.rename.message = currentContextId() ===
        api.rename.batchStatus.sourceContextId
        ? api.rename.batchStatus.message
        : "";
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
      const allFolders = currentFolderTree();
      if (allFolders.length === 0) return 0;
      const availability = libraryAvailability();
      if (!availability.ok) {
        api.metaBatchMessage = formatBatchMessage(ui.libraryUnavailable, {
          reason: availability.reason
        });
        renderMetaTreeSettings();
        return 0;
      }
      const type = normalizeMetaType(bodyScope.listMetaType);
      const targetCount = allFolders.length;
      const message = ui.applyMetaTreeConfirm
        .replace("{type}", currentMetaLabel())
        .replace("{count}", String(targetCount));
      if (allFolders.length > 1 && !window.confirm(message)) return 0;

      const library = metaLibrary(true);
      const result = folderTreeBatchRuntime.applyToFolderTree(allFolders, {
        snapshot: (folder) => ({
          hadValue: Object.prototype.hasOwnProperty.call(
            library.folders,
            folder.id
          ),
          value: library.folders[folder.id]
        }),
        apply: (folder) => {
          library.folders[folder.id] = type;
        }
      });
      try {
        persistMetaStore();
      } catch (error) {
        result.failures.push({
          id: "meta-store",
          name: "meta-store",
          error: error?.message || String(error)
        });
      }
      const counts = folderTreeBatchRuntime.counts(result);
      if (counts.failed && counts.applied === 0) {
        api.metaBatchMessage = formatBatchMessage(ui.applyMetaTreeFailed, {
          reason: firstBatchFailure(result)
        });
      } else {
        api.metaBatchMessage = formatBatchMessage(
          counts.failed ? ui.appliedMetaTreePartial : ui.appliedMetaTree,
          { count: counts.applied, failed: counts.failed }
        );
      }
      renderMetaTreeSettings();
      return counts.applied;
    }

    function saveCurrentContainer() {
      if (bodyScope.currentFolder || bodyScope.currentSmartFolder) {
        bodyScope.saveFolder();
      }
    }

    function activateCustomSort(orderBy = SORT_KEY) {
      if (folderLocked()) return false;
      const collection = currentCollection();
      if (collection.kind === "smart") {
        bodyScope.currentSmartFolder.orderBy = orderBy;
        if (bodyScope.currentSmartFolder.sortIncrease === undefined) {
          bodyScope.currentSmartFolder.sortIncrease = true;
        }
        saveCurrentContainer();
      } else if (collection.kind === "normal") {
        bodyScope.currentFolder.orderBy = orderBy;
        if (bodyScope.currentFolder.sortIncrease === undefined) {
          bodyScope.currentFolder.sortIncrease = true;
        }
        saveCurrentContainer();
      } else {
        bodyScope.orderBy = orderBy;
        localStorage.setItem(
          "eagle.list.orderBy." + bodyScope.rootDir,
          orderBy
        );
      }

      bodyScope.currentOrderBy = orderBy;
      bodyScope.currentSortIncrease = currentIncrease();
      api.selectionVersion = (api.selectionVersion || 0) + 1;
      syncManualContext();
      if (folderLocked()) updateCurrentProtectedSortConfig();
      api.ensureMenu?.();
      api.refresh?.();
      bodyScope.$evalAsync();
      return true;
    }

    function activatePhotoSort() {
      return activateCustomSort(SORT_KEY);
    }

    function activateTakenTimeSort() {
      return activateCustomSort(TAKEN_SORT_KEY);
    }

    function setCustomIncrease(increase) {
      if (folderLocked()) return currentIncrease();
      const normalized = increase !== false;
      const collection = currentCollection();
      if (collection.kind === "smart") {
        bodyScope.currentSmartFolder.sortIncrease = normalized;
        saveCurrentContainer();
      } else if (collection.kind === "normal") {
        bodyScope.currentFolder.sortIncrease = normalized;
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
      // Multi-level rule directions are independent. Eagle may reverse the
      // result internally, so sortData compensates without mutating rules.
      if (folderLocked()) updateCurrentProtectedSortConfig();
      api.refresh?.();
      bodyScope.$evalAsync();
      return normalized;
    }

    if (!api.original.sortData) {
      api.original.sortData = bodyScope.sortData;
      bodyScope.sortData = function(data, orderBy) {
        if (!isPluginSort(orderBy)) {
          return applyManualOverlay(
            api.original.sortData.call(this, data, orderBy),
            orderBy
          );
        }
        const desired = resolveHostOrder(data, orderBy, true);
        // Eagle reverses folder and smart-folder results after sortData.
        return currentIncrease() ? desired : desired.reverse();
      };
    }

    if (!api.original.sortRawData) {
      api.original.sortRawData = bodyScope.sortRawData;
      bodyScope.sortRawData = function(orderBy) {
        if (!isPluginSort(orderBy)) {
          const result = api.original.sortRawData.call(this, orderBy);
          this.raw = applyManualOverlay(
            Array.isArray(result) ? result : this.raw
          );
          return this.raw;
        }
        this.raw = resolveHostOrder(this.raw, orderBy, true);
        this.currentOrderBy = orderBy;
        this.currentSortIncrease = currentIncrease();
        return this.raw;
      };
    }

    if (!api.original.changeOrderBy) {
      api.original.changeOrderBy = bodyScope.changeOrderBy;
      bodyScope.changeOrderBy = function(orderBy) {
        if (folderLocked()) {
          renderSettings();
          return false;
        }
        if (orderBy === SORT_KEY) return activatePhotoSort();
        if (orderBy === TAKEN_SORT_KEY) return activateTakenTimeSort();
        const result = api.original.changeOrderBy.call(this, orderBy);
        if (folderLocked()) {
          setTimeout(() => {
            updateCurrentProtectedSortConfig();
            renderProtectionSettings();
          }, 0);
        }
        return result;
      };
    }

    if (!api.original.changeSortIncrease) {
      api.original.changeSortIncrease = bodyScope.changeSortIncrease;
      bodyScope.changeSortIncrease = function(increase) {
        if (folderLocked()) {
          renderSettings();
          return currentIncrease();
        }
        if (isPluginSort()) {
          return setCustomIncrease(increase);
        }
        const result = api.original.changeSortIncrease.call(this, increase);
        if (folderLocked()) {
          setTimeout(() => {
            updateCurrentProtectedSortConfig();
            renderProtectionSettings();
          }, 0);
        }
        return result;
      };
    }

    if (!api.original.changeFolderName && bodyScope.changeFolderName) {
      api.original.changeFolderName = bodyScope.changeFolderName;
      bodyScope.changeFolderName = function(folder, name) {
        if (
          folderLocked(folder) ||
          (bodyScope.currentFolder && folderLocked(bodyScope.currentFolder))
        ) {
          renderSettings();
          return false;
        }
        return api.original.changeFolderName.call(this, folder, name);
      };
    }

    function ensureStyle() {
      if (document.getElementById("eagle-photo-sort-style")) return;
      const style = document.createElement("style");
      style.id = "eagle-photo-sort-style";
      style.textContent = [
        ".eagle-photo-taken-settings{display:flex;flex-direction:column;gap:0;margin:4px 0;padding:0 10px;border-radius:6px;background:var(--color-dark-5,rgba(128,128,128,.08));box-sizing:border-box}",
        ".eagle-photo-collection-actions{display:flex;flex-direction:column;margin:4px 0;padding:4px 10px;border:1px solid rgba(128,128,128,.28);border-radius:6px;background:var(--color-dark-5,rgba(128,128,128,.08));box-sizing:border-box}",
        ".eagle-photo-sort-protection-settings{display:flex;flex-direction:column;min-height:34px;padding:0;box-sizing:border-box}",
        ".eagle-photo-sort-section{display:flex;flex-direction:column;gap:2px;min-height:34px;padding:0;box-sizing:border-box}",
        ".eagle-photo-collection-actions>div+section,.eagle-photo-collection-actions>section+section{border-top:1px solid rgba(128,128,128,.16)}",
        "#layout-panel.eagle-photo-sort-panel{width:380px;max-width:calc(100vw - 24px)}",
        ".eagle-photo-sort-header{display:flex;align-items:center;justify-content:space-between;gap:12px}",
        ".eagle-photo-sort-title{font-weight:600;color:var(--color-text-primary)}",
        ".eagle-photo-sort-summary{display:flex;flex-wrap:wrap;gap:5px;font-size:11px;line-height:1.4}",
        ".eagle-photo-sort-summary span{display:inline-flex;max-width:100%;padding:3px 6px;border-radius:4px;background:rgba(128,128,128,.12);color:var(--color-text-secondary);box-sizing:border-box;white-space:normal}",
        ".eagle-photo-sort-lock{display:flex;align-items:center;gap:7px;min-height:34px;padding:0;font-size:13px;font-weight:600;box-sizing:border-box}",
        ".eagle-photo-sort-lock[data-locked='true']{color:var(--color-primary,#1473e6)}",
        ".eagle-photo-sort-lock input{margin:0}",
        ".eagle-photo-sort-lock-state{font-size:10px;font-weight:400;opacity:.55}",
        ".eagle-photo-feature-apply{margin-left:auto;min-height:26px;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;font-size:11px;padding:3px 8px;white-space:nowrap}",
        ".eagle-photo-feature-apply:disabled{opacity:.35}",
        "#sidebar-item-container .sidebar-folder-item.eagle-photo-sort-folder-locked .badge{color:#ff3b30!important;font-weight:600}",
        "#sidebar-item-container .sidebar-folder-item.eagle-photo-sort-folder-locked .badge::before{content:'';display:inline-block;width:6px;height:6px;margin-right:5px;border-radius:50%;background:#ff3b30;box-shadow:0 0 0 1px rgba(255,59,48,.18);vertical-align:1px}",
        ".eagle-photo-sort-tree-row{display:flex;align-items:center;gap:8px}",
        ".eagle-photo-sort-tree{min-height:28px;flex:1;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;padding:4px 9px;text-align:left}",
        ".eagle-photo-sort-tree-result{font-size:11px;color:var(--color-positive,var(--color-text-secondary));line-height:1.4;min-width:0;overflow-wrap:anywhere}",
        ".eagle-photo-order-tree-settings{display:flex;align-items:center;gap:8px;min-height:28px;padding:0 10px 6px;box-sizing:border-box}",
        ".eagle-photo-order-tree-apply{min-height:28px;flex:1;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;padding:4px 9px;text-align:left}",
        ".eagle-photo-order-tree-result{font-size:11px;color:var(--color-positive,var(--color-text-secondary));line-height:1.4;min-width:0;overflow-wrap:anywhere}",
        ".eagle-photo-sort-actions{display:flex;align-items:center;gap:6px;min-height:28px}",
        ".eagle-photo-sort-actions button,.eagle-photo-sort-edit{height:28px;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;padding:0 9px}",
        ".eagle-photo-sort-actions button:disabled,.eagle-photo-sort-edit:disabled{opacity:.35}",
        ".eagle-photo-sort-manual{display:flex;align-items:center;gap:7px;min-height:34px;font-size:13px;font-weight:600}",
        ".eagle-photo-sort-manual input{margin:0}",
        ".eagle-photo-manual-tree-result{padding:0 0 4px 25px;font-size:11px;color:var(--color-positive,var(--color-text-secondary));line-height:1.4;min-width:0;overflow-wrap:anywhere}",
        ".eagle-photo-sort-rename{display:flex;align-items:center;gap:7px;min-height:34px;font-size:13px;font-weight:600}",
        ".eagle-photo-sort-rename input{margin:0}",
        ".eagle-photo-rename-actions{display:flex;align-items:center;gap:6px;min-height:28px}",
        ".eagle-photo-rename-preview,.eagle-photo-rename-undo{height:28px;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;padding:0 9px}",
        ".eagle-photo-rename-undo:disabled{opacity:.35}",
        ".eagle-photo-rename-state{padding:0 0 4px 25px;font-size:10px;line-height:1.3;opacity:.55;min-width:0}",
        ".eagle-photo-rename-tree-result{font-size:11px;color:var(--color-positive,var(--color-text-secondary));line-height:1.4}",
        ".eagle-photo-taken-meta-value{white-space:nowrap}",
        "#layout-panel .eagle-photo-taken-meta-active .select-content{min-width:150px}",
        ".eagle-photo-meta-tree-settings{display:flex;align-items:center;gap:8px;min-height:28px}",
        ".eagle-photo-meta-tree-apply{min-height:28px;flex:1;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;padding:4px 9px;text-align:left}",
        ".eagle-photo-meta-tree-result{font-size:11px;color:var(--color-positive,var(--color-text-secondary));line-height:1.4;min-width:0;overflow-wrap:anywhere}",
        "body.eagle-photo-sort-active:not(.eagle-photo-sort-dragging) .box-sortable-helper{display:none!important}",
        "body.eagle-photo-sort-dragging .box:not(.selected):not(.pinned) .box-sortable-helper{display:block!important}",
        "body.eagle-photo-smart-dragging .box.eagle-photo-smart-target-host .box-sortable-helper.eagle-photo-smart-active-helper{display:block!important;position:absolute!important;top:0!important;bottom:0!important;height:auto!important;pointer-events:none!important;z-index:2147483500!important}",
        "body.eagle-photo-smart-dragging .box.eagle-photo-drop-target:before{content:'';position:absolute;top:0;bottom:0;width:3px;background:var(--color-primary,#1473e6);pointer-events:none;z-index:2147483500}",
        "body.eagle-photo-smart-dragging .box.eagle-photo-drop-target.eagle-photo-drop-before:before{left:0;right:auto}",
        "body.eagle-photo-smart-dragging .box.eagle-photo-drop-target.eagle-photo-drop-after:before{right:0;left:auto}",
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
        ".eagle-photo-sort-list{display:flex;flex-direction:column;gap:7px}",
        ".eagle-photo-sort-rule{display:grid;grid-template-columns:20px minmax(0,1fr) 70px 24px 24px 24px;gap:4px;align-items:center}",
        ".eagle-photo-sort-rule select{height:28px;min-width:0;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;padding:0 5px;font:inherit;font-size:11px}",
        ".eagle-photo-sort-inline-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px}",
        ".eagle-photo-sort-rule button,.eagle-photo-sort-inline-actions button,.eagle-photo-sort-preset{height:28px;border:1px solid rgba(128,128,128,.32);border-radius:5px;background:var(--color-bg-input,rgba(128,128,128,.12));color:inherit;font:inherit;padding:0 8px;font-size:11px}",
        ".eagle-photo-sort-rule button{padding:0;font-size:14px}.eagle-photo-sort-rule button:disabled{opacity:.3}",
        ".eagle-photo-sort-priority{text-align:center;font-size:12px;opacity:.65}"
      ].join("");
      document.head.appendChild(style);
    }

    function renderOrderTreeSettings() {
      const smartScope = currentCollection().kind === "smart";
      const count = smartScope ? 1 : currentFolderTree().length;
      const show = count > 1 || smartScope;
      document.querySelectorAll(".eagle-photo-order-tree-settings").forEach(
        (row) => {
          row.style.display = show ? "flex" : "none";
          const button = row.querySelector(".eagle-photo-order-tree-apply");
          if (button) {
            button.textContent = ui.applyTree;
            button.title = smartScope
              ? "仅应用到当前智能文件夹"
              : ui.applyTreeConfirm.replace("{count}", String(count));
            button.disabled = folderLocked();
          }
          const result = row.querySelector(".eagle-photo-order-tree-result");
          if (result) {
            result.textContent = api.batchMessage;
            result.style.display = api.batchMessage ? "" : "none";
          }
        }
      );
    }

    function renderProtectionSettings() {
      syncRulesContext();
      const treeFolders = currentFolderTree();
      const locked = folderLocked();
      const protectedFromBatch = folderBatchProtected();
      const descendantLockedCount = treeFolders.filter((folder, index) =>
        index > 0 && folderBatchProtected(folder)
      ).length;
      document.querySelectorAll(".eagle-photo-sort-protection-settings").forEach(
        (row) => {
          row.style.display = "flex";
          const lockRow = row.querySelector(".eagle-photo-sort-lock");
          const lockCheckbox = lockRow?.querySelector("input");
          if (lockRow) {
            lockRow.style.display = "flex";
            lockRow.dataset.locked = protectedFromBatch ? "true" : "false";
          }
          if (lockCheckbox) {
            lockCheckbox.checked = protectedFromBatch;
            lockCheckbox.disabled = currentCollection().kind === "global";
          }
          const lockState = row.querySelector(".eagle-photo-sort-lock-state");
          if (lockState) {
            lockState.textContent = locked
              ? ui.lockedState
              : descendantLockedCount > 0
                ? ui.descendantLockedState.replace(
                    "{count}",
                    String(descendantLockedCount)
                  )
                : ui.unlockedState;
          }
          const lockTree = row.querySelector(".eagle-photo-lock-tree");
          if (lockTree) {
            lockTree.style.display = treeFolders.length > 1 ? "" : "none";
            lockTree.textContent = ui.applyTree;
            lockTree.title = protectedFromBatch
              ? "将排序锁定同步到全部后代文件夹"
              : "将解除锁定同步到全部后代文件夹";
          }
        }
      );
    }

    function renderSettings() {
      syncManualContext();
      document.body.classList.toggle(
        "eagle-photo-sort-active",
        manualEnabled() &&
          currentCollection().kind !== "global"
      );
      renderProtectionSettings();
      const panels = Array.from(document.querySelectorAll(
        ".eagle-photo-taken-settings, .eagle-photo-collection-actions"
      ));
      const collectionKind = currentCollection().kind;
      collectionSettingsRenderer.renderSettings({
        collectionKind,
        panels,
        multiSortSelected: isMultiSortSelected(),
        renameSection: api.renameSection
      });
      panels.forEach(
        (panel) => {
          const isCollectionActionsPanel = panel.classList.contains(
            "eagle-photo-collection-actions"
          );
          const rulesSection = panel.querySelector(
            ".eagle-photo-sort-rules-section"
          );
          if (rulesSection) {
            rulesSection.style.display = isMultiSortSelected()
              ? "flex"
              : "none";
          }
          const summary = panel.querySelector(".eagle-photo-sort-summary");
          const rulesSignature = JSON.stringify(api.rules);
          const inlineRuleList = panel.querySelector(
            ".eagle-photo-sort-list"
          );
          if (
            inlineRuleList &&
            inlineRuleList.dataset.rules !== rulesSignature
          ) {
            inlineRuleList.dataset.rules = rulesSignature;
            renderRuleList(inlineRuleList);
          }
          if (summary && summary.dataset.rules !== rulesSignature) {
            summary.dataset.rules = rulesSignature;
            summary.replaceChildren(
              ...api.rules.map((rule, index) => {
                const item = document.createElement("span");
                const fieldLabel =
                  rule.field === "NAME" && rule.options?.prefixOnly
                    ? "文件名（1-/2- 前缀分组）"
                    : ui[rule.field];
                item.textContent =
                  String(index + 1) + ". " + fieldLabel +
                  (rule.direction === "desc" ? " ↓" : " ↑");
                return item;
              })
            );
          }
          const checkbox = panel.querySelector(".eagle-photo-sort-manual input");
          const locked = folderLocked();
          const availability = currentLevelAvailability();
          const descendantCount = Math.max(0, currentFolderTree().length - 1);
          document.querySelectorAll(
            '#layout-panel select[ng-change*="changeOrderBy"]'
          ).forEach((select) => {
            select.disabled = locked;
          });
          const edit = panel.querySelector(".eagle-photo-sort-edit");
          if (edit) edit.disabled = locked;
          if (rulesSection) {
            rulesSection.querySelectorAll("button,select,input").forEach(
              (control) => { control.disabled = locked; }
            );
          }
          const manualSection = panel.querySelector(
            ".eagle-photo-sort-manual-section"
          );
          if (manualSection) {
            manualSection.style.display = "flex";
          }
          if (checkbox) {
            checkbox.checked = true;
            checkbox.disabled = !availability.canManualDrag;
          }
          const treeButton = panel.querySelector(".eagle-photo-manual-tree");
          const treeResult = panel.querySelector(
            ".eagle-photo-manual-tree-result"
          );
          const treeCount = currentFolderTree().length;
          const renameSection = panel.querySelector(
            ".eagle-photo-sort-rename-section"
          );
          if (treeButton) {
            treeButton.style.display = descendantCount > 0 ? "" : "none";
            treeButton.textContent = ui.applyTree;
            treeButton.title = "将手动拖动开关同步到全部后代文件夹";
            treeButton.disabled = locked;
          }
          if (treeResult) {
            treeResult.style.display = api.manualTreeMessage ? "" : "none";
            treeResult.textContent = api.manualTreeMessage;
          }
          const undo = panel.querySelector('[data-manual-action="undo"]');
          const reset = panel.querySelector('[data-manual-action="reset"]');
          if (undo) undo.disabled = api.manual.history.length === 0;
          if (reset) {
            reset.disabled = locked || api.manual.relations.length === 0;
          }
          if (!renameSection) return;
          if (!isCollectionActionsPanel || collectionKind !== "normal") return;
          const renameCheckbox = panel.querySelector(
            ".eagle-photo-sort-rename input"
          );
          if (renameCheckbox) {
            renameCheckbox.checked = renameEnabled();
            renameCheckbox.disabled =
              !renameLifecycleRuntime.canToggleAutoNumber(availability);
          }
          const renamePlan = buildCurrentRenamePlan();
          const renameState = panel.querySelector(".eagle-photo-rename-state");
          if (renameState) {
            if (api.rename.message) {
              renameState.textContent = api.rename.message;
            } else if (renamePlan.error === "scene-name-empty") {
              renameState.textContent = ui.renameEmptyScene;
            } else if (
              renamePlan.targetKind === "direct-folders" &&
              renamePlan.entries.length
            ) {
              renameState.textContent =
                "当前层 " + String(renamePlan.entries.length) +
                " 个子文件夹 · 待改 " + String(renamePlan.changes.length) + " 个";
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
              currentCollection().kind === "global" ||
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
            renameTree.style.display = descendantCount > 0 ? "" : "none";
            renameTree.textContent = ui.applyRenameTree;
            renameTree.title = ui.applyRenameTreeConfirm.replace(
              "{count}",
              String(treeCount)
            );
            renameTree.disabled = locked || api.rename.running;
          }
          const renameTreeResult = panel.querySelector(
            ".eagle-photo-rename-tree-result"
          );
          if (renameTreeResult) {
            const message = renameBatchStatusForCurrentContext()?.message || "";
            renameTreeResult.style.display = message ? "" : "none";
            renameTreeResult.textContent = message;
          }
        }
      );
      renderOrderTreeSettings();
      syncSubFolderManualMode();
    }
    api.renderSettings = renderSettings;

    function clearManual(refresh = true) {
      syncManualContext();
      api.manual.relations = [];
      api.manual.history = [];
      api.manual.mode = "automatic";
      api.manual.revision = Date.now();
      persistCurrentManualOrder();
      renderSettings();
      if (refresh) api.refresh?.();
    }

    function undoManual() {
      const previous = api.manual.history.pop();
      if (!previous) return;
      api.manual.relations = Array.isArray(previous)
        ? previous.map((relation) => ({ ...relation }))
        : [];
      api.manual.mode = api.manual.relations.length ? "overlay" : "automatic";
      api.manual.revision = Date.now();
      persistCurrentManualOrder();
      renderSettings();
      api.refresh?.();
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

    function renderRuleList(list) {
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
          saveRules(next);
        });

        const direction = createSelect([
          { value: "asc", label: ui.asc },
          { value: "desc", label: ui.desc }
        ], rule.direction);
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
            saveRules(next);
          });

          const direction = createSelect([
            { value: "asc", label: ui.asc },
            { value: "desc", label: ui.desc }
          ], rule.direction);
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
      if (!sortPanel) return;

      const existingPanel = sortPanel.parentElement.querySelector(
        ".eagle-photo-taken-settings"
      );
      if (existingPanel) {
        if (existingPanel.previousElementSibling !== sortPanel) {
          sortPanel.insertAdjacentElement("afterend", existingPanel);
        }
        renderSettings();
        return;
      }

      const panel = document.createElement("div");
      panel.className = "eagle-photo-taken-settings";
      panel.style.display = "none";
      sortPanel.closest("#layout-panel")?.classList.add(
        "eagle-photo-sort-panel"
      );

      const collectionActions = document.createElement("div");
      collectionActions.className = "eagle-photo-collection-actions";

      const header = document.createElement("div");
      header.className = "eagle-photo-sort-header";
      const title = document.createElement("div");
      title.className = "eagle-photo-sort-title";
      title.textContent = ui.title;

      const preset = document.createElement("button");
      preset.type = "button";
      preset.className = "eagle-photo-sort-preset";
      preset.textContent = ui.preset;
      preset.addEventListener("click", () => {
        saveRules(sortRuntime.defaultRules);
      });
      header.append(title, preset);

      const ruleList = document.createElement("div");
      ruleList.className = "eagle-photo-sort-list";
      api.renderInlineRuleRows = () => renderRuleList(ruleList);

      const ruleActions = document.createElement("div");
      ruleActions.className = "eagle-photo-sort-inline-actions";
      const restore = document.createElement("button");
      restore.type = "button";
      restore.textContent = ui.restore;
      restore.addEventListener("click", () => {
        saveRules(sortRuntime.defaultRules);
      });
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = ui.add;
      add.addEventListener("click", () => {
        if (api.rules.length >= 8) return;
        saveRules(api.rules.concat([{ field: "NAME", direction: "asc" }]));
      });
      ruleActions.append(restore, add);

      const manual = document.createElement("label");
      manual.className = "eagle-photo-sort-manual";
      const manualCheckbox = document.createElement("input");
      manualCheckbox.type = "checkbox";
      manualCheckbox.checked = true;
      manualCheckbox.hidden = true;
      manualCheckbox.tabIndex = -1;
      const manualLabel = document.createElement("span");
      manualLabel.textContent = "手动拖动（默认开启）";
      const restoreAutomatic = document.createElement("button");
      restoreAutomatic.type = "button";
      restoreAutomatic.dataset.manualAction = "reset";
      restoreAutomatic.textContent = "恢复自动排序";
      restoreAutomatic.title = "清除当前文件夹的手动顺序，重新使用所选排序方式";
      restoreAutomatic.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (folderLocked()) return;
        clearManual(true);
      });
      manual.append(
        manualCheckbox,
        manualLabel,
        restoreAutomatic
      );

      const manualTreeResult = document.createElement("div");
      manualTreeResult.className = "eagle-photo-manual-tree-result";
      manualTreeResult.style.display = "none";

      const rename = document.createElement("label");
      rename.className = "eagle-photo-sort-rename";
      const renameCheckbox = document.createElement("input");
      renameCheckbox.type = "checkbox";
      renameCheckbox.addEventListener("change", () => {
        if (renameCheckbox.checked) {
          const plan = buildCurrentRenamePlan();
          if (shouldRouteRenameToTree(plan)) {
            setRenameEnabled(true);
            api.rename.batchStatus = {
              state: "idle",
              sourceContextId: currentContextId(),
              message: ui.renameTreeReady.replace(
                "{count}",
                String(currentFolderTree().length)
              )
            };
            api.rename.message = api.rename.batchStatus.message;
            renderSettings();
          } else {
            renameCheckbox.checked = false;
            openRenamePreview({ enableAfter: true });
          }
        } else {
          setRenameEnabled(false);
        }
      });
      const renameTree = document.createElement("button");
      renameTree.type = "button";
      renameTree.className = "eagle-photo-feature-apply eagle-photo-rename-tree";
      renameTree.textContent = ui.applyRenameTree;
      renameTree.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        applyRenameToCurrentTree();
      });
      rename.append(
        renameCheckbox,
        document.createTextNode(ui.autoRename),
        renameTree
      );

      const renameState = document.createElement("div");
      renameState.className = "eagle-photo-rename-state";

      const sortSection = document.createElement("section");
      sortSection.className =
        "eagle-photo-sort-section eagle-photo-sort-rules-section";
      sortSection.append(
        header,
        ruleList,
        ruleActions
      );

      const manualSection = document.createElement("section");
      manualSection.className =
        "eagle-photo-sort-section eagle-photo-sort-manual-section";
      manualSection.append(
        manual,
        manualTreeResult
      );

      const renameSection = document.createElement("section");
      renameSection.className =
        "eagle-photo-sort-section eagle-photo-sort-rename-section";
      renameSection.append(
        rename,
        renameState
      );
      api.renameSection = renameSection;
      collectionActions.append(manualSection);
      if (currentCollection().kind !== "smart") {
        collectionActions.append(renameSection);
      }
      panel.append(sortSection);
      sortPanel.insertAdjacentElement("beforebegin", collectionActions);
      sortPanel.insertAdjacentElement("afterend", panel);
      api.renderInlineRuleRows();
      renderSettings();
    }

    function ensureProtectionSettings(select) {
      const sortPanel = select.closest(".panel-item");
      if (!sortPanel || sortPanel.parentElement.querySelector(
        ".eagle-photo-sort-protection-settings"
      )) {
        return;
      }

      const row = document.createElement("div");
      row.className = "eagle-photo-sort-protection-settings";

      const lock = document.createElement("label");
      lock.className = "eagle-photo-sort-lock";
      const lockCheckbox = document.createElement("input");
      lockCheckbox.type = "checkbox";
      lockCheckbox.addEventListener("change", () => {
        api.hostInputAdapter?.lockChanged();
        api.lockActionToken = (api.lockActionToken || 0) + 1;
        const actionToken = api.lockActionToken;
        if (!lockCheckbox.checked) {
          setCurrentFolderLocked(false);
          return;
        }
        if (api.lockActionToken === actionToken) setCurrentFolderLocked(true);
      });
      const lockLabel = document.createTextNode(ui.lockCurrent);
      const lockState = document.createElement("span");
      lockState.className = "eagle-photo-sort-lock-state";
      const lockTree = document.createElement("button");
      lockTree.type = "button";
      lockTree.className = "eagle-photo-feature-apply eagle-photo-lock-tree";
      lockTree.textContent = ui.applyTree;
      lockTree.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setLockTreeEnabled(lockCheckbox.checked);
      });
      lock.append(lockCheckbox, lockLabel, lockState, lockTree);
      row.append(lock);
      const actions = sortPanel.parentElement.querySelector(
        ".eagle-photo-collection-actions"
      );
      if (actions) actions.insertBefore(row, actions.firstChild);
      renderProtectionSettings();
    }

    function ensureOrderTreeSettings(select) {
      const panelItem = select.closest(".panel-item");
      if (!panelItem || panelItem.parentElement.querySelector(
        ".eagle-photo-order-tree-settings"
      )) {
        return;
      }
      const row = document.createElement("div");
      row.className = "eagle-photo-order-tree-settings";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "eagle-photo-order-tree-apply";
      button.addEventListener("click", applySortToCurrentTree);
      const result = document.createElement("div");
      result.className = "eagle-photo-order-tree-result";
      row.append(button, result);
      // Batch scope belongs to the arrangement layer, directly below Eagle's
      // arrangement selector. It must not add a fourth control to the compact
      // collection switches above that selector.
      const rulesPanel = panelItem.parentElement.querySelector(
        ".eagle-photo-taken-settings"
      );
      (rulesPanel || panelItem).insertAdjacentElement("afterend", row);
      renderOrderTreeSettings();
    }

    function addOption(select) {
      const customOptions = [
        {
          key: TAKEN_SORT_KEY,
          label: TAKEN_LABELS[language] || TAKEN_LABELS.en
        },
        { key: SORT_KEY, label: LABELS[language] || LABELS.en }
      ];
      let anchor = select.querySelector('option[value="BTIME"]');
      for (const entry of customOptions) {
        if (select.querySelector('option[value="' + entry.key + '"]')) {
          anchor = select.querySelector('option[value="' + entry.key + '"]');
          continue;
        }
        const option = document.createElement("option");
        option.value = entry.key;
        option.textContent = entry.label;
        if (anchor) anchor.insertAdjacentElement("afterend", option);
        else select.appendChild(option);
        anchor = option;
      }

      if (!select.dataset.eaglePhotoTakenBound) {
        select.dataset.eaglePhotoTakenBound = "true";
        select.addEventListener("change", (event) => {
          if (!isPluginSort(select.value)) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          if (select.value === TAKEN_SORT_KEY) {
            activateTakenTimeSort();
          } else {
            activatePhotoSort();
          }
          renderSettings();
        }, true);
      }

      const selectRoot = select.closest(".select");
      const content = selectRoot && selectRoot.querySelector(".select-content");
      if (content) {
        for (const entry of customOptions) {
          const className = entry.key === SORT_KEY
            ? "eagle-photo-taken-value"
            : "eagle-photo-taken-time-value";
          if (content.querySelector("." + className)) continue;
          const value = document.createElement("div");
          value.className = "select-value " + className;
          value.style.display = "none";
          const existingIcon = content.querySelector(
            'img[src*="ic-prop-createdAt.svg"]'
          );
          if (existingIcon) value.appendChild(existingIcon.cloneNode(true));
          value.appendChild(document.createTextNode(entry.label));
          content.appendChild(value);
        }
      }

      const sync = () => {
        const selected = currentOrder();
        for (const entry of customOptions) {
          const className = entry.key === SORT_KEY
            ? ".eagle-photo-taken-value"
            : ".eagle-photo-taken-time-value";
          const value = content && content.querySelector(className);
          if (value) value.style.display = selected === entry.key ? "" : "none";
        }
        if (isPluginSort(selected) && select.value !== selected) {
          select.value = selected;
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
      ensureOrderTreeSettings(select);
      ensureProtectionSettings(select);
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
      if (!panelItem || document.querySelector(".eagle-photo-meta-tree-settings")) {
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
            button.textContent = ui.applyMetaTree;
            button.title = ui.applyMetaTreeConfirm
              .replace("{type}", currentMetaLabel())
              .replace("{count}", String(count));
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
      return collectionRuntime.scopedItems({
        currentFolder: bodyScope.currentFolder,
        currentSmartFolder: bodyScope.currentSmartFolder,
        locationHash: window.location.hash,
        allData: bodyScope.allData,
        filtereds: bodyScope.filtereds,
        raw: bodyScope.raw
      });
    }

    // This is the only Eagle-side collection snapshot boundary. It converts
    // the current normal/smart context into the adapter contract without
    // falling back to the global raw array for an empty or unknown view.
    function hostCollectionMembers() {
      const collection = currentCollection();
      if (collection.kind === "global") {
        return { collection, targetKind: "unknown", members: [] };
      }
      if (
        collection.kind === "normal" &&
        bodyScope.currentFolder &&
        folderLevelRuntime.directChildren(bodyScope.currentFolder).length > 0
      ) {
        return {
          collection,
          targetKind: "direct-folders",
          members: folderLevelRuntime
            .directChildren(bodyScope.currentFolder)
            .map((folder) => ({ ...folder, id: String(folder.id) }))
        };
      }
      const members = currentItems()
        .filter((item) => item?.id)
        .map((item) => ({ ...item, id: String(item.id) }));
      return {
        collection,
        targetKind: "direct-media",
        members
      };
    }

    function hostCollectionSnapshot(context = {}) {
      const resolved = hostCollectionMembers();
      const collection = resolved.collection;
      const libraryId = currentLibraryId();
      const collectionId = String(collection.id || "");
      const acceptedContextIds = new Set([
        collectionId,
        currentContextId()
      ]);
      if (
        collection.kind === "global" ||
        !collectionId ||
        (context.libraryId && String(context.libraryId) !== libraryId) ||
        (context.collectionId &&
          !acceptedContextIds.has(String(context.collectionId))) ||
        (context.kind && String(context.kind) !== collection.kind)
      ) {
        return null;
      }
      const members = resolved.members;
      const memberIds = members.map((member) => member.id);
      const baseOrder = memberIds.slice();
      const revision = [
        itemFingerprint(members),
        String(currentOrder()),
        String(currentIncrease()),
        String(api.manual.revision || 0)
      ].join(":");
      return {
        ref: {
          libraryId,
          collectionId,
          kind: collection.kind,
          targetKind: resolved.targetKind
        },
        revision,
        members,
        hostBaseOrder: baseOrder
      };
    }

    api.getCollectionSnapshot = (context = {}) =>
      hostCollectionSnapshot(context);

    api.writeManualView = (command = {}) => {
      const snapshot = hostCollectionSnapshot({
        libraryId: command.ref?.libraryId,
        collectionId: command.ref?.collectionId,
        kind: command.ref?.kind
      });
      if (!snapshot || !Array.isArray(command.order)) {
        return { ok: false, reason: "collection-unavailable" };
      }
      const expected = new Set(snapshot.members.map((member) => member.id));
      const order = command.order.map(String);
      if (
        order.length !== expected.size ||
        new Set(order).size !== expected.size ||
        order.some((id) => !expected.has(id))
      ) {
        return { ok: false, reason: "manual-order-membership-mismatch" };
      }
      syncManualContext();
      api.manual.legacyOrder = order.slice();
      api.manual.order = order.slice();
      api.manual.relations = [];
      api.manual.mode = "automatic";
      api.manual.targetKind = snapshot.ref.targetKind;
      api.manual.revision = Date.now();
      persistCurrentManualOrder();
      return {
        ok: true,
        collectionId: snapshot.ref.collectionId,
        revision: String(api.manual.revision)
      };
    };

    api.requestHostConfirmation = (command = {}) => {
      const snapshot = hostCollectionSnapshot({
        libraryId: command.ref?.libraryId,
        collectionId: command.ref?.collectionId,
        kind: command.ref?.kind
      });
      if (!snapshot) return { ok: false, confirmed: false };
      return {
        ok: true,
        confirmed: true,
        collectionId: snapshot.ref.collectionId,
        commandType: String(command.type || "")
      };
    };

    function renderedCardIds() {
      return Array.from(
        document.querySelectorAll("#box-list .box[data-box-id]")
      ).map((box, index) => {
        const rect = box.getBoundingClientRect();
        return {
          id: String(box.getAttribute("data-box-id") || ""),
          index,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        };
      })
        .filter((entry) => entry.id && entry.width > 0 && entry.height > 0)
        .sort((left, right) => {
          const rowTolerance = Math.max(
            12,
            Math.min(left.height || 0, right.height || 0) / 3
          );
          if (Math.abs(left.top - right.top) > rowTolerance) {
            return left.top - right.top;
          }
          if (left.left !== right.left) return left.left - right.left;
          return left.index - right.index;
        })
        .map((entry) => entry.id)
        .filter(Boolean);
    }

    function resolveCurrentOrderSnapshot(options = {}) {
      const collection = currentCollection();
      if (collection.kind === "global") {
        return sortingSystemRuntime.resolveOrder({
          collection,
          contextId: currentContextId(),
          targetKind: "direct-media",
          items: []
        });
      }
      const items = collection.kind === "normal"
        ? collectionRuntime.directFolderItems(currentItems(), collection.id)
        : currentItems().slice();
      const orderBy = currentOrder();
      const config = sortConfigFor(orderBy);
      return sortingSystemRuntime.resolveOrder({
        collection,
        contextId: currentContextId(),
        targetKind: "direct-media",
        items,
        pluginSort: isPluginSort(orderBy),
        sortMode: currentSortMode(orderBy),
        timestamps: config.timestamps,
        rules: config.rules,
        manualOrder: [],
        manualOverlay: activeManualOverlay(),
        locked: folderLocked(),
        preferRendered: options.preferRendered === true,
        renderedIds: options.preferRendered === true ? renderedCardIds() : []
      });
    }

    function currentRenameItems() {
      return resolveCurrentOrderSnapshot({ preferRendered: true }).finalItems;
    }

    function buildCurrentRenamePlan() {
      const collection = currentCollection();
      if (collection.kind === "global") {
        return {
          contextId: currentContextId(),
          sceneName: "",
          entries: [],
          changes: [],
          groups: { people: 0, environment: 0 },
          ignoredCount: 0,
          error: "collection-required"
        };
      }
      if (collection.kind === "smart") {
        return {
          contextId: currentContextId(),
          collectionKind: "smart",
          targetKind: "direct-media",
          sceneName: collection.name,
          entries: [],
          changes: [],
          groups: { people: 0, environment: 0 },
          ignoredCount: 0,
          sourceFolders: [],
          error: "smart-collection-rename-disabled"
        };
      }
      if (
        collection.kind === "normal" &&
        folderLevelRuntime.directChildren(bodyScope.currentFolder).length > 0
      ) {
        const plan = folderLevelRuntime.buildFolderRenamePlan(
          folderLevelRuntime.directChildren(bodyScope.currentFolder),
          { token: currentContextId() }
        );
        return {
          ...plan,
          contextId: currentContextId(),
          collectionKind: collection.kind,
          targetKind: "direct-folders",
          sceneName: collection.name,
          groups: { people: 0, environment: 0 },
          ignoredCount: 0,
          error: null,
          sourceFolders: []
        };
      }
      const orderSnapshot = resolveCurrentOrderSnapshot({ preferRendered: true });
      const items = orderSnapshot.finalItems;
      const plan = sortingSystemRuntime.buildRenamePlan(orderSnapshot, {
        folderName: collection.name
      });
      plan.collectionKind = collection.kind;
      plan.targetKind = "direct-media";
      plan.sourceFolders = collectionRuntime.sourceFolderSummary(items);
      plan.contextId = currentContextId();
      return plan;
    }

    function buildManualDropRenamePlan(nextItems, previousItemsOverride = null) {
      const collection = currentCollection();
      if (collection.kind !== "normal" || !bodyScope.currentFolder?.id) return null;
      const baseSnapshot = resolveCurrentOrderSnapshot();
      const previousItems = Array.isArray(previousItemsOverride)
        ? previousItemsOverride
        : baseSnapshot.sourceItems;
      const finalItems = sortingSystemRuntime.exactOrder(
        baseSnapshot.sourceItems,
        nextItems
      );
      if (!baseSnapshot.operable || !finalItems) return null;
      const orderSnapshot = {
        ...baseSnapshot,
        finalItems,
        finalIds: finalItems.map((item) => String(item?.id || "")),
        authority: "manual"
      };
      const plan = sortingSystemRuntime.buildRenamePlan(orderSnapshot, {
        folderName: collection.name
      });
      const limitedPlan = renameRuntime.limitPlanToOrdinalChanges(
        plan,
        previousItems,
        finalItems
      );
      limitedPlan.collectionKind = collection.kind;
      limitedPlan.targetKind = "direct-media";
      limitedPlan.sourceFolders = collectionRuntime.sourceFolderSummary(finalItems);
      limitedPlan.contextId = currentContextId();
      return limitedPlan;
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

    function applyFolderRenameEntries(plan, options = {}) {
      if (!plan?.changes?.length || folderLocked()) return 0;
      const children = folderLevelRuntime.directChildren(bodyScope.currentFolder);
      const folders = new Map(children.map((folder) => [String(folder.id), folder]));
      const transaction = plan.changes.map((entry) => ({
        kind: "folder",
        id: entry.id,
        oldName: entry.oldName,
        newName: entry.newName
      }));
      const snapshots = transaction.map((entry) => ({
        folder: folders.get(entry.id),
        oldName: entry.oldName
      })).filter((entry) => entry.folder);
      if (!snapshots.length) return 0;
      api.rename.running = true;
      try {
        for (const entry of plan.phases.temporary) {
          const folder = folders.get(entry.id);
          if (folder) folder.name = entry.name;
        }
        for (const entry of plan.phases.final) {
          const folder = folders.get(entry.id);
          if (folder) folder.name = entry.name;
        }
        bodyScope.updateSidebarList?.();
        bodyScope.refreshSubfolderList?.();
        bodyScope.saveFolder();
        if (options.record !== false) api.rename.lastTransaction = transaction;
      } catch (error) {
        for (const snapshot of snapshots) snapshot.folder.name = snapshot.oldName;
        api.rename.running = false;
        throw error;
      }
      bodyScope.$evalAsync();
      setTimeout(() => {
        api.rename.running = false;
        api.rename.lastSignature = renameRuntime.signature(
          buildCurrentRenamePlan()
        );
        renderSettings();
      }, 350);
      return snapshots.length;
    }

    function renderVisibleRenameMask() {
      const names = api.rename.visibleNames || {};
      if (
        !Object.keys(names).length ||
        api.rename.visibleContextId !== currentContextId()
      ) {
        return 0;
      }
      let rendered = 0;
      for (const [id, expectedName] of Object.entries(names)) {
        const box = document.getElementById("box-" + id);
        if (!box) continue;
        for (const label of box.querySelectorAll(".name span,.ext-icon-name")) {
          if (label.textContent !== expectedName) label.textContent = expectedName;
        }
        rendered += 1;
      }
      const selectedId = String(bodyScope.selected?.[0]?.id || "");
      const selectedName = names[selectedId];
      const inspectorName = document.querySelector("#inspector-name");
      if (
        selectedName &&
        inspectorName &&
        inspectorName.value !== selectedName
      ) {
        inspectorName.value = selectedName;
      }
      return rendered;
    }

    function scheduleVisibleRenameMaskRender() {
      if (api.rename.visibleMaskTimer) return;
      api.rename.visibleMaskTimer = setTimeout(() => {
        api.rename.visibleMaskTimer = null;
        renderVisibleRenameMask();
      }, 0);
    }

    function beginVisibleRenameMask(plan) {
      const entries = Array.isArray(plan?.changes) ? plan.changes : [];
      if (!entries.length || plan.contextId !== currentContextId()) return 0;
      api.rename.visibleContextId = plan.contextId;
      api.rename.visibleNames = Object.fromEntries(
        entries.map((entry) => [String(entry.id), String(entry.newName || "")])
      );
      if (!api.rename.visibleMaskObserver) {
        api.rename.visibleMaskObserver = new MutationObserver(
          scheduleVisibleRenameMaskRender
        );
        api.rename.visibleMaskObserver.observe(document.body, {
          attributes: true,
          characterData: true,
          childList: true,
          subtree: true
        });
        api.sortingModuleRegister?.(() => {
          api.rename.visibleMaskObserver?.disconnect?.();
          api.rename.visibleMaskObserver = null;
        });
      }
      renderVisibleRenameMask();
      return entries.length;
    }

    function finishVisibleRenameMask(commitFinalNames = false) {
      clearTimeout(api.rename.visibleMaskTimer);
      api.rename.visibleMaskTimer = null;
      const names = api.rename.visibleNames || {};
      const maskContextMatches =
        api.rename.visibleContextId === currentContextId();
      if (commitFinalNames && maskContextMatches) {
        const items = new Map(
          currentItems().map((item) => [String(item?.id || ""), item])
        );
        const changed = [];
        for (const [id, expectedName] of Object.entries(names)) {
          const item = items.get(id);
          if (!item || item.name === expectedName) continue;
          item.name = expectedName;
          changed.push(item);
        }
        if (changed.length && typeof bodyScope.updateItemsView === "function") {
          bodyScope.updateItemsView(changed);
        }
        if (changed.length && typeof bodyScope.updateSelection === "function") {
          bodyScope.updateSelection();
        }
        bodyScope.$evalAsync();
      }
      api.rename.visibleContextId = "";
      api.rename.visibleNames = Object.create(null);
      if (!commitFinalNames && maskContextMatches) {
        const maskedIds = new Set(Object.keys(names));
        const currentMaskedItems = currentItems().filter(
          (item) => maskedIds.has(String(item?.id || ""))
        );
        if (
          currentMaskedItems.length &&
          typeof bodyScope.updateItemsView === "function"
        ) {
          bodyScope.updateItemsView(currentMaskedItems);
        }
        if (
          currentMaskedItems.length &&
          typeof bodyScope.updateSelection === "function"
        ) {
          bodyScope.updateSelection();
        }
        bodyScope.$evalAsync();
      }
    }

    function queueCurrentRenamePlan(plan) {
      if (
        !plan?.changes?.length ||
        api.rename.running ||
        api.rename.batchRequest ||
        currentCollection().kind !== "normal" ||
        !bodyScope.currentFolder?.id
      ) {
        return 0;
      }
      const sourceContextId = currentContextId();
      beginVisibleRenameMask(plan);
      const id = Date.now().toString(36) + "-" +
        Math.random().toString(36).slice(2, 9);
      const request = sortingSystemRuntime.createCurrentFolderRenameRequest(
        plan,
        {
          id,
          collectionId: bodyScope.currentFolder.id,
          folderId: bodyScope.currentFolder.id,
          folderName: bodyScope.currentFolder.name,
          orderRevision: api.manual.revision,
          snapshotVersion: String(api.manual.revision || 0),
          snapshotIdentity:
            String(currentContextId()) + ":" +
            String(plan.orderSnapshot.membershipFingerprint || ""),
          signature: renameRuntime.signature(plan)
        }
      );
      if (!request) {
        finishVisibleRenameMask(false);
        return 0;
      }
      api.rename.batchId = id;
      api.rename.batchRequest = request;
      api.rename.batchStatus = {
        state: "queued",
        sourceContextId,
        message: "已按当前可见顺序提交安全编号"
      };
      api.rename.running = true;
      api.rename.message = api.rename.batchStatus.message;
      renderSettings();
      bodyScope.$evalAsync();
      return plan.changes.length;
    }

    function applyRenamePlan(plan, options = {}) {
      if (!plan || plan.contextId !== currentContextId()) return 0;
      if (currentCollection().kind !== "normal") return 0;
      if (!sortingSystemRuntime.guard("rename", {
        collection: currentCollection(),
        locked: folderLocked(),
        targetCount: plan.entries?.length || 0
      }).allowed) return 0;
      if (plan.error || !plan.entries.length) return 0;
      if (options.enableAfter) setRenameEnabled(true);
      const count = plan.targetKind === "direct-folders"
        ? applyFolderRenameEntries(plan)
        : queueCurrentRenamePlan(plan);
      api.rename.message = plan.targetKind === "direct-media" && count
        ? "已按当前可见顺序提交安全编号"
        : count
          ? ui.renameDone.replace("{count}", String(count))
          : ui.renameNoChanges;
      renderSettings();
      return count;
    }

    function undoLastRename() {
      const transaction = api.rename.lastTransaction.slice();
      if (!transaction.length || api.rename.running) return 0;
      setRenameEnabled(false);
      const folderTransaction = transaction.every(
        (entry) => entry.kind === "folder"
      );
      let count = 0;
      if (folderTransaction) {
        const children = folderLevelRuntime.directChildren(bodyScope.currentFolder);
        const folders = new Map(children.map((folder) => [String(folder.id), folder]));
        for (const entry of transaction) {
          const folder = folders.get(entry.id);
          if (!folder) continue;
          folder.name = entry.oldName;
          count += 1;
        }
        bodyScope.updateSidebarList?.();
        bodyScope.refreshSubfolderList?.();
        bodyScope.saveFolder();
        bodyScope.$evalAsync();
      } else {
        count = applyRenameEntries(
          transaction.map((entry) => ({ id: entry.id, newName: entry.oldName })),
          { record: false }
        );
      }
      api.rename.lastTransaction = [];
      api.rename.message = ui.renameUndone.replace("{count}", String(count));
      renderSettings();
      return count;
    }

    function maybeAutoRename() {
      if (
        !renameEnabled() ||
        api.rename.running ||
        folderLocked() ||
        inheritedRenameExecutionBlocked() ||
        !bodyScope.currentFolder
      ) {
        return false;
      }
      const pendingManualPlan = api.rename.pendingManualPlan;
      const plan = pendingManualPlan?.contextId === currentContextId()
        ? pendingManualPlan
        : buildCurrentRenamePlan();
      api.rename.pendingManualPlan = null;
      const signature = renameRuntime.signature(plan);
      if (
        plan.error ||
        !plan.entries.length ||
        !signature
      ) {
        return false;
      }
      if (!plan.changes.length || signature === api.rename.lastSignature) {
        api.rename.lastSignature = signature;
        return false;
      }
      applyRenamePlan(plan);
      return true;
    }

    function scheduleAutoRename(
      cause,
      delay = AUTO_RENAME_QUIET_MS,
      restart = false
    ) {
      if (![
        "manual-media-drop",
        "manual-folder-drop",
        "manual-drop-continuation"
      ].includes(cause)) return;
      if (
        !renameEnabled() ||
        folderLocked() ||
        inheritedRenameExecutionBlocked()
      ) return;
      if (api.rename.timer && !restart) return;
      clearTimeout(api.rename.timer);
      api.rename.timer = setTimeout(() => {
        api.rename.timer = null;
        if (api.rename.running || api.rename.batchRequest) {
          api.rename.pendingAfterRun = true;
          return;
        }
        maybeAutoRename();
      }, delay);
    }

    function closeRenamePreview() {
      document.querySelector(".eagle-photo-rename-modal")?.remove();
    }

    function openRenamePreview(options = {}) {
      if (folderLocked() || currentCollection().kind !== "normal") return null;
      closeRenamePreview();
      const plan = buildCurrentRenamePlan();
      const overlay = document.createElement("div");
      overlay.className = "eagle-photo-rename-modal";
      const dialog = document.createElement("div");
      dialog.className = "eagle-photo-rename-dialog";

      const head = document.createElement("div");
      head.className = "eagle-photo-rename-head";
      const title = document.createElement("h2");
      title.textContent = plan.targetKind === "direct-folders"
        ? "按当前顺序自动编号子文件夹"
        : ui.renameTitle;
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "×";
      close.title = ui.renameCancel;
      close.addEventListener("click", closeRenamePreview);
      head.append(title, close);

      const summary = document.createElement("div");
      summary.className = "eagle-photo-rename-summary";
      const scene = plan.sceneName || "—";
      summary.textContent = plan.targetKind === "direct-folders"
        ? "当前层 " + String(plan.entries.length) +
          " 个直接子文件夹 · 待改 " + String(plan.changes.length) + " 个"
        : ui.renameScene.replace("{scene}", scene) + " · " +
          ui.renameSummary
            .replace("{people}", String(plan.groups.people))
            .replace("{environment}", String(plan.groups.environment))
            .replace("{ignored}", String(plan.ignoredCount));

      const warning = document.createElement("div");
      warning.className = "eagle-photo-rename-warning";
      if (plan.error === "scene-name-empty") {
        warning.textContent = ui.renameEmptyScene;
      } else if (!plan.entries.length) {
        warning.textContent = ui.renameNoItems;
      } else if (!plan.changes.length) {
        warning.textContent = options.enableAfter
          ? ui.renameWarning
          : ui.renameNoChanges;
      } else if (plan.targetKind === "direct-folders") {
        warning.textContent =
          "只重命名当前层的直接子文件夹，不会修改子文件夹内的素材。" +
          "确认后按 1-名称、2-名称连续编号。";
      } else {
        warning.textContent = plan.collectionKind === "smart"
          ? "智能文件夹是跨目录视图。本次改名会影响 " +
            String(plan.sourceFolders.length) +
            " 个来源文件夹；请逐项确认预览后再执行。"
          : ui.renameWarning;
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
      ensureSmartCollectionObserver();
      document
        .querySelectorAll('#layout-panel select[ng-change*="changeOrderBy"]')
        .forEach((select) => {
          const parent = select.closest(".panel-item")?.parentElement;
          const complete =
            select.dataset.eaglePhotoTakenBound === "true" &&
            select.querySelector('option[value="' + SORT_KEY + '"]') &&
            select.querySelector('option[value="' + TAKEN_SORT_KEY + '"]') &&
            parent?.querySelector(".eagle-photo-taken-settings") &&
            parent?.querySelector(".eagle-photo-collection-actions");
          if (!complete) addOption(select);
        });
      document
        .querySelectorAll('#layout-panel select[ng-model*="listMetaType"]')
        .forEach((select) => {
          const complete =
            select.dataset.eaglePhotoTakenMetaBound === "true" &&
            select.querySelector('option[value="' + META_KEY + '"]');
          if (!complete) addMetaOption(select);
        });
    }

    function sortingHostProjectionSignature() {
      const collection = currentCollection();
      const allData = Array.isArray(bodyScope.allData) ? bodyScope.allData : [];
      const filtereds = Array.isArray(bodyScope.filtereds)
        ? bodyScope.filtereds
        : [];
      const edges = (items) => [
        String(items[0]?.id || ""),
        String(items[items.length - 1]?.id || "")
      ].join(":");
      return [
        currentLibraryId(),
        collection.kind,
        collection.id,
        currentOrder(),
        currentIncrease() ? "1" : "0",
        allData.length,
        edges(allData),
        filtereds.length,
        edges(filtereds),
        String(bodyScope.page || ""),
        String(bodyScope.len || "")
      ].join("|");
    }

    function handleSortingHostChange() {
      ensureMenu();
      syncManualContext();
      syncMetaContext();
      syncRenameContext();
      document.querySelectorAll(
        ".eagle-photo-taken-value, .eagle-photo-taken-time-value"
      ).forEach((value) => {
        const isTakenTime = value.classList.contains(
          "eagle-photo-taken-time-value"
        );
        value.style.display = currentOrder() === (
          isTakenTime ? TAKEN_SORT_KEY : SORT_KEY
        ) ? "" : "none";
      });
      renderTakenMeta();
      renderMetaTreeSettings();
      renderFolderLockMarkers();
      renderSettings();
      scheduleSmartHostObservation();
    }

    api.ensureMenu = ensureMenu;
    api.activate = activatePhotoSort;
    api.applyToCurrentTree = applyRulesToCurrentTree;
    api.applyMetaToCurrentTree = applyMetaToCurrentTree;
    api.applyRenameToCurrentTree = applyRenameToCurrentTree;
    api.claimRenameBatch = claimRenameBatch;
    api.updateRenameBatchProgress = updateRenameBatchProgress;
      api.completeRenameBatch = completeRenameBatch;
      api.acknowledgeRenameEnqueue = acknowledgeRenameEnqueue;
      api.rejectRenameEnqueue = rejectRenameEnqueue;
      api.restoreRenameBatch = restoreRenameBatch;
    api.setCurrentFolderLocked = setCurrentFolderLocked;
    api.renderFolderLockMarkers = renderFolderLockMarkers;
    api.previewCurrentTree = () => currentFolderTree().map((folder) => ({
      id: folder.id,
      name: folder.name,
      orderBy: folder.orderBy || "",
      locked: folderLocked(folder),
        sortingLockConfig: folderLockProfile(folder)?.config || null
    }));
    api.clearManual = clearManual;
    api.getRules = () => api.rules.map((rule) => ({ ...rule }));
    api.setRules = (rules) => saveRules(rules);
    api.previewRename = buildCurrentRenamePlan;
    api.openRenamePreview = openRenamePreview;
    api.undoLastRename = undoLastRename;
    api.current = () => {
      ensureTeamSortStateForCurrentLibrary();
      syncManualContext();
      const lockProfile = folderLockProfile();
      const collection = currentCollection();
      // A global view may contain the entire Library. It has no folder-level
      // operation, so never fingerprint, clone, or transport all of its items.
      const items = collection.kind === "global" ? [] : currentItems();
      return {
        orderBy: currentOrder(),
        increase: currentIncrease(),
        folderLocked: lockProfile?.locked === true,
        sortingLockConfig: lockProfile?.config || null,
        levelAvailability: currentLevelAvailability(items),
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
        renameBatchStatus: renameBatchStatusForCurrentContext(),
        // The main-panel renderer builds rename previews on demand. The
        // background poll must stay lightweight, especially for smart folders.
        renamePlan: null,
        manualEnabled: manualEnabled(),
        sortMode: currentSortMode(),
        sortAuthority: activeManualOverlay().length > 0
          ? "automatic-rule+manual-overlay"
          : isPluginSort() ? "automatic-rule" : "native",
        manualOrder: api.manual.order.slice(),
        manualOverlay: api.manual.relations.map((relation) => ({ ...relation })),
        sortingModuleActive: api.sortingModuleActive === true,
        dragStats: { ...(api.dragStats || {}) },
        hostInputDiagnostics:
          api.hostInputAdapter?.diagnostics?.() || [],
        moveDiagnostics: api.moveDiagnostics.slice(),
        contextId: currentContextId(),
        currentFolderId: collection.kind === "normal"
          ? bodyScope.currentFolder?.id || ""
          : "",
        currentSmartFolderId: collection.kind === "smart"
          ? bodyScope.currentSmartFolder?.id || ""
          : "",
        teamImportResult: api.teamImportResult,
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
          name: item.name,
          size: item.size,
          mtime: item.mtime,
          modificationTime: item.modificationTime
        }))
      };
    };
    api.setTimestamps = (values) => {
      Object.assign(api.timestamps, values);
      renderTakenMeta();
      setTimeout(renderTakenMeta, 80);
      return Object.keys(values).length;
    };
    api.renderTakenMeta = renderTakenMeta;
    api.refresh = () => {
      ensureMenu();
      if (!isPluginSort()) {
        bodyScope.rebindRefresh?.();
        bodyScope.$evalAsync();
        return true;
      }
      const orderBy = currentOrder();
      bodyScope.currentOrderBy = orderBy;
      bodyScope.currentSortIncrease = currentIncrease();
      if (!bodyScope.currentFolder && !bodyScope.currentSmartFolder) {
        bodyScope.sortRawData(orderBy);
      }
      bodyScope.rebindRefresh();
      bodyScope.$evalAsync();
      return true;
    };

    function syncSubFolderManualMode() {
      const options = bodyScope.subFolderSortableOptions;
      if (!options || typeof options !== "object") return false;
      if (!api.original.subFolderSortableUpdate) {
        api.original.subFolderSortableUpdate = options.update;
      }
      if (!options.__eaglePhotoManualWrapped) {
        options.__eaglePhotoManualWrapped = true;
        options.update = function(...args) {
          const result = api.original.subFolderSortableUpdate?.apply(this, args);
          setTimeout(() => {
            if (!manualEnabled() || folderLocked()) return;
            const children = folderLevelRuntime.directChildren(
              bodyScope.currentFolder
            );
            syncManualContext();
            api.manual.history.push(api.manual.order.slice());
            api.manual.order = children.map((folder) => String(folder.id));
            api.manual.targetKind = "direct-folders";
            api.manual.mode = "manual";
            persistCurrentManualOrder();
            renderSettings();
            scheduleAutoRename("manual-folder-drop", 350, true);
          }, 0);
          return result;
        };
      }
      const availability = currentLevelAvailability();
      const enabled =
        manualEnabled() &&
        availability.targetKind === "direct-folders" &&
        availability.canManualDrag;
      options.disabled = !enabled;
      document.querySelector("#sub-folder-container .sub-folder-list")
        ?.classList.toggle("eagle-photo-folder-manual-active", enabled);
      return enabled;
    }

    function canHandleManualDrag() {
      const availability = currentLevelAvailability();
      return manualEnabled() &&
        availability.targetKind === "direct-media" &&
        sortingSystemRuntime.guard("manual-drag", {
          collection: currentCollection(),
          locked: folderLocked(),
          targetCount: availability.targetCount
        }).allowed;
    }

    function selectedIdsForDrag(sourceId) {
      const visibleSelected = Array.from(
        document.querySelectorAll("#box-list .box.selected[data-box-id]")
      ).map((box) => String(box.getAttribute("data-box-id") || ""))
        .filter(Boolean);
      if (visibleSelected.includes(String(sourceId || ""))) {
        return visibleSelected;
      }
      return sourceId ? [String(sourceId)] : [];
    }

    const dragFeedbackController = createDragFeedbackController({ document });

    function setDropTargetsVisible(visible, selectedIds = []) {
      if (visible === true) {
        dragFeedbackController.start(selectedIds, { mode: "normal" });
      } else {
        dragFeedbackController.clear({ schedulePostCleanup: false });
      }
    }

    function finishManualDrag(schedulePostCleanup = true) {
      clearTimeout(api.dragCleanupTimer);
      api.dragCleanupTimer = null;
      api.dragState = null;
      dragFeedbackController.clear({ schedulePostCleanup });
    }

    function clearSmartDragFeedback(schedulePostCleanup = true) {
      dragFeedbackController.clear({ schedulePostCleanup });
    }

    function showSmartDragFeedback(selectedIds, target = {}) {
      dragFeedbackController.start(selectedIds, { mode: "smart" });
      dragFeedbackController.update({ ...target, mode: "smart" });
    }

    function dropHelperAtPoint(clientX, clientY) {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
      const pointTarget = document.elementFromPoint(clientX, clientY);
      const directHelper = pointTarget?.closest?.(".box-sortable-helper");
      if (directHelper) return directHelper;
      const targetBox = pointTarget?.closest?.(".box");
      if (!targetBox || targetBox.classList.contains("pinned")) return null;
      const targetId = targetBox.getAttribute("data-box-id");
      if (!targetId || api.dragState?.selectedIds?.includes(targetId)) {
        return null;
      }
      const bounds = targetBox.getBoundingClientRect();
      const side = clientX >= bounds.left + bounds.width / 2
        ? "right"
        : "left";
      return targetBox.querySelector(".box-sortable-helper." + side);
    }

    function markDropHelper(helper) {
      const targetBox = helper?.closest?.(".box") || null;
      dragFeedbackController.update({
        mode: "normal",
        insideGrid: true,
        targetId: String(targetBox?.getAttribute?.("data-box-id") || ""),
        targetBox,
        helper: helper || null,
        insertAfter: helper?.classList?.contains?.("right") === true
      });
    }

    function manualItemsForDrag() {
      return resolveCurrentOrderSnapshot({ preferRendered: true }).finalItems;
    }

    function mergeManualRelations(existing, additions, movedIds) {
      const moved = new Set((movedIds || []).map(String));
      const retained = (Array.isArray(existing) ? existing : []).filter(
        (relation) =>
          !moved.has(String(relation.itemId)) &&
          !moved.has(String(relation.anchorId))
      );
      return orderCoordinator.normalizeManualOverlay(
        retained.concat(Array.isArray(additions) ? additions : [])
      );
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
      const collection = currentCollection();
      // Every drop starts from the complete visible order when Eagle has rendered
      // all target cards. Persisted manual order restores that same view after
      // refresh/restart, but numbering and drag math still follow what is visible.
      const visualItems = manualItemsForDrag();
      if (!helper || !targetId || !selectedIds?.length) return false;

      const suppliedMoveCommand = options.moveCommand;
      const moveResult = suppliedMoveCommand
        ? {
            ok:
              suppliedMoveCommand.type === "MoveCommand" &&
              suppliedMoveCommand.collection?.id === collection.id &&
              suppliedMoveCommand.collection?.kind === collection.kind &&
              suppliedMoveCommand.targetId === targetId,
            command: suppliedMoveCommand
          }
        : manualMoveRuntime.createMoveCommand({
            collection,
            items: visualItems,
            selectedIds,
            targetId,
            insertAfter: helper.classList.contains("right"),
            locked: folderLocked()
          });
      if (!moveResult.ok) return false;
      const moveCommand = moveResult.command;
      const nextItems = moveCommand.nextItems;

      syncManualContext();
      const nextManualState = manualMoveRuntime.reduce(
        api.manual,
        moveCommand,
        Date.now()
      );
      Object.assign(api.manual, nextManualState);
      persistCurrentManualOrder();
      api.dragStats.drops += 1;
      api.dragStats.lastDrop = {
        count: selectedIds.length,
        targetId,
        insertAfter: moveCommand.insertAfter,
        collectionId: collection.id,
        commandType: moveCommand.type
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
        moveCommand.insertAfter
      );
      if (collection.kind === "normal") {
        if (
          renameEnabled() &&
          !folderLocked() &&
          !inheritedRenameExecutionBlocked()
        ) {
          const immediatePlan = buildManualDropRenamePlan(nextItems, visualItems);
          api.rename.pendingManualPlan = immediatePlan;
          if (immediatePlan?.changes?.length) {
            beginVisibleRenameMask(immediatePlan);
          }
        }
        if (options.autoRename !== false) {
          scheduleAutoRename("manual-media-drop", AUTO_RENAME_QUIET_MS, true);
        }
      }
      // Non-grid views still use Eagle's reliable full rebind as a fallback.
      if (!locallyUpdated && options.refresh !== false) api.refresh?.();
      return true;
    }

    function submitManualDrop(dragState, helper) {
      if (
        !dragState ||
        dragState.submitted === true ||
        !helper ||
        dragState.collectionId !== currentContextId() ||
        !canHandleManualDrag()
      ) {
        return false;
      }
      dragState.submitted = true;
      const submitted = performManualDrop({
        target: helper
      }, dragState.selectedIds);
      if (!submitted) dragState.submitted = false;
      if (submitted) api.hostInputAdapter?.nativeDropCommitted();
      return submitted;
    }

    function hostInputContext(overrides = {}) {
      const collection = currentCollection();
      const availability = currentLevelAvailability();
      return {
        libraryId: currentLibraryId(),
        collectionId: currentContextId(),
        collectionKind: collection.kind,
        targetKind: availability.targetKind,
        manualAllowed: canHandleManualDrag(),
        locked: folderLocked(),
        preview: false,
        ...overrides
      };
    }

    const smartDragTargetResolver = createSmartDragTargetResolver({
      elementsFromPoint: (clientX, clientY) =>
        Array.from(document.elementsFromPoint?.(clientX, clientY) || [])
    });

    function resolveSmartDragTarget(event, selectedIds = [], options = {}) {
      return smartDragTargetResolver.resolve(event, {
        selectedIds,
        startGridIdentity: options.startGridIdentity,
        allowUnknownSurface: options.allowUnknownSurface === true
      });
    }

    function smartTargetBoxById(targetId) {
      const id = String(targetId || "");
      if (!id) return null;
      const direct = document.getElementById("box-" + id);
      if (
        direct?.classList?.contains("box") &&
        direct.getAttribute("data-box-id") === id
      ) {
        return direct;
      }
      return Array.from(
        document.querySelectorAll("#box-list .box[data-box-id]")
      ).find((box) => box.getAttribute("data-box-id") === id) || null;
    }

    function expectedSmartVisibleIds(moveCommand) {
      const visible = new Set(renderedCardIds());
      return moveCommand.nextItems
        .map((item) => String(item?.id || ""))
        .filter((id) => id && visible.has(id));
    }

    async function presentSmartManualMove(input = {}) {
      if (currentCollection().kind !== "smart") return false;
      if (!Array.isArray(input.nextItems)) return false;
      const context = input.context ||
        smartCollectionLifecycleController?.snapshot?.();
      if (!context || context.kind !== "smart") return false;
      return (await smartCollectionPresenter?.present({
        ...input,
        context
      })) === true;
    }

    function moveSmartElementsBefore(sourceIds, targetId, insertAfter) {
      const grid = typeof ig !== "undefined" ? ig : window.ig;
      if (!grid || typeof grid.moveElementsBefore !== "function") return false;
      const targetBox = smartTargetBoxById(targetId);
      const sourceElements = (Array.isArray(sourceIds) ? sourceIds : [])
        .map((id) => document.getElementById("box-" + id))
        .filter(Boolean);
      if (
        !targetBox ||
        sourceElements.length !== sourceIds.length ||
        sourceElements.includes(targetBox)
      ) {
        return false;
      }
      try {
        const moved = grid.moveElementsBefore(
          sourceElements,
          targetBox,
          insertAfter === true
        );
        return moved !== false;
      } catch {
        return false;
      }
    }

    smartCollectionPresenter = createSmartCollectionPresenter({
      currentContext: () =>
        smartCollectionLifecycleController?.snapshot?.() || null,
      readVisibleIds: renderedCardIds,
      moveBefore: (sourceId, targetId, insertAfter) =>
        moveSmartElementsBefore([sourceId], targetId, insertAfter),
      moveItemsBefore: moveSmartElementsBefore,
      notify: () => {
        bodyScope.$evalAsync();
        renderTakenMeta();
      }
    });

    const smartMoveApplicationRuntime = createManualMoveApplicationRuntime({
      reduce: (state, command, revision) =>
        manualMoveRuntime.reduce(state, command, revision),
      persist: (nextState) => {
        Object.assign(api.manual, nextState);
        return persistCurrentManualOrder();
      },
      resolvePersistedOrder: (sourceItems, relations) =>
        orderCoordinator.applyManualOverlay(sourceItems, relations),
      present: presentSmartManualMove,
      readVisibleIds: renderedCardIds,
      diagnose: recordMoveDiagnostic
    });

    smartCollectionLifecycleController =
      createSmartCollectionLifecycleController({
        present: async (request) => {
          if (api.manual.relations.length === 0) return true;
          const sourceItems = request.items.slice();
          const visibleIds = renderedCardIds();
          const visibleSet = new Set(visibleIds);
          const nextItems = orderCoordinator.applyManualOverlay(
            sourceItems,
            api.manual.relations
          );
          const expectedVisibleIds = nextItems
            .map((item) => String(item?.id || ""))
            .filter((id) => visibleSet.has(id));
          const result = await smartMoveApplicationRuntime.restore({
            collection: currentCollection(),
            state: api.manual,
            sourceItems,
            expectedVisibleIds,
            presentationContext: request.context
          });
          api.dragStats.lastRestore = {
            ok: result.ok,
            stage: result.stage,
            collectionId: request.collectionId
          };
          return result.ok;
        },
        diagnose: (event, payload) => recordMoveDiagnostic(
          "SMART_LIFECYCLE_" + String(event || "").toUpperCase(),
          payload
        )
      });

    function beginSmartCollectionLifecycle() {
      if (!smartCollectionLifecycleController) return null;
      const collection = currentCollection();
      const current = smartCollectionLifecycleController.snapshot();
      const libraryId = currentLibraryId();
      if (
        current.kind === collection.kind &&
        current.libraryId === libraryId &&
        current.collectionId === collection.id
      ) {
        return current;
      }
      api.smartEmptyObservation = { key: "", count: 0 };
      return smartCollectionLifecycleController.enter({
        kind: collection.kind,
        libraryId,
        collectionId: collection.id
      });
    }

    function smartHostBusy() {
      return [
        bodyScope.loading,
        bodyScope.isLoading,
        bodyScope.loadingItems,
        bodyScope.listLoading
      ].some((value) => value === true);
    }

    async function observeSmartCollectionHost() {
      const collection = currentCollection();
      const lifecycle = beginSmartCollectionLifecycle();
      if (!lifecycle || collection.kind !== "smart") {
        return { ok: false, reason: "not-smart" };
      }
      const sourceItems = currentItems().slice();
      const visibleIds = renderedCardIds();
      const sourceIds = new Set(sourceItems.map((item) => String(item?.id || "")));
      const visibleConsistent = visibleIds.every((id) => sourceIds.has(id));
      const queryComplete = !smartHostBusy() && (
        sourceItems.length > 0
          ? visibleIds.length > 0 && visibleConsistent
          : visibleIds.length === 0
      );
      let stable = queryComplete && sourceItems.length > 0;
      if (queryComplete && sourceItems.length === 0) {
        const key = lifecycle.token + ":empty";
        if (api.smartEmptyObservation?.key === key) {
          api.smartEmptyObservation.count += 1;
        } else {
          api.smartEmptyObservation = { key, count: 1 };
        }
        stable = api.smartEmptyObservation.count >= 2;
      } else if (sourceItems.length > 0) {
        api.smartEmptyObservation = { key: "", count: 0 };
      }
      return smartCollectionLifecycleController.observe({
        token: lifecycle.token,
        items: sourceItems,
        queryComplete,
        stable,
        overlayRevision: api.manual.revision,
        viewFingerprint:
          smartCollectionLifecycleController.itemFingerprint(visibleIds)
      });
    }

    function scheduleSmartHostObservation() {
      if (smartHostObservationQueued) return;
      smartHostObservationQueued = true;
      queueMicrotask(() => {
        smartHostObservationQueued = false;
        void observeSmartCollectionHost();
      });
    }

    function ensureSmartCollectionObserver() {
      const target = document.querySelector("#box-list");
      if (!target || target === smartCollectionObserverTarget) return;
      smartCollectionObserver?.disconnect?.();
      smartCollectionObserverTarget = target;
      smartCollectionObserver = new MutationObserver(() => {
        scheduleSmartHostObservation();
      });
      smartCollectionObserver.observe(target, {
        childList: true,
        subtree: true
      });
      scheduleSmartHostObservation();
    }

    async function restoreSmartManualView(request = {}) {
      if (
        currentCollection().kind !== "smart" ||
        (request.contextId && currentContextId() !== request.contextId) ||
        (
          request.revision !== undefined &&
          api.manual.revision !== request.revision
        )
      ) {
        return false;
      }
      const result = await observeSmartCollectionHost();
      return result.ok === true;
    }
    api.restoreSmartManualView = restoreSmartManualView;
    api.clearSmartDragFeedback = clearSmartDragFeedback;

    function submitSmartHostInputResult(result) {
      if (!result?.ok || result.command?.type !== "MoveCommand") return false;
      const collection = currentCollection();
      if (
        collection.kind !== "smart" ||
        result.command.collection?.id !== collection.id
      ) {
        return false;
      }
      syncManualContext();
      const expectedVisibleIds = expectedSmartVisibleIds(result.command);
      smartMoveApplicationRuntime.apply({
        command: result.command,
        collection,
        state: api.manual,
        expectedVisibleIds
      }).then((application) => {
        api.dragStats.lastApplication = {
          ok: application.ok,
          stage: application.stage,
          collectionId: collection.id
        };
        if (application.ok) {
          api.dragStats.drops += 1;
          api.dragStats.lastDrop = {
            count: result.command.selectedIds.length,
            targetId: result.command.targetId,
            insertAfter: result.command.insertAfter,
            collectionId: collection.id,
            commandType: result.command.type
          };
        }
        renderSettings();
      }).catch(() => {
        recordMoveDiagnostic(MOVE_APPLICATION_STAGES.VISIBLE_VERIFY_FAIL, {
          collectionId: collection.id,
          reason: "application-error"
        });
      });
      return true;
    }

    function observeSmartNativeDrag(method, event, options = {}) {
      const snapshot = api.hostInputAdapter.snapshot();
      if (
        currentCollection().kind !== "smart" ||
        !snapshot.active ||
        typeof api.hostInputAdapter[method] !== "function"
      ) {
        return { handled: false, result: null, target: null };
      }
      const selectedIds = snapshot.session?.selectedIds || [];
      const target = resolveSmartDragTarget(event, selectedIds, {
        startGridIdentity: snapshot.session?.startGridIdentity,
        allowUnknownSurface: true
      });
      const result = api.hostInputAdapter[method](hostInputContext({
        sourceId: options.sourceId,
        clientX: event.clientX,
        clientY: event.clientY,
        insideWindow: options.insideWindow,
        insideGrid: target.insideGrid,
        gridIdentity: target.gridIdentity,
        targetId: target.targetId,
        insertAfter: target.insertAfter
      }));
      if (method === "nativeDragStart" && result?.ok) {
        dragFeedbackController.start(selectedIds, { mode: "smart" });
      } else if (method === "nativeDrag" && result?.ok) {
        showSmartDragFeedback(selectedIds, target);
      } else if (method === "nativeDragEnd" || !api.hostInputAdapter.snapshot().active) {
        clearSmartDragFeedback();
      }
      return { handled: true, result, target };
    }

    function createSmartPointerMoveCommand(input = {}) {
      const collection = currentCollection();
      if (
        collection.kind !== "smart" ||
        currentContextId() !== input.collectionId ||
        currentLibraryId() !== input.libraryId
      ) {
        return { ok: false, reason: "context-changed" };
      }
      return manualMoveRuntime.createMoveCommand({
        collection,
        items: manualItemsForDrag(),
        selectedIds: input.selectedIds,
        targetId: input.targetId,
        insertAfter: input.insertAfter,
        locked: folderLocked()
      });
    }

    function createSmartHostInputAdapter() {
      return createHostInputAdapter({
        thresholdPx: 8,
        diagnosticLimit: 64,
        adapterId: sortingWindowId + ":" + Date.now(),
        createMoveCommand: createSmartPointerMoveCommand
      });
    }

    function startSortingModule() {
      if (api.sortingModuleActive) return true;
      api.sortingModuleActive = true;
      finishManualDrag(false);
      api.hostInputAdapter?.contextChanged();
      api.hostInputAdapter = createSmartHostInputAdapter();
      if (api.handlers) {
        for (const [eventName, handler] of Object.entries(api.handlers)) {
          document.removeEventListener(eventName, handler, true);
        }
      }
      api.dragStats = {
        starts: 0,
        overs: 0,
        drops: 0,
        nativeStartsPreserved: 0,
        lastDrop: null
      };
      api.dragState = null;
      api.sortingModuleResources = [];
      const register = (dispose) => {
        if (typeof dispose === "function") api.sortingModuleResources.push(dispose);
      };
      api.sortingModuleRegister = register;
      const dragStartHandler = (event) => {
      const smartCollection = currentCollection().kind === "smart";
      const smartSource = smartCollection
        ? resolveSmartDragTarget(event)
        : null;
      const sourceBox = smartSource?.targetBox ||
        event.target?.closest?.(".box");
      const sourceId = smartSource?.targetId ||
        sourceBox?.getAttribute("data-box-id");
      if (
        !canHandleManualDrag() ||
        !sourceId ||
        sourceBox.classList.contains("pinned")
      ) {
        return;
      }
      if (smartCollection) {
        const observed = observeSmartNativeDrag(
          "nativeDragStart",
          event,
          { sourceId }
        );
        if (observed.handled && observed.result?.ok) {
          api.dragStats.starts += 1;
          api.dragStats.nativeStartsPreserved += 1;
        }
        return;
      }
      finishManualDrag(false);
      api.dragState = {
        sourceId,
        selectedIds: selectedIdsForDrag(sourceId),
        nativeDrag: true,
        collectionId: currentContextId(),
        lastHelper: null,
        submitted: false
      };
      api.dragCleanupTimer = setTimeout(finishManualDrag, 30000);
      api.dragStats.starts += 1;
      api.dragStats.nativeStartsPreserved += 1;
      // Observe only. Never cancel dragstart or mutate dataTransfer: Eagle must
      // keep exporting the original files to Finder and other applications.
      };
      const dragHandler = (event) => {
      observeSmartNativeDrag("nativeDrag", event);
      };
      const dragOverHandler = (event) => {
      const smartObservation = observeSmartNativeDrag("nativeDrag", event);
      if (smartObservation.handled) return;
      if (!api.dragState) return;
      if (!canHandleManualDrag()) {
        finishManualDrag();
        return;
      }
      const helper = dropHelperAtPoint(event.clientX, event.clientY);
      sortingOwnership.setContext({
        windowId: sortingWindowId,
        hostAppId: "eagle",
        collectionId: currentContextId()
      });
      const decision = sortingOwnership.classify({
        type: "dragover",
        windowId: sortingWindowId,
        sourceAppId: "eagle",
        target: {
          kind: "grid",
          collectionId: currentContextId(),
          valid: Boolean(helper)
        }
      });
      if (decision.owner !== SORTING) return;
      if (helper) api.dragState.lastHelper = helper;
      setDropTargetsVisible(true, api.dragState.selectedIds);
      markDropHelper(helper);
      api.dragStats.overs += 1;
      // The plugin owns only a valid in-grid sort target. Everywhere else the
      // native Eagle drag continues without any event or DataTransfer changes.
      applyEventOwnership(event, decision);
      };
      const dropHandler = (event) => {
      const smartObservation = observeSmartNativeDrag(
        "nativeDragEnd",
        event,
        { insideWindow: true }
      );
      if (smartObservation.handled) {
        submitSmartHostInputResult(
          smartObservation.result,
          smartObservation.target
        );
        return;
      }
      const dragState = api.dragState;
      if (!dragState) return;
      const helper = dropHelperAtPoint(event.clientX, event.clientY);
      if (!helper) {
        finishManualDrag();
        return;
      }
      sortingOwnership.setContext({
        windowId: sortingWindowId,
        hostAppId: "eagle",
        collectionId: currentContextId()
      });
      const decision = sortingOwnership.classify({
        type: "drop",
        windowId: sortingWindowId,
        sourceAppId: "eagle",
        target: {
          kind: "grid",
          collectionId: currentContextId(),
          valid: Boolean(helper)
        }
      });
      if (decision.owner !== SORTING) {
        finishManualDrag();
        return;
      }
      applyEventOwnership(event, decision);
      try {
        submitManualDrop(dragState, helper);
      } finally {
        finishManualDrag();
      }
      };
      const dragEndHandler = (event) => {
      const smartObservation = observeSmartNativeDrag(
        "nativeDragEnd",
        event,
        { insideWindow: true }
      );
      if (smartObservation.handled) {
        submitSmartHostInputResult(
          smartObservation.result,
          smartObservation.target
        );
        return;
      }
      const dragState = api.dragState;
      if (!dragState) return;
      const helper = dropHelperAtPoint(event.clientX, event.clientY) ||
        (dragState.lastHelper?.isConnected ? dragState.lastHelper : null);
      try {
        submitManualDrop(dragState, helper);
      } finally {
        finishManualDrag();
      }
      };
      const pointerDownHandler = (event) => {
      const collection = currentCollection();
      if (collection.kind !== "smart") return;
      const source = resolveSmartDragTarget(event);
      const sourceBox = source.targetBox;
      const sourceId = source.targetId;
      if (!sourceId || sourceBox.classList.contains("pinned")) return;
      api.hostInputAdapter.pointerDown(hostInputContext({
        pointerId: event.pointerId,
        button: event.button,
        isPrimary: event.isPrimary,
        sourceId,
        selectedIds: selectedIdsForDrag(sourceId),
        clientX: event.clientX,
        clientY: event.clientY,
        startGridIdentity: source.gridIdentity
      }));
      };
      const pointerMoveHandler = (event) => {
      const snapshot = api.hostInputAdapter.snapshot();
      if (!snapshot.active) return;
      const target = resolveSmartDragTarget(
        event,
        snapshot.session?.selectedIds || [],
        { startGridIdentity: snapshot.session?.startGridIdentity }
      );
      const result = api.hostInputAdapter.pointerMove(hostInputContext({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        insideGrid: target.insideGrid,
        gridIdentity: target.gridIdentity,
        targetId: target.targetId,
        insertAfter: target.insertAfter
      }));
      if (result?.crossedThreshold) {
        showSmartDragFeedback(
          snapshot.session?.selectedIds || [],
          target
        );
      }
      };
      const pointerUpHandler = (event) => {
      const snapshot = api.hostInputAdapter.snapshot();
      if (!snapshot.active) return;
      const target = resolveSmartDragTarget(
        event,
        snapshot.session?.selectedIds || [],
        { startGridIdentity: snapshot.session?.startGridIdentity }
      );
      const result = api.hostInputAdapter.pointerUp(hostInputContext({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        insideWindow: true,
        insideGrid: target.insideGrid,
        gridIdentity: target.gridIdentity,
        targetId: target.targetId,
        insertAfter: target.insertAfter
      }));
      submitSmartHostInputResult(result, target);
      if (!api.hostInputAdapter.snapshot().active) {
        clearSmartDragFeedback();
      }
      };
      const pointerCancelHandler = (event) => {
      if (!api.hostInputAdapter.snapshot().active) return;
      api.hostInputAdapter.pointerCancelled({
        pointerId: event.pointerId
      });
      clearSmartDragFeedback();
      };
      const keyDownHandler = (event) => {
      if (event.key === "Escape") {
        if (api.dragState) finishManualDrag();
        api.hostInputAdapter.escape();
        clearSmartDragFeedback();
      } else if (event.key === " " || event.code === "Space") {
        api.hostInputAdapter.previewOpened();
        clearSmartDragFeedback();
      }
      };
      const visibilityHandler = () => {
      if (!document.hidden) return;
      if (api.dragState) finishManualDrag();
      api.hostInputAdapter.windowBlurred();
      clearSmartDragFeedback();
      };
      const lockedRenameGuard = (event) => {
      api.hostInputAdapter.previewOpened();
      clearSmartDragFeedback();
      if (!folderLocked()) return;
      if (!event.target?.closest?.(".sub-folder .name, #box-list .box .name")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      };
      api.handlers = {
      dragstart: dragStartHandler,
      drag: dragHandler,
      dragover: dragOverHandler,
      drop: dropHandler,
      dragend: dragEndHandler,
      pointerdown: pointerDownHandler,
      pointermove: pointerMoveHandler,
      pointerup: pointerUpHandler,
      pointercancel: pointerCancelHandler,
      keydown: keyDownHandler,
      visibilitychange: visibilityHandler,
      dblclick: lockedRenameGuard
      };
      for (const [eventName, handler] of Object.entries(api.handlers)) {
        document.addEventListener(eventName, handler, true);
      }
      register(() => {
        for (const [eventName, handler] of Object.entries(api.handlers || {})) {
          document.removeEventListener(eventName, handler, true);
        }
      });
      api.windowHandlers = {
      blur: () => {
        finishManualDrag();
        api.hostInputAdapter.windowBlurred();
      }
      };
      for (const [eventName, handler] of Object.entries(api.windowHandlers)) {
        window.addEventListener(eventName, handler, true);
      }
      register(() => {
        for (const [eventName, handler] of Object.entries(api.windowHandlers || {})) {
          window.removeEventListener(eventName, handler, true);
        }
      });

      api.original.onDropBoxItem =
        api.original.onDropBoxItem || window.onDropBoxItem;
      window.onDropBoxItem = api.original.onDropBoxItem;
      if (typeof bodyScope.$watch === "function") {
        const unwatchSortingHost = bodyScope.$watch(
          sortingHostProjectionSignature,
          (next, previous) => {
            if (next === previous && previous !== undefined) return;
            handleSortingHostChange();
          }
        );
        register(unwatchSortingHost);
      }
      ensureSmartCollectionObserver();
      register(() => {
        smartCollectionObserver?.disconnect?.();
        smartCollectionObserver = null;
        smartCollectionObserverTarget = null;
        smartHostObservationQueued = false;
      });
      clearInterval(api.menuTimer);
      api.menuTimer = setInterval(ensureMenu, 500);
      register(() => {
        clearInterval(api.menuTimer);
        api.menuTimer = null;
      });
      return true;
    }

    function stopSortingModule() {
      if (!api.sortingModuleActive) return false;
      api.sortingModuleActive = false;
      finishManualDrag(false);
      api.hostInputAdapter?.contextChanged();
      for (const dispose of (api.sortingModuleResources || []).slice().reverse()) {
        try {
          dispose();
        } catch {}
      }
      api.sortingModuleResources = [];
      api.sortingModuleRegister = null;
      api.handlers = {};
      api.windowHandlers = {};
      clearInterval(api.menuTimer);
      api.menuTimer = null;
      clearTimeout(api.rename.timer);
      api.rename.timer = null;
      api.rename.visibleMaskObserver?.disconnect?.();
      api.rename.visibleMaskObserver = null;
      clearTimeout(api.rename.visibleMaskTimer);
      api.rename.visibleMaskTimer = null;
      return true;
    }

    api.startSortingModule = startSortingModule;
    api.stopSortingModule = stopSortingModule;
    startSortingModule();

    ensureMenu();
    handleSortingHostChange();
    api.runLayoutIntegrationTest = () => {
      const panel = document.querySelector(".eagle-photo-taken-settings");
      if (!panel) return { ok: false, reason: "settings panel missing" };
      const collectionActions = document.querySelector(
        ".eagle-photo-collection-actions"
      );
      const orderTree = document.querySelector(
        ".eagle-photo-order-tree-settings"
      );
      const switchCount = collectionActions?.querySelectorAll(
        'input[type="checkbox"]'
      ).length || 0;
      const ruleCount = panel.querySelectorAll(
        ".eagle-photo-sort-rule"
      ).length;
      const selectedOrder = settingsOrder();
      const rulesVisible = panel.style.display !== "none";
      const sortSelect = document.querySelector(
        '#layout-panel select[ng-change*="changeOrderBy"]'
      );
      const sortPanel = sortSelect?.closest(".panel-item");
      const rulesSection = panel.querySelector(
        ".eagle-photo-sort-rules-section"
      );
      const rulesImmediatelyBelowSort =
        panel.previousElementSibling === sortPanel;
      const rulesVisibilityMatchesSelection =
        rulesVisible === (selectedOrder === SORT_KEY);
      let multiSelectionExpandsInlineRules = false;
      if (sortSelect) {
        const originalValue = sortSelect.value;
        sortSelect.value = SORT_KEY;
        renderSettings();
        multiSelectionExpandsInlineRules =
          panel.style.display !== "none" &&
          rulesSection?.style.display !== "none" &&
          panel.previousElementSibling === sortPanel;
        sortSelect.value = originalValue;
        renderSettings();
      }
      const orderTreeOutsideSwitches = !!orderTree &&
        !collectionActions?.contains(orderTree);
      const featureApplyCount = collectionActions?.querySelectorAll(
        ".eagle-photo-feature-apply"
      ).length || 0;
      const expectedSwitchCount =
        currentCollection().kind === "smart" ? 2 : 3;
      const expectedFeatureApplyCount =
        currentCollection().kind === "smart" ? 1 : 2;
      return {
        ok:
          switchCount === expectedSwitchCount &&
          featureApplyCount === expectedFeatureApplyCount &&
          ruleCount === api.rules.length &&
          rulesImmediatelyBelowSort &&
          rulesVisibilityMatchesSelection &&
          multiSelectionExpandsInlineRules &&
          orderTreeOutsideSwitches,
        switchCount,
        expectedSwitchCount,
        featureApplyCount,
        expectedFeatureApplyCount,
        ruleCount,
        expectedRuleCount: api.rules.length,
        selectedOrder,
        rulesVisible,
        rulesImmediatelyBelowSort,
        rulesVisibilityMatchesSelection,
        multiSelectionExpandsInlineRules,
        orderTreeOutsideSwitches
      };
    };
    api.runFolderLevelIntegrationTest = () => {
      const availability = currentLevelAvailability();
      const directFolders = folderLevelRuntime.directChildren(
        bodyScope.currentFolder
      );
      const visibleCards = document.querySelectorAll(
        "#sub-folder-container .sub-folder-list .sub-folder"
      ).length;
      const manualControl = document.querySelector(
        ".eagle-photo-sort-manual input"
      );
      const numberControl = document.querySelector(
        ".eagle-photo-sort-rename input"
      );
      const sortable = bodyScope.subFolderSortableOptions;
      const isDirectFolderView =
        currentCollection().kind === "normal" &&
        directFolders.length > 0 &&
        bodyScope.showSubfolderContent !== true;
      const preview = isDirectFolderView
        ? folderLevelRuntime.buildFolderRenamePlan(directFolders, {
          token: "integration"
        })
        : null;
      return {
        ok:
          !!manualControl &&
          !!numberControl &&
          (!isDirectFolderView || (
            availability.targetKind === "direct-folders" &&
            manualControl.disabled === !availability.canManualDrag &&
            !!sortable &&
            typeof sortable.update === "function" &&
            preview?.entries.length === directFolders.length
          )),
        currentFolderId: bodyScope.currentFolder?.id || "",
        currentFolderName: bodyScope.currentFolder?.name || "",
        showSubfolderContent: bodyScope.showSubfolderContent === true,
        targetKind: availability.targetKind,
        directFolderCount: directFolders.length,
        visibleFolderCardCount: visibleCards,
        manualControlDisabled: manualControl?.disabled ?? null,
        autoNumberControlDisabled: numberControl?.disabled ?? null,
        manualModeEnabled: manualEnabled(),
        sortingLocked: folderLocked(),
        nativeSortableDisabled: sortable?.disabled ?? null,
        previewChanges: preview?.changes.length || 0,
        previewFirst: preview?.entries.slice(0, 3).map((entry) => ({
          oldName: entry.oldName,
          newName: entry.newName
        })) || []
      };
    };
    api.runDragIntegrationTest = () => {
      if (!canHandleManualDrag()) {
        return { ok: false, reason: "temporary drag inactive" };
      }
      const visualItems = manualItemsForDrag();
      const candidates = visualItems.filter((item) => {
        const box = document.getElementById("box-" + item.id);
        return box && !box.classList.contains("pinned");
      });
      if (candidates.length < 2) {
        return { ok: false, reason: "not enough rendered targets" };
      }
      const source = candidates.find(
        (item) => !Number.isFinite(api.timestamps[String(item.id)])
      ) || candidates[1];
      const target = candidates.find((item) => item.id !== source.id);
      const targetHelper = document.querySelector(
        '#box-' + target.id + ' .box-sortable-helper.left'
      );
      if (!targetHelper) {
        return { ok: false, reason: "drop target missing" };
      }
      const sourceBox = document.getElementById("box-" + source.id);
      const draggableSource = sourceBox?.querySelector(
        '[draggable="true"]'
      );
      const movedItems = sortRuntime.moveItems(
        visualItems,
        [source.id],
        target.id,
        false
      );
      const grid = typeof ig !== "undefined" ? ig : window.ig;
      const gridAvailable =
        !!grid && typeof grid.moveElementsBefore === "function";
      const handlerNames = Object.keys(api.handlers || {}).sort();
      const nativeBoundaryHandlers = [
      "dblclick",
      "drag",
      "dragend",
        "dragover",
        "dragstart",
        "drop",
        "keydown",
        "pointercancel",
        "pointerdown",
        "pointermove",
        "pointerup",
        "visibilitychange"
      ];
      return {
        ok:
          movedItems[0]?.id === source.id &&
          !!draggableSource &&
          gridAvailable &&
          handlerNames.join(",") === nativeBoundaryHandlers.join(","),
        targetId: target.id,
        sourceId: source.id,
        sourceHasTakenAt: Number.isFinite(
          api.timestamps[String(source.id)]
        ),
        firstId: movedItems[0]?.id || "",
        draggableSource: !!draggableSource,
        gridAvailable,
        handlerNames,
        nativeDragPreserved: true,
        readOnly: true
      };
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
      const pureResult = sortRuntime.buildSortResult(items, {
        ...sortConfig(),
        manualOrder: []
      });
      const pureRank = new Map(
        pureResult.baseItems.map((item, index) => [String(item?.id || ""), index])
      );
      let visibleComparatorViolations = 0;
      let previousRank = null;
      for (const entry of visible) {
        const rank = pureRank.get(entry.id);
        if (!Number.isFinite(rank)) continue;
        if (Number.isFinite(previousRank) && previousRank > rank) {
          visibleComparatorViolations += 1;
        }
        previousRank = rank;
      }
      const manualOverlayActive = activeManualOverlay().length > 0;
      const sortMode = currentSortMode();
      const authority = manualOverlayActive
        ? "automatic-rule+manual-overlay"
        : isPluginSort() ? "automatic-rule" : "native";
      return {
        ok:
          sortMode === "automatic" &&
          (
            (visible.length < 2 && timestampCount < 2) ||
            (visibleComparatorViolations === 0 &&
              visibleViolations === 0)
          ),
        direction: takenRule?.direction || "",
        takenRuleIndex,
        increase: currentIncrease(),
        rawCount: items.length,
        timestampCount,
        violations,
        visibleCount: visible.length,
        visibleWithTimestamp,
        visibleViolations,
        visibleComparatorViolations,
        manualOverlayActive,
        sortMode,
        authority,
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
      ) && typeof openRenamePreview === "function" &&
        typeof applyRenameToCurrentTree === "function";
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
      const testId = "__eagle_photo_sort_lock_test__";
      const testLibrary = lockLibrary(true);
      const previousTestProfile = testLibrary.folders[testId];
      testLibrary.folders[testId] = {
        locked: true,
        config: {
          orderBy: SORT_KEY,
          sortIncrease: true,
          rules: sortRuntime.defaultRules
        },
        legacyOrderDiagnostic: { ignored: true, itemCount: 3 }
      };
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
        manualEnabled() &&
        !folderLocked() &&
        currentLevelAvailability().targetKind === "direct-media" &&
        currentCollection().kind !== "global";
      const localDragPermissionOk =
        canHandleManualDrag() === localDragExpected;
      return {
        ok:
          !!lockControl &&
          filteredFolders.join(",") ===
            "__eagle_photo_sort_unlocked_test__" &&
          folderIdFromSidebarItem({ id: "folder-test-id" }) === "test-id" &&
          markerStateOk &&
          localDragPermissionOk &&
          unlockedCount + lockedCount === tree.length,
        controlPresent: !!lockControl,
        filteredFolders,
        currentFolderLocked: folderLocked(currentFolder),
        treeFolderCount: tree.length,
        markerStats,
        markerStateOk,
        localDragExpected,
        localDragPermissionOk,
        unlockedCount,
        lockedCount
      };
    };
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

    const integrationResult = {
      ok: true,
      libraryId: currentLibraryId(),
      collectionId: String(currentCollection().id || ""),
      contextId: currentContextId(),
      itemCount: currentCollection().kind === "global" ? 0 : currentItems().length,
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
      manualHooked: window.onDropBoxItem === api.original.onDropBoxItem,
      dragCaptureHooked: Object.keys(api.handlers || {}).length === 11,
      layoutSelfTest: api.runLayoutIntegrationTest(),
      folderLevelSelfTest: api.runFolderLevelIntegrationTest(),
      takenMetaSelfTest: api.runTakenMetaIntegrationTest(),
      renameSelfTest: api.runRenameIntegrationTest(),
      lockSelfTest: api.runLockIntegrationTest(),
      renameCancelResult: api.renameCancelResult,
      teamImportResult: api.teamImportResult,
      folderTreeSelfTest,
      manualSelfTest,
      selfTest
    };
    api.integrationResult = integrationResult;
    api.initializedAt = Date.now();
    return integrationResult;
  })()`;
}

async function inject() {
  try {
    return await injectIntoMain();
  } catch (error) {
    await persistDiagnosticFailure("INJECTION_FAILURE", error);
    throw error;
  }
}

async function injectIntoMain() {
  const selection = await selectTeamStateForCurrentLibrary();
  teamStateStatus = {
    source: selection.source,
    path: selection.path || "",
    message: selection.state
      ? selection.source === "library-sidecar"
        ? "已读取当前 Library 的团队母版"
        : selection.source === "manual-import"
          ? "已读取手动选择的团队状态"
          : "已读取插件内置交接状态"
      : selection.verification?.reason || "没有可用的团队状态",
    verification: selection.verification || null,
    state: selection.state
      ? {
        createdAt: selection.state.createdAt || "",
        payloadSha256: selection.state.integrity?.payloadSha256 || "",
        folderCount: selection.state.identity?.folderCount || 0,
        pluginVersion: selection.state.plugin?.version || ""
      }
      : null
  };
  const result = await executeInMain(injectionSource(selection));
  teamStateStatus.importResult = result?.teamImportResult || null;
  if (!result || !result.ok) {
    throw new Error(result ? result.reason : "Injection returned no result");
  }
  const sortingFacade = ensureSortingModuleFacade();
  await sortingFacade.enable({
    windowId: "eagle-main",
    hostAppId: "eagle",
    libraryId: result.libraryId || "",
    collectionId: result.collectionId || ""
  });
  if (result.renameCancelResult?.applied) {
    await fs.promises.unlink(renameCancelPath).catch(() => {});
    setStatus(
      `已暂停并撤销自动编号开关：清除 ${result.renameCancelResult.cleared} 个文件夹`
    );
  }
  if (result.teamImportResult?.imported) {
    setStatus(
      `已导入团队排序状态：规则 ${result.teamImportResult.ruleFolderCount} 个文件夹，` +
        `旧配置保护 ${result.teamImportResult.legacyConfigProtectedFolderCount || 0} 个文件夹（未升级为排序锁），` +
        `简介 ${result.teamImportResult.metaFolderCount} 个文件夹；` +
        `跳过 ${result.teamImportResult.skippedKeys?.length || 0} 个风险键` +
        (result.teamImportResult.missingFolderCount
          ? `；缺失 ${result.teamImportResult.missingFolderCount} 个旧文件夹`
          : "")
    );
  } else if (
    result.teamImportResult?.reason &&
    result.teamImportResult.reason !== "already-imported" &&
    result.teamImportResult.reason !== "no-state-file" &&
    result.teamImportResult.reason !== "library-not-ready"
  ) {
    setStatus(`团队排序状态未导入：${result.teamImportResult.reason}`);
  }
  injectionReady = true;
  await pushCachedTimestamps();
  await initializeTeamStateSync(selection);
  renderTeamStateStatus();
  const testPassed =
    Array.isArray(result.selfTest) &&
    result.selfTest.join(",") ===
      "__photo_sort_test_old,__photo_sort_test_new," +
        "__photo_sort_test_missing,__photo_sort_test_document";
  const manualTestPassed =
    Array.isArray(result.manualSelfTest) &&
    result.manualSelfTest.join(",") === "49,51,50,52";
  const layoutTestPassed = result.layoutSelfTest?.ok === true;
  const folderLevelTestPassed = result.folderLevelSelfTest?.ok === true;
  const takenMetaTestPassed = result.takenMetaSelfTest?.ok === true;
  const renameTestPassed = result.renameSelfTest?.ok === true;
  const lockTestPassed = result.lockSelfTest?.ok === true;
  const folderTreeTestPassed =
    Array.isArray(result.folderTreeSelfTest) &&
    result.folderTreeSelfTest.join(",") === "root,a,a-1,b";
  if (!layoutTestPassed) {
    setStatus(`界面布局诊断：${JSON.stringify(result.layoutSelfTest)}`);
  }
  setStatus(`界面布局证据：${JSON.stringify(result.layoutSelfTest)}`);
  setStatus(
    `菜单注入成功：${result.optionCount} 个入口，排序自检${
      testPassed ? "通过" : "失败"
    }，界面布局${layoutTestPassed ? "通过" : "失败"}，拍摄时间简介${
      takenMetaTestPassed ? "自检通过" : "自检失败"
    }，连续重命名${renameTestPassed ? "自检通过" : "自检失败"}，全局保护${
      lockTestPassed ? "自检通过" : "自检失败"
    }，层级文件夹${folderLevelTestPassed ? "自检通过" : "自检失败"}，手动拖动${
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

async function pushCachedTimestamps() {
  const context = await getCurrentContext();
  latestContextId = String(context?.contextId || "");
  const values = {};
  for (const item of Array.isArray(context?.items) ? context.items : []) {
    const cached = cachedTakenAt(item);
    if (cached.hit) values[String(item.id)] = cached.value;
  }
  return Object.keys(values).length ? pushTimestamps(values) : 0;
}

async function waitForNativePreview(contextId) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const state = await executeInMain(`(() => {
      const api = window.__eaglePhotoTakenSort;
      const latestContextId = String(api?.current?.().contextId || "");
      const cards = Array.from(document.querySelectorAll("#box-list .box"));
      const sample = cards.slice(0, 12)
        .map((card) => card.querySelector("img"))
        .filter(Boolean);
      const loaded = sample.filter(
        (image) => image.complete && Number(image.naturalWidth || 0) > 0
      ).length;
      return {
        latestContextId,
        nativePreviewReady:
          cards.length > 0 && (sample.length === 0 || loaded === sample.length)
      };
    })()`);
    const latestContextId = String(state?.latestContextId || "");
    if (latestContextId !== contextId) return false;
    if (state?.nativePreviewReady) return true;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return latestContextId === contextId;
}

async function refreshMainList() {
  return executeInMain(`window.__eaglePhotoTakenSort?.refresh?.() || false`);
}

async function refreshMainListForFolder(folderId) {
  return executeInMain(`(() => {
    const api = window.__eaglePhotoTakenSort;
    if (!api || api.current?.().currentFolderId !== ${JSON.stringify(folderId)}) {
      return false;
    }
    return api.refresh?.() || false;
  })()`);
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

async function acknowledgeMainRenameEnqueue(id, signature) {
  return executeInMain(
    `window.__eaglePhotoTakenSort?.acknowledgeRenameEnqueue?.(` +
      `${JSON.stringify(id)},${JSON.stringify(signature || "")}) || false`
  );
}

async function rejectMainRenameEnqueue(id, result) {
  const serialized = JSON.stringify(result || {}).replace(/</g, "\\u003c");
  return executeInMain(
    `window.__eaglePhotoTakenSort?.rejectRenameEnqueue?.(` +
      `${JSON.stringify(id)},${serialized}) || false`
  );
}

async function restoreMainRenameBatch(request, reason) {
  const serialized = JSON.stringify(request).replace(/</g, "\\u003c");
  return executeInMain(
    `window.__eaglePhotoTakenSort?.restoreRenameBatch?.(` +
      `${serialized},${JSON.stringify(reason || "")}) || false`
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

function renameItemPaths(item, name) {
  const libraryPath = eagle.library?.path || cache.libraryPath;
  if (!libraryPath) throw new Error("Eagle library path is unavailable");
  const extension = String(item?.ext || "").replace(/^\./, "");
  if (!item?.id || !extension) {
    throw new Error(`Item ${item?.id || "unknown"} has no file identity`);
  }
  const infoPath = path.join(
    path.normalize(libraryPath),
    "images",
    `${item.id}.info`
  );
  return {
    infoPath,
    metadataPath: path.join(infoPath, "metadata.json"),
    rawPath: path.join(infoPath, `${name}.${extension}`)
  };
}

async function pathExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readRenameDiskState(item) {
  const paths = renameItemPaths(item, "");
  const extension = "." + String(item.ext || "").replace(/^\./, "").toLowerCase();
  const files = await fs.promises.readdir(paths.infoPath);
  const rawNames = files
    .filter((fileName) => {
      const lower = fileName.toLowerCase();
      return lower.endsWith(extension) &&
        !lower.endsWith("_thumbnail" + extension);
    })
    .map((fileName) => fileName.slice(0, -extension.length));
  const metadata = JSON.parse(
    await fs.promises.readFile(paths.metadataPath, "utf8")
  );
  return {
    rawNames,
    metadataName: String(metadata?.name || "")
  };
}

async function dispatchNativeRename(item, oldName, newName, label) {
  const oldPaths = renameItemPaths(item, oldName);
  const newPaths = renameItemPaths(item, newName);
  if (!(await pathExists(oldPaths.rawPath))) {
    throw new Error(`${label}: source file is missing: ${oldPaths.rawPath}`);
  }
  if (oldName !== newName && await pathExists(newPaths.rawPath)) {
    throw new Error(`${label}: destination already exists: ${newPaths.rawPath}`);
  }

  const payload = JSON.parse(
    await fs.promises.readFile(oldPaths.metadataPath, "utf8")
  );
  if (
    String(payload?.id || "") !== String(item.id) ||
    String(payload?.ext || "").toLowerCase() !==
      String(item.ext || "").toLowerCase()
  ) {
    throw new Error(`${label}: metadata identity is invalid for ${item.id}`);
  }
  payload.oldName = oldName;
  payload.name = newName;
  payload.newName = newName;
  const serialized = JSON.stringify(payload).replace(/</g, "\\u003c");
  const queued = await executeInMain(`(() => {
    if (typeof ayncsImagesChange !== "function") {
      return { __error: "Eagle native rename pipeline is unavailable" };
    }
    const item = ${serialized};
    ayncsImagesChange([item]);
    return { queued: true, id: item.id };
  })()`);
  if (!queued?.queued) throw new Error(`${label}: native rename was not queued`);

  const deadline = Date.now() + 30000;
  let lastState = null;
  while (Date.now() < deadline) {
    try {
      lastState = await readRenameDiskState(item);
      if (
        lastState.rawNames.length === 1 &&
        lastState.rawNames[0] === newName &&
        lastState.metadataName === newName &&
        !(await pathExists(oldPaths.rawPath))
      ) {
        item.name = newName;
        return true;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(
    `${label}: native rename verification failed for ${item.id}; ` +
    `raw=${lastState?.rawNames?.join(",") || "unavailable"}, ` +
    `metadata=${lastState?.metadataName || "unavailable"}`
  );
}

async function dispatchNativeRenameBatch(entries, itemsById, label) {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  const pending = await Promise.all(entries.map(async (entry) => {
    const item = itemsById.get(String(entry.id));
    if (!item) throw new Error(`${label}: item ${entry.id} is unavailable`);
    const expectedMetadataName =
      entry.expectedMetadataName ?? entry.oldName;
    const oldPaths = renameItemPaths(item, entry.oldName);
    const newPaths = renameItemPaths(item, entry.newName);
    const [sourceExists, destinationExists, metadataText] = await Promise.all([
      pathExists(oldPaths.rawPath),
      entry.oldName !== entry.newName
        ? pathExists(newPaths.rawPath)
        : Promise.resolve(false),
      fs.promises.readFile(oldPaths.metadataPath, "utf8")
    ]);
    if (!sourceExists) {
      throw new Error(`${label}: source file is missing: ${oldPaths.rawPath}`);
    }
    if (destinationExists) {
      throw new Error(`${label}: destination already exists: ${newPaths.rawPath}`);
    }
    const payload = JSON.parse(metadataText);
    if (
      String(payload?.id || "") !== String(item.id) ||
      String(payload?.ext || "").toLowerCase() !==
        String(item.ext || "").toLowerCase()
    ) {
      throw new Error(`${label}: metadata identity is invalid for ${item.id}`);
    }
    if (
      String(item.name || "") !== String(expectedMetadataName || "") ||
      String(payload?.name || "") !== String(expectedMetadataName || "")
    ) {
      throw new Error(
        `${label}: item ${item.id} changed before rename: ` +
        `item=${item.name}, metadata=${payload?.name}, ` +
        `expected=${expectedMetadataName}`
      );
    }
    payload.oldName = String(entry.oldName || "");
    payload.name = String(entry.newName || "");
    payload.newName = String(entry.newName || "");
    return { entry, item, oldPaths, payload, lastState: null };
  }));

  const serialized = JSON.stringify(
    pending.map((record) => record.payload)
  ).replace(/</g, "\\u003c");
  const queued = await executeInMain(`(() => {
    if (typeof ayncsImagesChange !== "function") {
      return { __error: "Eagle native rename pipeline is unavailable" };
    }
    const items = ${serialized};
    ayncsImagesChange(items);
    return { queued: true, count: items.length };
  })()`);
  if (!queued?.queued || queued.count !== pending.length) {
    throw new Error(`${label}: native rename batch was not queued`);
  }

  const deadline = Date.now() + 30000;
  let unresolved = pending;
  while (Date.now() < deadline) {
    const checks = await Promise.all(unresolved.map(async (record) => {
      try {
        record.lastState = await readRenameDiskState(record.item);
        const complete =
          record.lastState.rawNames.length === 1 &&
          record.lastState.rawNames[0] === record.entry.newName &&
          record.lastState.metadataName === record.entry.newName &&
          !(await pathExists(record.oldPaths.rawPath));
        if (complete) record.item.name = record.entry.newName;
        return complete;
      } catch {
        return false;
      }
    }));
    unresolved = unresolved.filter((record, index) => !checks[index]);
    if (unresolved.length === 0) return pending.length;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(
    `${label}: native rename batch verification failed for ` +
      unresolved.map((record) => {
        const state = record.lastState;
        return `${record.entry.id}[raw=${state?.rawNames?.join(",") ||
          "unavailable"},metadata=${state?.metadataName || "unavailable"}]`;
      }).join(";")
  );
}

async function dispatchNativeRenamePhase(entries, itemsById, label) {
  const batchSize = 3;
  let processed = 0;
  for (let index = 0; index < entries.length; index += batchSize) {
    processed += await dispatchNativeRenameBatch(
      entries.slice(index, index + batchSize),
      itemsById,
      `${label} ${Math.floor(index / batchSize) + 1}`
    );
  }
  return processed;
}

async function rollbackRenameItems(changes, itemsById, token) {
  const rollbackEntries = [];
  for (const [index, entry] of changes.entries()) {
    const item = itemsById.get(String(entry.id));
    if (!item) continue;
    try {
      const state = await readRenameDiskState(item);
      if (
        state.rawNames.length === 1 &&
        state.rawNames[0] === entry.oldName &&
        state.metadataName === entry.oldName
      ) {
        continue;
      }
      if (state.rawNames.length !== 1) throw new Error("raw file is ambiguous");
      rollbackEntries.push({
        entry,
        item,
        currentName: state.rawNames[0],
        temporaryName:
          "__eagle_rollback_" + token + "_" + String(index + 1)
      });
    } catch {
      rollbackEntries.push({ entry, item, currentName: "", temporaryName: "" });
    }
  }
  let failures = 0;
  for (const rollback of rollbackEntries) {
    if (!rollback.currentName || !rollback.temporaryName) {
      failures += 1;
      continue;
    }
    try {
      await dispatchNativeRename(
        rollback.item,
        rollback.currentName,
        rollback.temporaryName,
        "Stage rollback " + rollback.entry.id
      );
    } catch {
      failures += 1;
    }
  }
  for (const rollback of rollbackEntries) {
    if (!rollback.temporaryName) continue;
    try {
      await dispatchNativeRename(
        rollback.item,
        rollback.temporaryName,
        rollback.entry.oldName,
        "Restore original name " + rollback.entry.id
      );
    } catch {
      failures += 1;
    }
  }
  return failures;
}

async function executeSafeRenameChanges(request, plan, itemsById) {
  const token = String(request.id || Date.now().toString(36)).replace(
    /[^a-zA-Z0-9_-]/g,
    ""
  );
  const phases = backgroundRenameRuntime.buildExecutionPhases(
    plan.changes,
    token
  );
  let processed = 0;
  const total = phases.temporary.length + phases.final.length;
  try {
    processed += await dispatchNativeRenamePhase(
      phases.temporary,
      itemsById,
      "Stage numbering"
    );
    await updateMainRenameBatchProgress(request.id, {
      stage: "saving",
      phase: "temporary",
      current: processed,
      total
    });
    processed += await dispatchNativeRenamePhase(
      phases.final,
      itemsById,
      "Finalize numbering"
    );
    await updateMainRenameBatchProgress(request.id, {
      stage: "saving",
      phase: "final",
      current: processed,
      total
    });
  } catch (error) {
    const rollbackFailures = await rollbackRenameItems(
      plan.changes,
      itemsById,
      token
    );
    throw new Error(
      `${error.message}; rollback failures: ${rollbackFailures}`
    );
  }
  return plan.changes.length;
}

async function writeRenameRecoveryRequest(request) {
  const temporaryPath = `${renameRecoveryPath}.tmp`;
  await fs.promises.writeFile(
    temporaryPath,
    JSON.stringify(request, null, 2),
    "utf8"
  );
  await fs.promises.rename(temporaryPath, renameRecoveryPath);
}

async function prepareRenameRecoveryWork(request, itemsById) {
  const mode = String(request.mode || "restore-file-from-metadata");
  const workEntries = [];
  for (const entry of request.entries) {
    const item = itemsById.get(String(entry.id));
    if (!item) throw new Error(`Recovery item ${entry.id} is unavailable`);

    if (mode === "restore-interrupted-batch") {
      const currentName = String(entry.currentName || "");
      const targetName = String(entry.targetName || "");
      if (!currentName || !targetName || currentName === targetName) {
        throw new Error(`Recovery entry ${entry.id} has invalid names`);
      }
      if (!currentName.startsWith("__eagle_number_")) {
        throw new Error(`Recovery entry ${entry.id} is not an Eagle temp name`);
      }
      if (String(item.name || "") !== currentName) {
        throw new Error(
          `Recovery metadata changed for ${entry.id}: ` +
          `${item.name} != ${currentName}`
        );
      }
      const state = await readRenameDiskState(item);
      if (
        state.rawNames.length !== 1 ||
        state.rawNames[0] !== currentName ||
        state.metadataName !== currentName
      ) {
        throw new Error(
          `Recovery preflight failed for ${entry.id}: ` +
          `raw=${state.rawNames.join(",") || "missing"}, ` +
          `metadata=${state.metadataName || "missing"}`
        );
      }
      workEntries.push({
        id: String(entry.id),
        oldName: currentName,
        newName: targetName
      });
      continue;
    }

    if (String(item.name || "") !== String(entry.newName || "")) {
      throw new Error(
        `Recovery metadata changed for ${entry.id}: ` +
        `${item.name} != ${entry.newName}`
      );
    }
    const state = await readRenameDiskState(item);
    if (
      state.rawNames.length !== 1 ||
      state.rawNames[0] !== entry.oldName ||
      state.metadataName !== entry.newName
    ) {
      throw new Error(
        `Recovery preflight failed for ${entry.id}: ` +
        `raw=${state.rawNames.join(",") || "missing"}, ` +
        `metadata=${state.metadataName || "missing"}`
      );
    }
    workEntries.push({
      id: String(entry.id),
      oldName: String(entry.oldName || ""),
      newName: String(entry.newName || ""),
      expectedMetadataName: String(entry.newName || "")
    });
  }
  return { mode, entries: workEntries };
}

async function processApprovedRenameRecovery() {
  if (renameRecoveryInProgress) return renameRecoveryInProgress;
  let request;
  try {
    request = JSON.parse(await fs.promises.readFile(renameRecoveryPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("[photo-taken-sort] Unable to read rename recovery", error);
    }
    return null;
  }
  if (
    request?.version !== 1 ||
    request?.approved !== true ||
    request?.status !== "pending" ||
    !request?.requestId ||
    request.requestId === lastRenameRecoveryRequestId ||
    !request?.folderId ||
    !Array.isArray(request.entries) ||
    request.entries.length === 0
  ) {
    return null;
  }
  const currentLibraryPath = path.normalize(
    eagle.library?.path || cache.libraryPath || ""
  );
  if (
    !currentLibraryPath ||
    path.normalize(request.libraryPath || "") !== currentLibraryPath
  ) {
    return null;
  }

  lastRenameRecoveryRequestId = request.requestId;
  renameRecoveryInProgress = (async () => {
    const completed = [];
    try {
      const items = await withTimeout(
        eagle.item.get({ folders: [request.folderId] }),
        30000,
        `Read recovery folder ${request.folderId}`
      );
      const itemsById = new Map(
        items.map((item) => [String(item.id || ""), item])
      );
      const work = await prepareRenameRecoveryWork(request, itemsById);

      setStatus(`正在恢复 ${work.entries.length} 个 Eagle 文件引用`);
      for (let index = 0; index < work.entries.length; index += 3) {
        const batch = work.entries.slice(index, index + 3);
        await dispatchNativeRenameBatch(
          batch,
          itemsById,
          `Recover interrupted names ${Math.floor(index / 3) + 1}`
        );
        completed.push(...batch);
        setStatus(
          `正在恢复 Eagle 文件引用 ${completed.length}/${work.entries.length}`
        );
      }
      request.approved = false;
      request.status = "completed";
      request.completedAt = new Date().toISOString();
      request.completedCount = completed.length;
      await writeRenameRecoveryRequest(request);
      await refreshMainListForFolder(request.folderId);
      setStatus(`已恢复 ${completed.length} 个 Eagle 文件引用`);
      return { status: "completed", count: completed.length };
    } catch (error) {
      let rollbackFailures = 0;
      for (const entry of completed.reverse()) {
        try {
          const items = await eagle.item.getByIds([entry.id]);
          const item = Array.isArray(items) ? items[0] : items;
          if (!item) throw new Error("rollback item unavailable");
          await dispatchNativeRename(
            item,
            entry.newName,
            entry.oldName,
            `Rollback recovery ${entry.id}`
          );
        } catch {
          rollbackFailures += 1;
        }
      }
      request.approved = false;
      request.status = rollbackFailures ? "rollback-failed" : "rolled-back";
      request.failedAt = new Date().toISOString();
      request.error = error?.message || String(error);
      request.rollbackFailures = rollbackFailures;
      await writeRenameRecoveryRequest(request);
      setStatus(
        `Eagle 文件引用恢复失败：${request.error}；` +
        `回滚失败 ${rollbackFailures} 项`
      );
      return { status: request.status, error: request.error, rollbackFailures };
    }
  })().finally(() => {
    renameRecoveryInProgress = null;
  });
  return renameRecoveryInProgress;
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
      const directItems = backgroundCollectionRuntime.directFolderItems(
        items,
        folder.id
      );
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
  const authoritativeIds = new Set(
    folders.flatMap((folder) =>
      [
        ...(Array.isArray(folder.finalOrder) ? folder.finalOrder : []),
        ...(Array.isArray(folder.manualOrder) ? folder.manualOrder : [])
      ].map(String)
    )
  );
  const metadataItems = mediaItems.filter(
    (item) => !authoritativeIds.has(String(item.id))
  );
  let metadataProcessed = 0;
  await updateMainRenameBatchProgress(request.id, {
    stage: "metadata",
    current: 0,
    total: metadataItems.length
  });
  await mapWithConcurrency(metadataItems, 6, async (item) => {
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
    if (metadataProcessed % 50 === 0 || metadataProcessed === metadataItems.length) {
      setStatus(
        `正在读取全局重命名拍摄时间 ${metadataProcessed}/${metadataItems.length}`
      );
    }
    if (
      metadataProcessed % 100 === 0 ||
      metadataProcessed === metadataItems.length
    ) {
      await updateMainRenameBatchProgress(request.id, {
        stage: "metadata",
        current: metadataProcessed,
        total: metadataItems.length
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
  let saveError = "";
  await updateMainRenameBatchProgress(request.id, {
    stage: "saving",
    current: 0,
    total: plan.changes.length * 2
  });
  try {
    renamed = await executeSafeRenameChanges(request, plan, itemsById);
  } catch (error) {
    saveFailures = plan.changes.length || 1;
    saveError = error?.message || String(error);
    console.warn("[photo-taken-sort] Safe rename failed", error);
  }

  const result = {
    mode: request?.mode === "current-folder" ? "current-folder" : "tree",
    folders: plan.folderCount,
    renamed,
    failed: saveFailures + folderFailures + plan.errorCount,
    skippedConflicts: plan.conflictIds.length,
    unchanged: Math.max(0, mediaItems.length - plan.changes.length),
    error: saveError || plan.errors?.[0]?.reason ||
      (folderFailures ? "部分文件夹读取失败" : "")
  };
  setStatus(
    `全局连续重命名完成：${result.folders} 个文件夹，` +
      `${result.renamed} 个文件，${result.failed} 个失败，` +
      `${result.skippedConflicts} 个共享冲突已跳过`
  );
  return result;
}

async function executeRenameCommand(command) {
  let claimed = null;
  let completionSent = false;
  try {
    claimed = await claimMainRenameBatch(command.commandId);
    if (!claimed) {
      await rejectMainRenameEnqueue(command.commandId, {
        accepted: false,
        retryable: true,
        reason: "claim-failed"
      }).catch(() => {});
      throw new Error("编号上下文已变化，任务可重试");
    }
    const result = await processRenameBatch(claimed);
    await completeMainRenameBatch(claimed.id, result);
    completionSent = true;
    if (Number(result?.failed || 0) > 0) {
      throw new Error(result.error || "部分文件失败");
    }
    return result;
  } catch (error) {
    const message = error?.message || String(error);
    console.error("[photo-taken-sort] Rename command failed", error);
    setStatus(`连续重命名失败：${message}`);
    if (claimed && !completionSent) {
      await completeMainRenameBatch(claimed.id, {
        mode: claimed.mode === "current-folder" ? "current-folder" : "tree",
        folders: claimed.folders?.length || 0,
        renamed: 0,
        failed: 1,
        skippedConflicts: 0,
        error: message
      }).catch(() => {});
    }
    throw error;
  }
}

async function handleRenameBatchRequest(request) {
  if (!request?.id) return false;
  const command = {
    ...request,
    collectionId: request.collectionId ||
      request.folders?.[0]?.id ||
      request.sourceContextId,
    commandId: request.commandId || request.id,
    snapshotVersion: request.snapshotVersion || request.orderRevision || "0",
    snapshotIdentity: request.snapshotIdentity ||
      request.folders?.[0]?.membershipFingerprint ||
      request.sourceContextId,
    signature: request.signature ||
      JSON.stringify({
        id: request.id,
        folders: request.folders || []
      }),
    request
  };
  let accepted;
  try {
    accepted = renameCommandQueue.enqueue(command, { defer: true });
  } catch (error) {
    await rejectMainRenameEnqueue(command.commandId, {
      accepted: false,
      retryable: true,
      reason: error.message
    }).catch(() => {});
    setStatus(`编号未进入队列：${error.message}`);
    return false;
  }
  if (!accepted.accepted) {
    await rejectMainRenameEnqueue(command.commandId, accepted).catch(() => {});
    return false;
  }
  const acknowledged = await acknowledgeMainRenameEnqueue(
    accepted.commandId,
    command.signature
  );
  if (!acknowledged) {
    renameCommandQueue.cancel(accepted.commandId, "编号上下文已变化");
    await rejectMainRenameEnqueue(accepted.commandId, {
      accepted: false,
      retryable: true,
      reason: "context-changed"
    }).catch(() => {});
    return false;
  }
  if (!renameCommandQueue.start(accepted.commandId)) {
    renameCommandQueue.cancel(accepted.commandId, "编号队列启动失败");
    await rejectMainRenameEnqueue(accepted.commandId, {
      accepted: false,
      retryable: true,
      reason: "start-failed"
    }).catch(() => {});
    return false;
  }
  return true;
}

async function runMainIntegrationChecks() {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return executeInMain(`({
    layout: window.__eaglePhotoTakenSort?.runLayoutIntegrationTest?.() || null,
    folderLevel: window.__eaglePhotoTakenSort?.runFolderLevelIntegrationTest?.() || null,
    drag: window.__eaglePhotoTakenSort?.runDragIntegrationTest?.() || null,
    takenMeta: window.__eaglePhotoTakenSort?.runTakenMetaIntegrationTest?.() || null,
    liveOrder: window.__eaglePhotoTakenSort?.runLiveTakenOrderTest?.() || null,
    lock: window.__eaglePhotoTakenSort?.runLockIntegrationTest?.() || null
  })`);
}

async function scanCurrentItems(context, options = {}) {
  const contextId = String(context?.contextId || "");
  if (!contextId) return null;
  if (scanInProgress?.contextId === contextId) return scanInProgress.promise;
  const generation = ++scanGeneration;
  latestContextId = contextId;
  const contextIsCurrent = () =>
    generation === scanGeneration && latestContextId === contextId;

  const promise = (async () => {
    let sourceItems = Array.isArray(context.items) ? context.items : [];
    // The current view already carries the collection items. Hydrating the
    // complete folder from Eagle is reserved for an empty view, otherwise a
    // normal monitor tick would enumerate a NAS folder before native
    // thumbnails/previews can render.
    if (context.currentFolderId && sourceItems.length === 0) {
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
    const missingPathIds = Array.from(new Set(
      sourceItems
        .filter((item) => item?.id && !item.filePath)
        .map((item) => String(item.id))
    ));
    if (missingPathIds.length > 0) {
      const batches = [];
      for (let index = 0; index < missingPathIds.length; index += 200) {
        batches.push(missingPathIds.slice(index, index + 200));
      }
      try {
        const hydratedBatches = await mapWithConcurrency(
          batches,
          3,
          (batch) => withTimeout(
            eagle.item.getByIds(batch),
            30000,
            "Read current view media paths"
          )
        );
        const hydratedById = new Map(
          hydratedBatches.flat().filter(Boolean).map((item) => [
            String(item.id || ""),
            item
          ])
        );
        sourceItems = sourceItems.map((item) =>
          hydratedById.get(String(item?.id || "")) || item
        );
      } catch (error) {
        console.warn(
          "[photo-taken-sort] Unable to hydrate current view media paths",
          error
        );
      }
    }
    if (context.currentSmartFolderId && sourceItems.length === 0) {
      const ids = Array.from(new Set(
        sourceItems.map((item) => String(item?.id || "")).filter(Boolean)
      ));
      const batches = [];
      for (let index = 0; index < ids.length; index += 200) {
        batches.push(ids.slice(index, index + 200));
      }
      try {
        const hydratedBatches = await mapWithConcurrency(
          batches,
          3,
          (batch) => withTimeout(
            eagle.item.getByIds(batch),
            30000,
            `Read smart folder ${context.currentSmartFolderId}`
          )
        );
        const hydrated = hydratedBatches.flat().filter(Boolean);
        if (hydrated.length || sourceItems.length === 0) sourceItems = hydrated;
        setStatus(
          `拍摄时间数据源：智能文件夹 ${context.currentSmartFolderId} ` +
            `${ids.length} 个结果，已解析 ${hydrated.length} 个项目`
        );
      } catch (error) {
        console.warn(
          `[photo-taken-sort] Unable to hydrate smart folder ` +
            `${context.currentSmartFolderId}`,
          error
        );
      }
    }
    const contextItems = sourceItems.filter(
      (item) => item.id && mediaTypeForExtension(item.ext)
    );
    const items = contextItems.filter((item) => item.filePath);
    if (!contextIsCurrent()) return;
    setStatus(
      `拍摄时间待读取：${contextItems.length} 个媒体，` +
        `${items.length} 个具有文件路径`
    );
    const values = {};
    const itemsToRead = [];
    let withTakenAt = 0;
    for (const item of items) {
      const cached = cachedTakenAt(item);
      if (!cached.hit) {
        itemsToRead.push(item);
        continue;
      }
      values[item.id] = cached.value;
      if (Number.isFinite(cached.value)) withTakenAt += 1;
    }
    if (Object.keys(values).length && contextIsCurrent()) {
      await pushTimestamps(values);
    }

    if (itemsToRead.length) {
      const nativePreviewReady = await waitForNativePreview(contextId);
      if (!nativePreviewReady || !contextIsCurrent()) return;
    }

    let processed = 0;
    setStatus(`正在读取拍摄时间 0/${itemsToRead.length}`);
    await mapWithConcurrency(itemsToRead, 2, async (item) => {
      if (!contextIsCurrent()) return;
      values[item.id] = await getTakenAt(item);
      if (!contextIsCurrent()) return;
      if (Number.isFinite(values[item.id])) withTakenAt += 1;
      processed += 1;
      if (processed % 25 === 0 || processed === itemsToRead.length) {
        setStatus(`正在读取拍摄时间 ${processed}/${itemsToRead.length}`);
      }
    });

    if (!contextIsCurrent()) return;
    await pushTimestamps(values);
    if (shouldRefreshAfterMetadataScan(context, {
      ...options,
      sortNeedsMetadata:
        options.sortNeedsMetadata === true &&
        (withTakenAt > 0 || items.length > 0)
    })) {
      await refreshMainList();
    }
    const checks = options.explicitSortChange
      ? await runMainIntegrationChecks()
      : null;
    const dragCheckLabel = checks?.drag?.ok
      ? "通过"
      : checks?.drag?.reason === "temporary drag inactive"
        ? "当前视图不适用"
        : "待列表渲染";
    if (checks) {
      setStatus(`拍摄时间现场验证：${JSON.stringify(checks.liveOrder || {})}`);
    }
    setStatus(
      `拍摄时间读取完成：${withTakenAt} 个有拍摄时间，` +
        `${items.length - withTakenAt} 个没有拍摄时间；` +
        (checks
          ? `界面${checks.layout?.ok ? "通过" : "失败"}，` +
            `简介${
              checks.takenMeta?.ok && checks.takenMeta.domChecked
                ? "实测通过"
                : checks.takenMeta?.ok
                  ? "结构通过"
                  : "失败"
            }，临时拖动链路${dragCheckLabel}`
          : "后台缓存已更新") +
        (context.folderLocked ? "（全局保护已开启）" : "")
    );
  })().finally(() => {
    if (scanInProgress?.generation === generation) scanInProgress = null;
  });

  scanInProgress = { contextId, generation, promise };
  return promise;
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

function teamStateTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function pluginVersion() {
  try {
    const manifest = JSON.parse(
      await fs.promises.readFile(path.join(pluginPath, "manifest.json"), "utf8")
    );
    return String(manifest.version || "");
  } catch {
    return "";
  }
}

async function captureTeamStateSnapshot() {
  if (!injectionReady) await inject();
  const snapshot = await executeInMain(
    "window.__eaglePhotoTakenSort?.exportTeamStorage?.() || null"
  );
  if (!snapshot?.libraryId || !snapshot?.storage) {
    throw new Error("无法读取当前 Library 的排序状态");
  }
  const folders = await currentLibraryFolders();
  if (!folders.length) {
    throw new Error("无法读取当前 Library 的文件夹清单");
  }
  return teamSortStateRuntime.createState({
    libraryId: snapshot.libraryId,
    storage: snapshot.storage,
    folders,
    pluginVersion: await pluginVersion()
  });
}

async function initializeTeamStateSync(selection = null) {
  if (selection?.blocked) {
    teamStateSyncRuntime = null;
    return { blocked: true, reason: selection.verification?.reason || "team-state-blocked" };
  }
  const libraryPath = eagle.library?.path || "";
  const filePath = teamSortStateRuntime.statePathForLibrary(libraryPath);
  if (!filePath) {
    teamStateSyncRuntime = null;
    return null;
  }
  const snapshot = await captureTeamStateSnapshot();
  const localFingerprint = teamStateFingerprint(snapshot);
  const sidecarIdentity = await teamStateFileRuntime.readIdentity(filePath);
  teamStateSyncRuntime = createTeamStateSyncRuntime({
    writerId: teamStateWriterId,
    debounceMs: 5000
  });
  const upgrade = selection?.state
    ? teamStateSyncRuntime.noteImportedState(
      selection.state,
      sidecarIdentity,
      localFingerprint
    )
    : (teamStateSyncRuntime.seed({
      localFingerprint,
      writtenFingerprint: localFingerprint,
      sidecarIdentity
    }), false);
  if (upgrade) {
    try {
      await scheduleTeamStateSync(snapshot, "initial-import-upgrade");
    } catch (error) {
      teamStateStatus = { ...teamStateStatus, message: `团队同步失败：${error.message}` };
      renderTeamStateStatus();
      setStatus(`团队同步失败：${error.message}`);
    }
  }
  return teamStateSyncRuntime.snapshot();
}

async function writeAutomaticTeamState(snapshot, metadata = {}) {
  const libraryPath = eagle.library?.path || "";
  const filePath = teamSortStateRuntime.statePathForLibrary(libraryPath);
  if (!filePath) throw new Error("当前 Library 路径尚未就绪");
  const state = teamSortStateRuntime.stampState(snapshot, metadata);
  const result = await teamStateFileRuntime.writeAtomic(
    filePath,
    JSON.stringify(state, null, 2) + "\n",
    {
      expectedIdentity: metadata.expectedSidecar || null,
      writerId: metadata.writerId || teamStateWriterId,
      beforeReplace: async () => {
        await backupExistingTeamState(filePath);
      }
    }
  );
  teamStateStatus = {
    ...teamStateStatus,
    source: "library-sidecar",
    path: filePath,
    message: "团队同步：自动",
    verification: {
      ok: true,
      payloadSha256: state.integrity.payloadSha256,
      compatibility: { matchRatio: 1 }
    },
    state: {
      createdAt: state.createdAt,
      payloadSha256: state.integrity.payloadSha256,
      folderCount: state.identity.folderCount,
      pluginVersion: state.plugin.version,
      revision: state.revision,
      writerId: state.writerId
    }
  };
  renderTeamStateStatus();
  return result;
}

async function scheduleTeamStateSync(snapshot = null, reason = "local-change") {
  if (!teamStateSyncRuntime) return null;
  const current = snapshot || await captureTeamStateSnapshot();
  const filePath = teamSortStateRuntime.statePathForLibrary(eagle.library?.path || "");
  if (!filePath) return null;
  const currentIdentity = await teamStateFileRuntime.readIdentity(filePath);
  const syncState = teamStateSyncRuntime.snapshot();
  if (syncState.blockedReason) return { ok: false, skipped: "blocked" };
  if (!teamStateFileRuntime.sameIdentity(syncState.observedSidecar, currentIdentity)) {
    const message = "团队同步冲突：sidecar 已被其他电脑更新，已停止自动覆盖；请重新读取团队状态";
    teamStateStatus = { ...teamStateStatus, message };
    renderTeamStateStatus();
    setStatus(message);
    teamStateSyncRuntime.block("sidecar-changed");
    return { ok: false, skipped: "sidecar-conflict" };
  }
  const localFingerprint = teamStateSyncRuntime.fingerprint(current);
  let result;
  try {
    result = await teamStateSyncRuntime.schedule(current, {
      reason,
      localFingerprint,
      baseRevision: syncState.observedSidecar?.revision || 0,
      write: writeAutomaticTeamState
    });
  } catch (error) {
    if (error?.code === "TEAM_STATE_CONFLICT") {
      teamStateSyncRuntime.block(error.reason || "sidecar-changed");
      teamStateStatus = {
        ...teamStateStatus,
        message: "团队同步冲突：写入窗口内 sidecar 已变化，已停止自动覆盖；请重新读取团队状态"
      };
      renderTeamStateStatus();
      setStatus(teamStateStatus.message);
    }
    throw error;
  }
  if (result?.ok === false) return result;
  if (result?.ok === true) {
    teamStateStatus.message = "团队同步：自动";
    renderTeamStateStatus();
  }
  return result;
}

async function syncTeamStateIfChanged() {
  if (!injectionReady || !teamStateSyncRuntime || teamStateSyncInProgress) return null;
  teamStateSyncInProgress = true;
  try {
    const snapshot = await captureTeamStateSnapshot();
    const localFingerprint = teamStateSyncRuntime.fingerprint(snapshot);
    const syncState = teamStateSyncRuntime.snapshot();
    if (localFingerprint === syncState.lastLocalFingerprint) return null;
    return await scheduleTeamStateSync(snapshot);
  } catch (error) {
    teamStateStatus = {
      ...teamStateStatus,
      message: `团队同步失败：${error.message}`
    };
    renderTeamStateStatus();
    setStatus(`团队同步失败：${error.message}`);
    return { ok: false, error };
  } finally {
    teamStateSyncInProgress = false;
  }
}

async function backupExistingTeamState(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
  } catch {
    return "";
  }
  const backupDir = path.join(pluginPath, "team-state-backups");
  await fs.promises.mkdir(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `${path.basename(filePath)}.${teamStateTimestamp()}.bak`
  );
  await fs.promises.copyFile(filePath, backupPath);
  return backupPath;
}

async function writeTeamStateFile(filePath, state, options = {}) {
  const directory = path.dirname(filePath);
  await fs.promises.access(directory, fs.constants.W_OK);
  let backupPath = "";
  const writeOptions = {
    writerId: options.writerId || teamStateWriterId,
    beforeReplace: async () => {
      backupPath = await backupExistingTeamState(filePath);
    }
  };
  if (options.expectedIdentity !== undefined) {
    writeOptions.expectedIdentity = options.expectedIdentity;
  }
  await teamStateFileRuntime.writeAtomic(
    filePath,
    JSON.stringify(state, null, 2) + "\n",
    writeOptions
  );
  return backupPath;
}

function setTeamStateBusy(busy) {
  for (const id of [
    "publish-team-state",
    "export-team-state",
    "import-team-state"
  ]) {
    const button = document.getElementById(id);
    if (button) button.disabled = busy;
  }
}

function renderTeamStateStatus() {
  const sourceNames = {
    "library-sidecar": "当前 Library 团队母版",
    "manual-import": "手动导入文件",
    "bundled-default": "插件内置交接状态",
    none: "未找到团队状态"
  };
  setText(
    "team-state-message",
    teamStateStatus.message || sourceNames[teamStateStatus.source] || "团队状态"
  );
  const state = teamStateStatus.state;
  const compatibility = teamStateStatus.verification?.compatibility;
  const details = [];
  details.push(sourceNames[teamStateStatus.source] || teamStateStatus.source);
  if (state?.pluginVersion) details.push(`插件 ${state.pluginVersion}`);
  if (state?.folderCount) details.push(`${state.folderCount} 个文件夹指纹`);
  if (compatibility && compatibility.matchRatio !== null) {
    details.push(`ID 匹配 ${Math.round(compatibility.matchRatio * 100)}%`);
  }
  if (teamStateStatus.importResult?.skippedKeys?.includes(
    "eagle.photoTakenSort.autoRename.v1"
  )) {
    details.push("自动编号已携带但未自动启用");
  }
  setText("team-state-detail", details.join(" · "));
  const pathElement = document.getElementById("team-state-path");
  if (pathElement) {
    pathElement.textContent = teamStateStatus.path || "";
    pathElement.title = teamStateStatus.path || "";
    pathElement.hidden = !teamStateStatus.path;
  }
}

async function publishTeamState() {
  setTeamStateBusy(true);
  try {
    const libraryPath = eagle.library?.path || "";
    const filePath = teamSortStateRuntime.statePathForLibrary(libraryPath);
    if (!filePath) throw new Error("当前 Library 路径尚未就绪");
    const expectedIdentity = await teamStateFileRuntime.readIdentity(filePath);
    const state = await captureTeamStateSnapshot();
    const stamped = teamSortStateRuntime.stampState(state, {
      revision: Number(expectedIdentity?.revision || 0) + 1,
      updatedAt: new Date().toISOString(),
      writerId: teamStateWriterId
    });
    const backupPath = await writeTeamStateFile(filePath, stamped, {
      expectedIdentity,
      writerId: teamStateWriterId
    });
    teamStateStatus = {
      source: "library-sidecar",
      path: filePath,
      message: "团队母版已发布；其他电脑重新打开此 Library 后会自动读取",
      verification: {
        ok: true,
        payloadSha256: stamped.integrity.payloadSha256,
        compatibility: { matchRatio: 1 }
      },
      state: {
        createdAt: stamped.createdAt,
        payloadSha256: stamped.integrity.payloadSha256,
        folderCount: stamped.identity.folderCount,
        pluginVersion: stamped.plugin.version,
        revision: stamped.revision,
        writerId: stamped.writerId
      },
      backupPath
    };
    if (teamStateSyncRuntime) {
      const writtenIdentity = await teamStateFileRuntime.readIdentity(filePath);
      teamStateSyncRuntime.seed({
        localFingerprint: teamStateFingerprint(stamped),
        writtenFingerprint: teamStateFingerprint(stamped),
        sidecarIdentity: writtenIdentity
      });
    }
    renderTeamStateStatus();
    setStatus(`团队状态已发布：${filePath}`);
  } catch (error) {
    teamStateStatus = {
      ...teamStateStatus,
      message: `发布失败：${error.message}`
    };
    renderTeamStateStatus();
  } finally {
    setTeamStateBusy(false);
  }
}

async function exportTeamState() {
  setTeamStateBusy(true);
  try {
    const state = await captureTeamStateSnapshot();
    const libraryName = path.basename(
      teamSortStateRuntime.normalizeLibraryId(state.libraries[0]),
      ".library"
    ) || "Eagle-Library";
    const result = await eagle.dialog.showSaveDialog({
      title: "导出团队排序与展示状态",
      defaultPath: `${libraryName}-团队状态.eagle-team-state.json`,
      filters: [{ name: "Eagle 团队状态", extensions: ["json"] }]
    });
    if (result?.canceled || !result?.filePath) return;
    const backupPath = await writeTeamStateFile(result.filePath, state);
    teamStateStatus = {
      source: "manual-import",
      path: result.filePath,
      message: "团队状态文件已导出",
      verification: { ok: true, compatibility: { matchRatio: 1 } },
      state: {
        createdAt: state.createdAt,
        payloadSha256: state.integrity.payloadSha256,
        folderCount: state.identity.folderCount,
        pluginVersion: state.plugin.version
      },
      backupPath
    };
    renderTeamStateStatus();
  } catch (error) {
    teamStateStatus = {
      ...teamStateStatus,
      message: `导出失败：${error.message}`
    };
    renderTeamStateStatus();
  } finally {
    setTeamStateBusy(false);
  }
}

async function importTeamState() {
  setTeamStateBusy(true);
  try {
    const result = await eagle.dialog.showOpenDialog({
      title: "读取团队排序与展示状态",
      properties: ["openFile"],
      filters: [{ name: "Eagle 团队状态", extensions: ["json"] }]
    });
    const filePath = result?.filePaths?.[0];
    if (result?.canceled || !filePath) return;
    const selection = await readVerifiedTeamState(filePath, {
      source: "manual-import"
    });
    if (!selection.state) {
      throw new Error(selection.verification?.reason || "团队状态不可用");
    }
    teamStateSelectionOverride = selection;
    injectionReady = false;
    const imported = await inject();
    renderTeamStateStatus();
    return imported;
  } catch (error) {
    teamStateStatus = {
      ...teamStateStatus,
      message: `导入失败：${error.message}`
    };
    renderTeamStateStatus();
  } finally {
    setTeamStateBusy(false);
  }
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
  document.getElementById("publish-team-state")?.addEventListener(
    "click",
    publishTeamState
  );
  document.getElementById("export-team-state")?.addEventListener(
    "click",
    exportTeamState
  );
  document.getElementById("import-team-state")?.addEventListener(
    "click",
    importTeamState
  );
  renderTeamStateStatus();
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
        context.orderBy === TAKEN_SORT_KEY ||
        (context.orderBy === SORT_KEY &&
          (context.rules || []).some((rule) => rule.field === "TAKEN_AT"))
      )
    )
  );
}

async function flushHostInputDiagnostics(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  const ordered = entries
    .filter((entry) => Number.isFinite(Number(entry?.sequence)))
    .sort((left, right) => Number(left.sequence) - Number(right.sequence));
  if (!ordered.length) return;
  const newest = ordered.at(-1);
  const newestSequence = Number(newest.sequence);
  const adapterId = String(newest.adapterId || "");
  if (adapterId !== lastHostInputDiagnosticAdapterId) {
    lastHostInputDiagnosticSequence = 0;
    lastHostInputDiagnosticAdapterId = adapterId;
  }
  const pending = ordered.filter(
    (entry) => Number(entry.sequence) > lastHostInputDiagnosticSequence
  );
  if (!pending.length) return;
  await fs.promises.appendFile(
    diagnosticPath,
    pending.map((entry) =>
      `${new Date().toISOString()} HOST_INPUT ${JSON.stringify(entry)}\n`
    ).join(""),
    "utf8"
  );
  lastHostInputDiagnosticSequence = newestSequence;
}

async function flushMoveDiagnostics(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  const ordered = entries
    .filter((entry) => Number.isFinite(Number(entry?.sequence)))
    .sort((left, right) => Number(left.sequence) - Number(right.sequence));
  if (!ordered.length) return;
  const newest = ordered.at(-1);
  const newestSequence = Number(newest.sequence);
  const runtimeId = String(newest.runtimeId || "");
  if (runtimeId !== lastMoveDiagnosticRuntimeId) {
    lastMoveDiagnosticSequence = 0;
    lastMoveDiagnosticRuntimeId = runtimeId;
  }
  const pending = ordered.filter(
    (entry) => Number(entry.sequence) > lastMoveDiagnosticSequence
  );
  if (!pending.length) return;
  await fs.promises.appendFile(
    diagnosticPath,
    pending.map((entry) =>
      `${new Date().toISOString()} MOVE_STAGE ${JSON.stringify(entry)}\n`
    ).join(""),
    "utf8"
  );
  lastMoveDiagnosticSequence = newestSequence;
}

async function monitor() {
  if (monitorInProgress || !mainBridgeAllowed) return;
  monitorInProgress = true;
  try {
    if (!injectionReady) {
      const readiness = await mainLibraryReadiness();
      if (!readiness.ready) return;
      await inject();
    }
    await processApprovedRenameRecovery();
    const context = await getCurrentContext();
    if (!context) return;
    await flushHostInputDiagnostics(context.hostInputDiagnostics);
    await flushMoveDiagnostics(context.moveDiagnostics);
    const currentContextId = String(context.contextId || "");
    if (latestContextId !== currentContextId) {
      latestContextId = currentContextId;
      scanGeneration += 1;
    }
    ensureSortingModuleFacade().setCollectionContext({
      windowId: "eagle-main",
      hostAppId: "eagle",
      collectionId: context.contextId || ""
    });
    syncFolderTagContext(context);

    if (context.teamImportResult?.imported) {
      const reportKey = `${context.teamImportResult.targetLibraryId}:` +
        `${context.teamImportResult.payloadSha256}`;
      if (reportKey !== lastTeamImportReport) {
        lastTeamImportReport = reportKey;
        setStatus(
          `已导入团队排序状态：规则 ${context.teamImportResult.ruleFolderCount} 个文件夹，` +
          `排序锁 ${context.teamImportResult.protectedFolderCount || 0} 个文件夹，` +
          `旧配置保护 ${context.teamImportResult.legacyConfigProtectedFolderCount || 0} 个文件夹，` +
          `简介 ${context.teamImportResult.metaFolderCount} 个文件夹；` +
          `跳过 ${context.teamImportResult.skippedKeys?.length || 0} 个风险键` +
          (context.teamImportResult.missingFolderCount
            ? `；缺失 ${context.teamImportResult.missingFolderCount} 个旧文件夹`
            : "")
        );
      }
    }

    await syncTeamStateIfChanged();

    if (context.renameBatchRequest) {
      await handleRenameBatchRequest(context.renameBatchRequest);
    }

    const contextKey = createScanContextKey(context);
    const needsTakenAt = contextNeedsTakenAt(context);
    const explicitSortChange =
      lastObservedOrderBy !== "" &&
      context.orderBy === TAKEN_SORT_KEY &&
      lastObservedOrderBy !== TAKEN_SORT_KEY;
    lastObservedOrderBy = context.orderBy || "";
    const smartScanIdentity = context.currentSmartFolderId
      ? `${context.contextId}:${context.itemFingerprint}`
      : "";
    const smartContextStable = !smartScanIdentity ||
      pendingSmartScanIdentity === smartScanIdentity;
    if (smartScanIdentity && !smartContextStable) {
      // Eagle updates the smart-folder id before replacing allData. Wait for
      // the same scoped result twice so the previous smart view is not scanned
      // under the newly selected id.
      pendingSmartScanIdentity = smartScanIdentity;
    } else if (!smartScanIdentity) {
      pendingSmartScanIdentity = "";
    }
    const canResolveItems =
      context.items.length > 0 ||
      !!context.currentFolderId ||
      !!context.currentSmartFolderId;
    if (
      needsTakenAt &&
      canResolveItems &&
      smartContextStable &&
      contextKey !== lastContextKey
    ) {
      lastContextKey = contextKey;
      // Never hold the monitor loop on NAS metadata I/O. The Eagle view stays
      // native and responsive while this cache warms in the background.
      void scanCurrentItems(context, {
        explicitSortChange,
        sortNeedsMetadata:
          context.orderBy === SORT_KEY ||
          context.orderBy === TAKEN_SORT_KEY ||
          (context.rules || []).some((rule) => rule.field === "TAKEN_AT")
      }).catch((error) => {
        console.warn("[photo-taken-sort] Background metadata scan failed:", error);
      });
    } else if (needsTakenAt && !canResolveItems) {
      lastContextKey = "";
    } else if (!needsTakenAt) {
      lastContextKey = contextKey;
    }
  } catch (error) {
    injectionReady = false;
    if (!error?.__eaglePhotoDiagnosticLogged) {
      await persistDiagnosticFailure("MONITOR_FAILURE", error);
    }
    console.warn("[photo-taken-sort] Monitor retry:", error);
  } finally {
    monitorInProgress = false;
  }
}

async function start() {
  await readCache();
  clearInterval(monitorTimer);
  monitorTimer = setInterval(monitor, 1000);
  await monitor();
}

eagle.onPluginCreate((plugin) => {
  pluginCreatedAt = Date.now();
  startupWindowRequestHandled = false;
  pluginPath = plugin.path;
  cachePath = path.join(pluginPath, "photo-taken-cache.json");
  diagnosticPath = path.join(pluginPath, "diagnostic.log");
  renameBackupPath = path.join(pluginPath, "rename-batch-backup.json");
  renameRecoveryPath = path.join(pluginPath, "rename-recovery-request.json");
  fs.promises.writeFile(diagnosticPath, "", "utf8").catch(() => {});
  lastHostInputDiagnosticSequence = 0;
  lastHostInputDiagnosticAdapterId = "";
  lastMoveDiagnosticSequence = 0;
  lastMoveDiagnosticRuntimeId = "";
  failureDiagnosticSignature = "";
  failureDiagnosticAt = 0;
  mainBridgeAllowed = false;
  runtimeInstanceAllowed =
    path.basename(path.normalize(pluginPath)) === CANONICAL_PLUGIN_DIRECTORY;
  if (!runtimeInstanceAllowed) {
    startPromise = Promise.resolve({ skipped: "non-canonical-instance" });
    fs.promises.appendFile(
      diagnosticPath,
      new Date().toISOString() +
        " 开发源码实例已停用；只允许正式安装目录启动排序后台\n",
      "utf8"
    ).catch(() => {});
    return;
  }
  clearTimeout(serviceStartTimer);
  startPromise = new Promise((resolve) => {
    serviceStartTimer = setTimeout(async () => {
      try {
        mainBridgeAllowed = true;
        await start();
      } catch (error) {
        setStatus(`启动失败：${error.message}`);
        console.error(error);
      } finally {
        resolve();
      }
    }, 0);
  });
});

eagle.onLibraryChanged((libraryPath) => {
  if (!runtimeInstanceAllowed) return;
  ensureSortingModuleFacade().disable("library-changed").catch((error) => {
    console.warn("[photo-taken-sort] Unable to stop sorting module", error);
  });
  const normalizedPath = path.normalize(libraryPath);
  if (
    cache.libraryPath &&
    path.normalize(cache.libraryPath) !== normalizedPath
  ) {
    cache.items = {};
  }
  cache.libraryPath = normalizedPath;
  injectionReady = false;
  mainBridgeAllowed = false;
  clearTimeout(libraryStabilizeTimer);
  libraryStabilizeTimer = setTimeout(() => {
    mainBridgeAllowed = true;
    monitor();
  }, 2000);
  teamStateSelectionOverride = null;
  teamStateSyncRuntime = null;
  teamStateSyncInProgress = false;
  teamStateStatus = {
    source: "none",
    message: "Library 已切换，正在读取对应团队状态",
    path: ""
  };
  renderTeamStateStatus();
  lastContextKey = "";
  latestContextId = "";
  scanGeneration += 1;
  lastObservedOrderBy = "";
  pendingSmartScanIdentity = "";
  lastHostInputDiagnosticSequence = 0;
  lastHostInputDiagnosticAdapterId = "";
  lastMoveDiagnosticSequence = 0;
  lastMoveDiagnosticRuntimeId = "";
  scheduleCacheSave();
  geoTagService?.switchLibrary(normalizedPath).catch((error) => {
    console.warn("[photo-taken-sort] Unable to switch geo tag library", error);
  });
});

eagle.onPluginRun(async () => {
  if (!runtimeInstanceAllowed) {
    setStatus("开发源码实例已停用；请使用正式安装的排序系统");
    return;
  }
  const automaticServiceStart =
    !startupWindowRequestHandled &&
    pluginCreatedAt > 0 &&
    Date.now() - pluginCreatedAt < 10000;
  startupWindowRequestHandled = true;
  if (automaticServiceStart) {
    if (startPromise) await startPromise;
    setStatus("排序服务已自动启动");
    return;
  }
  try {
    setStatus("收到用户打开插件窗口请求");
    if (startPromise) {
      await startPromise;
    } else {
      await inject();
    }
    if (!geoTagService) await initializeGeoTagService();
    clearInterval(geoPollTimer);
    geoPollTimer = setInterval(runGeoPoll, 8000);
    const context = await getCurrentContext();
    if (contextNeedsTakenAt(context)) {
      lastContextKey = "";
      void scanCurrentItems(context, { explicitSortChange: false }).catch((error) => {
        console.warn("[photo-taken-sort] Plugin-open metadata scan failed:", error);
      });
    }
    renderGeoSnapshot();
    renderTeamStateStatus();
    await loadExceptionList();
    folderTagUiActive = true;
    await eagle.window.show();
    await updateFolderTagTarget(true);
  } catch (error) {
    setStatus(`重新连接失败：${error.message}`);
    await eagle.window.show();
  }
});
