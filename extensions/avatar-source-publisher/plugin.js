"use strict";

const path = require("path");
const pluginPath = path.dirname(decodeURIComponent(window.location.pathname));
const { createAvatarSourceExporter } = require(path.join(pluginPath, "lib", "avatar-source-exporter.js"));
const { createEagleAvatarSourceAdapter } = require(path.join(pluginPath, "lib", "eagle-avatar-source-adapter.js"));

const REFRESH_INTERVAL_MS = 60_000;
const START_DELAY_MS = 5_000;
const exporter = createAvatarSourceExporter();
let refreshRunning = false;
let refreshQueued = false;
let refreshTimer = null;

function report(level, message, details = {}) {
  const entry = { source: "avatar-source-publisher", level, message, details };
  if (level === "error") console.error(entry);
  else console.log(entry);
}

async function refresh(reason) {
  if (refreshRunning) {
    refreshQueued = true;
    return;
  }
  refreshRunning = true;
  try {
    const adapter = createEagleAvatarSourceAdapter(window.eagle);
    const result = await exporter.refresh({
      libraryPath: adapter.libraryPath(),
      readSourceSnapshot: () => adapter.readSourceSnapshot()
    });
    report("info", result.changed ? "avatar-source-published" : "avatar-source-unchanged", {
      reason,
      outputRoot: result.outputRoot,
      manifestVersion: result.manifest?.manifestVersion || null,
      active: result.manifest?.counts?.active || 0,
      invalid: result.manifest?.counts?.invalid || 0,
      removed: result.manifest?.counts?.removed || 0
    });
  } catch (error) {
    report("error", "avatar-source-publish-failed", { reason, error: String(error?.message || error) });
  } finally {
    refreshRunning = false;
    if (refreshQueued) {
      refreshQueued = false;
      void refresh("queued");
    }
  }
}

function schedule(reason, delay = 0) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refresh(reason);
  }, delay);
}

schedule("startup", START_DELAY_MS);
setInterval(() => schedule("poll"), REFRESH_INTERVAL_MS);
if (window.eagle?.onLibraryChanged) {
  window.eagle.onLibraryChanged(() => schedule("library-changed", START_DELAY_MS));
}
