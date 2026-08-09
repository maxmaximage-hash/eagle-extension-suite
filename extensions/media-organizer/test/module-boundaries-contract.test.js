"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");
const {
  createModuleLifecycle
} = require(path.join(projectRoot, "lib", "module-lifecycle.js"));
const {
  createNormalCollectionAdapter,
  createSmartCollectionAdapter,
  ControlledUnavailableError
} = require(path.join(projectRoot, "lib", "host-adapter.js"));
const {
  createEventOwnership,
  applyEventOwnership
} = require(path.join(projectRoot, "lib", "event-ownership.js"));
const {
  createSortingModuleFacade
} = require(path.join(projectRoot, "lib", "sorting-module-facade.js"));
const { createFakeHostPort } = require(path.join(
  __dirname,
  "fixtures",
  "fake-host.js"
));

async function main() {
  const cleanup = [];
  let starts = 0;
  let stops = 0;
  const lifecycle = createModuleLifecycle({
    moduleId: "sorting",
    onStart: ({ register }) => {
      starts += 1;
      register(() => cleanup.push("resource-disposed"));
    },
    onStop: () => {
      stops += 1;
    }
  });

  assert.strictEqual(lifecycle.status().state, "disabled");

  let failedResourceDisposed = false;
  const failingStop = createModuleLifecycle({
    moduleId: "sorting-stop-failure",
    onStart: ({ register }) => register(() => {
      failedResourceDisposed = true;
    }),
    onStop: () => {
      throw new Error("stop-failure");
    }
  });
  await failingStop.setEnabled(true);
  await failingStop.start();
  await assert.rejects(() => failingStop.stop(), /stop-failure/);
  assert.strictEqual(failedResourceDisposed, true);
  assert.strictEqual(failingStop.status().resourceCount, 0);
  await lifecycle.start();
  assert.strictEqual(starts, 0, "disabled module must not start");
  await lifecycle.setEnabled(true);
  await lifecycle.start();
  await lifecycle.start();
  assert.strictEqual(starts, 1, "start must be idempotent");
  assert.strictEqual(lifecycle.status().resourceCount, 1);
  await lifecycle.setEnabled(false);
  assert.strictEqual(stops, 1, "disable must stop only this module");
  assert.deepStrictEqual(cleanup, ["resource-disposed"]);
  assert.strictEqual(lifecycle.status().state, "disabled");

  const normalSnapshot = {
    ref: {
      libraryId: "library-a",
      collectionId: "folder-a",
      kind: "normal",
      targetKind: "direct-media"
    },
    revision: "r1",
    members: [{ id: "1" }, { id: "2" }],
    hostBaseOrder: ["1", "2"]
  };
  const smartSnapshot = {
    ...normalSnapshot,
    ref: {
      ...normalSnapshot.ref,
      collectionId: "smart-a",
      kind: "smart"
    }
  };
  const parentSnapshot = {
    ...normalSnapshot,
    ref: {
      ...normalSnapshot.ref,
      collectionId: "folder-parent",
      targetKind: "direct-folders"
    },
    members: [{ id: "child-1" }, { id: "child-2" }],
    hostBaseOrder: ["child-1", "child-2"]
  };
  const host = createFakeHostPort({
    snapshots: [normalSnapshot, smartSnapshot, parentSnapshot]
  });
  const normalAdapter = createNormalCollectionAdapter({ host });
  const smartAdapter = createSmartCollectionAdapter({ host });
  const normal = await normalAdapter.readSnapshot({
    libraryId: "library-a",
    collectionId: "folder-a",
    targetKind: "direct-media"
  });
  const smart = await smartAdapter.readSnapshot({
    libraryId: "library-a",
    collectionId: "smart-a",
    targetKind: "direct-media"
  });
  assert.strictEqual(normal.ref.kind, "normal");
  assert.strictEqual(smart.ref.kind, "smart");
  const parent = await normalAdapter.readSnapshot({
    libraryId: "library-a",
    collectionId: "folder-parent",
    targetKind: "direct-folders"
  });
  assert.strictEqual(parent.ref.targetKind, "direct-folders");
  assert.deepStrictEqual(
    await normalAdapter.writeManualView({
      snapshot: normal,
      order: ["2", "1"]
    }),
    { ok: true, collectionId: "folder-a" }
  );
  assert.deepStrictEqual(
    await smartAdapter.writeManualView({
      snapshot: smart,
      order: ["2", "1"]
    }),
    { ok: true, collectionId: "smart-a" }
  );
  const smartManualWrite = host.calls.find(
    (call) =>
      call.type === "writeManualView" &&
      call.command.ref.collectionId === "smart-a"
  );
  assert.ok(smartManualWrite, "smart manual view must use the host write boundary");
  assert.strictEqual(smartManualWrite.command.ref.kind, "smart");
  assert.strictEqual(smartManualWrite.command.ref.targetKind, "direct-media");
  assert.deepStrictEqual(
    await normalAdapter.requestHostConfirmation({
      type: "apply-visible-order",
      ref: normal.ref,
      snapshot: normal,
      order: ["2", "1"]
    }),
    { ok: true, confirmed: true }
  );
  await assert.rejects(
    () => normalAdapter.readSnapshot({
      libraryId: "library-a",
      collectionId: "all",
      kind: "global",
      targetKind: "unknown"
    }),
    ControlledUnavailableError
  );
  assert.strictEqual(
    host.calls.some((call) => call.type === "readCollection" && call.context.collectionId === "smart-a"),
    true,
    "smart adapter must use the same host snapshot port"
  );

  const ownership = createEventOwnership({
    enabled: true,
    windowId: "main",
    hostAppId: "eagle",
    collectionId: "folder-a"
  });
  const validDrop = ownership.classify({
    type: "drop",
    windowId: "main",
    sourceAppId: "eagle",
    target: { kind: "grid", collectionId: "folder-a", valid: true }
  });
  assert.deepStrictEqual(validDrop, {
    owner: "sorting",
    canPreventDefault: true,
    reason: "valid-grid-drop"
  });
  for (const event of [
    { type: "dragstart", target: { kind: "grid", collectionId: "folder-a", valid: true } },
    { type: "drop", windowId: "main", sourceAppId: "finder", external: true },
    { type: "drop", windowId: "other", sourceAppId: "eagle", target: { kind: "grid", collectionId: "folder-a", valid: true } },
    { type: "drop", windowId: "main", sourceAppId: "eagle", target: { kind: "sidebar", collectionId: "folder-a", valid: true } },
    { type: "drop", windowId: "main", sourceAppId: "eagle", cancelled: true },
    { type: "drop", windowId: "main", sourceAppId: "eagle", leftWindow: true }
  ]) {
    assert.strictEqual(
      ownership.classify(event).owner,
      "eagle",
      "non-grid and foreign events must remain native"
    );
  }
  const calls = {
    prevent: 0,
    stop: 0,
    immediate: 0,
    preventDefault() { this.prevent += 1; },
    stopPropagation() { this.stop += 1; },
    stopImmediatePropagation() { this.immediate += 1; }
  };
  applyEventOwnership(calls, validDrop);
  assert.deepStrictEqual(
    { prevent: calls.prevent, stop: calls.stop, immediate: calls.immediate },
    { prevent: 1, stop: 1, immediate: 1 }
  );
  const nativeCalls = {
    prevent: 0,
    stop: 0,
    immediate: 0,
    preventDefault() { this.prevent += 1; },
    stopPropagation() { this.stop += 1; },
    stopImmediatePropagation() { this.immediate += 1; }
  };
  applyEventOwnership(nativeCalls, ownership.classify({
    type: "dragstart",
    target: { kind: "grid", collectionId: "folder-a", valid: true }
  }));
  assert.deepStrictEqual(
    { prevent: nativeCalls.prevent, stop: nativeCalls.stop, immediate: nativeCalls.immediate },
    { prevent: 0, stop: 0, immediate: 0 }
  );

  const facade = createSortingModuleFacade({
    host,
    legacy: {
      start: () => cleanup.push("legacy-start"),
      stop: () => cleanup.push("legacy-stop")
    },
    windowId: "main",
    hostAppId: "eagle"
  });
  assert.strictEqual(facade.status().state, "disabled");
  await facade.enable();
  assert.strictEqual(facade.status().state, "running");
  assert.strictEqual(facade.status().moduleId, "sorting");
  facade.setCollectionContext({
    windowId: "main",
    hostAppId: "eagle",
    collectionId: "folder-a"
  });
  assert.strictEqual(facade.classifyEvent({
    type: "drop",
    windowId: "main",
    sourceAppId: "eagle",
    target: { kind: "grid", collectionId: "folder-a", valid: true }
  }).owner, "sorting");
  await facade.disable();
  assert.strictEqual(facade.status().state, "disabled");
  assert.strictEqual(facade.classifyEvent({
    type: "drop",
    windowId: "main",
    sourceAppId: "eagle",
    target: { kind: "grid", collectionId: "folder-a", valid: true }
  }).owner, "eagle", "disabled sorting must let Eagle continue");

  for (const file of [
    "lib/module-lifecycle.js",
    "lib/host-adapter.js",
    "lib/event-ownership.js",
    "lib/sorting-module-facade.js"
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /localStorage|window\.|document\.|eagle\./i, file + " must stay host-neutral");
    assert.doesNotMatch(
      source,
      /geo|gps|tag|watermark|publish|mediaPublishing|metadataTags/i,
      file + " must not import B/C business concepts"
    );
  }
  assert.doesNotMatch(read("lib/sort-core.js"), /localStorage|window\.|document\.|eagle\./i);
  console.log("module boundary contract tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
