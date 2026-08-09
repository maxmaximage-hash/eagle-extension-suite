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
    completeness: { verifiedComplete: true },
    ...overrides
  };
}

const adapter = createSmartCollectionHostSnapshotAdapter();
let snapshot = adapter.enter({ libraryId: "library", collectionId: "smart-a" });
assert.strictEqual(snapshot.phase, "loading");

const membershipAdapter = createSmartCollectionHostSnapshotAdapter();
const membershipItems = [{ id: "c" }, { id: "a" }, { id: "b" }];
assert.strictEqual(
  membershipAdapter.fingerprint(membershipItems),
  membershipAdapter.fingerprint(membershipItems.slice().reverse()),
  "R69: smart query membership identity must be independent of plugin presentation order"
);
assert.notStrictEqual(
  membershipAdapter.fingerprint(membershipItems),
  membershipAdapter.fingerprint([{ id: "c" }, { id: "a" }, { id: "d" }]),
  "R69: a real member replacement must still change query identity"
);

// R53 qa.30 real-host regression: Eagle may expose the completed smart
// query through the explicit `filtereds` slot while that array is also the
// current allData reference. The property ownership is the contract; array
// identity alone is not proof that it is a library fallback.
const liveMembers = items(538, "live");
const liveSource = selectSmartQuerySource({
  filtereds: liveMembers,
  allData: liveMembers,
  raw: items(24319, "raw"),
  smartQueryEvidence: {
    routeKind: "smart",
    collectionId: "smart-live",
    currentSmartFolderId: "smart-live",
    filteredReference: liveMembers,
    currentViewReference: liveMembers,
    visibleIds: liveMembers.slice(0, 120).map((item) => item.id),
    queryIdentity: "smart-live:query-1"
  }
});
assert.strictEqual(liveSource.kind, "filtered-query");
assert.strictEqual(liveSource.members.length, 538);
assert.strictEqual(liveSource.sourceIdentity, "eagle-smart-query:filtereds");

// R58 Eagle 4.0 host truth (confirmed from the shipped host source): allData
// owns the complete smart result while filtereds is only the current paged
// projection (`allData.slice(0, len * page)`). A matching route-owned
// imageCount is independent completeness proof, so a 100-item filtered page
// must not block the complete 538-item current-view source. raw may alias
// allData after rebind; the independent count prevents a 24k library buffer
// from being promoted.
const r58AllData = items(538, "r58-member");
const r58Filtereds = r58AllData.slice(0, 100);
const r58Visible = r58AllData.slice(0, 120).map((item) => item.id);
const r58Source = selectSmartQuerySource({
  filtereds: r58Filtereds,
  allData: r58AllData,
  raw: r58AllData,
  smartQueryEvidence: {
    routeKind: "smart",
    collectionId: "MJCRT7F81VVTJ",
    currentSmartFolderId: "MJCRT7F81VVTJ",
    filteredReference: r58Filtereds,
    currentViewReference: r58AllData,
    visibleIds: r58Visible,
    visibleConsistent: true,
    queryIdentity: "MAX照片集:query-1",
    queryFinished: true,
    paginationComplete: true,
    advertisedCount: 538
  }
});
assert.strictEqual(r58Source.sourceIdentity, "eagle-smart-query:current-view");
assert.strictEqual(r58Source.members.length, 538);

const r58Provisional = items(24319, "r58-library");
assert.strictEqual(selectSmartQuerySource({
  filtereds: r58Provisional.slice(0, 100),
  allData: r58Provisional,
  raw: r58Provisional,
  smartQueryEvidence: {
    routeKind: "smart",
    collectionId: "MJCRT7F81VVTJ",
    currentSmartFolderId: "MJCRT7F81VVTJ",
    filteredReference: r58Provisional.slice(0, 100),
    currentViewReference: r58Provisional,
    visibleIds: r58Provisional.slice(0, 120).map((item) => item.id),
    visibleConsistent: true,
    queryIdentity: "MAX照片集:query-provisional",
    queryFinished: true,
    paginationComplete: true,
    advertisedCount: 538
  }
}).kind, "untrusted", "a 24k allData/raw buffer cannot pass a 538-item independent count");

