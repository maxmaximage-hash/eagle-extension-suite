"use strict";

const assert = require("assert");
const { createMediaSortRuntime } = require("../lib/sort-core");
const { createRenameRuntime } = require("../lib/rename-core");
const { createSortingSystemRuntime } = require("../lib/sorting-system-core");
const { createOrderCoordinator } = require("../lib/order-coordinator-core");

const sortRuntime = createMediaSortRuntime({
  imageExtensions: ["jpg"],
  videoExtensions: ["mov"],
  language: "zh_CN"
});
const renameRuntime = createRenameRuntime({ isMedia: sortRuntime.isMedia });
const orderCoordinator = createOrderCoordinator({ sortRuntime });
const runtime = createSortingSystemRuntime({
  sortRuntime,
  renameRuntime,
  orderCoordinator
});
const collection = {
  kind: "normal",
  id: "folder-a",
  key: "library|normal:folder-a"
};

function item(id, name, takenAt = null) {
  return { id, name, ext: "jpg", takenAt, folders: ["folder-a"] };
}

const source = [
  item("a", "1-scene1", 300),
  item("b", "1-scene2", null),
  item("c", "1-scene3", 100),
  item("d", "2-scene1", null)
];

{
  const snapshot = runtime.resolveOrder({
    collection,
    items: source,
    contextId: collection.key,
    pluginSort: true,
    sortMode: "automatic",
    rules: [{ field: "TAKEN_AT", direction: "asc" }],
    renderedIds: ["a", "b", "c", "d"],
    preferRendered: true,
    manualOrder: ["d", "b", "a", "c"]
  });
  assert.strictEqual(snapshot.authority, "visible-adapter");
  assert.deepStrictEqual(snapshot.finalIds, ["a", "b", "c", "d"]);
}

{
  const snapshot = runtime.resolveOrder({
    collection,
    items: source,
    contextId: collection.key,
    pluginSort: true,
    sortMode: "automatic",
    rules: [{ field: "TAKEN_AT", direction: "asc" }],
    manualOverlay: [{ itemId: "a", relation: "after", anchorId: "c" }]
  });
  assert.strictEqual(snapshot.authority, "automatic-rule+manual-overlay");
  assert.deepStrictEqual(snapshot.automaticItems.map((entry) => entry.id), [
    "c",
    "a",
    "b",
    "d"
  ]);
  assert.deepStrictEqual(snapshot.finalIds, ["c", "a", "b", "d"]);
}

{
  const snapshot = runtime.resolveOrder({
    collection,
    items: source,
    contextId: collection.key,
    pluginSort: true,
    sortMode: "automatic",
    rules: [{ field: "TAKEN_AT", direction: "asc" }],
    renderedIds: ["b", "a", "d", "c"],
    preferRendered: true
  });
  assert.strictEqual(snapshot.authority, "visible-adapter");
  assert.deepStrictEqual(snapshot.finalIds, ["b", "a", "d", "c"]);
}

{
  const snapshot = runtime.resolveOrder({
    collection,
    items: source,
    contextId: collection.key,
    pluginSort: false,
    sortMode: "manual",
    manualOrder: ["c", "a", "b", "d"]
  });
  const plan = runtime.buildRenamePlan(snapshot, { folderName: "4-scene" });
  assert.deepStrictEqual(
    plan.entries.map((entry) => entry.id),
    ["c", "a", "b", "d"]
  );
  assert.deepStrictEqual(
    plan.entries.map((entry) => entry.newName),
    ["1-scene1", "1-scene2", "1-scene3", "2-scene1"]
  );
  const request = runtime.createCurrentFolderRenameRequest(plan, {
    id: "job-1",
    folderId: "folder-a",
    folderName: "4-scene",
    orderRevision: 17
  });
  assert.deepStrictEqual(request.folders[0].finalOrder, ["c", "a", "b", "d"]);
  assert.deepStrictEqual(
    request.folders[0].allowedChangeIds,
    plan.changes.map((entry) => entry.id)
  );
  assert.strictEqual(request.collectionId, "folder-a");
  assert.strictEqual(request.snapshotVersion, "17");
  assert.ok(request.snapshotIdentity);
  assert.ok(request.signature);
  assert.strictEqual(request.orderRevision, 17);
  assert.strictEqual(request.orderAuthority, "manual");

  const resolved = runtime.resolveRequestedOrder(
    request.folders[0],
    [source[3], source[0], source[2], source[1]]
  );
  assert.strictEqual(resolved.ok, true);
  assert.deepStrictEqual(resolved.finalIds, ["c", "a", "b", "d"]);

  const stale = runtime.resolveRequestedOrder(
    request.folders[0],
    source.slice(0, 3)
  );
  assert.deepStrictEqual(stale, {
    ok: false,
    reason: "membership-changed",
    items: []
  });
}

{
  assert.deepStrictEqual(runtime.guard("manual-drag", {
    collection,
    locked: true,
    targetCount: 4
  }), { allowed: false, reason: "sorting-protected" });
  assert.deepStrictEqual(runtime.guard("rename", {
    collection,
    locked: true,
    targetCount: 4
  }), { allowed: false, reason: "sorting-protected" });
  assert.deepStrictEqual(runtime.guard("config-propagation", {
    collection,
    locked: true,
    targetCount: 4
  }), { allowed: true, reason: "" });
  assert.deepStrictEqual(runtime.guard("manual-drag", {
    collection: { kind: "global", id: "global" },
    locked: false,
    targetCount: 24000
  }), { allowed: false, reason: "collection-required" });
}

console.log("sorting-system-core tests passed");
