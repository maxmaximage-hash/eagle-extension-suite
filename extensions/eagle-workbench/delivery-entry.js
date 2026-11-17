"use strict";
(function expose(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.EagleWorkbenchDeliveryEntry = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  function createDeliveryEntryConsumer({read, remove, open, now = Date.now}) {
    let busy = false;
    let lastId = "";
    return async function consume() {
      if (busy) return false;
      busy = true;
      try {
        const request = await read();
        if (!request || request.version !== 1 || !request.id || request.action !== "manage-delivery-templates") return false;
        const age = now() - Date.parse(request.requestedAt);
        if (request.id === lastId || !Number.isFinite(age) || age > 300000 || age < -30000) {
          await remove(request.id);
          return false;
        }
        await open(request);
        lastId = request.id;
        await remove(request.id);
        return true;
      } finally { busy = false; }
    };
  }
  return {createDeliveryEntryConsumer};
});
