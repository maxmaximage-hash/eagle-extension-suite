"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  createTeamSortStateRuntime
} = require("../lib/team-sort-state-core");

const runtime = createTeamSortStateRuntime();
const isolatedRuntimeFactory = Function(
  "require",
  `"use strict"; return (${createTeamSortStateRuntime.toString()});`
)(require);
const isolatedRuntime = isolatedRuntimeFactory();
assert.strictEqual(
  isolatedRuntime.isLibraryReady("/Volumes/team.library"),
  true
);
const sourceLibraryId = "/Volumes/synthetic-source.library";
const folderIds = Array.from(
  { length: 99 },
  (_, index) => `folder-${String(index + 1).padStart(3, "0")}`
);
const folderStore = (count, valueFactory) => ({
  version: 1,
  libraries: {
    [sourceLibraryId]: {
      folders: Object.fromEntries(
        folderIds.slice(0, count).map((folderId, index) => [
          folderId,
          valueFactory(folderId, index)
        ])
      )
    }
  }
});
const state = runtime.createState({
  libraryId: sourceLibraryId,
  pluginVersion: "2.5.22-qa.34",
  folders: folderIds.map((id) => ({ id })),
  storage: {
    "eagle.list.meta.type": "PHOTO_TAKEN",
    ["eagle.list.orderBy." + sourceLibraryId]: "PHOTO_TAKEN",
    ["eagle.list.sortIncrease." + sourceLibraryId]: true,
    "eagle.photoTakenSort.autoRename.v1": folderStore(4, () => true),
    "eagle.photoTakenSort.rules.v2": folderStore(99, () => ({
      rules: [{ field: "TAKEN_AT", direction: "asc" }]
    })),
    "eagle.photoTakenSort.folderLocks.v1": folderStore(17, () => ({
      lockedAt: 1
    })),
    "eagle.photoTakenSort.metaProfiles.v1": folderStore(85, () => ({
      enabled: true
    }))
  }
});
const verification = runtime.verifyState(state);
assert.strictEqual(verification.ok, true);
assert.strictEqual(isolatedRuntime.verifyState(state).ok, true);
assert.match(verification.payloadSha256, /^[a-f0-9]{64}$/);

const nasLibrary = "/Volumes/synthetic-target.library";
const mapped = runtime.mappedEntries(state, nasLibrary, {
  includeAutoRename: false
});
assert.strictEqual(mapped.sourceLibraryId, state.libraries[0]);
assert.strictEqual(mapped.currentLibraryId, nasLibrary);
assert.ok(mapped.skipped.includes("eagle.photoTakenSort.autoRename.v1"));
assert.ok(
  mapped.entries.some((entry) =>
    entry.key === "eagle.list.sortIncrease." + nasLibrary
  )
);
assert.strictEqual(
  runtime.countMappedFolders(
    mapped.entries,
    "eagle.photoTakenSort.rules.v2"
  ),
  99
);
assert.strictEqual(
  runtime.countMappedFolders(
    mapped.entries,
    "eagle.photoTakenSort.folderLocks.v1"
  ),
  17
);
assert.strictEqual(
  runtime.countMappedFolders(
    mapped.entries,
    "eagle.photoTakenSort.metaProfiles.v1"
  ),
  85
);

const rules = mapped.entries.find(
  (entry) => entry.key === "eagle.photoTakenSort.rules.v2"
).value;
assert.ok(rules.libraries[nasLibrary]);
assert.strictEqual(rules.libraries[state.libraries[0]], undefined);

const decodedNasLibrary = decodeURIComponent(nasLibrary);
const scopedStore = {
  version: 1,
  libraries: {
    [nasLibrary]: {
      folders: {
        M7TDBVP0DW0VR: { lockedAt: 1784221182001 }
      }
    }
  }
};
assert.strictEqual(
  runtime.normalizeLibraryId(nasLibrary),
  decodedNasLibrary
);
assert.strictEqual(
  runtime.resolveLibraryStore(scopedStore, decodedNasLibrary, false)
    .folders.M7TDBVP0DW0VR.lockedAt,
  1784221182001
);
assert.strictEqual(
  runtime.resolveLibraryStore(scopedStore, decodedNasLibrary, false),
  scopedStore.libraries[nasLibrary]
);
assert.strictEqual(
  runtime.resolveLibraryStore(scopedStore, "/Volumes/missing.library", false),
  null
);
assert.strictEqual(runtime.isLibraryReady("default"), false);
assert.strictEqual(runtime.isLibraryReady(nasLibrary), true);

assert.strictEqual(
  runtime.statePathForLibrary(decodedNasLibrary),
  decodedNasLibrary + ".eagle-team-state.json"
);

