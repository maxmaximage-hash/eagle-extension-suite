"use strict";

const SMART_FRAME_STATES = Object.freeze({
  INACTIVE: "inactive",
  LOADING: "loading",
  STABLE: "stable",
  FAILED: "failed"
});

function createSmartFirstVisibleFrameGate() {
  let generation = 0;
  let state = SMART_FRAME_STATES.INACTIVE;
  let identity = "";
  let fingerprint = "";
  function enter({ libraryId = "", collectionId = "" } = {}) {
    generation += 1;
    identity = `${libraryId}|${collectionId}`;
    fingerprint = "";
    state = SMART_FRAME_STATES.LOADING;
    return snapshot();
  }
  function commit(input = {}) {
    if (Number(input.generation) !== generation || String(input.identity || "") !== identity) {
      return false;
    }
    if (!input.verifiedComplete || !input.metadataReady || !input.dataOrderVerified || !input.visibleOrderVerified) {
      return false;
    }
    fingerprint = String(input.snapshotFingerprint || "");
    if (!fingerprint) return false;
    state = SMART_FRAME_STATES.STABLE;
    return true;
  }
  function fail(input = {}) {
    if (input.generation !== undefined && Number(input.generation) !== generation) return false;
    state = SMART_FRAME_STATES.FAILED;
    return true;
  }
  function leave() {
    generation += 1;
    state = SMART_FRAME_STATES.INACTIVE;
    identity = "";
    fingerprint = "";
    return snapshot();
  }
  function snapshot() {
    return Object.freeze({ generation, state, identity, fingerprint, hideUnverified: state === SMART_FRAME_STATES.LOADING });
  }
  return Object.freeze({ enter, commit, fail, leave, snapshot });
}

module.exports = { SMART_FRAME_STATES, createSmartFirstVisibleFrameGate };
