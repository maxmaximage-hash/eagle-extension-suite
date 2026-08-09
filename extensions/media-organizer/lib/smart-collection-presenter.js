"use strict";

function createSmartCollectionPresenter(options = {}) {
  const currentContext = typeof options.currentContext === "function"
    ? options.currentContext
    : () => null;
  const readVisibleIds = typeof options.readVisibleIds === "function"
    ? options.readVisibleIds
    : () => [];
  const readVisibleWindow = typeof options.readVisibleWindow === "function"
    ? options.readVisibleWindow
    : null;
  const moveBefore = typeof options.moveBefore === "function"
    ? options.moveBefore
    : () => false;
  const moveItemsBefore = typeof options.moveItemsBefore === "function"
    ? options.moveItemsBefore
    : null;
  const notify = typeof options.notify === "function"
    ? options.notify
    : () => {};
  const commitDataOrder = typeof options.commitDataOrder === "function"
    ? options.commitDataOrder
    : null;
  const readDataOrderIds = typeof options.readDataOrderIds === "function"
    ? options.readDataOrderIds
    : null;
  const rollbackDataOrder = typeof options.rollbackDataOrder === "function"
    ? options.rollbackDataOrder
    : null;
  const waitForVisibleOrder = typeof options.waitForVisibleOrder === "function"
    ? options.waitForVisibleOrder
    : null;
  const diagnose = typeof options.diagnose === "function"
    ? options.diagnose
    : () => {};
  let activePresentationKey = "";

  function emit(stage, payload = {}) {
    try { diagnose(stage, payload); } catch {}
  }

  function presentationKey(context = {}) {
    return [
      Number(context.token) || 0,
      String(context.libraryId || ""),
      String(context.collectionId || "")
    ].join("|");
  }

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

  function sameIds(left, right) {
    return left.length === right.length &&
      left.every((id, index) => id === right[index]);
  }

  function normalizeVisibleWindow(value, fallbackIds) {
    const ids = idsOf(value?.ids).length > 0
      ? idsOf(value.ids)
      : fallbackIds.slice();
    const offset = Number(value?.offset);
    const count = Number(value?.count);
    return {
      offset: Number.isInteger(offset) && offset >= 0 ? offset : 0,
      count: Number.isInteger(count) && count >= 0 ? count : ids.length,
      ids,
      proven: value?.proven !== false
    };
  }

  function restoreVisibleOrder(originalIds) {
    const currentIds = idsOf(readVisibleIds());
    for (let index = 0; index < originalIds.length; index += 1) {
      const desiredId = originalIds[index];
      const currentIndex = currentIds.indexOf(desiredId);
      if (currentIndex < 0 || currentIndex === index) continue;
      const targetId = currentIds[index];
      if (moveBefore(desiredId, targetId, false) === false) return false;
      currentIds.splice(currentIndex, 1);
      currentIds.splice(index, 0, desiredId);
    }
    return true;
  }

  async function presentVerified(input = {}) {
    const context = input.context || {};
    if (!contextMatches(context)) return Object.freeze({ ok: false, reason: "stale-context" });
    const key = presentationKey(context);
    if (activePresentationKey) {
      emit("reentrant-rejected", { key, activePresentationKey });
      return Object.freeze({ ok: false, reason: "presentation-reentrant", failOpen: true });
    }
    activePresentationKey = key;
    emit("presentation-start", { key });
    try {
    const desiredIds = idsOf(input.nextItems);
    if (desiredIds.length === 0) {
      return Object.freeze({ ok: true, dataOrderVerified: true, visibleOrderVerified: true });
    }
    const originalVisibleIds = idsOf(readVisibleIds());
    let visibleWindow = normalizeVisibleWindow(null, originalVisibleIds);
    if (readVisibleWindow) {
      try {
        visibleWindow = normalizeVisibleWindow(
          readVisibleWindow({
            context,
            desiredIds: desiredIds.slice(),
            visibleIds: originalVisibleIds.slice()
          }),
          originalVisibleIds
        );
      } catch {}
    }
    emit("window-read", {
      offset: visibleWindow.offset,
      count: visibleWindow.count,
      proven: visibleWindow.proven
    });
    if (readVisibleWindow && visibleWindow.proven !== true) {
      return Object.freeze({ ok: false, reason: "visible-window-unproved" });
    }

    if (input.restore === true && commitDataOrder && waitForVisibleOrder) {
      let dataTransaction = null;
      let dataCommitted = false;
      try {
        emit("commit-start", { count: desiredIds.length });
        const commitResult = await commitDataOrder(input.nextItems, {
          ...input,
          visibleWindow
        });
        dataCommitted = commitResult === true || commitResult?.ok === true;
        dataTransaction = commitResult?.transaction || null;
        emit("commit-result", { ok: dataCommitted });
      } catch {}
      if (!dataCommitted) {
        return Object.freeze({ ok: false, reason: "data-commit-failed" });
      }
      const dataOrderVerified = readDataOrderIds
        ? sameIds(idsOf(readDataOrderIds()), desiredIds)
        : true;
      emit("data-verify", { ok: dataOrderVerified });
      const expectedVisibleIds = idsOf(input.expectedVisibleIds).length > 0
        ? idsOf(input.expectedVisibleIds)
        : desiredIds.slice(
            visibleWindow.offset,
            visibleWindow.offset + visibleWindow.count
          );
      try {
        emit("notify-start");
        await notify();
        emit("notify-ok");
      } catch {
        emit("notify-failed");
      }
      let visibleOrderVerified = false;
      try {
        emit("visible-verify-start", { count: expectedVisibleIds.length });
        visibleOrderVerified = await waitForVisibleOrder(
          expectedVisibleIds,
          context,
          {
            desiredIds: desiredIds.slice(),
            expectedVisibleIds: expectedVisibleIds.slice(),
            initialVisibleWindow: { ...visibleWindow }
          }
        ) === true;
        emit("visible-verify-result", { ok: visibleOrderVerified });
      } catch {}
      if (
        dataOrderVerified &&
        visibleOrderVerified &&
        contextMatches(context)
      ) {
        return Object.freeze({ ok: true, dataOrderVerified, visibleOrderVerified });
      }
      let dataRolledBack = false;
      if (rollbackDataOrder) {
        try {
          dataRolledBack = await rollbackDataOrder(
            dataTransaction,
            input
          ) !== false;
        } catch {}
      }
      try { await notify(); } catch {}
      let visibleRolledBack = false;
      if (dataRolledBack) {
        try {
          visibleRolledBack = await waitForVisibleOrder(
            originalVisibleIds,
            context
          ) === true;
        } catch {}
      }
      return Object.freeze({
        ok: false,
        reason: !dataRolledBack
          ? "data-rollback-failed"
          : !visibleRolledBack
            ? "visible-rollback-failed"
            : dataOrderVerified ? "visible-order-mismatch" : "data-order-mismatch",
        dataOrderVerified,
        visibleOrderVerified,
        dataRolledBack,
        visibleRolledBack,
        failOpen: true
      });
    }

    try {
      if (input.restore === true) {
        const desiredSet = new Set(desiredIds);
        const currentIds = idsOf(readVisibleIds())
          .filter((id) => desiredSet.has(id));
        const visibleSet = new Set(currentIds);
        const desiredVisibleIds = desiredIds.filter((id) => visibleSet.has(id));
        for (let index = 0; index < desiredVisibleIds.length; index += 1) {
          if (!contextMatches(context)) return Object.freeze({ ok: false, reason: "stale-context" });
          const desiredId = desiredVisibleIds[index];
          const currentIndex = currentIds.indexOf(desiredId);
          if (currentIndex < 0) return Object.freeze({ ok: false, reason: "visible-member-missing" });
          if (currentIndex === index) continue;
          const targetId = currentIds[index];
          if (moveBefore(desiredId, targetId, false) === false) {
            restoreVisibleOrder(originalVisibleIds);
            return Object.freeze({ ok: false, reason: "visible-move-failed" });
          }
          currentIds.splice(currentIndex, 1);
          currentIds.splice(index, 0, desiredId);
        }
      } else {
        const selectedIds = idsOf(input.selectedIds);
        const targetId = String(input.targetId || "");
        if (!selectedIds.length || !targetId || selectedIds.includes(targetId)) {
          return Object.freeze({ ok: false, reason: "move-input-invalid" });
        }
        if (moveItemsBefore) {
          if (moveItemsBefore(
            selectedIds,
            targetId,
            input.insertAfter === true
          ) === false) {
            restoreVisibleOrder(originalVisibleIds);
            return Object.freeze({ ok: false, reason: "visible-move-failed" });
          }
        } else {
          for (const sourceId of selectedIds) {
            if (moveBefore(
              sourceId,
              targetId,
              input.insertAfter === true
            ) === false) {
              restoreVisibleOrder(originalVisibleIds);
              return Object.freeze({ ok: false, reason: "visible-move-failed" });
            }
          }
        }
      }
    } catch {
      restoreVisibleOrder(originalVisibleIds);
      return Object.freeze({ ok: false, reason: "visible-move-threw" });
    }
    if (!contextMatches(context)) {
      restoreVisibleOrder(originalVisibleIds);
      return Object.freeze({ ok: false, reason: "stale-context" });
    }
    let dataCommitted = true;
    let dataTransaction = null;
    if (commitDataOrder) {
      try {
        const commitResult = await commitDataOrder(input.nextItems, input);
        dataCommitted = commitResult === true || commitResult?.ok === true;
        dataTransaction = commitResult?.transaction || null;
      } catch {
        dataCommitted = false;
      }
      if (!dataCommitted) {
        restoreVisibleOrder(originalVisibleIds);
        return Object.freeze({ ok: false, reason: "data-commit-failed" });
      }
    }
    const visibleSet = new Set(originalVisibleIds);
    const expectedVisibleIds = desiredIds.filter((id) => visibleSet.has(id));
    const actualVisibleIds = idsOf(readVisibleIds())
      .filter((id) => visibleSet.has(id));
    const visibleOrderVerified = sameIds(actualVisibleIds, expectedVisibleIds);
    const dataOrderVerified = readDataOrderIds
      ? sameIds(idsOf(readDataOrderIds()), desiredIds)
      : dataCommitted;
    if (!visibleOrderVerified || !dataOrderVerified || !contextMatches(context)) {
      let dataRolledBack = !commitDataOrder;
      if (commitDataOrder && rollbackDataOrder) {
        try { dataRolledBack = await rollbackDataOrder(dataTransaction, input) !== false; } catch {}
      }
      const visibleRolledBack = restoreVisibleOrder(originalVisibleIds);
      return Object.freeze({
        ok: false,
        reason: !dataRolledBack
          ? "data-rollback-failed"
          : !visibleRolledBack
            ? "visible-rollback-failed"
            : visibleOrderVerified ? "data-order-mismatch" : "visible-order-mismatch",
        dataOrderVerified,
        visibleOrderVerified,
        dataRolledBack,
        visibleRolledBack,
        failOpen: true
      });
    }
    try {
      notify();
    } catch {}
    return Object.freeze({ ok: true, dataOrderVerified, visibleOrderVerified });
    } finally {
      if (activePresentationKey === key) activePresentationKey = "";
      emit("presentation-end", { key });
    }
  }

  async function present(input = {}) {
    return (await presentVerified(input)).ok === true;
  }

  return Object.freeze({ present, presentVerified });
}

module.exports = { createSmartCollectionPresenter };
