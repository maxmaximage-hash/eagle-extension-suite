"use strict";

const assert = require("assert");
const { createMediaSortRuntime } = require("../lib/sort-core");
const { createOrderCoordinator } = require("../lib/order-coordinator-core");
const { createManualMoveRuntime } = require("../lib/manual-move-core");

const sortRuntime = createMediaSortRuntime({
  imageExtensions: ["jpg"],
  videoExtensions: [],
  language: "zh_CN"
});
const orderCoordinator = createOrderCoordinator({ sortRuntime });
const runtime = createManualMoveRuntime({ sortRuntime, orderCoordinator });
const items = [
  { id: "a", name: "a", ext: "jpg" },
  { id: "b", name: "b", ext: "jpg" },
  { id: "c", name: "c", ext: "jpg" }
];
const smart = {
  kind: "smart",
  id: "smart-a",
  key: "/Volumes/team.library|smart:smart-a"
};

const created = runtime.createMoveCommand({
  collection: smart,
  items,
  selectedIds: ["a"],
  targetId: "c",
  insertAfter: true,
  locked: false
});
assert.strictEqual(created.ok, true);
assert.strictEqual(created.command.type, "MoveCommand");
assert.strictEqual(created.command.collection.kind, "smart");
assert.deepStrictEqual(
  created.command.nextItems.map((item) => item.id),
  ["b", "c", "a"]
);

const reduced = runtime.reduce({
  relations: [],
  legacyOrder: [],
  order: [],
  history: [],
  revision: 0
}, created.command, 1234);
assert.deepStrictEqual(reduced.relations, [
  { itemId: "a", relation: "after", anchorId: "c" }
]);
assert.deepStrictEqual(reduced.legacyOrder, ["a", "b", "c"]);
assert.deepStrictEqual(reduced.order, ["a", "b", "c"]);
assert.strictEqual(reduced.targetKind, "direct-media");
assert.strictEqual(reduced.mode, "overlay");
assert.strictEqual(reduced.revision, 1234);

assert.deepStrictEqual(runtime.createMoveCommand({
  collection: smart,
  items,
  selectedIds: ["a"],
  targetId: "c",
  insertAfter: true,
  locked: true
}), { ok: false, reason: "sorting-protected" });

const normalState = {
  folders: {
    "source-a": { relations: [{ itemId: "x", relation: "before", anchorId: "y" }] }
  }
};
runtime.reduce(reduced, created.command, 2345);
assert.deepStrictEqual(normalState, {
  folders: {
    "source-a": { relations: [{ itemId: "x", relation: "before", anchorId: "y" }] }
  }
}, "a smart MoveCommand must not mutate a source normal-folder state");

console.log("manual move core tests passed");
