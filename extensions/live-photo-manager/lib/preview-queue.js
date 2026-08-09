"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { EventEmitter } = require("events");

function cancelledError(message = "Preview cancelled") {
  const error = new Error(message);
  error.code = "PREVIEW_CANCELLED";
  return error;
}

function timeoutError(timeoutMs) {
  const error = new Error(`Preview timed out after ${timeoutMs} ms`);
  error.code = "PREVIEW_TIMEOUT";
  return error;
}

function waitForAbort(signal) {
  if (signal.aborted) return Promise.reject(cancelledError());
  return new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(cancelledError()), { once: true });
  });
}

class SerialPreviewQueue extends EventEmitter {
  constructor(processor, options = {}) {
    super();
    if (typeof processor !== "function") {
      throw new TypeError("A preview processor function is required");
    }
    this.processor = processor;
    this.timeoutMs = options.timeoutMs || 15000;
    this.maxConsecutiveFailures = options.maxConsecutiveFailures || 3;
    this.tempRoot = options.tempRoot || os.tmpdir();
    this.records = new Map();
    this.order = [];
    this.running = false;
    this.paused = false;
    this.cancelRequested = false;
    this.circuitOpen = false;
    this.activeController = null;
    this.activePromise = null;
  }

  enqueue(items) {
    for (const item of items) {
      if (!item || !item.id) throw new Error("Every preview item needs an id");
      if (this.records.has(item.id)) continue;
      const record = {
        ...item,
        status: item.status === "conflict" || item.status === "incomplete"
          ? item.status
          : "paired",
        error: null,
        result: null,
        attempts: 0,
      };
      this.records.set(record.id, record);
      this.order.push(record.id);
    }
    this.emitState();
    return this.snapshot();
  }

  snapshot() {
    return {
      running: this.running,
      paused: this.paused,
      circuitOpen: this.circuitOpen,
      items: this.order.map((id) => ({ ...this.records.get(id) })),
    };
  }

  emitState() {
    this.emit("state", this.snapshot());
  }

  pause() {
    this.paused = true;
    this.emitState();
  }

  resume() {
    this.paused = false;
    this.cancelRequested = false;
    this.circuitOpen = false;
    this.emitState();
    return this.start();
  }

  cancel() {
    this.cancelRequested = true;
    this.paused = true;
    if (this.activeController) this.activeController.abort();
    this.emitState();
    return this.activePromise || Promise.resolve(this.snapshot());
  }

  retryFailed() {
    for (const record of this.records.values()) {
      if (record.status !== "failed" && record.status !== "cancelled") continue;
      record.status = "paired";
      record.error = null;
    }
    this.paused = false;
    this.cancelRequested = false;
    this.circuitOpen = false;
    this.emitState();
    return this.start();
  }

  start() {
    if (this.activePromise) return this.activePromise;
    this.activePromise = this.run().finally(() => {
      this.activePromise = null;
    });
    return this.activePromise;
  }

  async run() {
    if (this.running) return this.snapshot();
    this.running = true;
    this.cancelRequested = false;
    let consecutiveFailures = 0;
    this.emitState();

    try {
      for (const id of this.order) {
        if (this.paused || this.cancelRequested || this.circuitOpen) break;
        const record = this.records.get(id);
        if (record.status !== "paired") continue;

        record.status = "previewing";
        record.attempts += 1;
        record.error = null;
        this.activeController = new AbortController();
        const signal = this.activeController.signal;
        const tempDirectory = fs.mkdtempSync(path.join(this.tempRoot, "max-live-preview-"));
        let timer;
        this.emitState();

        try {
          const timedOut = new Promise((resolve, reject) => {
            timer = setTimeout(() => {
              this.activeController.abort();
              reject(timeoutError(this.timeoutMs));
            }, this.timeoutMs);
          });
          record.result = await Promise.race([
            Promise.resolve(this.processor(record, { signal, tempDirectory })),
            timedOut,
            waitForAbort(signal),
          ]);
          record.status = "preview_ready";
          consecutiveFailures = 0;
        } catch (error) {
          const wasCancelled = error && error.code === "PREVIEW_CANCELLED" && this.cancelRequested;
          record.status = wasCancelled ? "cancelled" : "failed";
          record.error = error && error.message ? error.message : String(error);
          if (!wasCancelled) consecutiveFailures += 1;
          if (consecutiveFailures >= this.maxConsecutiveFailures) {
            this.circuitOpen = true;
            this.paused = true;
          }
        } finally {
          clearTimeout(timer);
          this.activeController = null;
          fs.rmSync(tempDirectory, { recursive: true, force: true });
          this.emitState();
        }
      }
    } finally {
      this.running = false;
      this.emitState();
    }
    return this.snapshot();
  }
}

module.exports = {
  SerialPreviewQueue,
  cancelledError,
  timeoutError,
};
