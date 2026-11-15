"use strict";

function createHostScopeStateRuntime() {
  let pending = false;
  let pendingReason = "";
  let route = "";

  function markPending(reason = "host-scope-pending") {
    pending = true;
    pendingReason = String(reason || "host-scope-pending");
    return snapshot();
  }

  function markReady(nextRoute = "") {
    pending = false;
    pendingReason = "";
    route = String(
      typeof nextRoute === "object" ? nextRoute?.route || "" : nextRoute || ""
    );
    return snapshot();
  }

  function snapshot() {
    return {
      pending,
      reason: pendingReason,
      route
    };
  }

  return Object.freeze({
    markPending,
    markReady,
    isPending: () => pending,
    reason: () => pendingReason,
    guard: () => pending
      ? { allowed: false, reason: "host-scope-pending" }
      : { allowed: true, reason: "" },
    snapshot
  });
}

module.exports = { createHostScopeStateRuntime };
