"use strict";

const { metadataProofMatches } = require("./smart-metadata-proof-core.js");

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
  const requireReadyProofs = options.requireReadyProofs === true;
  const onReady = typeof options.onReady === "function"
    ? options.onReady
    : async () => {};
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
    queryEpoch: "",
    snapshotFingerprint: "",
    metadataReady: false,
    dataOrderVerified: false,
    visibleOrderVerified: false,
    overlayRevision: 0
  };

  function itemFingerprint(items) {
    const source = (Array.isArray(items) ? items : [])
      .map((item) => String(
        item && typeof item === "object" ? item.id || "" : item || ""
      ))
      .filter(Boolean)
      .sort();
    let hash = 2166136261;
    for (const id of source) {
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
      snapshotFingerprint: session.snapshotFingerprint,
      metadataReady: session.metadataReady,
      dataOrderVerified: session.dataOrderVerified,
      visibleOrderVerified: session.visibleOrderVerified,
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

  function boundedErrorStack(error) {
    return String(error?.stack || "")
      .split("\n")
      .slice(0, 8)
      .join("\n")
      .slice(0, 1600);
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
      queryEpoch: "",
      snapshotFingerprint: "",
      metadataReady: false,
      dataOrderVerified: false,
      visibleOrderVerified: false,
      overlayRevision: 0
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
    const overlayRevision = Math.max(0, Number(input.overlayRevision) || 0);
    const sourceIdentity = String(input.sourceIdentity || "");
    const queryEpoch = String(input.queryEpoch || "");
    const snapshotFingerprint = String(
      input.snapshotFingerprint || input.viewFingerprint || ""
    );
    const metadataProof = input.metadataProof || {};
    const metadataReady = requireReadyProofs
      ? metadataProofMatches(metadataProof, {
          libraryId: session.libraryId,
          collectionId: session.collectionId,
          snapshotGeneration: input.snapshotGeneration,
          snapshotFingerprint
        })
      : input.metadataReady === true;
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

    // A manual smart-folder move owns the host arrays for its overlay
    // revision. If an automatic lifecycle presentation is still awaiting
    // Eagle's virtual-window repaint when that revision advances, invalidate
    // the old token before it can commit or roll back allData/filtereds. The
    // next observation gets a fresh token and may present the newer plan;
    // the late result sees a stale token and is discarded.
    if (
      !sourceChanged &&
      session.inFlightSignature &&
      overlayRevision !== session.overlayRevision
    ) {
      generation += 1;
      session.token = generation;
      session.generation = generation;
      session.signature = "";
      session.inFlightSignature = "";
      session.failedSignature = "";
      session.state = STATES.LOADING;
      session.dataOrderVerified = false;
      session.visibleOrderVerified = false;
      emit("overlay-revision-enter", {
        fromRevision: session.overlayRevision,
        toRevision: overlayRevision
      });
    }
    session.overlayRevision = overlayRevision;
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
      String(overlayRevision) + ":" +
      String(input.viewFingerprint || "");
    if (requireReadyProofs && (!metadataReady || !snapshotFingerprint)) {
      session.state = STATES.STABILIZING;
      session.metadataReady = metadataReady;
      emit("final-order-pending", {
        count: items.length,
        metadataReady,
        snapshotFingerprint,
        sourceIdentity,
        queryEpoch
      });
      return {
        ok: false,
        reason: metadataReady ? "snapshot-fingerprint-required" : "metadata-not-ready",
        state: session.state,
        preserveVisible: true
      };
    }
    if (items.length === 0) {
      session.state = STATES.STABILIZING;
      let emptyCommitted = false;
      try {
        emptyCommitted = await onReady(Object.freeze({
          context: publicSnapshot(),
          token,
          libraryId: session.libraryId,
          collectionId: session.collectionId,
          snapshotGeneration: Number(input.snapshotGeneration || 0),
          snapshotFingerprint,
          frameGeneration: Number(input.frameGeneration || 0),
          metadataProof,
          empty: true,
          presentation: Object.freeze({
            ok: true,
            dataOrderVerified: true,
            visibleOrderVerified: true,
            finalItems: Object.freeze([])
          })
        })) !== false;
      } catch {
        emptyCommitted = false;
      }
      if (token !== session.token) {
        return { ok: false, reason: "stale-token", state: session.state };
      }
      if (!emptyCommitted) {
        session.state = STATES.ERROR;
        session.failedSignature = signature;
        emit("empty-commit-failed", { signature });
        return { ok: false, reason: "empty-commit-failed", state: session.state, failOpen: true };
      }
      session.state = STATES.EMPTY;
      session.signature = signature;
      session.snapshotFingerprint = snapshotFingerprint;
      session.metadataReady = metadataReady;
      session.dataOrderVerified = true;
      session.visibleOrderVerified = true;
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
    let presentationError = null;
    try {
      presented = await present({
        context: publicSnapshot(),
        token,
        libraryId: session.libraryId,
        collectionId: session.collectionId,
        items,
        sourceIdentity,
        queryEpoch,
        overlayRevision: Math.max(0, Number(input.overlayRevision) || 0),
        snapshotFingerprint,
        metadataReady,
        metadataProof,
        snapshotGeneration: Number(input.snapshotGeneration || 0),
        frameGeneration: Number(input.frameGeneration || 0),
        finalItems: Array.isArray(input.finalItems) ? input.finalItems.slice() : items.slice(),
        expectedVisibleIds: Array.isArray(input.expectedVisibleIds)
          ? input.expectedVisibleIds.slice()
          : []
      });
    } catch (error) {
      presentationError = {
        name: String(error?.name || "Error").slice(0, 80),
        message: String(error?.message || error || "presentation failed").slice(0, 240),
        stage: String(error?.presentationStage || "unknown").slice(0, 120),
        stack: boundedErrorStack(error)
      };
      presented = {
        ok: false,
        reason: "present-threw",
        errorName: presentationError.name,
        errorMessage: presentationError.message,
        presentationStage: presentationError.stage,
        errorStack: presentationError.stack
      };
    }
    if (token !== session.token) {
      return { ok: false, reason: "stale-token", state: session.state };
    }
    session.inFlightSignature = "";
    const presentationOk = presented === true || presented?.ok === true;
    const dataOrderVerified = presented?.dataOrderVerified === true;
    const visibleOrderVerified = presented?.visibleOrderVerified === true;
    if (
      !presentationOk ||
      (requireReadyProofs && (!dataOrderVerified || !visibleOrderVerified))
    ) {
      session.state = STATES.ERROR;
      session.failedSignature = signature;
      emit("present-fail-open", {
        signature,
        reason: String(presented?.reason || "presenter-failed"),
        ...(presentationError ? {
          errorName: presentationError.name,
          errorMessage: presentationError.message,
          presentationStage: presentationError.stage,
          errorStack: presentationError.stack
        } : {}),
        dataOrderVerified,
        visibleOrderVerified
      });
      return {
        ok: false,
        reason: String(presented?.reason || "presenter-failed"),
        state: session.state,
        failOpen: true
      };
    }
    let committed = false;
    try {
      committed = await onReady(Object.freeze({
        context: publicSnapshot(),
        token,
        libraryId: session.libraryId,
        collectionId: session.collectionId,
        snapshotGeneration: Number(input.snapshotGeneration || 0),
        snapshotFingerprint,
        frameGeneration: Number(input.frameGeneration || 0),
        metadataProof,
        presentation: presented
      })) !== false;
    } catch {
      committed = false;
    }
    if (token !== session.token) {
      return { ok: false, reason: "stale-token", state: session.state };
    }
    if (!committed) {
      session.state = STATES.ERROR;
      session.failedSignature = signature;
      session.inFlightSignature = "";
      emit("ready-commit-failed", { signature });
      return { ok: false, reason: "ready-commit-failed", state: session.state, failOpen: true };
    }
    session.state = STATES.READY;
    session.signature = signature;
    session.snapshotFingerprint = snapshotFingerprint;
    session.metadataReady = metadataReady;
    session.dataOrderVerified = requireReadyProofs ? dataOrderVerified : presentationOk;
    session.visibleOrderVerified = requireReadyProofs ? visibleOrderVerified : presentationOk;
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
