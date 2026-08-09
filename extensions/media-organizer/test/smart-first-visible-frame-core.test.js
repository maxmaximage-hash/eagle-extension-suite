"use strict";
const assert = require("assert");
const { createSmartFirstVisibleFrameGate } = require("../lib/smart-first-visible-frame-core");
const gate = createSmartFirstVisibleFrameGate();
const entered = gate.enter({ libraryId: "library", collectionId: "smart" });
assert.strictEqual(entered.hideUnverified, true, "the first frame must be an explicit loading surface, never known-wrong native order");
for (const missing of ["verifiedComplete", "metadataReady", "dataOrderVerified", "visibleOrderVerified"]) {
  const proof = { generation: entered.generation, identity: entered.identity, snapshotFingerprint: "571:final", verifiedComplete: true, metadataReady: true, dataOrderVerified: true, visibleOrderVerified: true };
  proof[missing] = false;
  assert.strictEqual(gate.commit(proof), false, `READY must require ${missing}`);
}
assert.strictEqual(gate.commit({ generation: entered.generation, identity: entered.identity, snapshotFingerprint: "571:final", verifiedComplete: true, metadataReady: true, dataOrderVerified: true, visibleOrderVerified: true }), true);
assert.strictEqual(gate.snapshot().state, "stable");
gate.enter({ libraryId: "library", collectionId: "next" });
assert.strictEqual(gate.commit({ generation: entered.generation, identity: entered.identity, snapshotFingerprint: "old", verifiedComplete: true, metadataReady: true, dataOrderVerified: true, visibleOrderVerified: true }), false, "late generations must be discarded");
const firstA = gate.enter({ libraryId: "library", collectionId: "smart-a" });
gate.enter({ libraryId: "library", collectionId: "smart-b" });
const secondA = gate.enter({ libraryId: "library", collectionId: "smart-a" });
assert.strictEqual(gate.commit({ generation: firstA.generation, identity: firstA.identity, snapshotFingerprint: "old-a", verifiedComplete: true, metadataReady: true, dataOrderVerified: true, visibleOrderVerified: true }), false, "A→B→A must not let the first A request borrow the new A generation");
assert.strictEqual(gate.commit({ generation: secondA.generation, identity: secondA.identity, snapshotFingerprint: "new-a", verifiedComplete: true, metadataReady: true, dataOrderVerified: true, visibleOrderVerified: true }), true);
console.log("smart first visible frame core tests passed");
