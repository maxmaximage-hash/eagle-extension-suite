"use strict";

(function initializeEagleBridge() {
  if (typeof require !== "function" || typeof window === "undefined") return;

  const path = require("path");
  const fs = require("fs");
  const childProcess = require("child_process");
  const os = require("os");
  const { pathToFileURL } = require("url");
  const pluginRoot = path.dirname(decodeURIComponent(window.location.pathname));
  const {
    DEFAULT_SAMPLE_DIRECTORY,
    createPreviewQueue,
    describePair,
    scanDirectory,
    snapshotPayload,
  } = require(path.join(pluginRoot, "lib", "live-photo-service.js"));
  const {
    createLedger,
    loadLedger,
    saveLedger,
    ensureGroup,
    createOperation,
    transitionOperation,
    recordOperationResult,
  } = require(path.join(pluginRoot, "lib", "live-photo-ledger.js"));
  const {
    exportLivePairComponent,
    exportLivePairPackage,
  } = require(path.join(pluginRoot, "lib", "export-service.js"));
  const {
    exportLivePackageComponents,
  } = require(path.join(pluginRoot, "lib", "vendor", "live-package.js"));
  const {
    registerNativeItem,
    findGroupByNativeItemId,
    exportNativeItem,
  } = require(path.join(pluginRoot, "lib", "native-live-registry.js"));
  const {
    replaceNativeLivePhoto,
  } = require(path.join(pluginRoot, "lib", "cover-edit-session.js"));
  const {
    DEFAULT_SESSIONS_ROOT,
    sessionFile,
    readJson,
    atomicWriteJson,
    createExternalEditSession,
  } = require(path.join(pluginRoot, "lib", "external-cover-edit-helper.js"));

  const hasDiagnosticUi = typeof document !== "undefined" && Boolean(document.getElementById("liveGrid"));
  let queue = null;
  let sourceDirectory = localStorage.getItem("max-live-source-v1") || DEFAULT_SAMPLE_DIRECTORY;
  const ledgerPath = path.join(os.homedir(), "Library", "Application Support", "Eagle", "LivePhotoManager", "ledger.json");
  let ledger = loadLedger(ledgerPath);
  const listeners = new Set();
  const editSessionsRoot = DEFAULT_SESSIONS_ROOT;
  let editPollTimer = null;
  let editPollInFlight = false;
  const editWatchers = new Map();

  function state() {
    if (!queue) return null;
    const payload = snapshotPayload(sourceDirectory, queue.snapshot(), "eagle-plugin");
    payload.items = payload.items.map((item) => ({
      ...item,
      imageUrl: item.imagePath ? pathToFileURL(item.imagePath).href : null,
      movieUrl: item.moviePath ? pathToFileURL(item.moviePath).href : null,
    }));
    payload.operations = Object.values(ledger.operations);
    return payload;
  }

  function publish() {
    const payload = state();
    for (const listener of listeners) listener(payload);
  }

  function scan(nextSource = sourceDirectory) {
    if (queue) queue.cancel();
    sourceDirectory = nextSource;
    localStorage.setItem("max-live-source-v1", sourceDirectory);
    queue = createPreviewQueue({ timeoutMs: 10000, maxConsecutiveFailures: 3 });
    queue.on("state", publish);
    const items = scanDirectory(sourceDirectory);
    ledger.sourceDirectory = sourceDirectory;
    for (const item of items) ensureGroup(ledger, item);
    queue.enqueue(items);
    saveLedger(ledgerPath, ledger);
    queue.start().catch(publish);
    return state();
  }

  function registerNativePair(payload = {}) {
    const imagePath = payload.imagePath || payload.image;
    const moviePath = payload.moviePath || payload.movie;
    const stem = payload.stem || path.basename(imagePath || moviePath || "live-photo", path.extname(imagePath || moviePath || ""));
    if (!imagePath || !moviePath || !payload.itemId) {
      throw new Error("Native Live Photo registration requires itemId, imagePath and moviePath");
    }
    const pair = describePair({
      stem,
      image: imagePath,
      movie: moviePath,
      issues: [],
      status: "ready",
    });
    const group = ensureGroup(ledger, {
      ...pair,
      status: "ready",
    });
    registerNativeItem(ledger, {
      group,
      itemId: payload.itemId,
      packagePath: payload.packagePath || null,
    });
    ledger.sourceDirectory = path.dirname(imagePath);
    saveLedger(ledgerPath, ledger);
    return { groupId: group.id, itemId: String(payload.itemId) };
  }

  function spawnExternalCoverHelper(session) {
    const helperPath = path.join(pluginRoot, "scripts", "max-live-photo-edit.js");
    const child = childProcess.spawn(process.execPath, [helperPath, "--session", sessionFile(session)], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    });
    if (typeof child.unref === "function") child.unref();
    return session;
  }

  async function startExternalCoverEdit(itemId) {
    if (!window.eagle?.item?.getById) throw new Error("Eagle item API is unavailable");
    const item = await eagle.item.getById(String(itemId));
    if (!item || String(item.ext || "").toLowerCase() !== "livp") {
      throw new Error("Only a native LIVP item can start cover editing");
    }
    let group = findGroupByNativeItemId(ledger, itemId);
    if (!group) {
      const bootstrapRoot = path.join(editSessionsRoot, "bootstrap", String(itemId));
      const extracted = exportLivePackageComponents(item.filePath, bootstrapRoot, { mode: "all" });
      const pair = describePair({
        stem: item.name || path.basename(item.filePath, path.extname(item.filePath)),
        image: extracted.image,
        movie: extracted.movie,
        issues: [],
        status: "ready",
      });
      group = ensureGroup(ledger, { ...pair, status: "ready" });
      registerNativeItem(ledger, {
        group,
        itemId: String(itemId),
        packagePath: item.filePath,
      });
      saveLedger(ledgerPath, ledger);
    }
    const session = createExternalEditSession({
      packagePath: item.filePath,
      nativeItemId: String(itemId),
      groupId: group.id,
      workspaceRoot: editSessionsRoot,
    });
    const started = spawnExternalCoverHelper(session);
    watchExternalEditSession(started);
    return started;
  }

  async function processExternalEditSessions() {
    if (editPollInFlight || !fs.existsSync(editSessionsRoot)) return;
    editPollInFlight = true;
    try {
      for (const entry of fs.readdirSync(editSessionsRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const filePath = path.join(editSessionsRoot, entry.name, "session.json");
        if (!fs.existsSync(filePath)) continue;
        let session;
        try { session = readJson(filePath); } catch { continue; }
        if (session.status !== "ready-for-eagle") continue;
        eagle.log?.info?.(`MAX Live Photo: processing staged session ${session.id}`);
        session.status = "writing";
        atomicWriteJson(filePath, session);
        try {
          await replaceNativeLivePhoto({
            eagle,
            nativeItemId: session.nativeItemId,
            packagePath: session.stagedPackagePath,
          });
          session.status = "confirmed";
          session.confirmedAt = new Date().toISOString();
          eagle.log?.info?.(`MAX Live Photo: replaceFile confirmed for ${session.nativeItemId}`);
        } catch (error) {
          session.status = "failed";
          session.error = String(error.message || error);
          session.failedAt = new Date().toISOString();
        }
        atomicWriteJson(filePath, session);
      }
    } finally {
      editPollInFlight = false;
    }
  }

  function watchExternalEditSession(session) {
    const filePath = sessionFile(session);
    if (editWatchers.has(filePath)) return;
    const timer = setInterval(async () => {
      let current;
      try { current = readJson(filePath); } catch { return; }
      if (!["ready-for-eagle", "writing"].includes(current.status)) {
        clearInterval(timer);
        editWatchers.delete(filePath);
        return;
      }
      if (current.status !== "ready-for-eagle") return;
      clearInterval(timer);
      editWatchers.delete(filePath);
      current.status = "writing";
      atomicWriteJson(filePath, current);
      try {
        await replaceNativeLivePhoto({
          eagle,
          nativeItemId: current.nativeItemId,
          packagePath: current.stagedPackagePath,
        });
        current.status = "confirmed";
        current.confirmedAt = new Date().toISOString();
      } catch (error) {
        current.status = "failed";
        current.error = String(error.message || error);
        current.failedAt = new Date().toISOString();
      }
      atomicWriteJson(filePath, current);
    }, 1000);
    editWatchers.set(filePath, timer);
  }

  function startEditPolling() {
    if (editPollTimer) return;
    editPollTimer = setInterval(() => {
      processExternalEditSessions().catch(() => {});
    }, 1000);
    processExternalEditSessions().catch(() => {});
  }

  function stopEditPolling() {
    if (editPollTimer) clearInterval(editPollTimer);
    editPollTimer = null;
    for (const timer of editWatchers.values()) clearInterval(timer);
    editWatchers.clear();
  }

  function sendNativeActionResult(payload, result, error = null) {
    if (!window.eagle?.sendNativeActionResult || !payload?.requestId) return;
    window.eagle.sendNativeActionResult({
      requestId: payload.requestId,
      ok: !error,
      result: error ? null : result,
      error: error ? String(error.message || error) : null,
    });
  }

  function handleNativeAction(payload = {}) {
    try {
      if (payload.type === "register") {
        return registerNativePair(payload);
      }
      if (payload.type === "export") {
        const outputDirectory = payload.outputDirectory || path.join(os.homedir(), "Desktop", "MAX Live Photo Exports");
        const itemIds = Array.isArray(payload.itemIds) && payload.itemIds.length > 0
          ? payload.itemIds
          : [payload.itemId];
        const operations = itemIds.filter(Boolean).map((itemId) => exportNativeItem(ledger, {
          itemId,
          mode: payload.mode,
          outputDirectory,
          overwrite: payload.overwrite === true,
        }));
        if (operations.length === 0) throw new Error("No Live Photo item was selected");
        saveLedger(ledgerPath, ledger);
        return { operations };
      }
      throw new Error(`Unsupported native Live Photo action: ${payload.type || "(missing)"}`);
    } catch (error) {
      sendNativeActionResult(payload, null, error);
      throw error;
    }
  }

  function onNativeAction(payload) {
      try {
        const result = handleNativeAction(payload);
        sendNativeActionResult(payload, result);
      } catch {
        // Error details are sent through the result channel above.
      }
  }

  if (window.eagle?.onNativeAction) {
    window.eagle.onNativeAction(onNativeAction);
  }

  async function chooseSource() {
    if (!window.eagle?.dialog?.showOpenDialog) {
      throw new Error("当前运行模式无法打开 Eagle 文件夹选择器");
    }
    const result = await eagle.dialog.showOpenDialog({
      title: "选择 Live Photo 源目录",
      properties: ["openDirectory", "createDirectory"],
    });
    const nextSource = result?.filePaths?.[0];
    if (result?.canceled || !nextSource) return state() || null;
    return scan(nextSource);
  }

  function exportSelected(groupId, mode) {
    if (!queue || !ledger.groups[groupId]) throw new Error("Live Photo item is not ready");
    if (!["image", "movie", "livp"].includes(mode)) throw new Error(`Unsupported export mode: ${mode}`);
    const group = ledger.groups[groupId];
    if (group.status !== "ready") throw new Error(`Live Photo group is not exportable: ${group.status}`);
    const outputDirectory = path.join(sourceDirectory, "MAX Live Photo Exports");
    const operation = createOperation(ledger, {
      type: `export-${mode}`,
      groupIds: [groupId],
      outputDirectory,
    });
    transitionOperation(ledger, operation.id, "running");
    try {
      const result = mode === "livp"
        ? exportLivePairPackage(group, outputDirectory)
        : exportLivePairComponent(group, outputDirectory, mode);
      recordOperationResult(ledger, operation.id, groupId, { status: "confirmed", ...result });
      transitionOperation(ledger, operation.id, "completed");
    } catch (error) {
      recordOperationResult(ledger, operation.id, groupId, { status: "failed", error: error.message });
      transitionOperation(ledger, operation.id, "failed");
      throw error;
    } finally {
      saveLedger(ledgerPath, ledger);
    }
    publish();
    return ledger.operations[operation.id];
  }

  window.MaxLivePhotoBridge = {
    getState: () => state() || scan(),
    scan,
    chooseSource,
    pause: () => queue && queue.pause(),
    resume: () => queue && queue.resume(),
    cancel: () => queue && queue.cancel(),
    retry: () => queue && queue.retryFailed(),
    exportSelected,
    startExternalCoverEdit,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  if (window.eagle) {
    // Start immediately when the service module loads.  A background service may
    // never open its diagnostic window, so lifecycle callbacks alone cannot own
    // the external editor writeback poller.
    startEditPolling();
    // The native service must not scan or open a window on Eagle startup.
    // The old panel remains an explicit diagnostic surface when it is loaded.
    eagle.onPluginCreate(() => {
      if (hasDiagnosticUi) scan();
      startEditPolling();
    });
    eagle.onPluginRun(async () => {
      try {
        await processExternalEditSessions();
        const selected = await eagle.item.getSelected();
        const liveItem = (selected || []).find((item) => String(item?.ext || "").toLowerCase() === "livp");
        if (liveItem) {
          const session = await startExternalCoverEdit(liveItem.id);
          await processExternalEditSessions();
          eagle.log?.info?.(`MAX Live Photo: external cover edit started for ${liveItem.id}`);
          return { status: "started", itemId: liveItem.id, sessionId: session.id };
        }
        if (!hasDiagnosticUi) {
          eagle.log?.info?.("MAX Live Photo: no selected LIVP item for external cover edit");
          return { status: "no-live-photo" };
        }
      } catch (error) {
        eagle.log?.error?.(`MAX Live Photo external cover edit failed: ${error.message || error}`);
        return { status: "failed", error: String(error.message || error) };
      }
      await eagle.window.show();
      publish();
      return { status: "diagnostic-opened" };
    });
    eagle.onPluginBeforeExit(() => {
      if (queue) queue.cancel();
      stopEditPolling();
      listeners.clear();
    });
  }
})();
