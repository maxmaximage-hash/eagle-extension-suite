"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { SerialPreviewQueue } = require("../lib/preview-queue");

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "max-live-queue-test-"));
}

test("processes preview work strictly one item at a time with unique temp folders", async () => {
  const root = tempRoot();
  let active = 0;
  let peak = 0;
  const tempDirectories = [];
  try {
    const queue = new SerialPreviewQueue(async (item, context) => {
      active += 1;
      peak = Math.max(peak, active);
      tempDirectories.push(context.tempDirectory);
      await new Promise((resolve) => setTimeout(resolve, 8));
      active -= 1;
      return { id: item.id };
    }, { tempRoot: root, timeoutMs: 1000 });
    queue.enqueue([{ id: "one" }, { id: "two" }, { id: "three" }]);
    const snapshot = await queue.start();

    assert.equal(peak, 1);
    assert.equal(new Set(tempDirectories).size, 3);
    assert.deepEqual(snapshot.items.map((item) => item.status), [
      "preview_ready", "preview_ready", "preview_ready",
    ]);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("cancels the active item and leaves later work resumable", async () => {
  const root = tempRoot();
  try {
    const queue = new SerialPreviewQueue(async (item, { signal }) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 500);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(Object.assign(new Error("Preview cancelled"), { code: "PREVIEW_CANCELLED" }));
        }, { once: true });
      });
      return item.id;
    }, { tempRoot: root, timeoutMs: 1000 });
    queue.enqueue([{ id: "one" }, { id: "two" }]);
    const running = queue.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await queue.cancel();
    const stopped = await running;

    assert.equal(stopped.items[0].status, "cancelled");
    assert.equal(stopped.items[1].status, "paired");
    assert.equal(stopped.paused, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("times out stalled work and opens the circuit after repeated failures", async () => {
  const root = tempRoot();
  try {
    const queue = new SerialPreviewQueue(
      () => new Promise(() => {}),
      { tempRoot: root, timeoutMs: 15, maxConsecutiveFailures: 2 },
    );
    queue.enqueue([{ id: "one" }, { id: "two" }, { id: "three" }]);
    const snapshot = await queue.start();

    assert.deepEqual(snapshot.items.map((item) => item.status), ["failed", "failed", "paired"]);
    assert.equal(snapshot.circuitOpen, true);
    assert.equal(snapshot.paused, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("deduplicates repeated queue ids", () => {
  const queue = new SerialPreviewQueue(() => null);
  const snapshot = queue.enqueue([{ id: "same" }, { id: "same" }]);
  assert.equal(snapshot.items.length, 1);
});
