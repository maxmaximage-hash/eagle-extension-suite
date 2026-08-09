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

  console.log("smart collection presenter tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
