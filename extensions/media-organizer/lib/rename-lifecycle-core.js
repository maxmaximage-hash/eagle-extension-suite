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

  function isFolderContextId(value, folderId) {
    const contextId = String(value || "");
    const targetFolderId = String(folderId || "");
    if (!contextId || !targetFolderId) return false;
    return contextId === `tag-folder:${targetFolderId}` ||
      contextId.endsWith(`|normal:${targetFolderId}`) ||
      contextId.endsWith(`:normal:${targetFolderId}`);
  }

  // The background monitor keeps a tag-scanning context key while the
  // injected Eagle window keeps a library-scoped collection key. They are
  // different identifiers for the same folder and must be accepted as one
  // rename transaction without ever allowing a request to cross folders.
  function isSameFolderContext(
    sourceContextId,
    contextId,
    folderId,
    mainContextId = ""
  ) {
    const source = String(sourceContextId || "");
    const candidates = new Set(
      [contextId, mainContextId]
        .map((value) => String(value || ""))
        .filter(Boolean)
    );
    if (!source || candidates.has(source)) return Boolean(source);
    return Array.from(candidates).some((candidate) =>
      isFolderContextId(source, folderId) &&
      isFolderContextId(candidate, folderId)
    );
  }

  function canToggleAutoNumber(availability = {}) {
    return availability.canAutoNumber === true;
  }

  function isStale(status, now = Date.now(), timeoutMs = 120000) {
    if (!status || !activeStates.has(String(status.state || ""))) return false;
    const lastActivity = Number(
      status.lastActivityAt || status.startedAt || status.queuedAt || 0
    );
    return lastActivity > 0 && Number(now) - lastActivity >= Number(timeoutMs);
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

  function resetForContext(state = {}, contextId) {
    const targetContextId = String(contextId || "");
    const sourceContextId = String(state?.sourceContextId || "");
    if (!targetContextId || !sourceContextId || targetContextId === sourceContextId) {
      return { changed: false, state };
    }
    return {
      changed: true,
      state: {
        state: "idle",
        sourceContextId: targetContextId,
        kind: "",
        message: "",
        result: null,
        progress: null
      }
    };
  }

  return Object.freeze({
    canToggleAutoNumber,
    enqueueRejection,
    isStale,
    isActiveForContext,
    isSameFolderContext,
    resetForContext
  });
}

module.exports = { createRenameLifecycleRuntime };
