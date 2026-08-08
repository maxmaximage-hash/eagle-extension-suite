"use strict";

const NATIVE = "eagle";
const SORTING = "sorting";

function createEventOwnership({
  enabled = false,
  windowId = "",
  hostAppId = "host",
  collectionId = ""
} = {}) {
  let active = enabled === true;
  let currentWindowId = String(windowId || "");
  let currentHostAppId = String(hostAppId || "host");
  let currentCollectionId = String(collectionId || "");

  function native(reason) {
    return {
      owner: NATIVE,
      canPreventDefault: false,
      reason: String(reason)
    };
  }

  function classify(event = {}) {
    if (!active) return native("module-disabled");
    if (event.type === "dragstart") return native("native-dragstart");
    if (event.type !== "dragover" && event.type !== "drop") {
      return native("non-sorting-event");
    }
    if (event.cancelled === true) return native("cancelled");
    if (event.leftWindow === true) return native("left-window");
    if (!currentWindowId || String(event.windowId || "") !== currentWindowId) {
      return native("cross-window");
    }
    if (
      event.external === true ||
      (event.sourceAppId && String(event.sourceAppId) !== currentHostAppId)
    ) {
      return native("cross-application");
    }
    const target = event.target;
    if (target?.kind !== "grid") return native("unknown-target");
    if (!currentCollectionId || String(target.collectionId || "") !== currentCollectionId) {
      return native("collection-mismatch");
    }
    if (target.valid !== true) return native("invalid-grid-drop");
    return {
      owner: SORTING,
      canPreventDefault: true,
      reason: "valid-grid-drop"
    };
  }

  function setEnabled(nextEnabled) {
    active = nextEnabled === true;
    return active;
  }

  function setContext(nextContext = {}) {
    currentWindowId = String(nextContext.windowId || "");
    currentHostAppId = String(nextContext.hostAppId || currentHostAppId);
    currentCollectionId = String(nextContext.collectionId || "");
  }

  return Object.freeze({
    classify,
    setEnabled,
    setContext,
    isEnabled: () => active
  });
}

function applyEventOwnership(event, decision) {
  if (!decision || decision.owner !== SORTING || !decision.canPreventDefault) {
    return false;
  }
  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.stopImmediatePropagation?.();
  return true;
}

module.exports = {
  NATIVE,
  SORTING,
  createEventOwnership,
  applyEventOwnership
};
