"use strict";

function normalizeCommand(command = {}) {
  const collectionId = String(
    command.collectionId || command.sourceContextId || ""
  );
  const commandId = String(command.commandId || command.id || "");
  const snapshotVersion = String(
    command.snapshotVersion || command.orderRevision || ""
  );
  const snapshotIdentity = String(
    command.snapshotIdentity || command.membershipFingerprint || ""
  );
  const signature = String(command.signature || "");
  if (!collectionId || !commandId || !snapshotVersion ||
      !snapshotIdentity || !signature) {
    throw new Error(
      "rename command requires collectionId, commandId, snapshotVersion, " +
      "snapshotIdentity and signature"
    );
  }
  if (!command.plan && !command.request) {
    throw new Error("rename command requires plan or request");
  }
  return Object.freeze({
    ...command,
    collectionId,
    commandId,
    snapshotVersion,
    snapshotIdentity,
    signature
  });
}

function createRenameCommandQueue({
  execute = async () => undefined,
  now = () => Date.now(),
  onStateChange = () => undefined
} = {}) {
  if (typeof execute !== "function") {
    throw new TypeError("execute must be a function");
  }

  const queues = new Map();
  const committedSignatures = new Map();
  const records = new Map();
  let scheduled = false;

  function emit(record) {
    try {
      onStateChange({ ...record });
    } catch {
      // Diagnostics must never change command delivery semantics.
    }
  }

  function collectionQueue(collectionId) {
    let state = queues.get(collectionId);
    if (!state) {
      state = { pending: [], running: false };
      queues.set(collectionId, state);
    }
    return state;
  }

  function hasSignature(collectionId, signature) {
    const state = committedSignatures.get(collectionId);
    return state?.has(signature) === true;
  }

  function commitSignature(collectionId, signature) {
    let state = committedSignatures.get(collectionId);
    if (!state) {
      state = new Set();
      committedSignatures.set(collectionId, state);
    }
    state.add(signature);
  }

  function releaseSignature(collectionId, signature) {
    const state = committedSignatures.get(collectionId);
    if (!state) return;
    state.delete(signature);
    if (!state.size) committedSignatures.delete(collectionId);
  }

  function scheduleDrain() {
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(async () => {
      scheduled = false;
      await Promise.all(Array.from(queues.keys()).map(drainCollection));
    });
  }

  async function drainCollection(collectionId) {
    const state = queues.get(collectionId);
    if (!state || state.running) return;
    state.running = true;
    try {
      while (state.pending.length) {
        const record = state.pending.shift();
        if (record.deferred) {
          state.pending.unshift(record);
          break;
        }
        record.state = "running";
        record.startedAt = now();
        emit(record);
        try {
          record.result = await execute(record.command, record);
          record.state = "success";
          record.finishedAt = now();
          emit(record);
        } catch (error) {
          record.state = "failed";
          record.finishedAt = now();
          record.error = {
            name: String(error?.name || "Error"),
            message: String(error?.message || error || "Rename command failed")
          };
          releaseSignature(collectionId, record.command.signature);
          emit(record);
        }
      }
    } finally {
      state.running = false;
      if (!state.pending.length) queues.delete(collectionId);
    }
  }

  function enqueue(command, options = {}) {
    const normalized = normalizeCommand(command);
    const collectionId = normalized.collectionId;
    if (hasSignature(collectionId, normalized.signature)) {
      return {
        accepted: false,
        retryable: false,
        reason: "duplicate-signature",
        commandId: normalized.commandId,
        collectionId
      };
    }
    const state = collectionQueue(collectionId);
    if (
      state.pending.some((record) => record.command.signature === normalized.signature) ||
      Array.from(records.values()).some((record) =>
        record.command.collectionId === collectionId &&
        record.command.signature === normalized.signature &&
        (record.state === "running" || record.state === "queued")
      )
    ) {
      return {
        accepted: false,
        retryable: false,
        reason: "duplicate-signature",
        commandId: normalized.commandId,
        collectionId
      };
    }
    const record = {
      command: normalized,
      commandId: normalized.commandId,
      collectionId,
      state: "queued",
      queuedAt: now(),
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
      deferred: options.defer === true
    };
    // Signature becomes a fact only after this enqueue acceptance point.
    commitSignature(collectionId, normalized.signature);
    records.set(record.commandId, record);
    state.pending.push(record);
    emit(record);
    if (!record.deferred) scheduleDrain();
    return {
      accepted: true,
      retryable: true,
      reason: "enqueued",
      commandId: record.commandId,
      collectionId
    };
  }

  function start(commandId) {
    const record = records.get(String(commandId || ""));
    if (!record || record.state !== "queued") return false;
    record.deferred = false;
    scheduleDrain();
    return true;
  }

  function cancel(commandId, reason = "cancelled") {
    const id = String(commandId || "");
    const record = records.get(id);
    if (!record || record.state !== "queued") return false;
    const state = queues.get(record.collectionId);
    if (state) {
      state.pending = state.pending.filter((entry) => entry !== record);
      if (!state.pending.length && !state.running) queues.delete(record.collectionId);
    }
    releaseSignature(record.collectionId, record.command.signature);
    record.state = "cancelled";
    record.error = { name: "Cancelled", message: String(reason) };
    record.finishedAt = now();
    emit(record);
    return true;
  }

  function status(commandId) {
    const record = records.get(String(commandId || ""));
    return record ? {
      commandId: record.commandId,
      collectionId: record.collectionId,
      state: record.state,
      error: record.error,
      result: record.result
    } : null;
  }

  function isBusy(collectionId) {
    if (collectionId) {
      const state = queues.get(String(collectionId));
      return Boolean(state?.running || state?.pending.length);
    }
    return Array.from(queues.values()).some((state) =>
      state.running || state.pending.length
    );
  }

  async function idle() {
    while (isBusy()) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return Object.freeze({
    enqueue,
    start,
    cancel,
    status,
    isBusy,
    idle,
    hasSignature: (collectionId, signature) =>
      hasSignature(String(collectionId || ""), String(signature || ""))
  });
}

module.exports = {
  createRenameCommandQueue,
  normalizeCommand
};
