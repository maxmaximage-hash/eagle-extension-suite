"use strict";

const assert = require("assert");
const {
  evaluateMainLibraryReadiness,
  libraryIdentitiesMatch
} = require("../lib/main-library-readiness-core.js");

const decodedLibrary = "/Volumes/团队文件-MAX线上协作中台/引力环球.library";
const encodedLibrary = "/Volumes/%E5%9B%A2%E9%98%9F%E6%96%87%E4%BB%B6-MAX%E7%BA%BF%E4%B8%8A%E5%8D%8F%E4%BD%9C%E4%B8%AD%E5%8F%B0/%E5%BC%95%E5%8A%9B%E7%8E%AF%E7%90%83.library";

assert.strictEqual(
  libraryIdentitiesMatch(decodedLibrary, encodedLibrary),
  true,
  "real Eagle encoded main-scope identity must match the public decoded Library path"
);

const scopeRoute = evaluateMainLibraryReadiness({
  targetLibraryId: decodedLibrary,
  routeHash: "#!?view=smartfolder&smartfolder=MJCRT7F81VVTJ",
  angularPresent: true,
  bodyScopePresent: true,
  libraryCandidates: [
    { source: "body-scope", libraryId: encodedLibrary }
  ]
});
assert.strictEqual(scopeRoute.ready, true);
assert.strictEqual(scopeRoute.matchedBy, "scope-route");
assert.strictEqual(scopeRoute.libraryId, decodedLibrary);

// R54.2: Eagle can already have an operable sidebar and real grid while the
// body-scope branch used by qa.34 does not expose rootDir. A matching scoped
// UI identity plus route/sidebar/grid is independent positive readiness proof.
const scopedUi = evaluateMainLibraryReadiness({
  targetLibraryId: decodedLibrary,
  routeHash: "#!?view=smartfolder&smartfolder=MJCRT7F81VVTJ",
  angularPresent: true,
  bodyScopePresent: true,
  gridPresent: true,
  sidebarPresent: true,
  gridScopePresent: true,
  libraryCandidates: [
    { source: "grid-scope-parent", libraryId: encodedLibrary }
  ]
});
assert.strictEqual(scopedUi.ready, true);
assert.strictEqual(scopedUi.matchedBy, "scoped-ui");

const pathOnly = evaluateMainLibraryReadiness({
  targetLibraryId: decodedLibrary,
  routeHash: "",
  angularPresent: false,
  libraryCandidates: [
    { source: "host-path", libraryId: decodedLibrary }
  ]
});
assert.strictEqual(pathOnly.ready, false, "Library path alone must never authorize injection");
assert.ok(pathOnly.missingReasons.includes("route-not-ready"));
assert.ok(pathOnly.missingReasons.includes("angular-unavailable"));

const staleUi = evaluateMainLibraryReadiness({
  targetLibraryId: decodedLibrary,
  routeHash: "#!?view=smartfolder&smartfolder=old",
  angularPresent: true,
  bodyScopePresent: true,
  gridPresent: true,
  sidebarPresent: true,
  libraryCandidates: [
    { source: "body-scope", libraryId: "/Volumes/old.library" }
  ]
});
assert.strictEqual(staleUi.ready, false, "an old Library UI must not authorize the new generation");
assert.ok(staleUi.missingReasons.includes("library-identity-unmatched"));
assert.strictEqual(staleUi.evidence.gridPresent, true);
assert.strictEqual(staleUi.evidence.sidebarPresent, true);

console.log("main library readiness core tests passed");
