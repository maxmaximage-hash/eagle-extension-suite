"use strict";

const assert = require("assert");
const {
  SMART_COLLECTION_STATES,
  createSmartCollectionLifecycleController
} = require("../lib/smart-collection-lifecycle-core");
const { createSmartMetadataProof } = require("../lib/smart-metadata-proof-core");

const items = (count, prefix = "item") =>
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}` }));

async function run() {
  const presentations = [];
  const controller = createSmartCollectionLifecycleController({
    present(request) {
      presentations.push(request);
      return true;
    }
  });

  const max = controller.enter({
    kind: "smart",
    libraryId: "library",
    collectionId: "max"
  });
  assert.strictEqual(max.state, SMART_COLLECTION_STATES.LOADING);

  let result = await controller.observe({
    token: max.token,
    items: [],
    queryComplete: false,
    stable: false,
    overlayRevision: 7
  });
  assert.strictEqual(result.state, SMART_COLLECTION_STATES.LOADING);
  assert.strictEqual(result.preserveVisible, true);
  assert.strictEqual(presentations.length, 0);

  // R53: an explicitly identified provisional allData source must fail open;
  // it must not start a presentation even if a caller incorrectly says ready.
  result = await controller.observe({
    token: max.token,
    items: items(24319, "provisional"),
    queryComplete: true,
    stable: true,
    sourceIdentity: "eagle-allData:max",
    queryEpoch: "provisional"
  });
  assert.strictEqual(result.reason, "host-not-stable");
  assert.strictEqual(presentations.length, 0);

  result = await controller.observe({
    token: max.token,
    items: items(511),
    queryComplete: false,
    stable: false,
    overlayRevision: 7
  });
  assert.strictEqual(result.state, SMART_COLLECTION_STATES.STABILIZING);
  assert.strictEqual(presentations.length, 0);

  result = await controller.observe({
    token: max.token,
    items: items(511),
    queryComplete: true,
    stable: true,
    overlayRevision: 7,
    viewFingerprint: "native-view",
    sourceIdentity: "eagle-smart-query:max",
    queryEpoch: "query-1"
  });
  assert.strictEqual(result.state, SMART_COLLECTION_STATES.READY);
  assert.strictEqual(presentations.length, 1);
  assert.strictEqual(presentations[0].items.length, 511);

  await controller.observe({
    token: max.token,
    items: items(511),
    queryComplete: true,
    stable: true,
    overlayRevision: 7,
    viewFingerprint: "native-view"
  });
  assert.strictEqual(
    presentations.length,
    1,
    "the same stable fingerprint must not replay every poll"
  );
  await controller.observe({
    token: max.token,
    items: items(511),
    queryComplete: true,
    stable: true,
    overlayRevision: 7,
    viewFingerprint: "host-rerendered-native-view"
  });
  assert.strictEqual(
    presentations.length,
    2,
    "a host rerender must be presented again without mutating host arrays"
  );

  const online = controller.enter({
    kind: "smart",
    libraryId: "library",
    collectionId: "online"
  });
  const stale = await controller.observe({
    token: max.token,
    items: items(511),
    queryComplete: true,
    stable: true,
    overlayRevision: 7
  });
  assert.strictEqual(stale.reason, "stale-token");

  result = await controller.observe({
    token: online.token,
    items: [],
    queryComplete: false,
    stable: false,
    overlayRevision: 3
  });
  assert.strictEqual(result.preserveVisible, true);
  assert.strictEqual(presentations.length, 2);

  result = await controller.observe({
    token: online.token,
    items: items(91, "online"),
    queryComplete: true,
    stable: true,
    overlayRevision: 3
  });
  assert.strictEqual(result.state, SMART_COLLECTION_STATES.READY);
  assert.strictEqual(presentations.length, 3);

  // R55.5/R55.8: member completion alone is not READY. Metadata and both
  // host-data/visible final-order proofs are mandatory for plugin sorting.
  const proofCalls = [];
  const proofController = createSmartCollectionLifecycleController({
    requireReadyProofs: true,
    present(request) {
      proofCalls.push(request);
      return { ok: true, dataOrderVerified: true, visibleOrderVerified: true };
    }
  });
  const proof = proofController.enter({
    kind: "smart", libraryId: "library", collectionId: "proof"
  });
  result = await proofController.observe({
    token: proof.token, items: items(571, "proof"), queryComplete: true, stable: true,
    sourceIdentity: "eagle-smart-query:proof", queryEpoch: "epoch-proof",
    snapshotFingerprint: "571:complete", snapshotGeneration: 7,
    metadataProof: createSmartMetadataProof({
      libraryId: "library", collectionId: "proof", snapshotGeneration: 6,
      snapshotFingerprint: "571:complete", totalCount: 571,
      resolvedCount: 571, complete: true
    })
  });
  assert.strictEqual(result.reason, "metadata-not-ready");
  assert.strictEqual(proofCalls.length, 0);
  result = await proofController.observe({
    token: proof.token, items: items(571, "proof"), queryComplete: true, stable: true,
    sourceIdentity: "eagle-smart-query:proof", queryEpoch: "epoch-proof",
    snapshotFingerprint: "571:complete", snapshotGeneration: 7,
    metadataProof: createSmartMetadataProof({
      libraryId: "library", collectionId: "proof", snapshotGeneration: 7,
      snapshotFingerprint: "571:complete", totalCount: 571,
      resolvedCount: 550, missingSentinelCount: 21, complete: true
    }),
    finalItems: items(571, "proof-final")
  });
  assert.strictEqual(result.state, SMART_COLLECTION_STATES.READY);
  assert.strictEqual(proofCalls.length, 1);
  assert.strictEqual(proofController.snapshot().dataOrderVerified, true);
  assert.strictEqual(proofController.snapshot().visibleOrderVerified, true);

  let readyCommitCalls = 0;
  const rejectedCommit = createSmartCollectionLifecycleController({
    requireReadyProofs: true,
    present: () => ({ ok: true, dataOrderVerified: true, visibleOrderVerified: true }),
    onReady: async () => { readyCommitCalls += 1; return false; }
  });
  const rejected = rejectedCommit.enter({ kind: "smart", libraryId: "library", collectionId: "rejected" });
  result = await rejectedCommit.observe({
    token: rejected.token, items: items(3, "rejected"), queryComplete: true, stable: true,
    sourceIdentity: "eagle-smart-query:rejected", queryEpoch: "epoch-rejected",
    snapshotFingerprint: "3:rejected", snapshotGeneration: 3,
    metadataProof: createSmartMetadataProof({
      libraryId: "library", collectionId: "rejected", snapshotGeneration: 3,
      snapshotFingerprint: "3:rejected", totalCount: 3, resolvedCount: 3, complete: true
    })
  });
  assert.strictEqual(result.reason, "ready-commit-failed");
  assert.strictEqual(rejectedCommit.snapshot().state, SMART_COLLECTION_STATES.ERROR, "onReady failure must never leave a fake READY signature");
  assert.strictEqual(readyCommitCalls, 1);

  let emptyCommitted = 0;
  const verifiedEmpty = createSmartCollectionLifecycleController({
    requireReadyProofs: true,
    onReady: async ({ empty }) => { if (empty) emptyCommitted += 1; return true; }
  });
  const emptyProof = verifiedEmpty.enter({ kind: "smart", libraryId: "library", collectionId: "verified-empty" });
  result = await verifiedEmpty.observe({
    token: emptyProof.token, items: [], queryComplete: true, stable: true,
    sourceIdentity: "eagle-smart-query:verified-empty", queryEpoch: "empty-epoch",
    snapshotFingerprint: "0:empty", snapshotGeneration: 4,
    metadataProof: createSmartMetadataProof({
      libraryId: "library", collectionId: "verified-empty", snapshotGeneration: 4,
      snapshotFingerprint: "0:empty", totalCount: 0, complete: true
    })
  });
  assert.strictEqual(result.state, SMART_COLLECTION_STATES.EMPTY);
  assert.strictEqual(emptyCommitted, 1, "stable empty must commit the frame and release loading UI");

  const empty = controller.enter({
    kind: "smart",
    libraryId: "library",
    collectionId: "empty"
  });
  result = await controller.observe({
    token: empty.token,
    items: [],
    queryComplete: true,
    stable: false,
    overlayRevision: 0
  });
  assert.strictEqual(result.state, SMART_COLLECTION_STATES.STABILIZING);
  assert.strictEqual(result.preserveVisible, true);
  result = await controller.observe({
    token: empty.token,
    items: [],
    queryComplete: true,
    stable: true,
    overlayRevision: 0
  });
  assert.strictEqual(result.state, SMART_COLLECTION_STATES.EMPTY);
  assert.strictEqual(presentations.length, 3);

  const normal = controller.enter({
    kind: "normal",
    libraryId: "library",
    collectionId: "normal"
  });
  assert.strictEqual(normal.state, SMART_COLLECTION_STATES.IDLE);
  result = await controller.observe({
    token: normal.token,
    items: items(4),
    queryComplete: true,
    stable: true
  });
  assert.strictEqual(result.reason, "not-smart");

  let releaseFirst;
  const delayedCalls = [];
  const delayed = createSmartCollectionLifecycleController({
    present(request) {
      delayedCalls.push(request.collectionId);
      if (request.collectionId === "first") {
        return new Promise((resolve) => {
          releaseFirst = resolve;
        });
      }
      return true;
    }
  });
  const first = delayed.enter({
    kind: "smart",
    libraryId: "library",
    collectionId: "first"
  });
  const firstPromise = delayed.observe({
    token: first.token,
    items: items(3, "first"),
    queryComplete: true,
    stable: true,
    overlayRevision: 1
  });
  const second = delayed.enter({
    kind: "smart",
    libraryId: "library",
    collectionId: "second"
  });
  releaseFirst(true);
  const late = await firstPromise;
  assert.strictEqual(late.reason, "stale-token");
  await delayed.observe({
    token: second.token,
    items: items(3, "second"),
    queryComplete: true,
    stable: true,
    overlayRevision: 1
  });
  assert.deepStrictEqual(delayedCalls, ["first", "second"]);
  assert.strictEqual(delayed.snapshot().collectionId, "second");

  // R53: a new query epoch in the same smart folder also cancels an old
  // in-flight presentation; collection ID alone is not enough ownership.
  let releaseEpochOne;
  const epochCalls = [];
  const epochController = createSmartCollectionLifecycleController({
    present(request) {
      epochCalls.push(request.queryEpoch);
      if (request.queryEpoch === "epoch-1") {
        return new Promise((resolve) => { releaseEpochOne = resolve; });
      }
      return true;
    }
  });
  const sameCollection = epochController.enter({
    kind: "smart", libraryId: "library", collectionId: "same"
  });
  const epochOne = epochController.observe({
    token: sameCollection.token,
    items: items(3), queryComplete: true, stable: true,
    sourceIdentity: "eagle-smart-query:same", queryEpoch: "epoch-1"
  });
  const epochTwo = epochController.observe({
    token: sameCollection.token,
    items: items(4, "next"), queryComplete: true, stable: true,
    sourceIdentity: "eagle-smart-query:same", queryEpoch: "epoch-2"
  });
  releaseEpochOne(true);
  assert.strictEqual((await epochOne).reason, "stale-token");
  assert.strictEqual((await epochTwo).state, SMART_COLLECTION_STATES.READY);
  assert.deepStrictEqual(epochCalls, ["epoch-1", "epoch-2"]);

  let failures = 0;
  const failOpen = createSmartCollectionLifecycleController({
    present() {
      failures += 1;
      return false;
    }
  });
  const failed = failOpen.enter({
    kind: "smart",
    libraryId: "library",
    collectionId: "failed"
  });
  result = await failOpen.observe({
    token: failed.token,
    items: items(3),
    queryComplete: true,
    stable: true,
    overlayRevision: 1
  });
  assert.strictEqual(result.state, SMART_COLLECTION_STATES.ERROR);
  assert.strictEqual(result.failOpen, true);
  await failOpen.observe({
    token: failed.token,
    items: items(3),
    queryComplete: true,
    stable: true,
    overlayRevision: 1
  });
  assert.strictEqual(failures, 1, "a failed signature must not retry in a loop");

  const thrownDiagnostics = [];
  const thrown = createSmartCollectionLifecycleController({
    requireReadyProofs: true,
    present() {
      const error = new TypeError("host presentation exploded");
      error.presentationStage = "commit-start";
      throw error;
    },
    diagnose(event, details) {
      thrownDiagnostics.push({ event, details });
    }
  });
  const thrownContext = thrown.enter({
    kind: "smart", libraryId: "library", collectionId: "thrown"
  });
  result = await thrown.observe({
    token: thrownContext.token,
    items: items(3, "thrown"),
    queryComplete: true,
    stable: true,
    sourceIdentity: "eagle-smart-query:thrown",
    queryEpoch: "epoch-thrown",
    snapshotFingerprint: "3:thrown",
    snapshotGeneration: 9,
    metadataProof: createSmartMetadataProof({
      libraryId: "library",
      collectionId: "thrown",
      snapshotGeneration: 9,
      snapshotFingerprint: "3:thrown",
      totalCount: 3,
      resolvedCount: 3,
      complete: true
    })
  });
  assert.strictEqual(result.reason, "present-threw");
  const thrownFailure = thrownDiagnostics.at(-1);
  assert.strictEqual(thrownFailure.event, "present-fail-open");
  assert.deepStrictEqual(
    {
      ...thrownFailure.details,
      signature: "<verified-separately>"
    },
    {
      token: thrownContext.token,
      collectionId: "thrown",
      state: SMART_COLLECTION_STATES.ERROR,
      signature: "<verified-separately>",
      reason: "present-threw",
      errorName: "TypeError",
      errorMessage: "host presentation exploded",
      presentationStage: "commit-start",
      errorStack: thrownFailure.details.errorStack,
      dataOrderVerified: false,
      visibleOrderVerified: false
    },
    "R66: lifecycle diagnostics must preserve a bounded presentation exception instead of collapsing it to presenter-failed"
  );
  assert.match(thrownFailure.details.errorStack, /^TypeError: host presentation exploded/);
  assert.ok(thrownFailure.details.errorStack.length <= 1600);
  assert.ok(String(thrownFailure.details.signature).startsWith("3:"));

  let sameMembersPresentations = 0;
  const sameMembers = createSmartCollectionLifecycleController({
    present() {
      sameMembersPresentations += 1;
      return true;
    }
  });
  const sameMembersContext = sameMembers.enter({
    kind: "smart", libraryId: "library", collectionId: "same-members"
  });
  const sameMembersInput = {
    token: sameMembersContext.token,
    queryComplete: true,
    stable: true,
    sourceIdentity: "eagle-smart-query:same-members",
    queryEpoch: "epoch-same-members",
    overlayRevision: 4,
    viewFingerprint: "membership-a-b-c"
  };
  await sameMembers.observe({
    ...sameMembersInput,
    items: [{ id: "a" }, { id: "b" }, { id: "c" }]
  });
  result = await sameMembers.observe({
    ...sameMembersInput,
    items: [{ id: "c" }, { id: "a" }, { id: "b" }]
  });
  assert.strictEqual(result.reason, "duplicate-observation");
  assert.strictEqual(
    sameMembersPresentations,
    1,
    "R69: a presentation reorder of identical smart members must not start a second lifecycle commit"
  );

  console.log("smart collection lifecycle core tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
