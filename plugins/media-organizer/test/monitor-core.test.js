"use strict";

const assert = require("assert");
const {
  createScanContextKey,
  shouldRefreshAfterMetadataScan
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

for (const changed of [
  { itemFingerprint: "12:789:1011" },
  { orderBy: "PHOTO_TAKEN_AT" },
  { metaType: "MTIME" },
  { rules: [{ field: "NAME", direction: "desc" }] }
]) {
  assert.notStrictEqual(
    createScanContextKey(base),
    createScanContextKey({ ...base, ...changed })
  );
}

console.log("monitor core tests passed");
