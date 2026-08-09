"use strict";

(function initializeEagleBridge() {
  if (typeof require !== "function" || typeof window === "undefined") return;

  const path = require("path");
  const { pathToFileURL } = require("url");
  const pluginRoot = path.dirname(decodeURIComponent(window.location.pathname));
  const {
    DEFAULT_SAMPLE_DIRECTORY,
    createPreviewQueue,
    scanDirectory,
    snapshotPayload,
  } = require(path.join(pluginRoot, "lib", "live-photo-service.js"));
  let queue = null;
  let sourceDirectory = localStorage.getItem("max-live-source-v1") || DEFAULT_SAMPLE_DIRECTORY;
  const listeners = new Set();

  function state() {
    if (!queue) return null;
    const payload = snapshotPayload(sourceDirectory, queue.snapshot(), "eagle-plugin");
    payload.items = payload.items.map((item) => ({
      ...item,
      imageUrl: item.imagePath ? pathToFileURL(item.imagePath).href : null,
      movieUrl: item.moviePath ? pathToFileURL(item.moviePath).href : null,
    }));
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
    queue.enqueue(scanDirectory(sourceDirectory));
    queue.start().catch(publish);
    return state();
  }

  window.MaxLivePhotoBridge = {
    getState: () => state() || scan(),
    scan,
    pause: () => queue && queue.pause(),
    resume: () => queue && queue.resume(),
    cancel: () => queue && queue.cancel(),
    retry: () => queue && queue.retryFailed(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  if (window.eagle) {
    eagle.onPluginCreate(() => scan());
    eagle.onPluginRun(async () => {
      await eagle.window.show();
      publish();
    });
    eagle.onPluginBeforeExit(() => {
      if (queue) queue.cancel();
      listeners.clear();
    });
  }
})();