const exportedState = runtime.createState({
  libraryId: decodedNasLibrary,
  pluginVersion: "2.5.0",
  folders: [
    {
      id: "root",
      children: [
        { id: "child-a" },
        { id: "child-b", children: [{ id: "child-c" }] }
      ]
    }
  ],
  storage: {
    "eagle.list.meta.type": "PHOTO_TAKEN",
    ["eagle.list.orderBy." + decodedNasLibrary]: "PHOTO_TAKEN",
    ["eagle.list.sortIncrease." + decodedNasLibrary]: false,
    "eagle.photoTakenSort.autoRename.v1": {
      version: 1,
      libraries: {
        [decodedNasLibrary]: { folders: { "child-a": true } },
        "/Volumes/other.library": { folders: { wrong: true } }
      }
    },
    "eagle.photoTakenSort.folderLocks.v1": {
      version: 1,
      libraries: {
        [decodedNasLibrary]: {
          folders: { "child-b": { lockedAt: 1 } }
        }
      }
    },
    "eagle.photoTakenSort.protection.v2": {
      version: 2,
      libraries: {
        [decodedNasLibrary]: {
          folders: {
            "child-b": {
              protected: true,
              config: { orderBy: "PHOTO_TAKEN", sortIncrease: true }
            }
          },
          smartFolders: {},
          global: null
        }
      }
    },
    "eagle.photoTakenSort.manualViews.v2": {
      version: 2,
      libraries: {
        [decodedNasLibrary]: {
          folders: {},
          smartFolders: {
            "smart-a": { order: ["item-b", "item-a"], moves: 1 }
          },
          global: null
        }
      }
    }
  }
});
assert.strictEqual(runtime.verifyState(exportedState).ok, true);
assert.strictEqual(exportedState.schemaVersion, 2);
assert.strictEqual(exportedState.identity.folderCount, 4);
assert.strictEqual(
  exportedState.storage["eagle.list.meta.type"],
  "PHOTO_TAKEN"
);
assert.strictEqual(
  exportedState.storage["eagle.list.orderBy." + decodedNasLibrary],
  "PHOTO_TAKEN"
);
assert.deepStrictEqual(
  Object.keys(
    exportedState.storage["eagle.photoTakenSort.autoRename.v1"].libraries
  ),
  [decodedNasLibrary]
);
assert.ok(
  exportedState.storage["eagle.photoTakenSort.protection.v2"]
    .libraries[decodedNasLibrary].folders["child-b"].protected
);
assert.deepStrictEqual(
  exportedState.storage["eagle.photoTakenSort.manualViews.v2"]
    .libraries[decodedNasLibrary].smartFolders["smart-a"].order,
  ["item-b", "item-a"]
);

const compatible = runtime.targetLibraryCompatibility(exportedState, [
  { id: "root" },
  { id: "child-a" },
  { id: "child-b" },
  { id: "child-c" },
  { id: "new-folder" }
]);
assert.strictEqual(compatible.ok, true);
assert.strictEqual(compatible.matched, 4);
assert.strictEqual(compatible.missing.length, 0);

const partlyCompatible = runtime.targetLibraryCompatibility(exportedState, [
  { id: "root" },
  { id: "child-a" },
  { id: "child-b" }
]);
assert.strictEqual(partlyCompatible.ok, false);
assert.strictEqual(partlyCompatible.missing.length, 1);

const wrongLibrary = runtime.targetLibraryCompatibility(exportedState, [
  { id: "other-1" },
  { id: "other-2" },
  { id: "other-3" },
  { id: "other-4" }
]);
assert.strictEqual(wrongLibrary.ok, false);
assert.strictEqual(wrongLibrary.matched, 0);

const exportedMapped = runtime.mappedEntries(
  exportedState,
  "/Volumes/team-copy.library",
  { includeAutoRename: false }
);
assert.ok(
  exportedMapped.entries.some(
    (entry) => entry.key === "eagle.list.orderBy./Volumes/team-copy.library"
  )
);
assert.ok(
  exportedMapped.skipped.includes("eagle.photoTakenSort.autoRename.v1")
);

const mergedStore = runtime.mergeMappedValue(
  {
    version: 1,
    libraries: {
      default: { folders: { stale: true } },
      "/Volumes/other.library": { folders: { other: true } }
    }
  },
  rules
);
assert.ok(mergedStore.libraries.default.folders.stale);
assert.ok(mergedStore.libraries["/Volumes/other.library"].folders.other);
assert.ok(mergedStore.libraries[nasLibrary]);
assert.strictEqual(
  runtime.containsMappedLibrary(mergedStore, rules, decodedNasLibrary),
  true
);
assert.strictEqual(
  runtime.containsMappedLibrary(
    { version: 2, libraries: { [nasLibrary]: { folders: {} } } },
    rules,
    decodedNasLibrary
  ),
  false
);

console.log("team sort state core tests passed");
