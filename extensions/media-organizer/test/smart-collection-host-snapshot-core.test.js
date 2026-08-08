"use strict";

const assert = require("assert");
const {
  createSmartCollectionHostSnapshotAdapter,
  selectSmartQuerySource
} = require("../lib/smart-collection-host-snapshot-core");

const items = (count, prefix = "item") =>
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}` }));

function observation(overrides = {}) {
  return {
    libraryId: "library",
    collectionId: "smart-a",
    sourceIdentity: "eagle-smart-query:smart-a",
    queryEpoch: "epoch-1",
    members: items(538, "member"),
    visibleIds: items(538, "member").map((item) => item.id),
    queryComplete: true,
    stable: true,
    ...overrides
  };
}

const adapter = createSmartCollectionHostSnapshotAdapter();
let snapshot = adapter.enter({ libraryId: "library", collectionId: "smart-a" });
assert.strictEqual(snapshot.phase, "loading");

// R53 qa.30 real-host regression: Eagle may expose the completed smart
// query through the explicit `filtereds` slot while that array is also the
// current allData reference. The property ownership is the contract; array
// identity alone is not proof that it is a library fallback.
const liveMembers = items(538, "live");
const liveSource = selectSmartQuerySource({
  filtereds: liveMembers,
  allData: liveMembers,
  raw: items(24319, "raw")
});
assert.strictEqual(liveSource.kind, "filtered-query");
assert.strictEqual(liveSource.members.length, 538);
assert.strictEqual(liveSource.sourceIdentity, "eagle-smart-query:filtereds");

// R53 Phase 3 live-host regression: qa.29's successful currentItems path can
// expose the completed smart result in allData while filtereds is empty. It is
// trusted only with explicit smart-route/collection/visible consistency and a
// distinct current-view reference; this is not a generic allData fallback.
const liveCurrentView = items(571, "live-current");
const liveCurrentSource = selectSmartQuerySource({
  allData: liveCurrentView,
  filtereds: [],
  raw: items(24319, "raw-current"),
  smartQueryEvidence: {
    routeKind: "smart",
    collectionId: "smart-live-current",
    currentSmartFolderId: "smart-live-current",
    sourceReference: liveCurrentView,
    visibleIds: liveCurrentView.slice(0, 120).map((item) => item.id),
    visibleConsistent: true
  }
});
assert.strictEqual(liveCurrentSource.kind, "filtered-query");
assert.strictEqual(liveCurrentSource.members.length, 571);
assert.strictEqual(liveCurrentSource.sourceIdentity, "eagle-smart-query:current-view");

// A provisional allData/raw alias has no smart-query ownership evidence and
// remains fail-open even if a stale smart route is present.
const provisionalAlias = items(24319, "provisional-alias");
assert.strictEqual(selectSmartQuerySource({
  allData: provisionalAlias,
  filtereds: [],
  raw: provisionalAlias,
  smartQueryEvidence: {
    routeKind: "smart",
    collectionId: "smart-live-current",
    currentSmartFolderId: "smart-live-current",
    sourceReference: provisionalAlias,
    visibleIds: provisionalAlias.slice(0, 120).map((item) => item.id),
    visibleConsistent: true
  }
}).kind, "untrusted");

// A generic allData/raw buffer is still never promoted to a smart source.
assert.strictEqual(selectSmartQuerySource({
  allData: items(24319, "all"),
  raw: items(24319, "raw")
}).kind, "untrusted");
const rawAlias = items(24319, "raw-alias");
assert.strictEqual(selectSmartQuerySource({
  filtereds: rawAlias,
  raw: rawAlias
}).kind, "untrusted");

const liveHost = createSmartCollectionHostSnapshotAdapter();
liveHost.enter({ libraryId: "library", collectionId: "smart-live" });
const liveObservation = observation({
  collectionId: "smart-live",
  sourceIdentity: "eagle-smart-query:filtereds",
  queryEpoch: "route-1:filtered-ref-1",
  members: liveSource.members,
  visibleIds: liveMembers.map((item) => item.id)
});
assert.strictEqual(liveHost.observe(liveObservation).phase, "loading");
assert.strictEqual(liveHost.observe(liveObservation).phase, "ready");

// R53: an allData/raw source is never a smart-query member source, even when
// it is visible and otherwise looks stable.
snapshot = adapter.observe(observation({
  sourceIdentity: "eagle-allData:smart-a",
  queryEpoch: "provisional-all",
  members: items(24319, "all"),
  visibleIds: items(24319, "all").map((item) => item.id)
}));
assert.strictEqual(snapshot.phase, "loading");
assert.strictEqual(snapshot.members.length, 0);

// One host observation establishes the candidate, a continuous second
// observation establishes READY. This is event stability, not a sleep.
snapshot = adapter.observe(observation());
assert.strictEqual(snapshot.phase, "loading");
snapshot = adapter.observe(observation());
assert.strictEqual(snapshot.phase, "ready");
assert.strictEqual(snapshot.members.length, 538);
assert.strictEqual(snapshot.visibleIds.length, 538);
assert.ok(snapshot.memberFingerprint);

// A legal smart query may match the entire library. Source identity and epoch,
// not count comparison, decide whether it is eligible.
const allLibrary = createSmartCollectionHostSnapshotAdapter();
allLibrary.enter({ libraryId: "library", collectionId: "smart-all" });
const allQuery = observation({
  collectionId: "smart-all",
  sourceIdentity: "eagle-smart-query:smart-all",
  queryEpoch: "epoch-all",
  members: items(24319, "library"),
  visibleIds: items(24319, "library").map((item) => item.id)
});
allLibrary.observe(allQuery);
snapshot = allLibrary.observe(allQuery);
assert.strictEqual(snapshot.phase, "ready");
assert.strictEqual(snapshot.members.length, 24319);

// A transient empty observation never overwrites the stable member snapshot.
snapshot = adapter.observe(observation({
  members: [],
  visibleIds: [],
  queryComplete: false,
  stable: false,
  queryEpoch: "epoch-empty"
}));
assert.strictEqual(snapshot.phase, "loading");
assert.strictEqual(snapshot.members.length, 0);
snapshot = adapter.observe(observation({
  members: [], visibleIds: [], queryEpoch: "epoch-empty"
}));
assert.strictEqual(snapshot.phase, "loading");
snapshot = adapter.observe(observation({
  members: [], visibleIds: [], queryEpoch: "epoch-empty"
}));
assert.strictEqual(snapshot.phase, "empty");

// Route changes create a new generation and reject old observations.
const next = adapter.enter({ libraryId: "library", collectionId: "smart-b" });
snapshot = adapter.observe(observation({ collectionId: "smart-a" }));
assert.strictEqual(snapshot.generation, next.generation);
assert.strictEqual(snapshot.phase, "loading");

console.log("smart collection host snapshot core tests passed");
