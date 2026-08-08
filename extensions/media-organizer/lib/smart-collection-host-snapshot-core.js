"use strict";

// `filtereds` is the only host slot that denotes a smart-query result. Eagle
// can legitimately alias it to allData after the query settles, so reference
// inequality is not a valid ownership test. allData/raw are deliberately not
// candidates here: callers must pass the explicit filtered-query slot.
function selectSmartQuerySource(input = {}) {
  const filtered = Array.isArray(input.filtereds) ? input.filtereds : null;
  const allData = Array.isArray(input.allData) ? input.allData : null;
  const raw = Array.isArray(input.raw) ? input.raw : null;
  const evidence = input.smartQueryEvidence || {};
  if (filtered && filtered !== raw && filtered.length > 0) {
    return Object.freeze({
      kind: "filtered-query",
      sourceIdentity: "eagle-smart-query:filtereds",
      sourceReference: filtered,
      members: Object.freeze(filtered.slice())
    });
  }
  const currentViewEvidence =
    evidence.routeKind === "smart" &&
    String(evidence.collectionId || "") === String(evidence.currentSmartFolderId || "") &&
    allData &&
    allData !== raw &&
    evidence.sourceReference === allData &&
    evidence.visibleConsistent === true;
  if (currentViewEvidence) {
    return Object.freeze({
      kind: "filtered-query",
      sourceIdentity: "eagle-smart-query:current-view",
      sourceReference: allData,
      members: Object.freeze(allData.slice())
    });
  }
  return Object.freeze({
    kind: "untrusted",
    sourceIdentity: "",
    sourceReference: null,
    members: Object.freeze([])
  });
}

// Owns the distinction between Eagle's smart-query result and its transient
// library-wide view buffers. It is deliberately host-agnostic so the host
// adapter, lifecycle and sorting gate share one member truth.
function createSmartCollectionHostSnapshotAdapter() {
  let generation = 0;
  let session = {
    generation: 0,
    libraryId: "",
    collectionId: "",
    phase: "loading",
    queryEpoch: "",
    sourceIdentity: "",
    members: [],
    visibleIds: [],
    memberFingerprint: "",
    stableKey: "",
    stableObservations: 0
  };

  function idOf(value) {
    return String(value && typeof value === "object" ? value.id || "" : value || "");
  }

  function fingerprint(values) {
    let hash = 2166136261;
    const ids = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : []) {
      const id = idOf(value);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    for (const id of ids) {
      for (let index = 0; index < id.length; index += 1) {
        hash ^= id.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      hash ^= 124;
      hash = Math.imul(hash, 16777619);
    }
    return `${ids.length}:${hash >>> 0}`;
  }

  function snapshot() {
    return Object.freeze({
      phase: session.phase,
      generation: session.generation,
      queryEpoch: session.queryEpoch,
      libraryId: session.libraryId,
      collectionId: session.collectionId,
      members: Object.freeze(session.members.slice()),
      visibleIds: Object.freeze(session.visibleIds.slice()),
      memberFingerprint: session.memberFingerprint,
      sourceIdentity: session.sourceIdentity
    });
  }

  function enter(context = {}) {
    generation += 1;
    session = {
      generation,
      libraryId: String(context.libraryId || ""),
      collectionId: String(context.collectionId || ""),
      phase: "loading",
      queryEpoch: "",
      sourceIdentity: "",
      members: [],
      visibleIds: [],
      memberFingerprint: "",
      stableKey: "",
      stableObservations: 0
    };
    return snapshot();
  }

  function loading() {
    session.phase = "loading";
    session.members = [];
    session.visibleIds = [];
    session.memberFingerprint = "";
    return snapshot();
  }

  function observe(input = {}) {
    const libraryId = String(input.libraryId || "");
    const collectionId = String(input.collectionId || "");
    if (
      !libraryId || !collectionId ||
      libraryId !== session.libraryId || collectionId !== session.collectionId
    ) {
      return loading();
    }
    const sourceIdentity = String(input.sourceIdentity || "");
    const queryEpoch = String(input.queryEpoch || "");
    // The host adapter reserves these identities for fallback buffers. They
    // are never proof of smart membership, regardless of their item count.
    const trustedSource = sourceIdentity.startsWith("eagle-smart-query:");
    const members = Array.isArray(input.members) ? input.members.slice() : [];
    const visibleIds = Array.from(new Set(
      (Array.isArray(input.visibleIds) ? input.visibleIds : []).map(idOf).filter(Boolean)
    ));
    const memberIds = new Set(members.map(idOf).filter(Boolean));
    const visibleConsistent = visibleIds.every((id) => memberIds.has(id));
    const complete = input.queryComplete === true && input.stable === true;
    if (!trustedSource || !queryEpoch || !complete || !visibleConsistent) {
      session.stableKey = "";
      session.stableObservations = 0;
      return loading();
    }

    const memberFingerprint = fingerprint(members);
    const key = `${sourceIdentity}|${queryEpoch}|${memberFingerprint}|${visibleIds.join(",")}`;
    if (key === session.stableKey) session.stableObservations += 1;
    else {
      session.stableKey = key;
      session.stableObservations = 1;
    }
    session.queryEpoch = queryEpoch;
    session.sourceIdentity = sourceIdentity;
    if (session.stableObservations < 2) return loading();
    session.members = members;
    session.visibleIds = visibleIds;
    session.memberFingerprint = memberFingerprint;
    session.phase = members.length === 0 ? "empty" : "ready";
    return snapshot();
  }

  return Object.freeze({ enter, observe, snapshot, fingerprint });
}

module.exports = {
  createSmartCollectionHostSnapshotAdapter,
  selectSmartQuerySource
};
