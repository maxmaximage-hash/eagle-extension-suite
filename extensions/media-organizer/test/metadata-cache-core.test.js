"use strict";

const assert = require("assert");
const {
  CACHE_SCHEMA_VERSION,
  createMetadataCacheRuntime
} = require("../lib/metadata-cache-core.js");

const runtime = createMetadataCacheRuntime({
  normalizeLibraryId: (value) => String(value || "").replace(/\/+$/, "")
});

const migrated = runtime.load({
  version: 2,
  libraryPath: "/nas/library-a.library/",
  items: {
    photo: {
      signature: "12:1700000000000",
      hostSignature: "12:1700000000000",
      mediaType: "image",
      takenAt: 123
    }
  }
});
assert.strictEqual(migrated.version, CACHE_SCHEMA_VERSION);
assert.strictEqual(migrated.activeLibraryId, "");

runtime.activate(migrated, "/nas/library-b.library");
assert.strictEqual(migrated.activeLibraryId, "/nas/library-b.library");
assert.deepStrictEqual(
  runtime.items(migrated),
  {},
  "loading an old cache must not reactivate or overwrite the current Library"
);

runtime.activate(migrated, "/nas/library-a.library");
assert.strictEqual(
  runtime.lookup(migrated, {
    id: "photo",
    size: 12,
    modifiedAt: 1700000000000
  }).value,
  123,
  "the official Eagle modifiedAt field must validate a cached timestamp"
);

runtime.activate(migrated, "/nas/library-b.library");
runtime.write(migrated, {
  id: "video",
  size: 34,
  modifiedAt: 1700000000100
}, {
  mediaType: "video",
  takenAt: 456
});
assert.strictEqual(runtime.lookup(migrated, {
  id: "video",
  size: 34,
  modifiedAt: 1700000000100
}).value, 456);

runtime.write(migrated, {
  id: "late-photo",
  size: 56,
  modifiedAt: 1700000000200
}, {
  mediaType: "image",
  takenAt: 789
}, "/nas/library-a.library");
assert.strictEqual(
  runtime.lookup(migrated, {
    id: "late-photo",
    size: 56,
    modifiedAt: 1700000000200
  }).hit,
  false,
  "a late scan from Library A must never write into active Library B"
);
assert.strictEqual(
  runtime.lookup(migrated, {
    id: "late-photo",
    size: 56,
    modifiedAt: 1700000000200
  }, "/nas/library-a.library").value,
  789,
  "a late scan may only commit into the Library partition it originally captured"
);

runtime.activate(migrated, "/nas/library-a.library");
assert.strictEqual(runtime.lookup(migrated, {
  id: "photo",
  size: 12,
  modifiedAt: 1700000000000
}).hit, true, "switching back must preserve the first Library cache");
assert.strictEqual(runtime.lookup(migrated, {
  id: "photo",
  size: 12,
  modifiedAt: 1700000000001
}).hit, false, "changed host identity must invalidate stale metadata");

assert.deepStrictEqual(
  Object.keys(runtime.serialize(migrated).libraries).sort(),
  ["/nas/library-a.library", "/nas/library-b.library"],
  "the durable cache must retain independent Library partitions"
);

runtime.activate(migrated, "/nas/library-a.library");
runtime.write(migrated, {
  id: "snapshot-needs-hydration",
  size: 99,
  modifiedAt: 1700000000400
}, {
  mediaType: "image",
  takenAt: 999
});
const provisionalPlan = runtime.classify(migrated, [
  { id: "snapshot-needs-hydration", ext: "jpg" }
]);
assert.deepStrictEqual(
  provisionalPlan.misses.map((item) => item.id),
  ["snapshot-needs-hydration"],
  "a smart snapshot without identity fields may require lightweight hydration"
);
const hydratedPlan = runtime.classify(migrated, [
  {
    id: "snapshot-needs-hydration",
    ext: "jpg",
    filePath: "/nas/photo.jpg",
    size: 99,
    modifiedAt: 1700000000400
  }
]);
assert.deepStrictEqual(
  hydratedPlan.hits,
  [{
    item: {
      id: "snapshot-needs-hydration",
      ext: "jpg",
      filePath: "/nas/photo.jpg",
      size: 99,
      modifiedAt: 1700000000400
    },
    value: 999
  }],
  "R67: identity hydration must be followed by a second cache lookup before any original-file read"
);
assert.deepStrictEqual(hydratedPlan.misses, []);

console.log("metadata cache core tests passed");
