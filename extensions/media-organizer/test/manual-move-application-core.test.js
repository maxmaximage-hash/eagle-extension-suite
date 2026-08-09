"use strict";

const assert = require("assert");
const {
  MOVE_APPLICATION_STAGES,
  createManualMoveApplicationRuntime
} = require("../lib/manual-move-application-core");

const items = [
  { id: "a", name: "a" },
  { id: "b", name: "b" },
  { id: "c", name: "c" }
];
const command = Object.freeze({
  type: "MoveCommand",
  collection: Object.freeze({
    kind: "smart",
    id: "smart-a",
    key: "/Volumes/team.library|smart:smart-a"
  }),
  targetKind: "direct-media",
  selectedIds: Object.freeze(["a"]),
  targetId: "c",
  insertAfter: true,
  sourceItems: Object.freeze(items),
  nextItems: Object.freeze([items[1], items[2], items[0]]),
  relations: Object.freeze([
    { itemId: "a", relation: "after", anchorId: "c" }
  ])
});

async function run() {
  const stages = [];
  let visibleIds = items.map((item) => item.id);
  let persisted = null;
  let presented = null;
  const runtime = createManualMoveApplicationRuntime({
    reduce(state, suppliedCommand, revision) {
      assert.strictEqual(suppliedCommand, command);
      return {
        ...state,
        relations: suppliedCommand.relations,
        revision
      };
    },
    persist(nextState) {
      persisted = nextState;
      return true;
    },
    present(input) {
      presented = input;
      assert.strictEqual(input.targetId, "c");
      assert.strictEqual(input.insertAfter, true);
      assert.deepStrictEqual(input.selectedIds, ["a"]);
      visibleIds = input.nextItems.map((item) => item.id);
      return true;
    },
    readVisibleIds() {
      return visibleIds;
    },
    diagnose(stage, payload) {
      stages.push({ stage, payload });
    },
    now: () => 1234
  });

  const result = await runtime.apply({
    command,
    collection: command.collection,
    state: { relations: [], history: [] },
    expectedVisibleIds: ["b", "c", "a"]
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.stage, MOVE_APPLICATION_STAGES.VISIBLE_VERIFY_OK);
  assert.deepStrictEqual(persisted.relations, command.relations);
  assert.deepStrictEqual(presented.nextItems, command.nextItems);
  assert.deepStrictEqual(stages.map((entry) => entry.stage), [
    MOVE_APPLICATION_STAGES.MOVE_RECEIVED,
    MOVE_APPLICATION_STAGES.REDUCER_BEFORE_AFTER,
    MOVE_APPLICATION_STAGES.PERSIST_OK,
    MOVE_APPLICATION_STAGES.RENDER_REQUESTED,
    MOVE_APPLICATION_STAGES.VISIBLE_VERIFY_OK
  ]);
  assert.deepStrictEqual(stages[0].payload, {
    collectionId: "smart-a",
    selectedCount: 1,
    targetId: "c",
    insertAfter: true,
    source: { count: 3, head: ["a", "b", "c"], tail: [] },
    next: { count: 3, head: ["b", "c", "a"], tail: [] }
  });

  const unchangedStages = [];
  const unchangedRuntime = createManualMoveApplicationRuntime({
    reduce: () => ({ relations: command.relations, revision: 1 }),
    persist: () => true,
    // Replays qa.18: the command is correct and submitted once, but the
    // presenter leaves Eagle's visible order unchanged.
    present: () => true,
    readVisibleIds: () => ["a", "b", "c"],
    diagnose: (stage) => unchangedStages.push(stage)
  });
  const unchanged = await unchangedRuntime.apply({
    command,
    collection: command.collection,
    state: {},
    expectedVisibleIds: ["b", "c", "a"]
  });
  assert.strictEqual(unchanged.ok, false);
  assert.strictEqual(
    unchanged.stage,
    MOVE_APPLICATION_STAGES.VISIBLE_VERIFY_FAIL
  );
  assert.strictEqual(
    unchangedStages.at(-1),
    MOVE_APPLICATION_STAGES.VISIBLE_VERIFY_FAIL
  );

  const persistenceStages = [];
  let renderAttempted = false;
  const persistenceRuntime = createManualMoveApplicationRuntime({
    reduce: () => ({ relations: command.relations, revision: 1 }),
    persist() {
      throw new Error("disk unavailable");
    },
    present() {
      renderAttempted = true;
      return true;
    },
    readVisibleIds: () => [],
    diagnose: (stage) => persistenceStages.push(stage)
  });
  const persistenceFailure = await persistenceRuntime.apply({
    command,
    collection: command.collection,
    state: {}
  });
  assert.strictEqual(persistenceFailure.ok, false);
  assert.strictEqual(
    persistenceFailure.stage,
    MOVE_APPLICATION_STAGES.PERSIST_ERROR
  );
  assert.strictEqual(renderAttempted, false);
  assert.strictEqual(
    persistenceStages.at(-1),
    MOVE_APPLICATION_STAGES.PERSIST_ERROR
  );

  const wrongContext = await runtime.apply({
    command,
    collection: { kind: "smart", id: "smart-b" },
    state: {}
  });
  assert.deepStrictEqual(wrongContext, {
    ok: false,
    reason: "collection-changed",
    stage: MOVE_APPLICATION_STAGES.MOVE_RECEIVED
  });

  // qa.20 real sequence: persistence succeeds and refresh retains the order,
  // but Eagle may reuse a cached smart collection without calling sortData
  // when the user switches away and returns.
  const restoreStages = [];
  let restoredVisibleIds = ["a", "b", "c"];
  const restoreRuntime = createManualMoveApplicationRuntime({
    reduce: () => {
      throw new Error("restore must not reduce another move");
    },
    persist: () => {
      throw new Error("restore must not persist another move");
    },
    resolvePersistedOrder(sourceItems, relations) {
      assert.deepStrictEqual(relations, command.relations);
      return [sourceItems[1], sourceItems[2], sourceItems[0]];
    },
    present(input) {
      assert.strictEqual(input.restore, true);
      restoredVisibleIds = input.nextItems.map((item) => item.id);
      return true;
    },
    readVisibleIds: () => restoredVisibleIds,
    diagnose: (stage, payload) => restoreStages.push({ stage, payload })
  });
  const restored = await restoreRuntime.restore({
    collection: command.collection,
    state: { relations: command.relations, revision: 1234 },
    sourceItems: items,
    expectedVisibleIds: ["b", "c", "a"]
  });
  assert.strictEqual(restored.ok, true);
  assert.strictEqual(
    restored.stage,
    MOVE_APPLICATION_STAGES.VISIBLE_VERIFY_OK
  );
  assert.deepStrictEqual(restoreStages.map((entry) => entry.stage), [
    MOVE_APPLICATION_STAGES.RENDER_REQUESTED,
    MOVE_APPLICATION_STAGES.VISIBLE_VERIFY_OK
  ]);
  assert.strictEqual(restoreStages[0].payload.reason, "context-reentry");

  console.log("manual move application core tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
