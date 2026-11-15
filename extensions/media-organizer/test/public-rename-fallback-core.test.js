"use strict";

const assert = require("assert");
const { createSelectedRenameRuntime } = require("../lib/selected-rename-core");
const { createPublicRenameFallbackRuntime } = require(
  "../lib/public-rename-fallback-core"
);

const selected = createSelectedRenameRuntime({ isMedia: () => true });
const items = [
  { id: "a", name: "IMG_a", ext: "jpg" },
  { id: "b", name: "IMG_b", ext: "jpg" }
];
const plan = selected.buildPlan(items, { folderName: "5-驾雾", group: "1" });
const saved = [];
const runtime = createPublicRenameFallbackRuntime({
  buildPlan: selected.buildPlan,
  saveItem: async (item) => saved.push(item.name)
});

(async () => {
  const result = await runtime.applyPlan(plan, items);
  assert.deepStrictEqual(result, { ok: true, renamed: 2, rolledBack: 0 });
  assert.deepStrictEqual(saved, ["1-驾雾1", "1-驾雾2"]);

  const failingItems = [
    { id: "a", name: "IMG_a", ext: "jpg" },
    { id: "b", name: "IMG_b", ext: "jpg" }
  ];
  let calls = 0;
  const failingRuntime = createPublicRenameFallbackRuntime({
    saveItem: async () => {
      calls += 1;
      if (calls === 2) throw new Error("save failed");
    }
  });
  const failed = await failingRuntime.applyPlan(plan, failingItems);
  assert.strictEqual(failed.ok, false);
  assert.strictEqual(failed.renamed, 0);
  assert.strictEqual(failingItems[0].name, "IMG_a");
  console.log("public rename fallback core tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
