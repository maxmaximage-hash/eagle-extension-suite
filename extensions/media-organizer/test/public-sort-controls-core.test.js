"use strict";

const assert = require("assert");
const { createPublicSortControlsRuntime } = require(
  "../lib/public-sort-controls-core.js"
);

const memory = new Map();
const renameRuntime = {
  buildPlan(items, config) {
    return {
      sceneName: config.folderName,
      entries: items.map((item, index) => ({
        id: item.id,
        oldName: item.name,
        newName: `1-${config.folderName}${index + 1}`,
        changed: true
      })),
      changes: items.map((item, index) => ({
        id: item.id,
        oldName: item.name,
        newName: `1-${config.folderName}${index + 1}`,
        changed: true
      })),
      groups: { people: items.length, environment: 0 },
      ignoredCount: 0,
      error: null
    };
  }
};
const runtime = createPublicSortControlsRuntime({
  renameRuntime,
  storage: {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value)
  }
});

assert.deepStrictEqual(runtime.readState("folder"), {
  locked: false,
  manualEnabled: true,
  autoRenameEnabled: false
});
runtime.updateState("folder", { locked: true, autoRenameEnabled: true });
assert.strictEqual(runtime.canMutate("folder"), false);
assert.strictEqual(
  runtime.buildAutoRenamePlan([{ id: "1", name: "photo.jpg" }], {
    folderName: "BROLL",
    state: runtime.readState("folder")
  }).error,
  "locked"
);
runtime.updateState("folder", { locked: false, autoRenameEnabled: false });
const plan = runtime.buildAutoRenamePlan([{ id: "1", name: "photo.jpg" }], {
  folderName: "BROLL",
  state: runtime.readState("folder")
});
assert.strictEqual(plan.error, "auto-rename-disabled");
runtime.updateState("folder", { autoRenameEnabled: true });
assert.strictEqual(
  runtime.buildAutoRenamePlan([{ id: "1", name: "photo.jpg" }], {
    folderName: "BROLL",
    state: runtime.readState("folder")
  }).changes.length,
  1
);

console.log("public-sort-controls-core tests passed");
