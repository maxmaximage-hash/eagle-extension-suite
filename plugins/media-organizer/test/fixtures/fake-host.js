"use strict";

function createFakeHostPort(options = {}) {
  const calls = [];
  const snapshots = new Map();
  const confirmations = [];

  for (const snapshot of options.snapshots || []) {
    snapshots.set(String(snapshot.ref.collectionId), snapshot);
  }

  return {
    calls,
    confirmations,
    readCollection(context) {
      calls.push({ type: "readCollection", context });
      return snapshots.get(String(context.collectionId)) || null;
    },
    writeManualView(command) {
      calls.push({ type: "writeManualView", command });
      return { ok: true, collectionId: command.ref.collectionId };
    },
    requestHostConfirmation(command) {
      calls.push({ type: "requestHostConfirmation", command });
      confirmations.push(command);
      return { ok: true, confirmed: options.confirm !== false };
    }
  };
}

module.exports = { createFakeHostPort };
