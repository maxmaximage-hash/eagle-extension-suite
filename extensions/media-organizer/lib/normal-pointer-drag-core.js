"use strict";

function createNormalPointerDragRuntime(options = {}) {
  const thresholdPx = Number.isFinite(options.thresholdPx)
    ? Math.max(1, options.thresholdPx)
    : 8;
  let session = null;

  function cancel(reason = "cancelled") {
    session = null;
    return { ok: false, reason };
  }

  function down(input = {}) {
    if (
      input.button !== 0 ||
      input.isPrimary === false ||
      input.collectionKind !== "normal" ||
      input.manualAllowed !== true ||
      input.locked === true ||
      !input.sourceId ||
      !Number.isFinite(input.pointerId) ||
      !Number.isFinite(input.clientX) ||
      !Number.isFinite(input.clientY)
    ) {
      return { ok: false, reason: "not-eligible" };
    }
    session = {
      pointerId: input.pointerId,
      collectionId: String(input.collectionId || ""),
      sourceId: String(input.sourceId),
      selectedIds: Array.from(new Set((input.selectedIds || [input.sourceId]).map(String))),
      startX: input.clientX,
      startY: input.clientY,
      crossedThreshold: false,
      targetId: "",
      insertAfter: false,
      insideGrid: true
    };
    return { ok: true };
  }

  function move(input = {}) {
    if (!session || input.pointerId !== session.pointerId) {
      return { ok: false, reason: "no-session" };
    }
    session.crossedThreshold = session.crossedThreshold ||
      Math.hypot(input.clientX - session.startX, input.clientY - session.startY) >= thresholdPx;
    session.insideGrid = input.insideGrid !== false;
    if (session.insideGrid && input.targetId && !session.selectedIds.includes(String(input.targetId))) {
      session.targetId = String(input.targetId);
      session.insertAfter = input.insertAfter === true;
    }
    return {
      ok: true,
      crossedThreshold: session.crossedThreshold,
      targetId: session.targetId,
      insertAfter: session.insertAfter,
      insideGrid: session.insideGrid
    };
  }

  function up(input = {}) {
    if (!session || input.pointerId !== session.pointerId) {
      return cancel("no-session");
    }
    move(input);
    if (!session.crossedThreshold) return cancel("below-threshold");
    if (session.insideGrid !== true) return cancel("grid-outside");
    const targetId = String(input.targetId || session.targetId || "");
    if (!targetId || session.selectedIds.includes(targetId)) {
      return cancel("target-invalid");
    }
    const result = {
      ok: true,
      collectionId: session.collectionId,
      sourceId: session.sourceId,
      selectedIds: session.selectedIds.slice(),
      targetId,
      insertAfter: input.targetId ? input.insertAfter === true : session.insertAfter
    };
    session = null;
    return result;
  }

  return Object.freeze({
    down,
    move,
    up,
    cancel,
    snapshot: () => session && { ...session, selectedIds: session.selectedIds.slice() }
  });
}

module.exports = { createNormalPointerDragRuntime };
