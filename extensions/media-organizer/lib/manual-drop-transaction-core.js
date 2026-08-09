"use strict";

function commitPresentedManualStateTransaction(options = {}) {
  const presentation = options.presentation;
  if (
    presentation?.ok !== true ||
    typeof presentation.rollback !== "function"
  ) {
    return Object.freeze({
      ok: false,
      reason: "presentation-transaction-required",
      failOpen: true
    });
  }
  if (
    typeof options.applyState !== "function" ||
    typeof options.persistState !== "function" ||
    typeof options.rollbackState !== "function"
  ) {
    const presentationRollback = presentation.rollback();
    return Object.freeze({
      ok: false,
      reason: "state-transaction-required",
      presentationRolledBack: presentationRollback?.ok === true,
      failOpen: true
    });
  }

  try {
    options.applyState();
    const persisted = options.persistState();
    if (persisted === false || persisted?.then) {
      throw new Error(
        persisted?.then ? "async-persistence-unsupported" : "persist-rejected"
      );
    }
    return Object.freeze({
      ok: true,
      reason: "",
      presentation,
      stateCommitted: true,
      persistenceCommitted: true
    });
  } catch (error) {
    let stateRolledBack = false;
    try { stateRolledBack = options.rollbackState() !== false; } catch {}
    let presentationRollback = null;
    try { presentationRollback = presentation.rollback(); } catch {}
    const presentationRolledBack = presentationRollback?.ok === true;
    return Object.freeze({
      ok: false,
      reason: !stateRolledBack
        ? "state-rollback-failed"
        : !presentationRolledBack
          ? "presentation-rollback-failed"
          : "persist-failed",
      error: String(error?.message || error || "persist-failed"),
      stateRolledBack,
      presentationRolledBack,
      presentationRollback,
      failOpen: true
    });
  }
}

module.exports = { commitPresentedManualStateTransaction };
