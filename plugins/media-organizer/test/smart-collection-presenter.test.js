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
    smartPresenterSource[1],
    /await smartCollectionPresenter\?\.present/,
    "the host adapter must await the presenter result before visible verification"
  );

  console.log("smart collection presenter tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
