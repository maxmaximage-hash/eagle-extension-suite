"use strict";

function createDragFeedbackController(options = {}) {
  const documentPort = options.document ||
    (typeof document !== "undefined" ? document : null);
  if (!documentPort?.body || typeof documentPort.querySelectorAll !== "function") {
    throw new TypeError("document port is required");
  }
  const schedule = typeof options.schedule === "function"
    ? options.schedule
    : (callback, delay) => setTimeout(callback, delay);
  const cancelScheduled = typeof options.cancelScheduled === "function"
    ? options.cancelScheduled
    : (timer) => clearTimeout(timer);
  const readComputedStyle = typeof options.getComputedStyle === "function"
    ? options.getComputedStyle
    : (typeof getComputedStyle === "function" ? getComputedStyle : null);
  const postCleanupDelays = Array.isArray(options.postCleanupDelays)
    ? options.postCleanupDelays.slice()
    : [0, 120, 400];

  let active = false;
  let activeMode = null;
  let selectedIds = new Set();
  let markedHelper = null;
  let markedCard = null;
  let markedHostCard = null;
  let markedHelperSnapshot = null;
  let cleanupTimers = [];
  const smartHelperStyleProperties = [
    "display",
    "position",
    "top",
    "bottom",
    "height",
    "pointer-events",
    "z-index"
  ];

  function helpers() {
    return Array.from(
      documentPort.querySelectorAll(".box-sortable-helper") || []
    );
  }

  function clearScheduledCleanup() {
    for (const timer of cleanupTimers) cancelScheduled(timer);
    cleanupTimers = [];
  }

  function snapshotInlineStyle(element) {
    return smartHelperStyleProperties.map((name) => ({
      name,
      value: element?.style?.getPropertyValue?.(name) || "",
      priority: element?.style?.getPropertyPriority?.(name) || ""
    }));
  }

  function restoreInlineStyle(element, snapshot) {
    for (const entry of Array.isArray(snapshot) ? snapshot : []) {
      if (entry.value) {
        element?.style?.setProperty?.(
          entry.name,
          entry.value,
          entry.priority
        );
      } else {
        element?.style?.removeProperty?.(entry.name);
      }
    }
  }

  function clearMarkedTarget(mode = activeMode) {
    const restoredHelper = markedHelper;
    const restoredDragOver = markedHelperSnapshot?.hadDragOver === true;
    if (markedHelperSnapshot) {
      restoreInlineStyle(markedHelper, markedHelperSnapshot.styles);
      markedHelper?.classList?.remove?.("eagle-photo-smart-active-helper");
    }
    if (normalizeMode(mode) === "normal") {
      for (const helper of Array.from(
        documentPort.querySelectorAll(".box-sortable-helper.drag-over") || []
      )) {
        helper.classList?.remove?.("drag-over");
      }
    } else if (!restoredDragOver) {
      restoredHelper?.classList?.remove?.("drag-over");
    }
    for (const card of Array.from(
      documentPort.querySelectorAll(".box.eagle-photo-drop-target") || []
    )) {
      card.classList?.remove?.(
        "eagle-photo-drop-target",
        "eagle-photo-drop-before",
        "eagle-photo-drop-after"
      );
    }
    markedHostCard?.classList?.remove?.("eagle-photo-smart-target-host");
    if (restoredDragOver) restoredHelper?.classList?.add?.("drag-over");
    markedHelper = null;
    markedCard = null;
    markedHostCard = null;
    markedHelperSnapshot = null;
  }

  function normalizeMode(mode) {
    return mode === "smart" ? "smart" : "normal";
  }

  function projectTargets(visible, mode) {
    const projectionMode = normalizeMode(mode);
    documentPort.body.classList.toggle(
      "eagle-photo-smart-dragging",
      visible === true && projectionMode === "smart"
    );
    documentPort.body.classList.toggle(
      "eagle-photo-sort-dragging",
      visible === true && projectionMode === "normal"
    );
    // Smart mode must never expose every helper: they participate in Eagle's
    // masonry layout. update() may project only the single current helper after
    // making it absolute and preserving its complete inline style for restore.
    if (projectionMode === "smart") return;
    for (const helper of helpers()) {
      const card = helper.closest?.(".box");
      const itemId = String(card?.getAttribute?.("data-box-id") || "");
      const eligible = visible === true &&
        itemId &&
        !selectedIds.has(itemId) &&
        !card.classList?.contains?.("pinned");
      if (eligible) {
        helper.style?.setProperty?.("display", "block", "important");
      } else {
        helper.style?.removeProperty?.("display");
        helper.classList?.remove?.("drag-over");
      }
    }
  }

  function hideVisual(mode = activeMode) {
    clearMarkedTarget(mode);
    projectTargets(false, mode);
  }

  function start(nextSelectedIds = [], options = {}) {
    clearScheduledCleanup();
    const nextMode = normalizeMode(options.mode);
    const nextSelected = new Set(
      (Array.isArray(nextSelectedIds) ? nextSelectedIds : [])
        .map(String)
        .filter(Boolean)
    );
    const sameSelection = nextSelected.size === selectedIds.size &&
      Array.from(nextSelected).every((id) => selectedIds.has(id));
    if (!active || !sameSelection || activeMode !== nextMode) {
      if (active && activeMode !== nextMode) hideVisual(activeMode);
      else clearMarkedTarget();
    }
    active = true;
    activeMode = nextMode;
    selectedIds = nextSelected;
    projectTargets(true, activeMode);
    return state();
  }

  function update(target = {}) {
    const targetMode = normalizeMode(target.mode || activeMode);
    if (!active || activeMode !== targetMode) {
      start(target.selectedIds || Array.from(selectedIds), {
        mode: targetMode
      });
    }

    // Chromium may report the source/native drag surface between two real
    // dragover frames. It is not evidence that the pointer left the grid, so
    // keep the last valid visible target instead of creating a blue-frame race.
    if (target.insideGrid === undefined) return state();

    if (target.insideGrid === false) {
      hideVisual(activeMode);
      return state();
    }

    projectTargets(true, activeMode);
    const targetId = String(target.targetId || "");
    const targetBox = target.targetBox || null;
    if (
      !targetId ||
      selectedIds.has(targetId) ||
      targetBox?.classList?.contains?.("pinned")
    ) {
      clearMarkedTarget();
      return state();
    }

    const helper = target.helper || null;
    if (activeMode === "normal" && helper) {
      if (markedHelper !== helper || markedCard) clearMarkedTarget();
      helper.classList?.add?.("drag-over");
      markedHelper = helper;
      markedCard = null;
      return state();
    }

    if (activeMode === "smart" && helper && targetBox) {
      if (
        markedHelper !== helper ||
        markedHostCard !== targetBox ||
        markedCard
      ) {
        clearMarkedTarget();
      }
      if (!markedHelperSnapshot) {
        markedHelperSnapshot = {
          hadDragOver: helper.classList?.contains?.("drag-over") === true,
          styles: snapshotInlineStyle(helper)
        };
      }
      helper.style?.setProperty?.("display", "block", "important");
      helper.style?.setProperty?.("position", "absolute", "important");
      helper.style?.setProperty?.("top", "0", "important");
      helper.style?.setProperty?.("bottom", "0", "important");
      helper.style?.setProperty?.("height", "auto", "important");
      helper.style?.setProperty?.("pointer-events", "none", "important");
      helper.style?.setProperty?.("z-index", "2147483500", "important");
      helper.classList?.add?.(
        "eagle-photo-smart-active-helper",
        "drag-over"
      );
      markedHelper = helper;
      markedCard = null;
      markedHostCard = null;
      return state();
    }

    // A rare smart virtual card can omit Eagle's helper child. The fallback is
    // a full-height pseudo-element on the existing card, never an inset shadow,
    // overlay, pointer capture or second drag state machine.
    if (targetBox) {
      if (markedCard !== targetBox || markedHelper) clearMarkedTarget();
      const computedPosition = String(
        readComputedStyle?.(targetBox)?.position || ""
      ).toLowerCase();
      if (!computedPosition || computedPosition === "static") {
        clearMarkedTarget();
        return state();
      }
      targetBox.classList?.add?.(
        "eagle-photo-smart-target-host",
        "eagle-photo-drop-target",
        target.insertAfter === true
          ? "eagle-photo-drop-after"
          : "eagle-photo-drop-before"
      );
      targetBox.classList?.remove?.(
        target.insertAfter === true
          ? "eagle-photo-drop-before"
          : "eagle-photo-drop-after"
      );
      markedCard = targetBox;
      markedHelper = null;
      markedHostCard = targetBox;
    } else {
      clearMarkedTarget();
    }
    return state();
  }

  function clear(options = {}) {
    clearScheduledCleanup();
    const endingMode = activeMode;
    active = false;
    activeMode = null;
    selectedIds = new Set();
    hideVisual(endingMode);
    if (options.schedulePostCleanup !== false) {
      cleanupTimers = postCleanupDelays.map((delay) =>
        schedule(() => hideVisual(endingMode), delay)
      );
    }
    return state();
  }

  function state() {
    return {
      active,
      mode: activeMode,
      selectedIds: Array.from(selectedIds),
      hasHelper: Boolean(markedHelper),
      hasCardFallback: Boolean(markedCard)
    };
  }

  return {
    start,
    update,
    clear,
    state
  };
}

module.exports = {
  createDragFeedbackController
};
