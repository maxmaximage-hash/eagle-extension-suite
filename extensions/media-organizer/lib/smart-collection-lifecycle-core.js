"use strict";

const SMART_COLLECTION_STATES = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  STABILIZING: "stabilizing",
  READY: "ready",
  EMPTY: "empty",
  ERROR: "error"
});

function createSmartCollectionLifecycleController(options = {}) {
  const STATES = {
    IDLE: "idle",
    LOADING: "loading",
    STABILIZING: "stabilizing",
    READY: "ready",
    EMPTY: "empty",
    ERROR: "error"
  };
  const present = typeof options.present === "function"
    ? options.present
    : async () => true;
  const diagnose = typeof options.diagnose === "function"
    ? options.diagnose
    : () => {};
  let generation = 0;
  let session = {
    token: 0,
    generation: 0,
    kind: "global",
    libraryId: "",
    collectionId: "",
    state: STATES.IDLE,
    signature: "",
    inFlightSignature: "",
    failedSignature: "",
    sourceIdentity: "",
    queryEpoch: ""
  };

  function itemFingerprint(items) {
    const source = Array.isArray(items) ? items : [];
    let hash = 2166136261;
    for (const item of source) {
      const id = String(
        item && typeof item === "object" ? item.id || "" : item || ""
      );
      for (let index = 0; index < id.length; index += 1) {
        hash ^= id.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      hash ^= 124;
      hash = Math.imul(hash, 16777619);
    }
    return `${source.length}:${hash >>> 0}`;
  }

  function publicSnapshot() {
    return {
      token: session.token,
      generation: session.generation,
      kind: session.kind,
      libraryId: session.libraryId,
      collectionId: session.collectionId,
      state: session.state,
      signature: session.signature,
      sourceIdentity: session.sourceIdentity,
      queryEpoch: session.queryEpoch,
      inFlight: Boolean(session.inFlightSignature)
    };
  }

  function emit(event, details = {}) {
    try {
      diagnose(event, {
        token: session.token,
        collectionId: session.collectionId,
        state: session.state,
        ...details
      });
    } catch {}
  }

  function enter(context = {}) {
    generation += 1;
    const kind = String(context.kind || "global");
    session = {
      token: generation,
      generation,
      kind,
      libraryId: String(context.libraryId || ""),
      collectionId: String(context.collectionId || ""),
      state: kind === "smart" ? STATES.LOADING : STATES.IDLE,
      signature: "",
      inFlightSignature: "",
      failedSignature: "",
      sourceIdentity: "",
      queryEpoch: ""
    };
    emit("context-enter");
    return publicSnapshot();
  }

  async function observe(input = {}) {
    if (Number(input.token) !== session.token) {
      return { ok: false, reason: "stale-token", state: session.state };
    }
    if (session.kind !== "smart") {
      return { ok: false, reason: "not-smart", state: session.state };
    }
    const items = Array.isArray(input.items) ? input.items.slice() : [];
    const queryComplete = input.queryComplete === true;
    const stable = input.stable === true;
    const sourceIdentity = String(input.sourceIdentity || "");
    const queryEpoch = String(input.queryEpoch || "");
    const sourceRejected = Boolean(sourceIdentity) && (
      !sourceIdentity.startsWith("eagle-smart-query:") || !queryEpoch
    );
    const sourceChanged = !sourceRejected && Boolean(sourceIdentity) && (
      (session.sourceIdentity && session.sourceIdentity !== sourceIdentity) ||
      (session.queryEpoch && session.queryEpoch !== queryEpoch)
    );
    if (sourceChanged) {
      generation += 1;
      session.token = generation;
      session.generation = generation;
      session.signature = "";
      session.inFlightSignature = "";
      session.failedSignature = "";
      session.state = STATES.LOADING;
      emit("query-epoch-enter", { sourceIdentity, queryEpoch });
    }
    if (!sourceRejected && sourceIdentity) {
      session.sourceIdentity = sourceIdentity;
      session.queryEpoch = queryEpoch;
    }
    const token = session.token;
    if (!queryComplete || !stable || sourceRejected) {
      session.state = sourceRejected ? STATES.LOADING : items.length > 0
        ? STATES.STABILIZING
        : queryComplete ? STATES.STABILIZING : STATES.LOADING;
      emit("host-pending", {
        count: items.length,
        queryComplete,
        stable,
        sourceIdentity,
        queryEpoch,
        sourceRejected
      });
      return {
        ok: false,
        reason: "host-not-stable",
        state: session.state,
        preserveVisible: true
      };
    }

    const signature =
      itemFingerprint(items) + ":" +
      String(input.overlayRevision || 0) + ":" +
      String(input.viewFingerprint || "");
    if (items.length === 0) {
      session.state = STATES.EMPTY;
      session.signature = signature;
      session.failedSignature = "";
      emit("host-empty");
      return {
        ok: true,
        reason: "stable-empty",
        state: session.state,
        preserveVisible: false
      };
    }
    if (
      signature === session.signature ||
      signature === session.failedSignature ||
      signature === session.inFlightSignature
    ) {
      return {
        ok: session.state === STATES.READY,
        reason: "duplicate-observation",
        state: session.state,
        failOpen: session.state === STATES.ERROR
      };
    }

    session.state = STATES.STABILIZING;
    session.inFlightSignature = signature;
    emit("present-start", {
      count: items.length,
      signature,
      sourceIdentity,
      queryEpoch
    });
    let presented = false;
    try {
      presented = await present({
        context: publicSnapshot(),
        token,
        libraryId: session.libraryId,
        collectionId: session.collectionId,
        items,
        sourceIdentity,
        queryEpoch,
        overlayRevision: Math.max(0, Number(input.overlayRevision) || 0)
      });
    } catch {
      presented = false;
    }
    if (token !== session.token) {
      return { ok: false, reason: "stale-token", state: session.state };
    }
    session.inFlightSignature = "";
    if (presented === false) {
      session.state = STATES.ERROR;
      session.failedSignature = signature;
      emit("present-fail-open", { signature });
      return {
        ok: false,
        reason: "presenter-failed",
        state: session.state,
        failOpen: true
      };
    }
    session.state = STATES.READY;
    session.signature = signature;
    session.failedSignature = "";
    emit("present-ready", { signature });
    return { ok: true, reason: "", state: session.state };
  }

  return Object.freeze({
    enter,
    observe,
    snapshot: publicSnapshot,
    itemFingerprint
  });
}

module.exports = {
  SMART_COLLECTION_STATES,
  createSmartCollectionLifecycleController
};
