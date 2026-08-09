"use strict";

const assert = require("assert");
const {
  createFolderTreeBatchRuntime
} = require("../lib/folder-tree-batch-core");

const runtime = createFolderTreeBatchRuntime();

function makeTree() {
  return {
    id: "root",
    name: "Root",
    children: [
      {
        id: "a",
        name: "A",
        children: [
          {
            id: "a-1",
            name: "A1",
            children: [{ id: "a-1-x", name: "A1X", children: [] }]
          }
        ]
      },
      { id: "b", name: "B", children: [] }
    ]
  };
}

const tree = makeTree();
assert.deepStrictEqual(
  runtime.collectFolderTree(tree).map((folder) => folder.id),
  ["root", "a", "a-1", "a-1-x", "b"]
);

const sortState = { orderBy: "NAME", sortIncrease: false };
let result = runtime.applyToFolderTree(tree, {
  apply(folder) {
    folder.orderBy = sortState.orderBy;
    folder.sortIncrease = sortState.sortIncrease;
  }
});
assert.deepStrictEqual(runtime.counts(result), {
  total: 5,
  applied: 5,
  skipped: 0,
  failed: 0
});
assert.deepStrictEqual(
  runtime.collectFolderTree(tree).map((folder) => [
    folder.id,
    folder.orderBy,
    folder.sortIncrease
  ]),
  [
    ["root", "NAME", false],
    ["a", "NAME", false],
    ["a-1", "NAME", false],
    ["a-1-x", "NAME", false],
    ["b", "NAME", false]
  ]
);

const secondSortState = { orderBy: "FILESIZE", sortIncrease: true };
result = runtime.applyToFolderTree(tree, {
  apply(folder) {
    folder.orderBy = secondSortState.orderBy;
    folder.sortIncrease = secondSortState.sortIncrease;
  }
});
assert.strictEqual(result.failures.length, 0);
assert.deepStrictEqual(
  runtime.collectFolderTree(tree).map((folder) => folder.orderBy),
  ["FILESIZE", "FILESIZE", "FILESIZE", "FILESIZE", "FILESIZE"]
);

const metaProfiles = Object.create(null);
result = runtime.applyToFolderTree(tree, {
  apply(folder) {
    metaProfiles[folder.id] = "PHOTO_TAKEN";
  }
});
assert.deepStrictEqual(runtime.counts(result), {
  total: 5,
  applied: 5,
  skipped: 0,
  failed: 0
});
assert.deepStrictEqual(Object.keys(metaProfiles).sort(), [
  "a",
  "a-1",
  "a-1-x",
  "b",
  "root"
]);
assert.strictEqual(metaProfiles["a-1-x"], "PHOTO_TAKEN");

const partialTree = makeTree();
const locked = new Set(["a"]);
Object.defineProperty(partialTree.children[0].children[0], "orderBy", {
  configurable: true,
  get() {
    return "NAME";
  },
  set() {
    throw new Error("permission denied");
  }
});
result = runtime.applyToFolderTree(partialTree, {
  skipFolder(folder) {
    return locked.has(folder.id) ? "locked" : "";
  },
  apply(folder) {
    folder.orderBy = "BTIME";
    folder.sortIncrease = true;
  }
});
assert.deepStrictEqual(runtime.counts(result), {
  total: 5,
  applied: 3,
  skipped: 1,
  failed: 1
});
assert.strictEqual(result.skipped[0].id, "a");
assert.strictEqual(result.failures[0].id, "a-1");
assert.match(result.failures[0].error, /permission denied/);

const lockedCurrentTree = makeTree();
result = runtime.applyToFolderTree(lockedCurrentTree, {
  skipDescendantsOfSkipped: true,
  skipFolder(folder) {
    return folder.id === "root" ? "locked" : "";
  },
  apply(folder) {
    folder.orderBy = "NAME";
  }
});
assert.deepStrictEqual(runtime.counts(result), {
  total: 5,
  applied: 0,
  skipped: 5,
  failed: 0
});
assert.deepStrictEqual(result.skipped.map((entry) => entry.id), [
  "root",
  "a",
  "a-1",
  "a-1-x",
  "b"
]);

const lockedParentTree = makeTree();
result = runtime.applyToFolderTree(lockedParentTree, {
  skipDescendantsOfSkipped: true,
  skipFolder(folder) {
    return folder.id === "a" ? "locked" : "";
  },
  apply(folder) {
    folder.orderBy = "MTIME";
  }
});
assert.deepStrictEqual(runtime.counts(result), {
  total: 5,
  applied: 2,
  skipped: 3,
  failed: 0
});
assert.deepStrictEqual(result.applied.map((entry) => entry.id), ["root", "b"]);
assert.deepStrictEqual(result.skipped.map((entry) => entry.id), [
  "a",
  "a-1",
  "a-1-x"
]);

