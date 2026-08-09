"use strict";

// Eagle 4.0 keeps the complete smart result in `allData` and derives the
// current paged projection with `filtereds = allData.slice(0, len * page)`.
// Other host phases can alias these arrays, so names and reference inequality
// are not ownership proof. A current-view snapshot is authoritative only when
// route identity, the exact host reference, visible membership and an
// independently maintained advertised count all agree.
function selectSmartQuerySource(input = {}) {
  const filtered = Array.isArray(input.filtereds) ? input.filtereds : null;
  const allData = Array.isArray(input.allData) ? input.allData : null;
  const raw = Array.isArray(input.raw) ? input.raw : null;
  const evidence = input.smartQueryEvidence || {};
  const currentSmartRoute = evidence.routeKind === "smart" &&
    String(evidence.collectionId || "") &&
    String(evidence.collectionId || "") === String(evidence.currentSmartFolderId || "");
  const visibleIds = Array.isArray(evidence.visibleIds) ? evidence.visibleIds.map(String) : [];
  const filteredIds = new Set((filtered || []).map((item) => String(item?.id || "")));
  const allDataIds = new Set((allData || []).map((item) => String(item?.id || "")));
  const advertisedCount = Number(evidence.advertisedCount);
  const advertisedKnown = Number.isFinite(advertisedCount) && advertisedCount >= 0;
  const filteredCountMatches = advertisedKnown && filtered &&
    filteredIds.size === filtered.length && filteredIds.size === advertisedCount;
  const currentViewCountMatches = advertisedKnown && allData &&
    allDataIds.size === allData.length && allDataIds.size === advertisedCount;
  const filteredVisibleConsistent = visibleIds.every((id) => filteredIds.has(id));
  const filteredOwned = currentSmartRoute &&
    evidence.filteredReference === filtered &&
    filteredVisibleConsistent &&
    Boolean(evidence.queryIdentity);
  const explicitEmptyComplete = filtered && filtered !== raw && filtered.length === 0 &&
    evidence.routeKind === "smart" &&
    String(evidence.collectionId || "") === String(evidence.currentSmartFolderId || "") &&
    evidence.queryFinished === true &&
    evidence.paginationComplete === true &&
    Boolean(evidence.terminalEvidence || evidence.verifiedComplete) &&
    Boolean(evidence.sourceRevision);
  const strongCurrentViewEvidence = currentSmartRoute && allData &&
    evidence.currentViewReference === allData &&
    evidence.visibleConsistent === true &&
    evidence.queryFinished === true &&
    evidence.paginationComplete === true &&
    currentViewCountMatches;
  if (
    filtered && filtered !== raw && filteredOwned &&
    (filtered.length > 0 || explicitEmptyComplete) &&
    (filteredCountMatches || !strongCurrentViewEvidence)
  ) {
    return Object.freeze({
      kind: "filtered-query",
      sourceIdentity: "eagle-smart-query:filtereds",
      sourceReference: filtered,
      members: Object.freeze(filtered.slice())
    });
  }
  const currentViewEvidence =
    strongCurrentViewEvidence || (
      currentSmartRoute &&
      (!filtered || filtered.length === 0) &&
      allData &&
      allData !== raw &&
      evidence.currentViewReference === allData &&
      evidence.visibleConsistent === true
    );
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
function createSmartCollectionHostSnapshotAdapter(options = {}) {
  const minimumStableMs = Math.max(0, Number(options.minimumStableMs) || 150);
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
    stableObservations: 0,
    stableSince: 0,
    completeness: {}
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
    // This identifies query membership, not presentation order. A plugin
    // reorder of the same smart-result members must not manufacture a new
    // query epoch and cancel its own presentation transaction.
    ids.sort();
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
      sourceIdentity: session.sourceIdentity,
      completeness: Object.freeze({ ...(session.completeness || {}) })
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
      stableObservations: 0,
      stableSince: 0,
      completeness: {}
    };
    return snapshot();
  }

  function loading() {
    session.phase = "loading";
    session.members = [];
    session.visibleIds = [];
    session.memberFingerprint = "";
    session.completeness = {};
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
    const memberFingerprint = fingerprint(members);
    const candidateKey = `${sourceIdentity}|${queryEpoch}|${memberFingerprint}`;
    const observedAt = Number(input.observedAt) || Date.now();
    if (candidateKey !== session.stableKey) {
      session.stableKey = candidateKey;
      session.stableObservations = 1;
      session.stableSince = observedAt;
    } else {
      session.stableObservations += 1;
    }
    const completeness = input.completeness || {};
    const advertisedCount = Number(completeness.advertisedCount);
    const advertisedCountMatches = Number.isFinite(advertisedCount) &&
      advertisedCount === memberIds.size;
    const stableDurationMs = Math.max(0, observedAt - session.stableSince);
    const advertisedKnown = Number.isFinite(advertisedCount);
    const explicitTerminalEvidence = completeness.queryFinished === true &&
      completeness.paginationComplete === true &&
      Boolean(completeness.terminalEvidence || completeness.endOfResults) &&
      String(completeness.sourceRevision || "");
    const completeEvidence = completeness.verifiedComplete === true || (
      advertisedKnown
        ? advertisedCountMatches && completeness.queryFinished === true &&
          completeness.paginationComplete === true
        : explicitTerminalEvidence
    );
    const complete = input.queryComplete === true &&
      input.stable === true &&
      completeEvidence;
    session.completeness = {
      verifiedComplete: completeEvidence,
      queryFinished: completeness.queryFinished === true,
      paginationComplete: completeness.paginationComplete === true,
      advertisedCount: Number.isFinite(advertisedCount) ? advertisedCount : null,
      advertisedCountMatches,
      advertisedKnown,
      explicitTerminalEvidence: Boolean(explicitTerminalEvidence),
      sourceRevision: String(completeness.sourceRevision || ""),
      stableDurationMs
    };
    if (!trustedSource || !queryEpoch || !complete || !visibleConsistent) {
      if (!input.queryComplete || !input.stable || !trustedSource || !queryEpoch) {
        session.stableKey = "";
        session.stableObservations = 0;
        session.stableSince = 0;
      }
      return loading();
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
