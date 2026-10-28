"use strict";

function createSmartDragTargetResolver(options = {}) {
  const gridSelector = options.gridSelector || "#box-list";
  const cardSelector = options.cardSelector || ".box";
  const helperSelector = options.helperSelector || ".box-sortable-helper";
  const elementsFromPoint = typeof options.elementsFromPoint === "function"
    ? options.elementsFromPoint
    : (clientX, clientY) => {
        if (typeof document === "undefined") return [];
        if (typeof document.elementsFromPoint === "function") {
          return document.elementsFromPoint(clientX, clientY);
        }
        const element = document.elementFromPoint?.(clientX, clientY);
        return element ? [element] : [];
      };

  function closest(element, selector) {
    if (!element || element.isConnected === false) return null;
    try {
      if (element.matches?.(selector)) return element;
      return element.closest?.(selector) || null;
    } catch {
      return null;
    }
  }

  function eventPath(event = {}) {
    try {
      const path = event.composedPath?.();
      if (Array.isArray(path)) return path;
    } catch {}
    const path = [];
    let current = event.target || null;
    while (current) {
      path.push(current);
      current = current.parentElement || current.parentNode || null;
    }
    return path;
  }

  function pointPath(event = {}) {
    if (
      !Number.isFinite(event.clientX) ||
      !Number.isFinite(event.clientY)
    ) {
      return [];
    }
    try {
      const elements = elementsFromPoint(event.clientX, event.clientY);
      return Array.isArray(elements) ? elements : Array.from(elements || []);
    } catch {
      return [];
    }
  }

  function uniqueElements(values) {
    const seen = new Set();
    return values.filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  function cardId(card) {
    const dataId = String(
      card?.getAttribute?.("data-box-id") ||
      card?.dataset?.boxId ||
      ""
    );
    if (dataId) return dataId;
    const elementId = String(card?.id || "");
    return elementId.startsWith("box-") ? elementId.slice(4) : "";
  }

  // The host may recycle the virtual grid element while a drag is in
  // progress.  DOM identity is therefore only a diagnostic hint; the stable
  // semantic key (normally the grid id) is what keeps one drag session alive.
  function gridKey(grid) {
    return String(
      grid?.getAttribute?.("data-grid-id") ||
      grid?.getAttribute?.("data-grid") ||
      grid?.id ||
      ""
    );
  }

  function resolve(event = {}, context = {}) {
    const candidates = uniqueElements([
      // During native drag, the browser may keep event.target/composedPath
      // bound to the source card even after the pointer is over a different
      // card. The current point is the authoritative drop target; eventPath
      // remains a fallback for hosts that do not expose point hit-testing.
      ...pointPath(event),
      ...eventPath(event)
    ]);
    const startGridIdentity = context.startGridIdentity || null;
    const startGridKey = String(context.startGridKey || "");
    const matchesStartGrid = (candidateGrid) =>
      !startGridIdentity && !startGridKey ||
      candidateGrid === startGridIdentity ||
      Boolean(startGridKey) && gridKey(candidateGrid) === startGridKey;
    const cardCandidates = uniqueElements(
      candidates.map((element) => closest(element, cardSelector))
    ).map((card) => ({
      card,
      grid: closest(card, gridSelector)
    })).filter((entry) => entry.grid && matchesStartGrid(entry.grid));
    const targetEntry = (
      cardCandidates[0]
    ) || null;
    const grid = targetEntry?.grid || candidates
      .map((element) => closest(element, gridSelector))
      .find(matchesStartGrid) || null;
    if (!grid) {
      if ((startGridIdentity || startGridKey) && context.allowUnknownSurface === true) {
        return {
          insideGrid: undefined,
          gridIdentity: null,
          gridKey: startGridKey,
          targetId: "",
          insertAfter: false,
          targetBox: null,
          helper: null,
          reason: "target-unknown"
        };
      }
      return {
        insideGrid: false,
        gridIdentity: null,
        gridKey: "",
        targetId: "",
        insertAfter: false,
        targetBox: null,
        helper: null,
        reason: "grid-outside"
      };
    }

    const targetBox = targetEntry?.card || null;
    if (!targetBox) {
      return {
        insideGrid: true,
        gridIdentity: grid,
        gridKey: gridKey(grid),
        targetId: "",
        insertAfter: false,
        targetBox: null,
        helper: null,
        reason: "card-missing"
      };
    }

    const targetId = cardId(targetBox);
    const selectedIds = new Set(
      (Array.isArray(context.selectedIds) ? context.selectedIds : [])
        .map(String)
    );
    if (!targetId || selectedIds.has(targetId)) {
      return {
        insideGrid: true,
        gridIdentity: grid,
        gridKey: gridKey(grid),
        targetId: "",
        insertAfter: false,
        targetBox,
        helper: null,
        reason: targetId ? "selected-target" : "card-id-missing"
      };
    }

    const directHelper = candidates
      .map((element) => closest(element, helperSelector))
      .find((helper) => helper && closest(helper, cardSelector) === targetBox);
    const bounds = targetBox.getBoundingClientRect?.();
    const insertAfter = directHelper
      ? directHelper.classList?.contains("right") === true
      : Boolean(
          bounds &&
          Number.isFinite(event.clientX) &&
          event.clientX >= bounds.left + bounds.width / 2
        );
    const helper = directHelper || targetBox.querySelector?.(
      `${helperSelector}.${insertAfter ? "right" : "left"}`
    ) || null;

    return {
      insideGrid: true,
      gridIdentity: grid,
      gridKey: gridKey(grid),
      targetId,
      insertAfter,
      targetBox,
      helper,
      reason: helper ? "target-resolved" : "helper-missing"
    };
  }

  return {
    resolve
  };
}

module.exports = {
  createSmartDragTargetResolver
};