// R56 real T3 shape: Eagle keeps filtereds and allData as different objects,
// grows filtereds in batches and virtualizes the visible grid. Ownership must
// carry both references independently. A non-empty partial filtered result
// blocks current-view fallback; only the final 538 members may become READY.
const r56Adapter = createSmartCollectionHostSnapshotAdapter();
r56Adapter.enter({ libraryId: "引力环球.library", collectionId: "MJCRT7F81VVTJ" });
const r56AllData = items(24319, "r56-all");
const r56Raw = r56AllData;
const r56Visible = items(120, "r56-member").map((item) => item.id);
function r56Source(count, visibleIds) {
  const filtereds = items(count, "r56-member");
  return selectSmartQuerySource({
    filtereds,
    allData: r56AllData,
    raw: r56Raw,
    smartQueryEvidence: {
      routeKind: "smart",
      collectionId: "MJCRT7F81VVTJ",
      currentSmartFolderId: "MJCRT7F81VVTJ",
      filteredReference: filtereds,
      currentViewReference: r56AllData,
      visibleIds,
      visibleConsistent: false,
      queryIdentity: "MAX照片集:query-1"
    }
  });
}
let r56Selected = r56Source(100, []);
assert.strictEqual(r56Selected.sourceIdentity, "eagle-smart-query:filtereds");
let r56Snapshot = r56Adapter.observe({
  libraryId: "引力环球.library",
  collectionId: "MJCRT7F81VVTJ",
  sourceIdentity: r56Selected.sourceIdentity,
  queryEpoch: "query-1:100",
  members: r56Selected.members,
  visibleIds: [],
  queryComplete: true,
  stable: true,
  completeness: { queryFinished: true, paginationComplete: true, advertisedCount: 538 }
});
assert.strictEqual(r56Snapshot.phase, "loading");
r56Selected = r56Source(100, r56Visible);
assert.strictEqual(r56Selected.kind, "untrusted", "visible members outside a partial filtered snapshot must not fall through to allData");
r56Selected = r56Source(300, r56Visible);
assert.strictEqual(r56Selected.sourceIdentity, "eagle-smart-query:filtereds");
r56Snapshot = r56Adapter.observe({
  libraryId: "引力环球.library",
  collectionId: "MJCRT7F81VVTJ",
  sourceIdentity: r56Selected.sourceIdentity,
  queryEpoch: "query-1:300",
  members: r56Selected.members,
  visibleIds: r56Visible,
  queryComplete: true,
  stable: true,
  completeness: { queryFinished: true, paginationComplete: true, advertisedCount: 538 }
});
assert.strictEqual(r56Snapshot.phase, "loading");
r56Selected = r56Source(538, r56Visible);
const r56FinalObservation = {
  libraryId: "引力环球.library",
  collectionId: "MJCRT7F81VVTJ",
  sourceIdentity: r56Selected.sourceIdentity,
  queryEpoch: "query-1:538",
  members: r56Selected.members,
  visibleIds: r56Visible,
  queryComplete: true,
  stable: true,
  completeness: { queryFinished: true, paginationComplete: true, advertisedCount: 538 }
};
assert.strictEqual(r56Adapter.observe(r56FinalObservation).phase, "loading");
assert.strictEqual(r56Adapter.observe(r56FinalObservation).phase, "ready");
assert.strictEqual(r56Adapter.snapshot().members.length, 538);

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
    filteredReference: [],
    currentViewReference: liveCurrentView,
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
    filteredReference: [],
    currentViewReference: provisionalAlias,
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

// R55.6: repeated partial buffers cannot become VERIFIED_COMPLETE merely
// because busy flags are false and two observations happen to match.
const partial = createSmartCollectionHostSnapshotAdapter({ minimumStableMs: 200 });
partial.enter({ libraryId: "library", collectionId: "smart-partial" });
const partialObservation = (count, observedAt) => observation({
  collectionId: "smart-partial",
  members: items(count, "partial"),
  visibleIds: items(Math.min(count, 100), "partial").map((item) => item.id),
  observedAt,
  completeness: {
    queryFinished: true,
    paginationComplete: true,
    advertisedCount: 571,
    sourceRevision: "smart-partial:query-1"
  }
});
assert.strictEqual(partial.observe(partialObservation(100, 0)).phase, "loading");
assert.strictEqual(partial.observe(partialObservation(100, 20)).phase, "loading");
assert.strictEqual(partial.observe(partialObservation(100, 500)).phase, "loading", "time stability cannot override a known advertised-count mismatch");
assert.strictEqual(partial.observe(partialObservation(300, 40)).phase, "loading");
assert.strictEqual(partial.observe(partialObservation(571, 60)).phase, "loading");
assert.strictEqual(partial.observe(partialObservation(571, 80)).phase, "ready", "an independently advertised complete count may prove the final 571-member snapshot");

const advertisedWithoutRevision = createSmartCollectionHostSnapshotAdapter();
advertisedWithoutRevision.enter({ libraryId: "library", collectionId: "smart-no-revision" });
const noRevisionObservation = observation({
  collectionId: "smart-no-revision",
  queryEpoch: "generation-4:filtered-reference-2",
  members: items(571, "no-revision"),
  visibleIds: items(120, "no-revision").map((item) => item.id),
  completeness: {
    queryFinished: true,
    paginationComplete: true,
    advertisedCount: 571,
    sourceRevision: ""
  }
});
assert.strictEqual(advertisedWithoutRevision.observe(noRevisionObservation).phase, "loading");
assert.strictEqual(
  advertisedWithoutRevision.observe(noRevisionObservation).phase,
  "ready",
  "matching advertised count plus host query/pagination completion must not require a fabricated source revision"
);

const stableEmpty = [];
assert.strictEqual(selectSmartQuerySource({
  filtereds: stableEmpty,
  allData: stableEmpty,
  raw: items(24319, "raw-empty"),
  smartQueryEvidence: {
    routeKind: "smart",
    collectionId: "smart-empty",
    currentSmartFolderId: "smart-empty",
    queryFinished: true,
    paginationComplete: true,
    terminalEvidence: true,
    sourceRevision: "empty-query-1",
    filteredReference: stableEmpty,
    currentViewReference: stableEmpty,
    visibleIds: [],
    queryIdentity: "smart-empty:query-1"
  }
}).kind, "filtered-query", "a host-confirmed empty smart result must not remain LOADING forever");
assert.strictEqual(selectSmartQuerySource({
  filtereds: [],
  raw: items(24319, "raw-transient-empty"),
  smartQueryEvidence: {
    routeKind: "smart", collectionId: "smart-empty", currentSmartFolderId: "smart-empty"
  }
}).kind, "untrusted", "a transient empty buffer is not an empty result");

// Route changes create a new generation and reject old observations.
const next = adapter.enter({ libraryId: "library", collectionId: "smart-b" });
snapshot = adapter.observe(observation({ collectionId: "smart-a" }));
assert.strictEqual(snapshot.generation, next.generation);
assert.strictEqual(snapshot.phase, "loading");

console.log("smart collection host snapshot core tests passed");
