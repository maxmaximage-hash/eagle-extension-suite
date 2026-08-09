"use strict";

function canonicalizeLibraryIdentity(value) {
  let normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.startsWith("file://")) normalized = normalized.slice(7);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const decoded = decodeURIComponent(normalized);
      if (decoded === normalized) break;
      normalized = decoded;
    } catch {
      break;
    }
  }
  normalized = normalized.replace(/\\/g, "/").replace(/\/+$/g, "");
  try {
    normalized = normalized.normalize("NFC");
  } catch {}
  return normalized;
}

function libraryIdentitiesMatch(left, right) {
  const leftId = canonicalizeLibraryIdentity(left);
  const rightId = canonicalizeLibraryIdentity(right);
  return Boolean(leftId && rightId && leftId === rightId);
}

function evaluateMainLibraryReadiness(input = {}) {
  const targetLibraryId = canonicalizeLibraryIdentity(input.targetLibraryId);
  const routeHash = String(input.routeHash || "");
  const routeReady = /(?:^|[#!?&])view=/.test(routeHash);
  const angularPresent = input.angularPresent === true;
  const bodyScopePresent = input.bodyScopePresent === true;
  const gridPresent = input.gridPresent === true;
  const sidebarPresent = input.sidebarPresent === true;
  const gridScopePresent = input.gridScopePresent === true;
  const sidebarScopePresent = input.sidebarScopePresent === true;
  const candidates = (Array.isArray(input.libraryCandidates)
    ? input.libraryCandidates
    : [])
    .slice(0, 16)
    .map((candidate) => ({
      source: String(candidate?.source || "unknown"),
      libraryId: canonicalizeLibraryIdentity(candidate?.libraryId)
    }))
    .filter((candidate) => candidate.libraryId);
  const matchingCandidates = candidates.filter((candidate) =>
    libraryIdentitiesMatch(candidate.libraryId, targetLibraryId)
  );
  const bodyIdentityMatch = matchingCandidates.some((candidate) =>
    /(?:body|root)-scope/.test(candidate.source)
  );
  const scopedUiIdentityMatch = matchingCandidates.some((candidate) =>
    /(?:grid|sidebar)-scope/.test(candidate.source)
  );
  const scopeRouteReady = Boolean(
    targetLibraryId &&
    angularPresent &&
    bodyScopePresent &&
    routeReady &&
    bodyIdentityMatch
  );
  const scopedUiReady = Boolean(
    targetLibraryId &&
    angularPresent &&
    routeReady &&
    gridPresent &&
    sidebarPresent &&
    (gridScopePresent || sidebarScopePresent) &&
    scopedUiIdentityMatch
  );
  const ready = scopeRouteReady || scopedUiReady;
  const matchedBy = scopeRouteReady
    ? "scope-route"
    : scopedUiReady ? "scoped-ui" : "";
  const missingReasons = [];
  if (!targetLibraryId) missingReasons.push("target-library-unavailable");
  if (!routeReady) missingReasons.push("route-not-ready");
  if (!angularPresent) missingReasons.push("angular-unavailable");
  if (!matchingCandidates.length) missingReasons.push("library-identity-unmatched");
  if (!bodyScopePresent) missingReasons.push("body-scope-unavailable");
  if (!gridPresent) missingReasons.push("grid-unavailable");
  if (!sidebarPresent) missingReasons.push("sidebar-unavailable");
  if (!gridScopePresent && !sidebarScopePresent) {
    missingReasons.push("scoped-ui-identity-unavailable");
  }

  return Object.freeze({
    ready,
    libraryId: ready ? targetLibraryId : matchingCandidates[0]?.libraryId || "",
    reason: ready ? `${matchedBy}-ready` : "main-window-evidence-pending",
    matchedBy,
    evidence: Object.freeze({
      routeReady,
      angularPresent,
      bodyScopePresent,
      gridPresent,
      sidebarPresent,
      gridScopePresent,
      sidebarScopePresent,
      libraryMatch: matchingCandidates.length > 0,
      bodyIdentityMatch,
      scopedUiIdentityMatch
    }),
    missingReasons: Object.freeze(Array.from(new Set(missingReasons))),
    observedLibraryIds: Object.freeze(candidates.map((candidate) => ({ ...candidate })))
  });
}

module.exports = {
  canonicalizeLibraryIdentity,
  libraryIdentitiesMatch,
  evaluateMainLibraryReadiness
};
