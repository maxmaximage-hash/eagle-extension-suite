"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  createSmartCollectionPresenter
} = require("../lib/smart-collection-presenter");

async function run() {
  let active = {
    token: 4,
    libraryId: "library",
    collectionId: "smart-a",
    kind: "smart"
  };
  let visibleIds = ["a", "b", "c"];
  const moves = [];
  const presenter = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => visibleIds.slice(),
    moveBefore(sourceId, targetId, insertAfter) {
      moves.push({ sourceId, targetId, insertAfter });
      const from = visibleIds.indexOf(sourceId);
      const target = visibleIds.indexOf(targetId);
      if (from < 0 || target < 0) return false;
      visibleIds.splice(from, 1);
      const nextTarget = visibleIds.indexOf(targetId);
      visibleIds.splice(nextTarget + (insertAfter ? 1 : 0), 0, sourceId);
      return true;
    }
  });

  const restored = await presenter.present({
    context: active,
    restore: true,
    nextItems: [{ id: "b" }, { id: "c" }, { id: "a" }]
  });
  assert.strictEqual(restored, true);
  assert.deepStrictEqual(visibleIds, ["b", "c", "a"]);
  assert.deepStrictEqual(moves, [
    { sourceId: "b", targetId: "a", insertAfter: false },
    { sourceId: "c", targetId: "a", insertAfter: false }
  ]);

  active = { ...active, token: 5, collectionId: "smart-b" };
  assert.strictEqual(await presenter.present({
    context: { ...active, token: 4 },
    restore: true,
    nextItems: [{ id: "a" }, { id: "b" }, { id: "c" }]
  }), false, "a stale token must fail open without changing the host view");
  assert.deepStrictEqual(visibleIds, ["b", "c", "a"]);

  const failing = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => ["a", "b"],
    moveBefore: () => {
      throw new Error("host unavailable");
    }
  });
  assert.strictEqual(await failing.present({
    context: active,
    restore: true,
    nextItems: [{ id: "b" }, { id: "a" }]
  }), false);

  let hostDataIds = ["a", "b", "c"];
  visibleIds = ["a", "b", "c"];
  active = { token: 9, libraryId: "library", collectionId: "smart-transaction", kind: "smart" };
  const transactional = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => visibleIds.slice(),
    readDataOrderIds: () => hostDataIds.slice(),
    moveBefore(sourceId, targetId) {
      const from = visibleIds.indexOf(sourceId);
      const to = visibleIds.indexOf(targetId);
      visibleIds.splice(from, 1);
      visibleIds.splice(to, 0, sourceId);
      return true;
    },
    commitDataOrder(nextItems) {
      hostDataIds = nextItems.map((item) => item.id);
      return true;
    }
  });
  const proof = await transactional.presentVerified({
    context: active,
    restore: true,
    nextItems: [{ id: "b" }, { id: "c" }, { id: "a" }]
  });
  assert.deepStrictEqual(proof, { ok: true, dataOrderVerified: true, visibleOrderVerified: true });

  hostDataIds = ["a", "b", "c", "d"];
  visibleIds = ["a", "b"];
  let restoreMoveCalls = 0;
  let restoreNotifyCalls = 0;
  const virtualizedRestore = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => visibleIds.slice(),
    readDataOrderIds: () => hostDataIds.slice(),
    moveBefore() {
      restoreMoveCalls += 1;
      return false;
    },
    commitDataOrder(nextItems) {
      const previous = hostDataIds.slice();
      hostDataIds = nextItems.map((item) => item.id);
      return { ok: true, transaction: previous };
    },
    rollbackDataOrder(previous) {
      hostDataIds = previous.slice();
      return true;
    },
    notify() {
      restoreNotifyCalls += 1;
      visibleIds = hostDataIds.slice(0, 2);
    },
    waitForVisibleOrder: async (expectedIds) =>
      JSON.stringify(visibleIds) === JSON.stringify(expectedIds)
  });
  const virtualizedProof = await virtualizedRestore.presentVerified({
    context: active,
    restore: true,
    nextItems: [{ id: "d" }, { id: "c" }, { id: "b" }, { id: "a" }],
    expectedVisibleIds: ["d", "c"]
  });
  assert.deepStrictEqual(
    virtualizedProof,
    { ok: true, dataOrderVerified: true, visibleOrderVerified: true },
    "automatic smart restore must verify Eagle's rerendered virtualized prefix"
  );
  assert.strictEqual(
    restoreMoveCalls,
    0,
    "automatic restore must not imitate hundreds of manual DOM drag moves"
  );
  assert.strictEqual(restoreNotifyCalls, 1);

  hostDataIds = ["a", "b", "c", "d", "e", "f"];
  visibleIds = ["c", "d"];
  let asyncRenderPending = false;
  const offsetRestore = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => visibleIds.slice(),
    readVisibleWindow() {
      return { offset: 2, count: 2, ids: visibleIds.slice() };
    },
    readDataOrderIds: () => hostDataIds.slice(),
    commitDataOrder(nextItems) {
      hostDataIds = nextItems.map((item) => item.id);
      return true;
    },
    notify() {
      asyncRenderPending = true;
      return new Promise((resolve) => {
        setTimeout(() => {
          visibleIds = hostDataIds.slice(2, 4);
          asyncRenderPending = false;
          resolve();
        }, 5);
      });
    },
    waitForVisibleOrder: async (expectedIds) =>
      !asyncRenderPending && JSON.stringify(visibleIds) === JSON.stringify(expectedIds)
  });
  const offsetProof = await offsetRestore.presentVerified({
    context: active,
    restore: true,
    nextItems: ["f", "e", "d", "c", "b", "a"].map((id) => ({ id }))
  });
  assert.deepStrictEqual(
    offsetProof,
    { ok: true, dataOrderVerified: true, visibleOrderVerified: true },
    "R66: automatic presentation must preserve a non-zero virtual window and await the host rerender"
  );
  assert.deepStrictEqual(visibleIds, ["d", "c"]);

  // R86: the host may remount fewer cards after notify. The presenter must
  // pass the full authoritative plan to the host proof instead of demanding
  // the stale pre-notify card count.
  hostDataIds = ["a", "b", "c", "d", "e"];
  visibleIds = ["a", "b", "c"];
  let r86Proof = null;
  const shrinkingVirtualWindow = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => visibleIds.slice(),
    readVisibleWindow: () => ({ offset: 0, count: visibleIds.length, ids: visibleIds.slice(), proven: true }),
    readDataOrderIds: () => hostDataIds.slice(),
    commitDataOrder(nextItems) {
      hostDataIds = nextItems.map((item) => item.id);
      return true;
    },
    notify() {
      visibleIds = hostDataIds.slice(0, 2);
    },
    waitForVisibleOrder: async (expectedIds, _context, proof) => {
      r86Proof = { expectedIds: expectedIds.slice(), desiredIds: proof.desiredIds.slice() };
      return JSON.stringify(visibleIds) === JSON.stringify(proof.desiredIds.slice(0, 2));
    }
  });
  assert.deepStrictEqual(
    await shrinkingVirtualWindow.presentVerified({
      context: active,
      restore: true,
      nextItems: ["e", "d", "c", "b", "a"].map((id) => ({ id }))
    }),
    { ok: true, dataOrderVerified: true, visibleOrderVerified: true }
  );
  assert.deepStrictEqual(r86Proof, {
    expectedIds: ["e", "d", "c"],
    desiredIds: ["e", "d", "c", "b", "a"]
  });

  let unprovedCommitCalls = 0;
  const unprovedWindow = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => ["c", "a"],
    readVisibleWindow: () => ({
      offset: 0,
      count: 2,
      ids: ["c", "a"],
      proven: false
    }),
    commitDataOrder() {
      unprovedCommitCalls += 1;
      return true;
    },
    waitForVisibleOrder: async () => true
  });
  assert.deepStrictEqual(
    await unprovedWindow.presentVerified({
      context: active,
      restore: true,
      nextItems: ["a", "b", "c"].map((id) => ({ id }))
    }),
    { ok: false, reason: "visible-window-unproved" },
    "R66: a non-contiguous host window must fail open before any data mutation"
  );
  assert.strictEqual(unprovedCommitCalls, 0);

  // R109: after a successful read-only manual overlay, Eagle's host array can
  // still advertise the previous order while the rendered cards are already
  // in the durable overlay order. A following manual drag must not reject
  // that stale initial projection before its own rendered proof runs.
  let manualWindowVisible = ["b", "a"];
  let manualWindowCommitted = false;
  const manualStaleWindow = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => manualWindowVisible.slice(),
    readVisibleWindow: () => ({
      offset: 0,
      count: 2,
      ids: manualWindowVisible.slice(),
      proven: false
    }),
    moveItemsBefore() {
      manualWindowVisible = ["a", "b"];
      return true;
    },
    commitDataOrder() {
      manualWindowCommitted = true;
      return { ok: true, readOnly: true, transaction: null };
    },
    waitForVisibleOrder: async (expectedIds) =>
      JSON.stringify(manualWindowVisible) === JSON.stringify(expectedIds)
  });
  assert.deepStrictEqual(
    await manualStaleWindow.presentVerified({
      owner: "manual",
      context: active,
      selectedIds: ["b"],
      targetId: "a",
      nextItems: [{ id: "a" }, { id: "b" }],
      expectedVisibleIds: ["a", "b"],
      awaitVisibleProof: true
    }),
    { ok: true, dataOrderVerified: true, visibleOrderVerified: true },
    "R109: consecutive manual overlays may start from a stale host projection"
  );
  assert.strictEqual(manualWindowCommitted, true);

  const reentrantStages = [];
  let reentrantResult = null;
  let reentrantPresenter;
  reentrantPresenter = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => ["a", "b"],
    readDataOrderIds: () => ["b", "a"],
    readVisibleWindow: () => ({ offset: 0, count: 2, ids: ["a", "b"], proven: true }),
    commitDataOrder() {
      reentrantResult = reentrantPresenter.presentVerified({
        context: active,
        restore: true,
        nextItems: [{ id: "b" }, { id: "a" }]
      });
      return { ok: false };
    },
    waitForVisibleOrder: async () => false,
    diagnose(stage) { reentrantStages.push(stage); }
  });
  const reentrantOuter = await reentrantPresenter.presentVerified({
    context: active,
    restore: true,
    nextItems: [{ id: "b" }, { id: "a" }]
  });
  assert.strictEqual(reentrantOuter.reason, "data-commit-failed");
  assert.strictEqual((await reentrantResult).reason, "presentation-reentrant");
  assert.strictEqual(
    reentrantStages.filter((stage) => stage === "commit-start").length,
    1,
    "R68: synchronous host re-entry must not start a second presentation transaction"
  );
  assert.ok(reentrantStages.includes("reentrant-rejected"));

  // R90: a manual drag must be able to supersede a lifecycle restore waiting
  // for a recycled virtual window. The stale lifecycle result must not roll
  // back the newer manual host-array commit or leave the presenter occupied.
  let ownerVisible = ["a", "b", "c"];
  let ownerData = ["a", "b", "c"];
  let releaseLifecycleWait;
  let ownerWaitCalls = 0;
  const ownershipPresenter = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => ownerVisible.slice(),
    readDataOrderIds: () => ownerData.slice(),
    moveItemsBefore(ids, targetId, insertAfter) {
      assert.deepStrictEqual(ids, ["a"]);
      assert.strictEqual(targetId, "c");
      const from = ownerVisible.indexOf("a");
      ownerVisible.splice(from, 1);
      const target = ownerVisible.indexOf("c");
      ownerVisible.splice(target + (insertAfter ? 1 : 0), 0, "a");
      return true;
    },
    commitDataOrder(nextItems) {
      const previous = ownerData.slice();
      ownerData = nextItems.map((item) => item.id);
      return { ok: true, transaction: previous };
    },
    waitForVisibleOrder: async (_expected, _context, proof) => {
      ownerWaitCalls += 1;
      if (ownerWaitCalls === 1) {
        await new Promise((resolve) => { releaseLifecycleWait = resolve; });
        return false;
      }
      return proof.isCurrent?.() !== false;
    }
  });
  active = { token: 11, libraryId: "library", collectionId: "smart-owner", kind: "smart" };
  const lifecyclePromise = ownershipPresenter.presentVerified({
    owner: "lifecycle",
    context: active,
    restore: true,
    nextItems: [{ id: "a" }, { id: "b" }, { id: "c" }]
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.strictEqual(typeof releaseLifecycleWait, "function");
  const ownerManualResult = await ownershipPresenter.presentVerified({
    owner: "manual",
    context: active,
    selectedIds: ["a"],
    targetId: "c",
    insertAfter: false,
    nextItems: [{ id: "b" }, { id: "a" }, { id: "c" }]
  });
  assert.strictEqual(ownerManualResult.ok, true);
  releaseLifecycleWait();
  const lifecycleResult = await lifecyclePromise;
  assert.deepStrictEqual(
    lifecycleResult,
    { ok: false, reason: "presentation-superseded", failOpen: true },
    "R90: a late lifecycle restore must not undo the newer manual transaction"
  );
  assert.deepStrictEqual(ownerData, ["b", "a", "c"]);

  hostDataIds = ["a", "b", "c"];
  visibleIds = ["a", "b", "c"];
  const rollback = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => visibleIds.slice(),
    readDataOrderIds: () => hostDataIds.slice(),
    moveBefore(sourceId, targetId) {
      const from = visibleIds.indexOf(sourceId);
      const to = visibleIds.indexOf(targetId);
      visibleIds.splice(from, 1);
      visibleIds.splice(to, 0, sourceId);
      return true;
    },
    commitDataOrder() { throw new Error("host array commit failed"); }
  });
  assert.strictEqual((await rollback.presentVerified({
    context: active, restore: true,
    nextItems: [{ id: "b" }, { id: "c" }, { id: "a" }]
  })).ok, false);
  assert.deepStrictEqual(visibleIds, ["a", "b", "c"], "failed data commit must roll the visible order back");

  hostDataIds = ["a", "b", "c"];
  visibleIds = ["a", "b", "c"];
  const reverseHalfCommit = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => visibleIds.slice(),
    readDataOrderIds: () => ["wrong-data-order"],
    moveBefore(sourceId, targetId) {
      const from = visibleIds.indexOf(sourceId);
      const to = visibleIds.indexOf(targetId);
      visibleIds.splice(from, 1);
      visibleIds.splice(to, 0, sourceId);
      return true;
    },
    commitDataOrder(nextItems) {
      const previous = hostDataIds.slice();
      hostDataIds = nextItems.map((item) => item.id);
      return { ok: true, transaction: previous };
    },
    rollbackDataOrder(previous) {
      hostDataIds = previous.slice();
      return true;
    }
  });
  const reversed = await reverseHalfCommit.presentVerified({
    context: active, restore: true,
    nextItems: [{ id: "b" }, { id: "c" }, { id: "a" }]
  });
  assert.strictEqual(reversed.ok, false);
  assert.strictEqual(reversed.dataRolledBack, true);
  assert.strictEqual(reversed.visibleRolledBack, true);
  assert.deepStrictEqual(hostDataIds, ["a", "b", "c"], "verification failure must roll back host data as well as DOM");

  // Manual DOM moves must commit the host projection before the asynchronous
  // visible proof reads it; a failed proof rolls back both sides.
  let manualVisible = ["a", "b", "c"];
  let manualHost = ["a", "b", "c"];
  const manualStages = [];
  const manualPresenter = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => manualVisible.slice(),
    readDataOrderIds: () => manualHost.slice(),
    moveItemsBefore(ids, target) {
      manualStages.push("move");
      manualVisible = ["b", "a", "c"];
      return true;
    },
    commitDataOrder(nextItems) {
      manualStages.push("commit");
      const previous = manualHost.slice();
      manualHost = nextItems.map((item) => item.id);
      return { ok: true, transaction: previous };
    },
    rollbackDataOrder(previous) {
      manualStages.push("rollback-data");
      manualHost = previous.slice();
      return true;
    },
    waitForVisibleOrder: async () => {
      manualStages.push("wait");
      assert.deepStrictEqual(manualHost, ["b", "a", "c"]);
      return false;
    }
  });
  const manualResult = await manualPresenter.presentVerified({
    context: active,
    selectedIds: ["a"],
    targetId: "c",
    nextItems: [{ id: "b" }, { id: "a" }, { id: "c" }],
    expectedVisibleIds: ["b", "a", "c"],
    awaitVisibleProof: true
  });
  assert.strictEqual(manualResult.ok, false);
  assert.deepStrictEqual(manualStages, ["move", "commit", "wait", "rollback-data"]);
  assert.deepStrictEqual(manualHost, ["a", "b", "c"]);

  // R96: Eagle's native drag may already have moved the DOM by the time the
  // extension's moveItemsBefore observer returns false. The presenter must
  // continue through the host commit and visible proof instead of restoring
  // the native result immediately.
  let nativeAppliedVisible = ["a", "b", "c"];
  let nativeAppliedHost = ["a", "b", "c"];
  let nativeAppliedWaitCalls = 0;
  const nativeAppliedPresenter = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => nativeAppliedVisible.slice(),
    readDataOrderIds: () => nativeAppliedHost.slice(),
    moveItemsBefore() {
      nativeAppliedVisible = ["b", "a", "c"];
      return false;
    },
    commitDataOrder(nextItems) {
      const previous = nativeAppliedHost.slice();
      nativeAppliedHost = nextItems.map((item) => item.id);
      return { ok: true, transaction: previous };
    },
    waitForVisibleOrder: async (expectedIds) => {
      nativeAppliedWaitCalls += 1;
      return JSON.stringify(nativeAppliedVisible) === JSON.stringify(expectedIds);
    }
  });
  const nativeAppliedResult = await nativeAppliedPresenter.presentVerified({
    context: active,
    selectedIds: ["a"],
    targetId: "c",
    nextItems: [{ id: "b" }, { id: "a" }, { id: "c" }],
    expectedVisibleIds: ["b", "a", "c"],
    awaitVisibleProof: true
  });
  assert.deepStrictEqual(
    nativeAppliedResult,
    { ok: true, dataOrderVerified: true, visibleOrderVerified: true },
    "R96: a native drag that already applied must be accepted when visible proof succeeds"
  );
  assert.strictEqual(nativeAppliedWaitCalls, 1);
  assert.deepStrictEqual(nativeAppliedHost, ["b", "a", "c"]);

  // R103: Eagle can expose the verified smart-query source as a read-only
  // projection. A native drag may already have changed the visible cards, so
  // the presenter must accept an overlay-only commit and rely on visible
  // proof; it must not require an impossible array splice/data-order proof.
  let readOnlyVisible = ["b", "a", "c"];
  const readOnlyPresenter = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => readOnlyVisible.slice(),
    readDataOrderIds: () => ["a", "b", "c"],
    moveItemsBefore() {
      return false;
    },
    commitDataOrder() {
      return { ok: true, readOnly: true, transaction: null };
    },
    rollbackDataOrder() {
      return true;
    },
    waitForVisibleOrder: async (expectedIds) =>
      JSON.stringify(readOnlyVisible) === JSON.stringify(expectedIds)
  });
  const readOnlyResult = await readOnlyPresenter.presentVerified({
    context: active,
    selectedIds: ["a"],
    targetId: "c",
    nextItems: [{ id: "b" }, { id: "a" }, { id: "c" }],
    expectedVisibleIds: ["b", "a", "c"],
    awaitVisibleProof: true
  });
  assert.deepStrictEqual(
    readOnlyResult,
    { ok: true, dataOrderVerified: true, visibleOrderVerified: true },
    "R103: read-only smart host projections accept native visible proof"
  );

  // R97: when moveItemsBefore returns false and the native host did not move,
  // the same transactional path must wait for proof, then roll back both the
  // host data and visible order after the proof fails.
  let nativeNotAppliedVisible = ["a", "b", "c"];
  let nativeNotAppliedHost = ["a", "b", "c"];
  let nativeNotAppliedWaitCalls = 0;
  let nativeNotAppliedRollbackCalls = 0;
  const nativeNotAppliedPresenter = createSmartCollectionPresenter({
    currentContext: () => active,
    readVisibleIds: () => nativeNotAppliedVisible.slice(),
    readDataOrderIds: () => nativeNotAppliedHost.slice(),
    moveItemsBefore: () => false,
    commitDataOrder(nextItems) {
      const previous = nativeNotAppliedHost.slice();
      nativeNotAppliedHost = nextItems.map((item) => item.id);
      return { ok: true, transaction: previous };
    },
    rollbackDataOrder(previous) {
      nativeNotAppliedRollbackCalls += 1;
      nativeNotAppliedHost = previous.slice();
      return true;
    },
    waitForVisibleOrder: async () => {
      nativeNotAppliedWaitCalls += 1;
      return false;
    }
  });
  const nativeNotAppliedResult = await nativeNotAppliedPresenter.presentVerified({
    context: active,
    selectedIds: ["a"],
    targetId: "c",
    nextItems: [{ id: "b" }, { id: "a" }, { id: "c" }],
    expectedVisibleIds: ["b", "a", "c"],
    awaitVisibleProof: true
  });
  assert.strictEqual(nativeNotAppliedResult.ok, false);
  assert.strictEqual(nativeNotAppliedResult.reason, "visible-order-mismatch");
  assert.strictEqual(nativeNotAppliedWaitCalls, 1);
  assert.strictEqual(nativeNotAppliedRollbackCalls, 1);
  assert.deepStrictEqual(nativeNotAppliedHost, ["a", "b", "c"]);
  assert.deepStrictEqual(nativeNotAppliedVisible, ["a", "b", "c"]);

  const pluginSource = fs.readFileSync(
    path.join(__dirname, "..", "plugin.js"),
    "utf8"
  );
  const smartPresenterSource = pluginSource.match(
    /async function presentSmartManualMove\(input = \{\}\) \{([\s\S]*?)\n    \}\n\n    function moveSmartElementsBefore/
  );
  assert.ok(smartPresenterSource, "smart presenter adapter must exist");
  assert.doesNotMatch(
    smartPresenterSource[1],
    /allData\.splice|filtereds\.splice/,
    "smart presentation must not rewrite Eagle collection arrays"
  );
  assert.match(
    pluginSource,
    /verifySmartVisibleWindow\(\{[\s\S]*?desiredIds: desired,[\s\S]*?visibleIds: actual/s,
    "R86: the Eagle adapter must prove the post-notify current virtual window against the full final plan"
  );
  assert.match(
    smartPresenterSource[1],
    /await smartCollectionPresenter\?\.present/,
    "the host adapter must await the presenter result before visible verification"
  );
  assert.doesNotMatch(
    pluginSource.match(/present: async \(request\) => \{([\s\S]*?)\n        \},\n        requireReadyProofs/)[1],
    /nextItems\s*\.slice\(0,\s*visibleIds\.length\)/,
    "R66: lifecycle presentation must not assume every virtualized window starts at offset zero"
  );
  const presenterSource = fs.readFileSync(
    path.join(__dirname, "..", "lib", "smart-collection-presenter.js"),
    "utf8"
  );
  const manualMoveBranch = presenterSource.match(
    /if \(moveItemsBefore\) \{([\s\S]*?)\n        \} else \{/
  );
  assert.ok(manualMoveBranch, "manual smart move branch should remain explicit");
  assert.match(
    manualMoveBranch[1],
    /const moveResult = moveItemsBefore\([\s\S]*?if \(moveResult === false\)/,
    "R96: a false native move result must enter proof-based reconciliation"
  );
  assert.doesNotMatch(
    manualMoveBranch[1],
    /moveResult === false[\s\S]*?restoreVisibleOrder\(originalVisibleIds\)[\s\S]*?return/,
    "R96: an unconfirmed native move must not immediately restore and abort"
  );

  console.log("smart collection presenter tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
