"use strict";

const assert = require("assert");
const { createFolderLevelRuntime } = require("../lib/folder-level-core");

const runtime = createFolderLevelRuntime();
const isolatedFactory = Function(
  `"use strict"; return (${createFolderLevelRuntime.toString()});`
)();
assert.strictEqual(isolatedFactory().numberedName("２－ 土耳其", 1), "1-土耳其");

assert.strictEqual(runtime.stripOrdinalPrefix(" 12-伊斯坦布尔 "), "伊斯坦布尔");
assert.strictEqual(runtime.stripOrdinalPrefix("３—卡帕多奇亚"), "卡帕多奇亚");
assert.strictEqual(runtime.numberedName("2-安卡拉", 1), "1-安卡拉");

const tree = {
  id: "portfolio",
  name: "作品集",
  children: [
    {
      id: "middle-east",
      name: "1-中东",
      children: [
        {
          id: "turkey",
          name: "2-土耳其",
          children: [
            { id: "istanbul", name: "1-伊斯坦布尔", children: [] },
            { id: "ankara", name: "2-安卡拉", children: [] }
          ]
        }
      ]
    },
    { id: "europe", name: "2-欧洲", children: [] }
  ]
};

assert.deepStrictEqual(
  runtime.descendants(tree).map((folder) => folder.id),
  ["middle-east", "turkey", "istanbul", "ankara", "europe"]
);
assert.deepStrictEqual(
  runtime.currentTarget({ folder: tree, directMedia: [], showSubfolderContent: false }),
  { kind: "direct-folders", items: tree.children, count: 2 }
);
assert.deepStrictEqual(
  runtime.currentTarget({
    folder: tree,
    directMedia: [{ id: "descendant-media" }],
    showSubfolderContent: true
  }),
  { kind: "direct-folders", items: tree.children, count: 2 }
);

const unlocked = runtime.actionAvailability({
  folder: tree.children[0].children[0],
  directMedia: [],
  showSubfolderContent: false,
  collectionKind: "normal",
  locked: false
});
assert.strictEqual(unlocked.targetKind, "direct-folders");
assert.strictEqual(unlocked.canManualDrag, true);
assert.strictEqual(unlocked.canAutoNumber, true);
assert.strictEqual(unlocked.canApplyToDescendants, true);

// Eagle can retain the previous normal folder while a smart folder is active.
// Smart collection identity must win over that stale writable folder tree.
const smartWithStaleFolder = runtime.actionAvailability({
  folder: tree,
  directMedia: [{ id: "smart-a" }, { id: "smart-b" }],
  collectionKind: "smart",
  locked: false
});
assert.strictEqual(smartWithStaleFolder.targetKind, "direct-media");
assert.strictEqual(smartWithStaleFolder.targetCount, 2);
assert.strictEqual(smartWithStaleFolder.canManualDrag, true);
assert.strictEqual(smartWithStaleFolder.canAutoNumber, false);
assert.strictEqual(smartWithStaleFolder.canApplyToDescendants, false);

const locked = runtime.actionAvailability({
  folder: tree,
  directMedia: [{ id: "image" }],
  collectionKind: "normal",
  locked: true
});
assert.strictEqual(locked.canToggleLock, true);
assert.strictEqual(locked.canManualDrag, false);
assert.strictEqual(locked.canAutoNumber, false);
assert.strictEqual(locked.canChangeSort, false);
assert.strictEqual(locked.canApplyToDescendants, false);

const rename = runtime.buildFolderRenamePlan([
  { id: "b", name: "2-安卡拉" },
  { id: "a", name: "1-伊斯坦布尔" },
  { id: "c", name: "无编号" }
], { token: "test" });
assert.deepStrictEqual(
  rename.entries.map((entry) => [entry.id, entry.newName]),
  [
    ["b", "1-安卡拉"],
    ["a", "2-伊斯坦布尔"],
    ["c", "3-无编号"]
  ]
);
assert.deepStrictEqual(
  rename.phases.temporary.map((entry) => entry.name),
  [
    "__eagle_folder_number_test_1",
    "__eagle_folder_number_test_2",
    "__eagle_folder_number_test_3"
  ]
);

const cascade = runtime.applyModeToTree(
  tree,
  true,
  (folder) => folder.id === "turkey"
);
assert.deepStrictEqual(cascade.skipped, ["turkey"]);
assert.deepStrictEqual(
  cascade.applied.map((entry) => entry.id),
  ["portfolio", "middle-east", "istanbul", "ankara", "europe"]
);

console.log("folder-level core tests passed");
