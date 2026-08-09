"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createCollectionRuntime } = require("../lib/collection-core");

const runtime = createCollectionRuntime();
const isolatedFactory = Function(
  `"use strict"; return (${createCollectionRuntime.toString()});`
)();
assert.strictEqual(isolatedFactory().COLLECTION_STATE_VERSION, 2);

const libraryId = "/Volumes/team.library";
const normal = runtime.create("normal", { id: "same", name: "普通" }, libraryId);
const smart = runtime.create("smart", { id: "same", name: "智能" }, libraryId);
assert.notStrictEqual(normal.key, smart.key);
assert.strictEqual(normal.supportsTree, true);
assert.strictEqual(smart.isVirtual, true);
assert.strictEqual(
  runtime.fromContext({
    currentSmartFolder: { id: "smart-1", name: "跨来源" },
    rootDir: libraryId
  }).kind,
  "smart"
);
assert.strictEqual(
  runtime.fromContext({
    currentFolder: { id: "stale-normal", name: "旧普通文件夹" },
    currentSmartFolder: { id: "smart-1", name: "跨来源" },
    rootDir: libraryId
  }).kind,
  "smart",
  "smart folder must win while Eagle retains a stale currentFolder"
);
assert.deepStrictEqual(
  runtime.fromContext({
    currentFolder: { id: "stale-normal", name: "旧普通文件夹" },
    locationHash: "#!?view=smartfolder&smartfolder=smart-route",
    rootDir: libraryId
  }),
  runtime.create("smart", { id: "smart-route" }, libraryId),
  "the explicit Eagle smart-folder route must win before currentSmartFolder settles"
);
assert.deepStrictEqual(
  runtime.fromContext({
    currentFolder: { id: "stale-normal", name: "旧普通文件夹" },
    locationHash: "#!?view=folder&folder=normal-route",
    rootDir: libraryId
  }),
  runtime.create("normal", { id: "normal-route" }, libraryId),
  "R79: the explicit Eagle normal-folder route must win before Angular currentFolder settles"
);
assert.deepStrictEqual(
  runtime.fromContext({
    currentFolder: { id: "stale-normal", name: "旧普通文件夹" },
    locationHash: "#!?view=all",
    rootDir: libraryId
  }),
  runtime.create("global", { id: "global", name: "全部" }, libraryId),
  "R52: an explicit all route must win before Eagle clears a stale currentFolder"
);
assert.strictEqual(
  runtime.fromContext({
    currentFolder: { id: "stale-normal" },
    currentSmartFolder: { id: "stale-smart" },
    locationHash: "#!?view=global",
    rootDir: libraryId
  }).kind,
  "global",
  "R52: global is an explicit route alias, not a stale collection fallback"
);
assert.strictEqual(
  runtime.fromContext({
    view: "unknown",
    currentFolder: { id: "stale-normal" },
    rootDir: libraryId
  }).kind,
  "global",
  "R52: unknown view must fail open instead of inheriting a stale folder"
);

const wholeLibrary = Array.from({ length: 24185 }, (_, index) => ({
  id: `raw-${index}`,
  folders: ["somewhere-else"]
}));
const smartResults = Array.from({ length: 96 }, (_, index) => ({
  id: `smart-${index}`
}));
assert.strictEqual(runtime.scopedItems({
  currentFolder: { id: "stale-normal" },
  currentSmartFolder: { id: "smart-1" },
  allData: smartResults,
  raw: wholeLibrary
}).length, 96);
assert.strictEqual(runtime.scopedItems({
  currentFolder: { id: "stale-normal" },
  locationHash: "#!?view=smartfolder&smartfolder=smart-route",
  allData: smartResults,
  raw: wholeLibrary
}).length, 96, "route-owned smart results must not fall back to the stale folder");
const normalRouteResults = [{ id: "normal-route-item" }];
assert.strictEqual(runtime.scopedItems({
  currentFolder: { id: "stale-normal" },
  locationHash: "#!?view=folder&folder=normal-route",
  allData: normalRouteResults,
  raw: wholeLibrary
}), normalRouteResults, "R79: a route-owned normal folder must use only its current-view array");
assert.deepStrictEqual(runtime.scopedItems({
  currentSmartFolder: { id: "empty-smart" },
  allData: [],
  raw: wholeLibrary
}), [], "an empty smart result must never fall through to the full library");
const nativeAllOrder = Object.freeze([
  { id: "added-3", get folders() { throw new Error("global must not inspect folders"); } },
  { id: "added-1", get folders() { throw new Error("global must not inspect folders"); } },
  { id: "added-2", get folders() { throw new Error("global must not inspect folders"); } }
]);
const allFirstFrame = runtime.scopedItems({
  currentFolder: { id: "stale-normal" },
  locationHash: "#!?view=all",
  allData: nativeAllOrder,
  raw: wholeLibrary
});
assert.strictEqual(
  allFirstFrame,
  nativeAllOrder,
  "R52: all-view first frame must return Eagle's input array without old-folder filtering"
);
assert.deepStrictEqual(
  allFirstFrame.map((item) => item.id),
  ["added-3", "added-1", "added-2"],
  "R52: native added-date order must remain byte-for-byte positional input"
);
assert.deepStrictEqual(runtime.scopedItems({
  currentFolder: { id: "stale-normal" },
  locationHash: "#!?view=all",
  allData: [],
  raw: wholeLibrary
}), [], "R52: an empty all view must not fall through to raw or scan the whole library");
assert.deepStrictEqual(runtime.scopedItems({
  view: "unknown",
  currentFolder: { id: "stale-normal" },
  allData: [],
  raw: wholeLibrary
}), [], "R52: unknown view must not inspect or fall through to raw");
assert.strictEqual(runtime.scopedItems({
  currentFolder: { id: "direct-folder" },
  raw: [
    { id: "direct", folders: ["direct-folder"] },
    { id: "other", folders: ["other-folder"] }
  ]
}).length, 1);
assert.deepStrictEqual(runtime.applyScope(smart), {
  kind: "smart-only",
  collectionCount: 1,
  description: "仅当前智能文件夹"
});
assert.deepStrictEqual(runtime.applyScope(normal, [{}, {}, {}]), {
  kind: "normal-tree",
  collectionCount: 3,
  description: "当前普通文件夹及全部子文件夹"
});

