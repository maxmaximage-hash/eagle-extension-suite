"use strict";

class ControlledUnavailableError extends Error {
  constructor(reason, details = {}) {
    super(String(reason || "collection-unavailable"));
    this.name = "ControlledUnavailableError";
    this.code = "CONTROLLED_UNAVAILABLE";
    this.reason = String(reason || "collection-unavailable");
    this.details = details;
  }
}

const COLLECTION_KINDS = new Set(["normal", "smart"]);
const TARGET_KINDS = new Set(["direct-media", "direct-folders"]);

function requireHostPort(host) {
  if (!host || typeof host.readCollection !== "function") {
    throw new TypeError("host.readCollection is required");
  }
  if (typeof host.writeManualView !== "function") {
    throw new TypeError("host.writeManualView is required");
  }
  if (typeof host.requestHostConfirmation !== "function") {
    throw new TypeError("host.requestHostConfirmation is required");
  }
  return host;
}

function validateRef(ref, expectedKind) {
  if (!ref || !ref.libraryId || !ref.collectionId) {
    throw new ControlledUnavailableError("missing-collection-ref");
  }
  const kind = String(ref.kind || expectedKind || "");
  const targetKind = String(ref.targetKind || "");
  if (!COLLECTION_KINDS.has(kind)) {
    throw new ControlledUnavailableError("unknown-collection-kind", { kind });
  }
  if (kind !== expectedKind) {
    throw new ControlledUnavailableError("adapter-kind-mismatch", {
      expectedKind,
      kind
    });
  }
  if (!TARGET_KINDS.has(targetKind)) {
    throw new ControlledUnavailableError("unknown-target-kind", { targetKind });
  }
  return {
    libraryId: String(ref.libraryId),
    collectionId: String(ref.collectionId),
    kind,
    targetKind
  };
}

function validateContext(context, expectedKind) {
  if (!context?.libraryId || !context?.collectionId) {
    throw new ControlledUnavailableError("missing-collection-context");
  }
  if (context.kind === "global" || context.kind === "unknown") {
    throw new ControlledUnavailableError("unsupported-context", {
      kind: context.kind
    });
  }
  return {
    libraryId: String(context.libraryId),
    collectionId: String(context.collectionId),
    kind: expectedKind,
    targetKind: String(context.targetKind || "")
  };
}

function normalizeMembers(members) {
  if (!Array.isArray(members)) {
    throw new ControlledUnavailableError("members-unavailable");
  }
  const seen = new Set();
  return members.map((member) => {
    const id = String(member?.id || "");
    if (!id || seen.has(id)) {
      throw new ControlledUnavailableError("invalid-member-set");
    }
    seen.add(id);
    return Object.freeze({ ...member, id });
  });
}

function normalizeSnapshot(raw, expectedKind, context) {
  if (!raw || typeof raw !== "object") {
    throw new ControlledUnavailableError("collection-not-ready");
  }
  const ref = validateRef({
    ...raw.ref,
    libraryId: raw.ref?.libraryId || context.libraryId,
    collectionId: raw.ref?.collectionId || context.collectionId,
    kind: raw.ref?.kind || expectedKind,
    targetKind: raw.ref?.targetKind || context.targetKind
  }, expectedKind);
  if (ref.libraryId !== context.libraryId || ref.collectionId !== context.collectionId) {
    throw new ControlledUnavailableError("collection-context-mismatch");
  }
  const members = normalizeMembers(raw.members);
  const memberIds = new Set(members.map((member) => member.id));
  const hostBaseOrder = Array.isArray(raw.hostBaseOrder)
    ? raw.hostBaseOrder.map(String)
    : members.map((member) => member.id);
  if (
    hostBaseOrder.length !== members.length ||
    new Set(hostBaseOrder).size !== members.length ||
    hostBaseOrder.some((id) => !memberIds.has(id))
  ) {
    throw new ControlledUnavailableError("invalid-host-base-order");
  }
  return Object.freeze({
    ref: Object.freeze(ref),
    revision: String(raw.revision || "0"),
    members: Object.freeze(members),
    hostBaseOrder: Object.freeze(hostBaseOrder)
  });
}

function validateOrder(snapshot, order) {
  if (!Array.isArray(order)) {
    throw new TypeError("manual order must be an array");
  }
  const expected = new Set(snapshot.members.map((member) => member.id));
  const normalized = order.map(String);
  if (
    normalized.length !== expected.size ||
    new Set(normalized).size !== expected.size ||
    normalized.some((id) => !expected.has(id))
  ) {
    throw new Error("manual order must contain exactly the current collection members");
  }
  return normalized;
}

function createCollectionAdapter({ kind, host } = {}) {
  if (!COLLECTION_KINDS.has(kind)) throw new TypeError("unsupported adapter kind");
  const port = requireHostPort(host);

  async function readSnapshot(context) {
    const normalizedContext = validateContext(context, kind);
    const raw = await port.readCollection({ ...normalizedContext });
    if (!raw) throw new ControlledUnavailableError("collection-not-ready");
    return normalizeSnapshot(raw, kind, normalizedContext);
  }

  async function writeManualView({ snapshot, order, revision } = {}) {
    if (!snapshot?.ref) throw new ControlledUnavailableError("snapshot-required");
    const ref = validateRef(snapshot.ref, kind);
    const normalizedOrder = validateOrder(snapshot, order);
    if (revision !== undefined && String(revision) !== String(snapshot.revision)) {
      throw new Error("collection revision is stale");
    }
    return port.writeManualView({
      ref,
      revision: snapshot.revision,
      order: normalizedOrder
    });
  }

  async function requestHostConfirmation(command = {}) {
    if (!command.ref) throw new ControlledUnavailableError("command-ref-required");
    const ref = validateRef(command.ref, kind);
    if (!command.type) throw new TypeError("host command type is required");
    const normalized = {
      ...command,
      ref,
      order: command.order ? validateOrder(command.snapshot, command.order) : command.order
    };
    delete normalized.snapshot;
    return port.requestHostConfirmation(normalized);
  }

  return Object.freeze({
    kind,
    readSnapshot,
    writeManualView,
    requestHostConfirmation
  });
}

function createNormalCollectionAdapter(options = {}) {
  return createCollectionAdapter({ ...options, kind: "normal" });
}

function createSmartCollectionAdapter(options = {}) {
  return createCollectionAdapter({ ...options, kind: "smart" });
}

module.exports = {
  ControlledUnavailableError,
  createCollectionAdapter,
  createNormalCollectionAdapter,
  createSmartCollectionAdapter
};
