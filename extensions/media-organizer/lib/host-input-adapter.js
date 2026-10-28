"use strict";

function createHostInputAdapter(options = {}) {
  const createMoveCommand = options.createMoveCommand;
  if (typeof createMoveCommand !== "function") {
    throw new TypeError("createMoveCommand is required");
  }

  const thresholdPx = Number.isFinite(options.thresholdPx)
    ? Math.max(1, options.thresholdPx)
    : 8;
  const diagnosticLimit = Number.isFinite(options.diagnosticLimit)
    ? Math.max(1, Math.trunc(options.diagnosticLimit))
    : 64;
  const adapterId = String(options.adapterId || "");
  let session = null;
  let sequence = 0;
  const diagnosticEntries = [];

  function record(type, details = {}) {
    const entry = {
      sequence: ++sequence,
      type,
      adapterId,
      ...details
    };
    diagnosticEntries.push(entry);
    if (diagnosticEntries.length > diagnosticLimit) {
      diagnosticEntries.splice(
        0,
        diagnosticEntries.length - diagnosticLimit
      );
    }
    return entry;
  }

  function validSmartContext(input = {}) {
    return (
      input.collectionKind === "smart" &&
      input.targetKind === "direct-media" &&
      input.manualAllowed === true &&
      input.locked !== true &&
      input.preview !== true &&
      Boolean(String(input.libraryId || "")) &&
      Boolean(String(input.collectionId || ""))
    );
  }

  function sameContext(input = {}) {
    return (
      session &&
      validSmartContext(input) &&
      String(input.libraryId || "") === session.libraryId &&
      String(input.collectionId || "") === session.collectionId
    );
  }

  function sameGrid(input = {}) {
    if (session?.startGridKey && input.gridKey) {
      return String(input.gridKey) === session.startGridKey;
    }
    return (
      !session?.startGridIdentity ||
      !input.gridIdentity ||
      input.gridIdentity === session.startGridIdentity
    );
  }

  function cancel(reason = "cancelled") {
    if (!session) return { ok: false, reason: "no-session" };
    const cancelled = session;
    session = null;
    record("pointer-cancel", {
      reason,
      pointerId: cancelled.pointerId,
      libraryId: cancelled.libraryId,
      collectionId: cancelled.collectionId,
      sourceId: cancelled.sourceId
    });
    return { ok: false, reason };
  }

  function updateObservation(input = {}) {
    if (!session) return { ok: false, reason: "no-session" };
    if (Number.isFinite(input.clientX) && Number.isFinite(input.clientY)) {
      session.lastX = input.clientX;
      session.lastY = input.clientY;
      session.crossedThreshold =
        session.crossedThreshold ||
        Math.hypot(
          input.clientX - session.startX,
          input.clientY - session.startY
        ) >= thresholdPx;
    }
    if (input.insideGrid === true) session.lastInsideGrid = true;
    if (input.insideGrid === false) session.lastInsideGrid = false;

    const targetId = String(input.targetId || "");
    if (
      input.insideGrid === true &&
      targetId &&
      !session.selectedIds.includes(targetId)
    ) {
      session.targetId = targetId;
      session.insertAfter = input.insertAfter === true;
    }
    return {
      ok: true,
      crossedThreshold: session.crossedThreshold,
      targetId: session.targetId,
      insideGrid: session.lastInsideGrid
    };
  }

  function complete(input = {}, channel = "pointer") {
    if (!session) return { ok: false, reason: "no-session" };
    if (input.insideWindow === false) return cancel("window-outside");
    if (!sameContext(input)) {
      if (input.preview === true) return cancel("preview");
      if (input.locked === true) return cancel("locked");
      return cancel("context-changed");
    }
    if (!sameGrid(input)) return cancel("grid-mismatch");
    updateObservation(input);
    if (input.insideGrid === false) return cancel("grid-outside");
    const insideGrid =
      input.insideGrid === true ||
      (input.insideGrid === undefined && session.lastInsideGrid === true);
    if (!insideGrid) return cancel("grid-outside");
    if (!session.crossedThreshold) return cancel("below-threshold");

    const directTargetId = String(input.targetId || "");
    if (directTargetId && session.selectedIds.includes(directTargetId)) {
      return cancel("target-invalid");
    }
    const targetId = directTargetId || session.targetId;
    if (!targetId || session.selectedIds.includes(targetId)) {
      return cancel("target-invalid");
    }
    const insertAfter = directTargetId
      ? input.insertAfter === true
      : session.insertAfter;
    const completed = session;
    const result = createMoveCommand({
      libraryId: completed.libraryId,
      collectionId: completed.collectionId,
      collectionKind: "smart",
      sourceId: completed.sourceId,
      selectedIds: completed.selectedIds.slice(),
      targetId,
      insertAfter
    });
    if (!result?.ok || result.command?.type !== "MoveCommand") {
      return cancel(result?.reason || "move-command-rejected");
    }

    session = null;
    record("pointer-commit", {
      channel,
      pointerId: completed.pointerId,
      libraryId: completed.libraryId,
      collectionId: completed.collectionId,
      sourceId: completed.sourceId,
      selectedCount: completed.selectedIds.length,
      targetId,
      insertAfter
    });
    return {
      ok: true,
      command: result.command,
      selectedIds: completed.selectedIds.slice(),
      targetId,
      insertAfter
    };
  }

  function pointerDown(input = {}) {
    if (
      input.button !== 0 ||
      input.isPrimary === false ||
      !validSmartContext(input)
    ) {
      return { ok: false, reason: "not-eligible" };
    }
    const sourceId = String(input.sourceId || "");
    const selectedIds = Array.from(new Set(
      (Array.isArray(input.selectedIds) ? input.selectedIds : [sourceId])
        .map(String)
        .filter(Boolean)
    ));
    if (!sourceId || !selectedIds.includes(sourceId)) {
      return { ok: false, reason: "source-missing" };
    }
    if (
      !Number.isFinite(input.clientX) ||
      !Number.isFinite(input.clientY) ||
      !Number.isFinite(input.pointerId)
    ) {
      return { ok: false, reason: "pointer-invalid" };
    }

    if (
      session &&
      session.pointerId === input.pointerId &&
      session.libraryId === String(input.libraryId) &&
      session.collectionId === String(input.collectionId) &&
      session.sourceId === sourceId
    ) {
      record("pointer-reuse", {
        pointerId: session.pointerId,
        libraryId: session.libraryId,
        collectionId: session.collectionId,
        sourceId: session.sourceId
      });
      return { ok: true, reused: true };
    }
    if (session) cancel("replaced-session");
    session = {
      pointerId: input.pointerId,
      libraryId: String(input.libraryId),
      collectionId: String(input.collectionId),
      sourceId,
      selectedIds,
      startGridIdentity:
        input.startGridIdentity || input.gridIdentity || null,
      startGridKey: String(input.startGridKey || input.gridKey || ""),
      startX: input.clientX,
      startY: input.clientY,
      lastX: input.clientX,
      lastY: input.clientY,
      crossedThreshold: false,
      nativeDragActive: false,
      lastInsideGrid: true,
      targetId: "",
      insertAfter: false
    };
    record("pointer-start", {
      pointerId: session.pointerId,
      libraryId: session.libraryId,
      collectionId: session.collectionId,
      sourceId,
      selectedCount: selectedIds.length
    });
    return { ok: true };
  }

  function pointerMove(input = {}) {
    if (!session) return { ok: false, reason: "no-session" };
    if (input.pointerId !== session.pointerId) {
      // A lost pointerup must not strand the previous session and reject all
      // subsequent drags. Eagle can recycle pointer IDs after a cancelled
      // virtual-grid drag, so clear ownership at the boundary.
      return cancel("pointer-mismatch");
    }
    if (!sameContext(input)) return cancel("context-invalid");
    if (!sameGrid(input)) return cancel("grid-mismatch");
    if (!Number.isFinite(input.clientX) || !Number.isFinite(input.clientY)) {
      return cancel("pointer-invalid");
    }

    updateObservation(input);
    return {
      ok: true,
      active: true,
      crossedThreshold: session.crossedThreshold,
      targetId: session.targetId
    };
  }

  function pointerUp(input = {}) {
    if (!session) return { ok: false, reason: "no-session" };
    if (input.pointerId !== session.pointerId) {
      return cancel("pointer-mismatch");
    }
    if (session.nativeDragActive) {
      if (input.insideWindow !== true) return cancel("window-outside");
      if (!sameContext(input)) {
        if (input.preview === true) return cancel("preview");
        if (input.locked === true) return cancel("locked");
        return cancel("context-changed");
      }
      if (!sameGrid(input)) return cancel("grid-mismatch");
      if (input.insideGrid === false) return cancel("grid-outside");
      updateObservation({
        ...input,
        targetId: String(input.targetId || "") &&
          !session.selectedIds.includes(String(input.targetId))
          ? input.targetId
          : ""
      });
      return { ok: false, reason: "native-drag-pending" };
    }
    if (!Number.isFinite(input.clientX) || !Number.isFinite(input.clientY)) {
      return cancel("pointer-invalid");
    }
    return complete(input, "pointer");
  }

  function nativeDragStart(input = {}) {
    if (!session) return { ok: false, reason: "no-session" };
    if (!sameContext(input)) return cancel("context-changed");
    if (!sameGrid(input)) return cancel("grid-mismatch");
    const sourceId = String(input.sourceId || session.sourceId);
    if (sourceId !== session.sourceId) return cancel("source-changed");
    session.nativeDragActive = true;
    updateObservation(input);
    record("native-drag-start", {
      pointerId: session.pointerId,
      libraryId: session.libraryId,
      collectionId: session.collectionId,
      sourceId: session.sourceId
    });
    return { ok: true };
  }

  function nativeDrag(input = {}) {
    if (!session) return { ok: false, reason: "no-session" };
    if (!session.nativeDragActive) {
      return { ok: false, reason: "native-drag-inactive" };
    }
    if (!sameContext(input)) return cancel("context-changed");
    if (!sameGrid(input)) return cancel("grid-mismatch");
    const previousTargetId = session.targetId;
    const previousInsideGrid = session.lastInsideGrid;
    const result = updateObservation(input);
    if (
      session.targetId !== previousTargetId ||
      session.lastInsideGrid !== previousInsideGrid
    ) {
      record("native-drag-target", {
        pointerId: session.pointerId,
        libraryId: session.libraryId,
        collectionId: session.collectionId,
        sourceId: session.sourceId,
        targetId: session.targetId,
        insideGrid: session.lastInsideGrid,
        insertAfter: session.insertAfter
      });
    }
    return result;
  }

  function nativeDragEnd(input = {}) {
    if (!session) return { ok: false, reason: "no-session" };
    if (!session.nativeDragActive) {
      return { ok: false, reason: "native-drag-inactive" };
    }
    return complete(input, "native-drag");
  }

  return {
    pointerDown,
    pointerMove,
    pointerUp,
    nativeDragStart,
    nativeDrag,
    nativeDragEnd,
    escape: () => cancel("escape"),
    previewOpened: () => cancel("preview"),
    lockChanged: () => cancel("locked"),
    contextChanged: () => cancel("context-changed"),
    windowBlurred: () => cancel("window-blur"),
    pointerCancelled: () => cancel("pointer-cancelled"),
    nativeDropCommitted: () => cancel("native-drop-committed"),
    diagnostics: () => diagnosticEntries.map((entry) => ({ ...entry })),
    snapshot: () => ({
      active: Boolean(session),
      session: session
        ? {
            pointerId: session.pointerId,
            libraryId: session.libraryId,
            collectionId: session.collectionId,
            sourceId: session.sourceId,
            selectedIds: session.selectedIds.slice(),
            startGridIdentity: session.startGridIdentity,
            startGridKey: session.startGridKey,
            crossedThreshold: session.crossedThreshold,
            nativeDragActive: session.nativeDragActive,
            lastInsideGrid: session.lastInsideGrid,
            targetId: session.targetId,
            insertAfter: session.insertAfter
          }
        : null
    })
  };
}

module.exports = {
  createHostInputAdapter
};