const protectionStore = runtime.emptyStore();
runtime.setProfile(protectionStore, libraryId, normal, {
  protected: true,
  config: { orderBy: "PHOTO_TAKEN", sortIncrease: true }
});
runtime.setProfile(protectionStore, libraryId, smart, {
  protected: true,
  config: { orderBy: "PHOTO_TAKEN", sortIncrease: false }
});
assert.strictEqual(
  runtime.profile(protectionStore, libraryId, normal).config.sortIncrease,
  true
);
assert.strictEqual(
  runtime.profile(protectionStore, libraryId, smart).config.sortIncrease,
  false
);

// A smart-folder manual overlay is isolated from every source folder.
const manualStore = runtime.emptyStore();
runtime.setProfile(manualStore, libraryId, smart, {
  order: ["mixed-b", "mixed-a"],
  moves: 1
});
assert.strictEqual(runtime.profile(manualStore, libraryId, normal), null);
const sourceA = runtime.create("normal", { id: "source-a" }, libraryId);
const sourceB = runtime.create("normal", { id: "source-b" }, libraryId);
assert.strictEqual(runtime.profile(manualStore, libraryId, sourceA), null);
assert.strictEqual(runtime.profile(manualStore, libraryId, sourceB), null);
assert.deepStrictEqual(
  runtime.sourceFolderSummary([
    { id: "mixed-a", folders: ["source-a"] },
    { id: "mixed-b", folders: [{ id: "source-b" }, "source-a"] }
  ]),
  [
    { id: "source-a", itemCount: 2 },
    { id: "source-b", itemCount: 1 }
  ]
);
const reloadedManualStore = JSON.parse(JSON.stringify(manualStore));
assert.deepStrictEqual(
  runtime.profile(reloadedManualStore, libraryId, smart).order,
  ["mixed-b", "mixed-a"]
);

// The real handoff state has 17 protection flags and 809 obsolete item IDs.
const teamState = JSON.parse(fs.readFileSync(path.join(
  __dirname,
  "..",
  "defaults",
  "sort-state",
  "team.eagle-sort-state.json"
), "utf8"));
const legacyStore = teamState.storage["eagle.photoTakenSort.folderLocks.v1"];
const migration = runtime.migrateLegacyProtection(legacyStore);
assert.strictEqual(migration.protectedCount, 17);
assert.strictEqual(migration.ignoredOrderCount, 809);
const migratedLibraryId = Object.keys(migration.store.libraries)[0];
const migratedProfiles = Object.values(
  migration.store.libraries[migratedLibraryId].folders
);
assert.strictEqual(migratedProfiles.length, 17);
for (const profile of migratedProfiles) {
  assert.strictEqual(profile.protected, true);
  assert.ok(profile.config);
  assert.strictEqual(Object.hasOwn(profile, "order"), false);
  assert.strictEqual(profile.legacyOrderDiagnostic.ignored, true);
}
const repeatedMigration = runtime.migrateLegacyProtection(
  legacyStore,
  migration.store
);
assert.strictEqual(repeatedMigration.protectedCount, 17);
assert.strictEqual(repeatedMigration.ignoredOrderCount, 809);
assert.strictEqual(
  Object.keys(repeatedMigration.store.libraries[migratedLibraryId].folders)
    .length,
  17
);

// Old team protection must become a visible highest-priority hard lock.
const existingLocks = runtime.emptyStore();
const existingLibrary = runtime.ensureLibrary(
  existingLocks,
  migratedLibraryId,
  true
);
existingLibrary.folders.MKPBIEGNPKQR9 = {
  locked: true,
  mode: "hard"
};
existingLibrary.folders.MLTB7G3NNV261 = {
  locked: false,
  mode: "legacy-suppressed",
  legacySuppressed: true
};
const visibleMigration = runtime.mergeLegacyProtectionIntoLocks(
  migration.store,
  existingLocks
);
assert.strictEqual(visibleMigration.importedCount, 15);
assert.strictEqual(visibleMigration.preservedCount, 1);
assert.strictEqual(visibleMigration.suppressedCount, 1);
assert.strictEqual(
  visibleMigration.store.libraries[migratedLibraryId]
    .folders.MKPBIEGNPKQR9.mode,
  "hard"
);
assert.strictEqual(
  visibleMigration.store.libraries[migratedLibraryId]
    .folders.MLTB7G3NNV261.legacySuppressed,
  true
);
const importedProtection = Object.values(
  visibleMigration.store.libraries[migratedLibraryId].folders
).find((profile) => profile.migratedFrom === "folderLocks.v1");
assert.ok(importedProtection);
assert.strictEqual(importedProtection.locked, true);
assert.strictEqual(importedProtection.mode, "hard");
const repeatedVisibleMigration = runtime.mergeLegacyProtectionIntoLocks(
  migration.store,
  visibleMigration.store
);
assert.strictEqual(repeatedVisibleMigration.importedCount, 0);
assert.strictEqual(repeatedVisibleMigration.preservedCount, 16);
assert.strictEqual(repeatedVisibleMigration.suppressedCount, 1);

console.log("collection core tests passed");
