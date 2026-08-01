"use strict";

const assert = require("assert");
const {
  SMART_COLLECTION_STATES,
  createSmartCollectionLifecycleController
} = require("../lib/smart-collection-lifecycle-core");

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
    viewFingerprint: "native-view"
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

  console.log("smart collection lifecycle core tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
