"use strict";

const RESOURCE_FIELDS = Object.freeze([
  "id",
  "ext",
  "filePath",
  "name",
  "size",
  "modifiedAt",
  "mtime",
  "modificationTime"
]);

function positiveInteger(value, fallback) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function uniqueMissingIds(items) {
  const seen = new Set();
  const ids = [];
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id || "");
    if (!id || item?.filePath || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function resolverError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.retryable = true;
  error.details = details;
  return error;
}

function readHostField(item, field) {
  try {
    return item?.[field];
  } catch {
    return undefined;
  }
}

function normalizeHostItem(source = {}, response = {}) {
  const normalized = { ...source };
  for (const field of RESOURCE_FIELDS) {
    const value = readHostField(response, field);
    if (value !== undefined) normalized[field] = value;
  }
  return normalized;
}

function createItemResourceResolver(options = {}) {
  if (typeof options.fetchItems !== "function") {
    throw new TypeError("fetchItems must implement eagle.item.get({ ids, fields })");
  }
  const fetchItems = options.fetchItems;
  const fetchItemById = typeof options.fetchItemById === "function"
    ? options.fetchItemById
    : null;
  const batchSize = positiveInteger(options.batchSize, 1);
  const concurrency = positiveInteger(options.concurrency, 1);
  const diagnose = typeof options.diagnose === "function"
    ? options.diagnose
    : async () => {};
  const yieldControl = typeof options.yieldControl === "function"
    ? options.yieldControl
    : async () => {};
  const isResourceItem = typeof options.isResourceItem === "function"
    ? options.isResourceItem
    : (item) => Boolean(String(item?.ext || ""));
  const emit = async (event, payload) => {
    try {
      await diagnose(event, payload);
    } catch {}
  };
  let preferredFetchMode = "query";

  async function fetchSingularBatch(batch) {
    const response = [];
    for (const id of batch) {
      const item = await fetchItemById(id);
      if (item) response.push(item);
    }
    return response;
  }

  async function resolve(sourceItems = [], runtime = {}) {
    const items = Array.isArray(sourceItems) ? sourceItems.slice() : [];
    const ids = uniqueMissingIds(items);
    const sourceById = new Map(
      items
        .filter((item) => item?.id)
        .map((item) => [String(item.id), item])
    );
    const isCurrent = typeof runtime.isCurrent === "function"
      ? runtime.isCurrent
      : () => true;
    if (ids.length === 0) {
      return {
        items,
        hydratedCount: 0,
        unresolvedIds: [],
        missingResponseIds: [],
        aborted: false
      };
    }

    const batches = [];
    for (let index = 0; index < ids.length; index += batchSize) {
      batches.push(ids.slice(index, index + batchSize));
    }

    const hydratedById = new Map();
    let nextBatchIndex = 0;
    let aborted = false;
    let resourceContractConfirmed = false;
    let probeAttempts = 0;
    const maximumProbeAttempts = Math.min(3, batches.length);
    await emit("resource-query-start", {
      requestedCount: ids.length,
      batchCount: batches.length,
      batchSize,
      concurrency
    });
    const worker = async () => {
      while (true) {
        if (!isCurrent()) {
          aborted = true;
          return;
        }
        const index = nextBatchIndex;
        nextBatchIndex += 1;
        if (index >= batches.length) return;
        const batch = batches[index];
        const phase = !resourceContractConfirmed &&
          probeAttempts < maximumProbeAttempts
          ? "probe"
          : "resolve";
        await emit("resource-query-batch-start", {
          index,
          batchCount: batches.length,
          size: batch.length,
          phase
        });
        let response;
        let fetchMode = preferredFetchMode;
        try {
          response = fetchMode === "single"
            ? await fetchSingularBatch(batch)
            : await fetchItems({
                ids: batch.slice(),
                fields: RESOURCE_FIELDS.slice()
              });
          const queryResponseInvalid = !Array.isArray(response);
          const queryResponseIds = new Set(
            Array.isArray(response)
              ? response.filter((item) => item?.id).map((item) => String(item.id))
              : []
          );
          const queryMissingIds = batch.filter((id) => !queryResponseIds.has(id));
          if (
            fetchMode === "query" &&
            fetchItemById &&
            (queryResponseInvalid || queryMissingIds.length > 0)
          ) {
            await emit("resource-query-mode-fallback", {
              index,
              batchCount: batches.length,
              requestedIds: batch.slice(),
              reason: queryResponseInvalid
                ? "query-response-invalid"
                : "query-ignored-exact-ids"
            });
            response = await fetchSingularBatch(batch);
            fetchMode = "single";
          }
        } catch (error) {
          await emit("resource-query-batch-fail", {
            index,
            batchCount: batches.length,
            size: batch.length,
            phase,
            code: String(error?.code || "ITEM_RESOURCE_QUERY_FAILED"),
            message: String(error?.message || error || "resource query failed")
          });
          throw error;
        }
        if (!Array.isArray(response)) {
          throw resolverError(
            "ITEM_RESOURCE_RESPONSE_INVALID",
            "Eagle item resource response is not an array",
            { requestedIds: batch }
          );
        }
        const responseById = new Map(
          response
            .filter((item) => item?.id)
            .map((item) => [String(item.id), item])
        );
        const missingResponseIds = batch.filter((id) => !responseById.has(id));
        if (missingResponseIds.length > 0) {
          throw resolverError(
            "ITEM_RESOURCE_RESPONSE_INCOMPLETE",
            "Eagle item resource response omitted exact requested IDs",
            { requestedIds: batch, missingResponseIds }
          );
        }
        if (fetchMode === "single") preferredFetchMode = "single";

        const resourceResponses = batch
          .map((id) => normalizeHostItem(
            sourceById.get(id),
            responseById.get(id)
          ))
          .filter((item) => isResourceItem(item));
        const resolvedPathCount = resourceResponses.filter(
          (item) => item.filePath
        ).length;
        if (resolvedPathCount > 0) resourceContractConfirmed = true;
        if (phase === "probe") probeAttempts += 1;
        if (
          resourceResponses.length > 0 &&
          resolvedPathCount === 0 &&
          !resourceContractConfirmed &&
          probeAttempts >= maximumProbeAttempts
        ) {
          throw resolverError(
            "ITEM_RESOURCE_CONTRACT_UNAVAILABLE",
            "Eagle returned item identities without file resources",
            { requestedIds: batch, fields: RESOURCE_FIELDS.slice() }
          );
        }
        for (const [id, item] of responseById) {
          hydratedById.set(id, normalizeHostItem(sourceById.get(id), item));
        }
        await emit("resource-query-batch-ok", {
          index,
          batchCount: batches.length,
          size: batch.length,
          phase,
          fetchMode,
          returnedCount: responseById.size,
          resolvedPathCount
        });
        try {
          await yieldControl();
        } catch {}
      }
    };

    try {
      await Promise.all(
        Array.from(
          { length: Math.min(concurrency, batches.length) },
          () => worker()
        )
      );
    } catch (error) {
      await emit("resource-query-fail", {
        requestedCount: ids.length,
        code: String(error?.code || "ITEM_RESOURCE_QUERY_FAILED"),
        message: String(error?.message || error || "resource query failed")
      });
      throw error;
    }
    if (aborted || !isCurrent()) {
      return {
        items,
        hydratedCount: 0,
        unresolvedIds: ids,
        missingResponseIds: [],
        aborted: true
      };
    }

    const hydratedIds = new Set();
    const mergedItems = items.map((item) => {
      const id = String(item?.id || "");
      if (!id || item?.filePath) return item;
      const hydrated = hydratedById.get(id);
      if (!hydrated) return item;
      if (hydrated.filePath) hydratedIds.add(id);
      return hydrated;
    });
    const unresolvedIds = uniqueMissingIds(mergedItems);
    await emit("resource-query-complete", {
      requestedCount: ids.length,
      hydratedCount: hydratedIds.size,
      unresolvedCount: unresolvedIds.length
    });
    return {
      items: mergedItems,
      hydratedCount: hydratedIds.size,
      unresolvedIds,
      missingResponseIds: [],
      aborted: false
    };
  }

  return { resolve };
}

module.exports = {
  RESOURCE_FIELDS,
  createItemResourceResolver
};
