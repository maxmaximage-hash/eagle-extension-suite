"use strict";

function createSortIntentRuntime(options = {}) {
  const pluginKeys = new Set(
    (Array.isArray(options.pluginKeys) ? options.pluginKeys : []).map(String)
  );
  const intents = new Map();

  function identity(input = {}) {
    const libraryId = String(input.libraryId || "");
    const kind = String(input.kind || input.collectionKind || "");
    const id = String(input.id || input.collectionId || "");
    if (!libraryId || !kind || !id || kind === "global") return "";
    return libraryId + "|" + kind + ":" + id;
  }

  function normalizeIntent(input = {}) {
    const orderBy = String(input.orderBy || "");
    if (!pluginKeys.has(orderBy)) return null;
    return {
      orderBy,
      increase: input.increase !== false
    };
  }

  function observe(input = {}) {
    const key = identity(input);
    const intent = normalizeIntent(input);
    if (!key || !intent) return false;
    intents.set(key, intent);
    return true;
  }

  function clear(input = {}) {
    const key = identity(input);
    if (!key || input.explicitNative !== true) return false;
    return intents.delete(key);
  }

  function resolve(input = {}) {
    const current = String(input.orderBy || "");
    if (pluginKeys.has(current)) {
      observe(input);
      return current;
    }
    if (input.explicitNative === true) {
      clear(input);
      return current;
    }
    return intents.get(identity(input))?.orderBy || current;
  }

  // Host callbacks carry the native order selected by the user when Eagle
  // has not yet rebound the collection object. An explicit non-plugin key is
  // therefore authoritative for this callback and must not be replaced by a
  // stale remembered plugin intent. Empty callbacks remain transient and keep
  // the remembered intent for the next stable frame.
  function resolveHost(input = {}) {
    const current = String(input.orderBy || "");
    if (current && !pluginKeys.has(current)) {
      clear({ ...input, explicitNative: true });
      return current;
    }
    return resolve(input);
  }

  function resolveEffective(input = {}) {
    const configuredOrder = String(input.configuredOrder || "");
    const scopedOrder = String(input.scopedOrder || "");
    const hostOrderBy = String(input.hostOrderBy || "");
    const selectedOrder = String(input.selectedOrder || "");
    if (pluginKeys.has(configuredOrder)) return configuredOrder;
    if (hostOrderBy && !pluginKeys.has(hostOrderBy)) {
      return resolveHost({ ...input, orderBy: hostOrderBy });
    }
    if (pluginKeys.has(scopedOrder)) return scopedOrder;
    if (pluginKeys.has(selectedOrder)) {
      observe({ ...input, orderBy: selectedOrder });
      return selectedOrder;
    }
    return resolveHost({
      ...input,
      orderBy: hostOrderBy || configuredOrder || selectedOrder
    });
  }

  function increase(input = {}) {
    const key = identity(input);
    return intents.get(key)?.increase ?? (input.increase !== false);
  }

  function restore(initial = {}) {
    for (const [key, value] of Object.entries(initial || {})) {
      const intent = normalizeIntent(value);
      if (intent) intents.set(String(key), intent);
    }
    return serialize();
  }

  function serialize() {
    const result = {};
    for (const [key, value] of intents.entries()) result[key] = { ...value };
    return result;
  }

  restore(options.initial || {});
  return Object.freeze({
    identity,
    observe,
    clear,
    resolve,
    resolveEffective,
    resolveHost,
    increase,
    restore,
    serialize
  });
}

module.exports = { createSortIntentRuntime };