const mixedLockTree = makeTree();
const mixedLockedAfterRestart = new Set(
  JSON.parse(JSON.stringify(["a-1", "b"]))
);
function applyMixedTree() {
  return runtime.applyToFolderTree(mixedLockTree, {
    skipDescendantsOfSkipped: true,
    skipFolder(folder) {
      return mixedLockedAfterRestart.has(folder.id) ? "locked" : "";
    },
    apply(folder) {
      folder.orderBy = "FILESIZE";
    }
  });
}
assert.deepStrictEqual(runtime.counts(applyMixedTree()), {
  total: 5,
  applied: 2,
  skipped: 3,
  failed: 0
});
assert.deepStrictEqual(runtime.counts(applyMixedTree()), {
  total: 5,
  applied: 2,
  skipped: 3,
  failed: 0
});
assert.deepStrictEqual(
  runtime.collectFolderTree(mixedLockTree).map((folder) => [
    folder.id,
    folder.orderBy
  ]),
  [
    ["root", "FILESIZE"],
    ["a", "FILESIZE"],
    ["a-1", undefined],
    ["a-1-x", undefined],
    ["b", undefined]
  ]
);

const rollbackTree = makeTree();
result = runtime.applyToFolderTree(rollbackTree, {
  snapshot(folder) {
    return {
      orderBy: folder.orderBy,
      hadOrderBy: Object.prototype.hasOwnProperty.call(folder, "orderBy")
    };
  },
  apply(folder) {
    folder.orderBy = "DURATION";
  }
});
const rolledBack = runtime.rollbackApplied(result, (folder, snapshot) => {
  if (snapshot.hadOrderBy) folder.orderBy = snapshot.orderBy;
  else delete folder.orderBy;
});
assert.strictEqual(rolledBack, 5);
assert.deepStrictEqual(
  runtime.collectFolderTree(rollbackTree).map((folder) => folder.orderBy),
  [undefined, undefined, undefined, undefined, undefined]
);

const repeatTree = makeTree();
function applySameTree() {
  return runtime.applyToFolderTree(repeatTree, {
    apply(folder) {
      folder.orderBy = "RESOLUTION";
      folder.sortIncrease = false;
    }
  });
}
assert.strictEqual(applySameTree().failures.length, 0);
assert.strictEqual(applySameTree().failures.length, 0);
assert.deepStrictEqual(
  runtime.collectFolderTree(repeatTree).map((folder) => [
    folder.orderBy,
    folder.sortIncrease
  ]),
  [
    ["RESOLUTION", false],
    ["RESOLUTION", false],
    ["RESOLUTION", false],
    ["RESOLUTION", false],
    ["RESOLUTION", false]
  ]
);

// Manual-order state cannot enter protected folders.
const manualTree = makeTree();
const manualProfiles = Object.create(null);
function applyManualMode() {
  return runtime.applyToFolderTree(manualTree, {
    skipFolder(folder) {
      return folder.id === "a-1-x" ? "locked" : "";
    },
    apply(folder) {
      if (folder.id === "a-1") throw new Error("storage denied");
      manualProfiles[folder.id] = { enabled: true };
    }
  });
}
assert.deepStrictEqual(runtime.counts(applyManualMode()), {
  total: 5,
  applied: 3,
  skipped: 1,
  failed: 1
});
assert.deepStrictEqual(Object.keys(manualProfiles).sort(), [
  "a",
  "b",
  "root"
]);
assert.strictEqual(manualProfiles["a-1-x"], undefined);
assert.deepStrictEqual(runtime.counts(applyManualMode()), {
  total: 5,
  applied: 3,
  skipped: 1,
  failed: 1
});
assert.strictEqual(manualProfiles.root.enabled, true);

const protectedForExecution = new Set(["a", "a-1-x"]);
const inheritedRenameProfiles = Object.create(null);
const renameStateResult = runtime.applyToFolderTree(makeTree(), {
  skipFolder(folder) {
    return protectedForExecution.has(folder.id) ? "locked" : "";
  },
  apply(folder) {
    inheritedRenameProfiles[folder.id] = {
      enabled: true,
      inherited: true
    };
  }
});
assert.strictEqual(runtime.counts(renameStateResult).applied, 3);
assert.strictEqual(inheritedRenameProfiles.a, undefined);
assert.strictEqual(inheritedRenameProfiles["a-1-x"], undefined);

const renameExecutionResult = runtime.applyToFolderTree(makeTree(), {
  skipFolder(folder) {
    return protectedForExecution.has(folder.id) ? "locked" : "";
  }
});
assert.deepStrictEqual(runtime.counts(renameExecutionResult), {
  total: 5,
  applied: 3,
  skipped: 2,
  failed: 0
});

console.log("folder-tree-batch-core tests passed");
