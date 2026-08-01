"use strict";

function createSmartCollectionPresenter(options = {}) {
  const currentContext = typeof options.currentContext === "function"
    ? options.currentContext
    : () => null;
  const readVisibleIds = typeof options.readVisibleIds === "function"
    ? options.readVisibleIds
    : () => [];
  const moveBefore = typeof options.moveBefore === "function"
    ? options.moveBefore
    : () => false;
  const moveItemsBefore = typeof options.moveItemsBefore === "function"
    ? options.moveItemsBefore
    : null;
  const notify = typeof options.notify === "function"
    ? options.notify
    : () => {};

  function contextMatches(expected = {}) {
    const current = currentContext() || {};
    return (
      current.kind === "smart" &&
      Number(current.token) === Number(expected.token) &&
      String(current.libraryId || "") === String(expected.libraryId || "") &&
      String(current.collectionId || "") ===
        String(expected.collectionId || "")
    );
  }

  function idsOf(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => String(item?.id || item || ""))
      .filter(Boolean);
  }

  async function present(input = {}) {
    const context = input.context || {};
    if (!contextMatches(context)) return false;
    const desiredIds = idsOf(input.nextItems);
    if (desiredIds.length === 0) return true;

    try {
      if (input.restore === true) {
        const desiredSet = new Set(desiredIds);
        const currentIds = idsOf(readVisibleIds())
          .filter((id) => desiredSet.has(id));
        const visibleSet = new Set(currentIds);
        const desiredVisibleIds = desiredIds.filter((id) => visibleSet.has(id));
        for (let index = 0; index < desiredVisibleIds.length; index += 1) {
          if (!contextMatches(context)) return false;
          const desiredId = desiredVisibleIds[index];
          const currentIndex = currentIds.indexOf(desiredId);
          if (currentIndex < 0) return false;
          if (currentIndex === index) continue;
          const targetId = currentIds[index];
          if (moveBefore(desiredId, targetId, false) === false) return false;
          currentIds.splice(currentIndex, 1);
          currentIds.splice(index, 0, desiredId);
        }
      } else {
        const selectedIds = idsOf(input.selectedIds);
        const targetId = String(input.targetId || "");
        if (!selectedIds.length || !targetId || selectedIds.includes(targetId)) {
          return false;
        }
        if (moveItemsBefore) {
          if (moveItemsBefore(
            selectedIds,
            targetId,
            input.insertAfter === true
          ) === false) {
            return false;
          }
        } else {
          for (const sourceId of selectedIds) {
            if (moveBefore(
              sourceId,
              targetId,
              input.insertAfter === true
            ) === false) {
              return false;
            }
          }
        }
      }
    } catch {
      return false;
    }
    if (!contextMatches(context)) return false;
    try {
      notify();
    } catch {}
    return true;
  }

  return Object.freeze({ present });
}

module.exports = { createSmartCollectionPresenter };
