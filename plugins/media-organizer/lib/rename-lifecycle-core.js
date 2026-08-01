"use strict";

function createRenameLifecycleRuntime() {
  const activeStates = new Set(["queued", "accepted", "running"]);

  function isActiveForContext(status, contextId) {
    const targetContextId = String(contextId || "");
    return Boolean(
      targetContextId &&
      status &&
      activeStates.has(String(status.state || "")) &&
      String(status.sourceContextId || "") === targetContextId
    );
  }

  function canToggleAutoNumber(availability = {}) {
    return availability.canAutoNumber === true;
  }

  function enqueueRejection({ request = {}, result = {} } = {}) {
    const reason = String(result.reason || "enqueue-rejected");
    const retryable = result.retryable === true;
    return {
      requestId: String(request.id || request.commandId || ""),
      sourceContextId: String(request.sourceContextId || ""),
      state: reason === "duplicate-signature"
        ? "done"
        : retryable
          ? "retryable-failure"
          : "failed",
      retryable,
      reason,
      signature: String(request.signature || "")
    };
  }

  return Object.freeze({
    canToggleAutoNumber,
    enqueueRejection,
    isActiveForContext
  });
}

module.exports = { createRenameLifecycleRuntime };
