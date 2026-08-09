"use strict";

const assert = require("assert");
const {
  createScanContextKey,
  shouldRefreshAfterMetadataScan,
  canWarmTakenAtMetadata,
  reconcileMetadataPathHydration,
  nextMetadataRetryDelay
} = require("../lib/monitor-core.js");

const base = {
  contextId: "library-a|folder:seven-hills",
  orderBy: "PHOTO_TAKEN",
  metaType: "PHOTO_TAKEN",
  itemFingerprint: "11:123:456",
  rules: [
    { field: "NAME", direction: "asc" },
    { field: "TAKEN_AT", direction: "asc" }
  ],
  folderLocked: false
};

assert.strictEqual(
  createScanContextKey(base),
  createScanContextKey({ ...base, folderLocked: true }),
  "protection toggles must not request a metadata scan or list refresh"
);

assert.strictEqual(
  shouldRefreshAfterMetadataScan(base),
  false,
  "background metadata scans must not refresh the native grid"
);
assert.strictEqual(
  shouldRefreshAfterMetadataScan({ ...base, folderLocked: true }),
  false,
  "a protected collection must not refresh after startup or plugin-open scans"
);
assert.strictEqual(
  shouldRefreshAfterMetadataScan(base, { explicitSortChange: true }),
  true,
  "an explicit taken-time sort switch may refresh after metadata is installed"
);
assert.strictEqual(
  shouldRefreshAfterMetadataScan(base, { sortNeedsMetadata: true }),
  true,
  "a multi-level taken-time rule may refresh once after metadata is installed"
);
assert.strictEqual(
  shouldRefreshAfterMetadataScan(
    { ...base, folderLocked: true },
    { explicitSortChange: true }
  ),
  false,
  "a protected collection must never refresh after metadata scans"
);

// R53 qa.30 real-host regression: a smart folder that is visible in Eagle
// but has not entered the adapter's READY phase must not read its members,
// hydrate paths, access EXIF or write the timestamp cache.
assert.strictEqual(
  canWarmTakenAtMetadata({
    ...base,
    currentSmartFolderId: "MAX照片集",
    smartSnapshotPhase: "loading",
    smartSnapshotGeneration: 7
  }),
  false
);
const loadingTrap = {
  currentSmartFolderId: "MAX照片集",
  smartSnapshotPhase: "loading"
};
for (const key of ["items", "timestamps", "filePath", "exif"]) {
  Object.defineProperty(loadingTrap, key, {
    get() {
      throw new Error(`LOADING metadata gate accessed ${key}`);
    }
  });
}
assert.strictEqual(canWarmTakenAtMetadata(loadingTrap), false);
assert.strictEqual(
  canWarmTakenAtMetadata({
    ...base,
    currentSmartFolderId: "MAX照片集",
    smartSnapshotPhase: "ready",
    smartSnapshotGeneration: 7
  }),
  true
);
assert.strictEqual(
  canWarmTakenAtMetadata({ ...base, currentFolderId: "normal-folder" }),
  true,
  "normal-folder metadata behavior remains frozen"
);

for (const changed of [
  { itemFingerprint: "12:789:1011" },
  { orderBy: "PHOTO_TAKEN_AT" },
  { metaType: "MTIME" },
  { rules: [{ field: "NAME", direction: "desc" }] },
  { currentSmartFolderId: "smart-a" },
  { smartSnapshotGeneration: 8 }
]) {
  assert.notStrictEqual(
    createScanContextKey(base),
    createScanContextKey({ ...base, ...changed })
  );
}

const pathHydration = reconcileMetadataPathHydration(
  [
    { id: "ready", filePath: "/already/ready.jpg", ext: "jpg" },
    { id: "hydrated", filePath: "", ext: "jpg", name: "hydrated" },
    { id: "pathless", filePath: "", ext: "jpg", name: "pathless" },
    { id: "missing-response", filePath: "", ext: "mov" }
  ],
  [
    { id: "hydrated", filePath: "/resolved/hydrated.jpg", ext: "jpg", size: 12 },
    { id: "pathless", filePath: "", ext: "jpg", size: 0 }
  ]
);
assert.deepStrictEqual(
  pathHydration.items.map((item) => [item.id, item.filePath || ""]),
  [
    ["ready", "/already/ready.jpg"],
    ["hydrated", "/resolved/hydrated.jpg"],
    ["pathless", ""],
    ["missing-response", ""]
  ]
);
assert.deepStrictEqual(pathHydration.unresolvedIds, ["pathless", "missing-response"]);
assert.deepStrictEqual(pathHydration.missingResponseIds, ["missing-response"]);
assert.strictEqual(pathHydration.hydratedCount, 1);

assert.deepStrictEqual(
  [0, 5000, 10000, 30000, 60000].map((value) =>
    nextMetadataRetryDelay(value)
  ),
  [5000, 10000, 20000, 60000, 60000],
  "resource failures must back off instead of retrying every monitor tick"
);

console.log("monitor core tests passed");
