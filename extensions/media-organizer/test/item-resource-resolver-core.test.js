"use strict";

const assert = require("assert");
const {
  RESOURCE_FIELDS,
  createItemResourceResolver
} = require("../lib/item-resource-resolver-core.js");

async function run() {
  const calls = [];
  const resolver = createItemResourceResolver({
    batchSize: 1,
    concurrency: 1,
    diagnose: async (event, payload) => {
      calls.push({ event, payload });
    },
    fetchItems: async (query) => {
      calls.push(query);
      return query.ids.map((id) => ({
        id,
        ext: id === "video" ? "mov" : "jpg",
        filePath: `/resolved/${id}.${id === "video" ? "mov" : "jpg"}`,
        name: id
      }));
    }
  });

  const resolved = await resolver.resolve([
    { id: "ready", ext: "jpg", filePath: "/already/ready.jpg" },
    { id: "photo", ext: "jpg" },
    { id: "video", ext: "mov" },
    { id: "photo", ext: "jpg" }
  ]);

  assert.deepStrictEqual(
    calls.filter((entry) => entry.ids).map((query) => query.ids),
    [["photo"], ["video"]],
    "cold resource resolution must use a single-ID capability probe and bounded sequential queries"
  );
  assert.deepStrictEqual(
    calls.find((entry) => entry.ids).fields,
    RESOURCE_FIELDS,
    "the supported Eagle item.get({ids, fields}) contract must request filePath explicitly"
  );
  assert.strictEqual(resolved.hydratedCount, 2);
  assert.deepStrictEqual(resolved.unresolvedIds, []);
  assert.strictEqual(resolved.items[0].filePath, "/already/ready.jpg");
  assert.strictEqual(resolved.items[1].filePath, "/resolved/photo.jpg");
  assert.deepStrictEqual(
    calls.filter((entry) => entry.event).map((entry) => entry.event),
    [
      "resource-query-start",
      "resource-query-batch-start",
      "resource-query-batch-ok",
      "resource-query-batch-start",
      "resource-query-batch-ok",
      "resource-query-complete"
    ],
    "resource hydration must leave an auditable bounded progress trail"
  );

  const partial = createItemResourceResolver({
    fetchItems: async ({ ids }) => ids.map((id) => ({
      id,
      ext: "jpg",
      filePath: id === "one" ? `/resolved/${id}.jpg` : ""
    }))
  });
  const partialResult = await partial.resolve([
    { id: "one", ext: "jpg" },
    { id: "two", ext: "jpg" }
  ]);
  assert.strictEqual(partialResult.hydratedCount, 1);
  assert.deepStrictEqual(partialResult.unresolvedIds, ["two"]);

  const unsupported = createItemResourceResolver({
    fetchItems: async ({ ids }) => ids.map((id) => ({ id, ext: "jpg" }))
  });
  await assert.rejects(
    unsupported.resolve([
      { id: "a", ext: "jpg" },
      { id: "b", ext: "jpg" }
    ]),
    (error) =>
      error?.code === "ITEM_RESOURCE_CONTRACT_UNAVAILABLE" &&
      error?.retryable === true,
    "a batch-wide zero-path response must fail open, never become stable missing metadata"
  );

  const identityOnly = createItemResourceResolver({
    fetchItems: async ({ ids }) => ids.map((id) => ({ id }))
  });
  await assert.rejects(
    identityOnly.resolve([{ id: "known-media", ext: "jpg" }]),
    (error) => error?.code === "ITEM_RESOURCE_CONTRACT_UNAVAILABLE",
    "resource contract failure must still be detected when the host omits ext as well as filePath"
  );

  const incomplete = createItemResourceResolver({
    fetchItems: async () => []
  });
  await assert.rejects(
    incomplete.resolve([{ id: "missing", ext: "jpg" }]),
    (error) => error?.code === "ITEM_RESOURCE_RESPONSE_INCOMPLETE",
    "an empty response for exact IDs is transport/integration failure, not a missing sentinel"
  );

  let unsupportedQueryCalls = 0;
  let singularCalls = 0;
  const legacyHostFallback = createItemResourceResolver({
    fetchItems: async () => {
      unsupportedQueryCalls += 1;
      return [{ id: "unrelated", ext: "jpg", filePath: "/wrong/unrelated.jpg" }];
    },
    fetchItemById: async (id) => {
      singularCalls += 1;
      return { id, ext: "jpg", filePath: `/legacy/${id}.jpg` };
    }
  });
  const legacyFirst = await legacyHostFallback.resolve([
    { id: "legacy-a", ext: "jpg" },
    { id: "legacy-b", ext: "jpg" }
  ]);
  assert.strictEqual(legacyFirst.hydratedCount, 2);
  assert.strictEqual(
    unsupportedQueryCalls,
    1,
    "an Eagle build that ignores ids/fields must be probed once, not once per item"
  );
  assert.strictEqual(singularCalls, 2);
  const legacySecond = await legacyHostFallback.resolve([
    { id: "legacy-c", ext: "jpg" }
  ]);
  assert.strictEqual(legacySecond.hydratedCount, 1);
  assert.strictEqual(
    unsupportedQueryCalls,
    1,
    "the resolver must remember the proven getById host capability for later scans"
  );
  assert.strictEqual(singularCalls, 3);

  class EagleHostItem {
    constructor(id) {
      this.id = id;
      this.ext = "jpg";
    }

    get filePath() {
      return `/host-getter/${this.id}.jpg`;
    }

    get size() {
      return 1234;
    }

    get modifiedAt() {
      return 1700000000300;
    }
  }
  const hostGetterResolver = createItemResourceResolver({
    fetchItems: async ({ ids }) => ids.map((id) => new EagleHostItem(id))
  });
  const hostGetterResult = await hostGetterResolver.resolve([
    { id: "getter-item", ext: "jpg" }
  ]);
  assert.strictEqual(
    hostGetterResult.hydratedCount,
    1,
    "Eagle read-only prototype getters must survive host item normalization"
  );
  assert.strictEqual(hostGetterResult.items[0].filePath, "/host-getter/getter-item.jpg");
  assert.strictEqual(hostGetterResult.items[0].size, 1234);
  assert.strictEqual(hostGetterResult.items[0].modifiedAt, 1700000000300);

  let staleCalls = 0;
  const cancellable = createItemResourceResolver({
    batchSize: 1,
    concurrency: 1,
    fetchItems: async ({ ids }) => {
      staleCalls += 1;
      return [{ id: ids[0], ext: "jpg", filePath: `/resolved/${ids[0]}.jpg` }];
    }
  });
  const stale = await cancellable.resolve(
    [{ id: "old-a", ext: "jpg" }, { id: "old-b", ext: "jpg" }],
    { isCurrent: () => staleCalls < 1 }
  );
  assert.strictEqual(stale.aborted, true);
  assert.strictEqual(staleCalls, 1, "stale generation must stop before the next batch");

  const diagnosticFailure = createItemResourceResolver({
    diagnose: async () => {
      throw new Error("diagnostic sink unavailable");
    },
    yieldControl: async () => {
      throw new Error("scheduler yield unavailable");
    },
    fetchItems: async ({ ids }) => ids.map((id) => ({
      id,
      ext: "jpg",
      filePath: `/resolved/${id}.jpg`
    }))
  });
  const diagnosticFailureResult = await diagnosticFailure.resolve([
    { id: "diagnostic-independent", ext: "jpg" }
  ]);
  assert.strictEqual(
    diagnosticFailureResult.hydratedCount,
    1,
    "diagnostic and cooperative-yield failures must never block resource resolution"
  );

  console.log("item resource resolver core tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
