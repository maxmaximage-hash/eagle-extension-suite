"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "plugin.js"),
  "utf8"
);
const indexSource = fs.readFileSync(
  path.join(__dirname, "..", "index.html"),
  "utf8"
);
const sortingSystemSource = fs.readFileSync(
  path.join(__dirname, "..", "lib", "sorting-system-core.js"),
  "utf8"
);
const manualMoveApplicationSource = fs.readFileSync(
  path.join(__dirname, "..", "lib", "manual-move-application-core.js"),
  "utf8"
);
const collectionSettingsRendererSource = fs.readFileSync(
  path.join(__dirname, "..", "lib", "collection-settings-renderer.js"),
  "utf8"
);
const manifest = JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "manifest.json"),
  "utf8"
));
assert.strictEqual(manifest.main.serviceMode, true);
assert.strictEqual(manifest.main.keepAlive, true);
assert.strictEqual(manifest.main.childWindow, true);
assert.strictEqual(manifest.main.frame, true);
assert.match(source, /const API_VERSION = 148/);
assert.match(
  source,
  /function diagnoseNormalOrderPresentation\(stage, payload = \{\}\)/,
  "R76: normal-folder first-frame presenter must leave a bounded gate diagnostic"
);
assert.match(
  source,
  /NORMAL_PRESENTER_/,
  "R76: presenter diagnostics must be distinguishable from drag diagnostics"
);
assert.match(
  source,
  /function refreshHostScope\(\)/,
  "R77: route changes must rebind plugin state to Eagle's live collection scope"
);
assert.match(
  source,
  /if \(refreshHostScope\(\)\) renderSettings\(\);/,
  "R77: scope rebound must immediately restore the correct enabled/disabled controls"
);
assert.match(
  source,
  /HOST_SCOPE_UNRESOLVED/,
  "R78: an unresolvable Eagle route must emit a bounded structural diagnostic"
);
assert.match(source, /createItemResourceResolver/);
assert.match(source, /eagle\.item\.getById/);
assert.match(
  source,
  /fetchItems: \(query\) => withTimeout\(\s*\(\) => eagle\.item\.get\(query\)/,
  "metadata resources must use the supported exact-ID fields query"
);
const metadataScanSource = source.match(
  /async function scanCurrentItems\(context, options = \{\}\) \{([\s\S]*?)\n\}\n\nasync function runSelectedItemSmokeTest/
);
assert.ok(metadataScanSource, "metadata scan source must exist");
assert.doesNotMatch(
  metadataScanSource[1],
  /eagle\.item\.getByIds/,
  "member lookup objects must not be mistaken for file-resource objects"
);
assert.match(metadataScanSource[1], /itemResourceResolver\.resolve/);
assert.match(metadataScanSource[1], /pathHydration\.aborted/);
assert.ok(
  metadataScanSource[1].indexOf("cachedTakenAt(item, scanLibraryId)") <
    metadataScanSource[1].indexOf("itemResourceResolver.resolve"),
  "verified cache hits must be installed before any NAS resource hydration"
);
assert.ok(
  metadataScanSource[1].indexOf("metadataCacheRuntime.classify") >
    metadataScanSource[1].indexOf("itemResourceResolver.resolve"),
  "R67: hydrated size/modifiedAt identities must be checked against cache again before original-file reads"
);
assert.match(source, /durableStateLayout\.teamBackupRoot/);
const teamBackupSource = source.match(
  /async function backupExistingTeamState\(filePath\) \{([\s\S]*?)\n\}/
);
assert.ok(teamBackupSource, "team sidecar backup helper must exist");
assert.match(teamBackupSource[1], /durableStateLayout\.teamBackupRoot/);
assert.doesNotMatch(teamBackupSource[1], /path\.join\(pluginPath/);
assert.match(source, /createStartupReadinessGate/);
assert.match(source, /createMainLibraryReadinessWaiter/);
assert.match(source, /maxAttempts: 40/);
assert.match(source, /maxIntervalMs: 5_000/);
assert.match(source, /backoffFactor: 2/);
assert.match(source, /maxElapsedMs: 180_000/);
assert.match(source, /waitUntilReady: \(\{ libraryId, signal \}\)/);
assert.match(source, /function hostLibraryReadiness\(\)/);
assert.match(source, /function ensureStartupReadinessGate\(\)/);
assert.match(source, /BOOTSTRAP_WAIT|recordBootstrapDiagnostic/);
assert.match(source, /expectedLibraryIdentity/);
assert.match(source, /ensureStartupReadinessGate\(\)\.reset\("library-changed"\)/);
assert.match(source, /createSmartCollectionHostSnapshotAdapter/);
assert.match(source, /smartCollectionHostSnapshotAdapter\.snapshot\(\)/);
assert.match(source, /snapshot\.phase !== "ready"/);
assert.match(source, /selectSmartQuerySource/);
assert.match(source, /filtereds: bodyScope\.filtereds/);
assert.match(source, /allData: bodyScope\.allData/);
assert.match(source, /smartQueryEvidence/);
assert.doesNotMatch(source, /filteredSource !== bodyScope\.allData/);
assert.match(source, /hostSource\.sourceIdentity/);
assert.match(
  source,
  /nextItems\.slice\(0, filteredCount\)/,
  "R66: Eagle filtereds remains a zero-based pagination prefix even when the DOM virtual window has a non-zero scroll offset"
);
assert.match(source, /const AUTO_RENAME_QUIET_MS = 400/);
assert.match(source, /lib", "host-input-adapter\.js"/);
assert.match(source, /const HOST_INPUT_ADAPTER_SOURCE/);
assert.match(source, /startGridIdentity: source\.gridIdentity/);
assert.match(source, /allowUnknownSurface: true/);
assert.match(source, /previousApi\.integrationResult/);
assert.match(source, /reused: true/);
const pluginCreateSource = source.match(
  /eagle\.onPluginCreate\(\(plugin\) => \{([\s\S]*?)\n\}\);\n\neagle\.onLibraryChanged/
);
assert.ok(pluginCreateSource, "plugin create lifecycle should be present");
assert.doesNotMatch(pluginCreateSource[1], /initializeGeoTagService|runGeoPoll/);
const pluginRunSource = source.match(
  /eagle\.onPluginRun\(async \(\) => \{([\s\S]*?)\n\}\);/
);
assert.ok(pluginRunSource, "plugin run lifecycle should be present");
assert.match(pluginRunSource[1], /const automaticServiceStart/);
assert.match(pluginRunSource[1], /Date\.now\(\) - pluginCreatedAt < 10000/);
assert.match(
  pluginRunSource[1],
  /if \(automaticServiceStart\) \{[\s\S]*?排序服务已自动启动[\s\S]*?return;/
);
assert.match(pluginRunSource[1], /initializeGeoTagService/);
assert.match(pluginRunSource[1], /setInterval\(runGeoPoll, 8000\)/);

assert.match(source, /renameTreeRequiresEnable/);
assert.match(
  source,
  /if \(!renameEnabled\(\)\) \{\s+api\.rename\.batchStatus = \{\s+state: "idle",\s+sourceContextId,\s+message: ui\.renameTreeRequiresEnable/s
);

const checkboxHandler = source.match(
  /renameCheckbox\.addEventListener\("change", \(\) => \{([\s\S]*?)\n      \}\);\n      rename\.append/
);
assert.ok(checkboxHandler, "rename checkbox handler should be present");
const treeBranch = checkboxHandler[1].match(
  /if \(shouldRouteRenameToTree\(plan\)\) \{([\s\S]*?)\} else \{/
);
assert.ok(treeBranch, "tree route branch should be present");
assert.match(treeBranch[1], /setRenameEnabled\(true\)/);
assert.doesNotMatch(treeBranch[1], /applyRenameToCurrentTree\(/);

assert.match(source, /descendantLockedState/);
assert.doesNotMatch(
  source,
  /lockRow\.style\.display = hasDirectMedia \? "flex" : "none"/
);
assert.match(source, /eagle-photo-sort-protection-settings/);
assert.match(source, /function renderProtectionSettings\(\)/);
const protectionRenderSource = source.match(
  /function renderProtectionSettings\(\) \{([\s\S]*?)\n    \}\n\n    function renderSettings/
);
assert.ok(protectionRenderSource, "protection renderer must exist");
assert.match(
  protectionRenderSource[1],
  /renderFolderLockMarkers\(\);/,
  "R72: every protection render must reconcile sidebar lock markers with the same current-library store as the checkbox"
);
assert.match(source, /lockCurrent: "排序锁定"/);
assert.doesNotMatch(source, /currentOrderSnapshot/);
assert.doesNotMatch(source, /_eaglePhotoSortOrder/);
assert.doesNotMatch(source, /lockedItemCount/);
assert.match(source, /visibleComparatorViolations/);
assert.match(source, /currentCollection\(\)\.kind !== "global"/);
assert.match(source, /collectionRuntime\.scopedItems\(/);
assert.match(source, /itemResourceResolver\.resolve\(missingPathItems/);
assert.match(source, /eagle\.item\.get\(query\)/);
assert.match(source, /if \(!monitorTimer\) \{\s+monitorTimer = setInterval\(monitor, 1000\);\s+\}/s);
assert.match(source, /const contextKey = createScanContextKey\(context\)/);
assert.match(source, /async function waitForNativePreview\(contextId\)/);
assert.match(source, /nativePreviewReady/);
assert.match(source, /latestContextId !== contextId/);
assert.match(source, /await pushCachedTimestamps\(\)/);
assert.match(source, /if \(!canWarmTakenAtMetadata\(context\)\) return 0/);
assert.match(source, /if \(!canWarmTakenAtMetadata\(context\)\) return null/);
assert.match(source, /smartSnapshotPhase: smartSnapshot\?\.phase \|\| ""/);
assert.match(source, /mapWithConcurrency\(itemsToRead, 2/);
assert.match(source, /debounceMs: 5000/);
assert.match(
  source,
  /if \(shouldRefreshAfterMetadataScan\(context, \{[\s\S]*?sortNeedsMetadata[\s\S]*?\}\)\) \{\s+await refreshMainList\(\);\s+\}/s
);
assert.match(
  source,
  /void scanCurrentItems\(context, \{[\s\S]*?explicitSortChange[\s\S]*?\}\)\.catch/
);
assert.match(
  source,
  /if \(context\.currentFolderId && sourceItems\.length === 0\)/
);
assert.match(
  source,
  /currentSmartFolderId:\s*collection\.kind === "smart"\s*\? collection\.id\s*:\s*""/
);
assert.match(
  source,
  /const missingPathIds = Array\.from\(new Set\([\s\S]*?itemResourceResolver\.resolve\(missingPathItems/
);
assert.match(
  source,
  /if \(pathHydration\.aborted \|\| !contextIsCurrent\(\)\) return;/
);
assert.match(source, /const scanIdentity = createScanContextKey\(context\)/);
assert.match(source, /scanInProgress\?\.scanIdentity === scanIdentity/);
assert.match(
  source,
  /const metadataMissingIds = contextItems[\s\S]*?unresolvedIds\.has[\s\S]*?!item\.filePath[\s\S]*?for \(const id of metadataMissingIds\) \{[\s\S]*?values\[id\] = null;/s
);
assert.match(
  source,
  /\.catch\(\(error\) => \{\s+if \(latestContextId === currentContextId\) \{\s+lastContextKey = "";\s+metadataRetryDelayMs = nextMetadataRetryDelay\(metadataRetryDelayMs\);\s+metadataRetryAt = Date\.now\(\) \+ metadataRetryDelayMs;/s
);
assert.doesNotMatch(
  source,
  /if \(context\.currentSmartFolderId && sourceItems\.length === 0\) \{[\s\S]*?sourceItems\.map/
);
assert.match(
  source,
  /lastObservedOrderBy !== ""/
);
assert.doesNotMatch(source, /context\.itemFingerprint\}:\$\{context\.folderLocked/);
assert.doesNotMatch(source, /automaticStartupRequest/);
assert.match(source, /async function mainLibraryReadiness\(\{ libraryId: targetLibraryId = "" \} = \{\}\)/);
assert.match(source, /evaluateMainLibraryReadiness/);
assert.match(source, /libraryCandidates: candidates/);
const startupSource = source.match(
  /async function start\(\) \{([\s\S]*?)\n\}/
);
assert.ok(startupSource, "startup lifecycle should be present");
assert.doesNotMatch(
  startupSource[1],
  /readCache\(/,
  "cache I/O must wait for the explicit host-readiness gate"
);
assert.doesNotMatch(
  startupSource[1],
  /setInterval\(monitor/,
  "waiting for Library readiness must not start the business monitor timer"
);
const activationSource = source.match(
  /async function activateStartup\(\{ libraryId \} = \{\}\) \{([\s\S]*?)\n\}/
);
assert.ok(activationSource, "startup activation lifecycle should be present");
assert.match(
  activationSource[1],
  /monitorTimer = setInterval\(monitor, 1000\)/,
  "monitor timer may begin only after ACTIVE"
);
assert.match(source, /if \(monitorInProgress \|\| !mainBridgeAllowed\) return/);
assert.match(source, /serviceStartTimer = setTimeout\(async \(\) => \{/);
assert.match(source, /\}, 0\)/);
assert.doesNotMatch(source, /libraryStabilizeTimer|\}, 2000\)/);
assert.match(
  source,
  /if \(!injectionReady\) \{\s+const bootstrap = await ensureStartupReadinessGate\(\)\.observe\(\s+hostLibraryReadiness\(\)\s+\);\s+if \(bootstrap\.phase !== "active" \|\| !injectionReady\) return;/s
);
const preInjectionSource = source.match(
  /function hostLibraryReadiness\(\) \{([\s\S]*?)\n\}/
);
assert.ok(preInjectionSource, "host readiness probe should be present");
assert.doesNotMatch(
  preInjectionSource[1],
  /executeInMain|readCache|currentItems|filtereds|allData|setInterval|setTimeout/,
  "pre-ready probe must remain a public, zero-I/O host signal"
);
assert.match(
  preInjectionSource[1],
  /if \(!expectedLibraryIdentity\)[\s\S]*?library-change-unobserved/s,
  "a public library path alone is not sufficient startup evidence"
);
assert.doesNotMatch(
  pluginRunSource[1],
  /else \{\s+await inject\(\);\s+\}/s,
  "opening the panel must not bypass the startup gate"
);
assert.match(
  pluginRunSource[1],
  /const bootstrap = await ensureStartupReadinessGate\(\)\.observe\([\s\S]*?hostLibraryReadiness\(\)/s,
  "panel activation must honor the same startup gate"
);
assert.match(source, /pendingSmartScanIdentity/);
assert.match(source, /smartContextStable/);
assert.doesNotMatch(
  source,
  /\(bodyScope\.currentFolder \|\| bodyScope\.currentSmartFolder\)[\s\S]{0,120}return bodyScope\.raw/
);
assert.match(source, /const TAKEN_SORT_KEY = "PHOTO_TAKEN_AT"/);
assert.match(
  source,
  /rules: \[\{\s+field: "TAKEN_AT",\s+direction: currentIncrease\(\) \? "asc" : "desc"\s+\}\]/s
);
assert.match(source, /function isPluginSort\(orderBy = effectivePluginOrderBy\(\)\)/);
assert.match(source, /function isMultiSort\(orderBy = effectivePluginOrderBy\(\)\)/);
assert.match(source, /function settingsOrder\(\)/);
const settingsOrderSource = source.match(
  /function settingsOrder\(\) \{([\s\S]*?)\n    \}\n\n    function isMultiSortSelected/
);
assert.ok(settingsOrderSource, "settings-order resolver must exist");
assert.match(
  settingsOrderSource[1],
  /return effectivePluginOrderBy\(\);/,
  "R71/R75: the rules panel must use the unified plugin sort intent, whether it comes from persisted folder state or the restored layout select"
);
assert.match(source, /function isMultiSortSelected\(\)/);
assert.match(source, /function pluginOrderByForHost\(hostOrderBy = ""\)/);
assert.match(
  source,
  /NORMAL_PRESENTER_HOST_SORT_DATA/,
  "R84: a host sorter callback must leave bounded direction evidence so a native direction reversal cannot masquerade as a successful multi-rule presentation"
);
assert.match(
  source,
  /ruleDirections:/,
  "R84: normal presentation diagnostics must disclose the configured per-rule directions"
);
assert.match(
  source,
  /manualOverlayCount:/,
  "R84: normal presentation diagnostics must disclose whether a persisted relative manual adjustment is active"
);
assert.match(
  source,
  /desiredGroupSignature:/,
  "R84: normal presentation diagnostics must expose a non-sensitive group-order signature for real-host verification"
);
assert.match(
  source,
  /eagle-photo-manual-status/,
  "R84: a locked folder must disclose retained manual relative adjustments instead of making the disabled restore action look broken"
);
assert.match(
  source,
  /先关闭“排序锁定”后，才可修改排序方向或恢复自动排序/,
  "R84: the lock explanation must say exactly why multi-rule controls and restore are disabled"
);
assert.match(
  source,
  /function effectivePluginOrderBy\(hostOrderBy = ""\)/,
  "R75: a visibly selected plugin sort must remain authoritative when legacy Eagle folder state still reports a native key"
);
assert.match(
  source,
  /const effectiveOrderBy = pluginOrderByForHost\(orderBy\);[\s\S]*?if \(!isPluginSort\(effectiveOrderBy\)\)/,
  "R71: sortData must not downgrade a persisted plugin sort merely because Eagle calls back with a stale native key"
);
assert.match(
  source,
  /bodyScope\.sortRawData = function\(orderBy\) \{[\s\S]*?const effectiveOrderBy = pluginOrderByForHost\(orderBy\);/,
  "R71: raw-data sorting must use the same authoritative effective order as visible sorting"
);
assert.match(source, /collectionActions\.className = "eagle-photo-collection-actions"/);
assert.match(
  source,
  /const smartScope = currentCollection\(\)\.kind === "smart";\s+const count = smartScope \? 1 : currentFolderTree\(\)\.length;/,
  "smart collection apply scope must count the current smart view as one target"
);
assert.match(
  source,
  /button\.title = smartScope\s+\? "仅应用到当前智能文件夹"/,
  "smart collection apply help must describe its current-view-only scope"
);
assert.match(source, /sortPanel\.insertAdjacentElement\("beforebegin", collectionActions\)/);
assert.match(source, /collectionActions\.append\(manualSection\)/);
assert.match(
  source,
  /if \(currentCollection\(\)\.kind !== "smart"\) \{\s+collectionActions\.append\(renameSection\)/
);
assert.match(source, /actions\.insertBefore\(row, actions\.firstChild\)/);
assert.match(source, /ensureOrderTreeSettings\(select\)/);
assert.match(
  source,
  /function ensureOrderTreeSettings[\s\S]*?\(rulesPanel \|\| panelItem\)\.insertAdjacentElement\("afterend", row\)/
);
assert.doesNotMatch(source, /collectionTitle/);
assert.doesNotMatch(source, /集合级功能（高于排列方式）/);
assert.match(source, /autoRename: "自动编号"/);
assert.match(source, /manual: "手动拖动"/);
assert.match(source, /eagle-photo-lock-tree/);
assert.match(source, /eagle-photo-manual-tree/);
assert.match(source, /eagle-photo-rename-tree/);
assert.match(source, /function setLockTreeEnabled\(enabled\)/);
const lockToggleHandler = source.match(
  /function setCurrentFolderLocked\(locked\) \{([\s\S]*?)\n    \}\n\n    function setLockTreeEnabled/
);
assert.ok(lockToggleHandler, "lock toggle handler should be present");
assert.match(
  lockToggleHandler[1],
  /stabilizeAutoRenameAfterProtectionToggle\(\)/
);
assert.doesNotMatch(lockToggleHandler[1], /sortConfigSnapshot\(/);
assert.doesNotMatch(lockToggleHandler[1], /api\.refresh/);
assert.doesNotMatch(lockToggleHandler[1], /\$evalAsync/);
assert.doesNotMatch(lockToggleHandler[1], /persistCurrentManualOrder/);
assert.doesNotMatch(lockToggleHandler[1], /applyRenamePlan/);
const lockStabilizer = source.match(
  /function stabilizeAutoRenameAfterProtectionToggle\(\) \{([\s\S]*?)\n    \}\n\n    function setCurrentFolderLocked/
);
assert.ok(lockStabilizer, "lock rename stabilizer should be present");
assert.match(lockStabilizer[1], /clearTimeout\(api\.rename\.timer\)/);
assert.match(lockStabilizer[1], /api\.rename\.lastSignature = renameRuntime\.signature/);
assert.doesNotMatch(lockStabilizer[1], /applyRenamePlan|api\.refresh|\$evalAsync/);
assert.match(source, /function setManualTreeEnabled\(enabled\)/);
const manualTreeHandler = source.match(
  /function setManualTreeEnabled\(enabled\) \{([\s\S]*?)\n    \}\n\n    function normalizeMetaType/
);
assert.ok(manualTreeHandler, "manual tree batch handler should be present");
assert.match(
  manualTreeHandler[1],
  /folderTreeBatchRuntime\.applyToFolderTree\(tree/
);
assert.match(manualTreeHandler[1], /persistManualModeStore\(\)/);
assert.match(manualTreeHandler[1], /rollbackApplied/);
assert.match(manualTreeHandler[1], /api\.manualTreeMessage/);
assert.doesNotMatch(manualTreeHandler[1], /skipFolder|folderBatchProtected/);
assert.match(source, /manualTreeResult\.className = "eagle-photo-manual-tree-result"/);
assert.match(source, /treeResult\.textContent = api\.manualTreeMessage/);
assert.match(source, /function syncSubFolderManualMode\(\)/);
assert.match(source, /targetKind: "direct-folders"/);
assert.match(source, /buildFolderRenamePlan/);
assert.match(source, /sortingLocks\.v3/);
assert.match(source, /manualMode\.v1/);
assert.match(source, /mergeLegacyProtectionIntoLocks/);
assert.match(source, /importedAsVisibleProtection/);
assert.match(source, /mode: "legacy-suppressed"/);
assert.match(source, /if \(profile\?\.legacySuppressed === true\) return false/);
assert.match(source, /promotedToHardLock: visibleMigration\.importedCount/);
assert.doesNotMatch(source, /setTimeout\(openRulesModal, 0\)/);
assert.match(source, /ruleList\.className = "eagle-photo-sort-list"/);
assert.match(source, /api\.renderInlineRuleRows = \(\) => renderRuleList\(ruleList\)/);
assert.match(source, /sortSection\.append\(\s*header,\s*ruleList,\s*ruleActions/s);
assert.match(source, /panel\.append\(sortSection\)/);
assert.match(
  source,
  /if \(existingPanel\.previousElementSibling !== sortPanel\) \{\s+sortPanel\.insertAdjacentElement\("afterend", existingPanel\)/s
);
assert.match(source, /inlineRuleList\.dataset\.rules = rulesSignature/);
assert.match(source, /renderRuleList\(inlineRuleList\)/);
assert.match(
  source,
  /const expectedSwitchCount =\s+currentCollection\(\)\.kind === "smart" \? 2 : 3/
);
assert.match(source, /switchCount === expectedSwitchCount/);
assert.match(
  source,
  /const expectedFeatureApplyCount =\s+currentCollection\(\)\.kind === "smart" \? 1 : 2/
);
assert.match(source, /featureApplyCount === expectedFeatureApplyCount/);
assert.match(source, /orderTreeOutsideSwitches/);
assert.match(source, /api\.teamImportResult\.legacyConfigProtectedFolderCount =/);
assert.match(source, /ignoredLegacyOrderCount/);
assert.match(source, /orderBy !== TAKEN_SORT_KEY/);
assert.match(source, /TAKEN_LABELS/);
assert.match(source, /title: "多级排序规则"/);
assert.match(source, /collectionSettingsRenderer\.renderSettings\(\{/);
assert.match(source, /const isCollectionActionsPanel = panel\.classList\.contains/);
assert.doesNotMatch(
  source,
  /const collectionActions = panel\.classList\.contains/
);
assert.match(source, /rulesImmediatelyBelowSort/);
assert.match(source, /rulesVisibilityMatchesSelection/);
assert.match(source, /multiSelectionExpandsInlineRules/);
assert.match(source, /sortSelect\.value = SORT_KEY;\s+renderSettings\(\)/s);
assert.match(source, /界面布局证据/);
assert.match(source, /ensureProtectionSettings\(select\)/);
assert.doesNotMatch(
  source,
  /sortSection\.append\(\s*header,\s*summary,\s*lock,/s
);
assert.doesNotMatch(
  source,
  /folder\.orderBy = SORT_KEY;\s*bodyScope\.currentOrderBy = SORT_KEY;\s*saveCurrentContainer\(\);/
);
assert.doesNotMatch(source, /skipDescendantsOfSkipped: true/);
assert.match(source, /lockSkipMessage\(targetPreview\.skipped\)/);
const renameTreeHandler = source.match(
  /function applyRenameToCurrentTree\(\) \{([\s\S]*?)\n    \}\n\n    function claimRenameBatch/
);
assert.ok(renameTreeHandler, "rename tree batch handler should be present");
assert.match(renameTreeHandler[1], /setRenameTreeEnabled\(allFolders, true\)/);
assert.match(renameTreeHandler[1], /skipFolder:[\s\S]*?folderBatchProtected/);
assert.match(source, /function inheritedRenameExecutionBlocked\(\)/);
assert.match(
  source,
  /function maybeAutoRename\(\)[\s\S]*?inheritedRenameExecutionBlocked\(\)/
);
const currentRenameItemsSource = source.match(
  /function currentRenameItems\(\) \{([\s\S]*?)\n    \}\n\n    function buildCurrentRenamePlan/
);
assert.ok(currentRenameItemsSource, "current rename item selector should be present");
assert.match(
  currentRenameItemsSource[1],
  /resolveCurrentOrderSnapshot\(\{ preferRendered: true \}\)\.finalItems/
);
assert.match(source, /function renderedCardIds\(\)/);
assert.match(source, /getBoundingClientRect\(\)/);
assert.match(source, /rowTolerance/);
assert.match(source, /function resolveCurrentOrderSnapshot\(options = \{\}\)/);
assert.match(source, /sortingSystemRuntime\.resolveOrder\(/);
assert.doesNotMatch(source, /pendingMetadata|renameWaiting|renamePending/);
assert.doesNotMatch(source, /manual\.moves|stored\.moves|manualMoves/);
assert.doesNotMatch(source, /eagle-photo-sort-state/);
const timestampSetter = source.match(
  /api\.setTimestamps = \(values\) => \{([\s\S]*?)\n    \};/
);
assert.ok(timestampSetter, "timestamp setter should be present");
assert.doesNotMatch(timestampSetter[1], /scheduleAutoRename/);
assert.match(
  source,
  /manualOverlay: activeManualOverlay\(\)/
);
assert.match(
  source,
  /const visualItems = manualItemsForDrag\(\)/
);
assert.match(source, /function manualItemsForDrag\(\)/);
assert.match(
  source,
  /return resolveCurrentOrderSnapshot\(\{ preferRendered: true \}\)\.finalItems/
);
assert.doesNotMatch(source, /bodyScope\.selected[\s\S]{0,120}selectedIdsForDrag/);
const activeManualOrderSource = source.match(
  /function activeManualOrder\(\) \{([\s\S]*?)\n    \}/
);
assert.ok(activeManualOrderSource, "saved manual order resolver should be present");
assert.doesNotMatch(
  activeManualOrderSource[1],
  /!manualEnabled\(\)/,
  "turning drag input off must not deactivate the saved order"
);
assert.doesNotMatch(
  source,
  /manualCheckbox\.addEventListener\("change"/,
  "manual drag is intrinsic and must not have an enable/disable toggle"
);
assert.match(source, /manualCheckbox\.hidden = true/);
assert.match(source, /手动拖动（默认开启）/);
assert.match(source, /恢复自动排序/);
const dragIntegration = source.match(
  /api\.runDragIntegrationTest = \(\) => \{([\s\S]*?)\n    \};/
);
assert.ok(dragIntegration, "drag integration check should be present");
assert.match(dragIntegration[1], /sourceHasTakenAt/);
assert.match(dragIntegration[1], /readOnly: true/);
assert.doesNotMatch(
  dragIntegration[1],
  /performManualDrop|persistCurrentManualOrder|resetManualState/
);
assert.match(source, /function dropHelperAtPoint\(clientX, clientY\)/);
assert.doesNotMatch(source, /const mouseDownHandler = \(event\) =>/);
assert.doesNotMatch(source, /const mouseMoveHandler = \(event\) =>/);
assert.doesNotMatch(source, /const mouseUpHandler = \(event\) =>/);
assert.match(source, /const dragStartHandler = \(event\) =>/);

const levelAvailability = source.match(
  /function currentLevelAvailability\(directMedia\) \{([\s\S]*?)\n    \}\n\n    function libraryAvailability/
);
assert.ok(levelAvailability, "current collection availability boundary must exist");
assert.match(
  levelAvailability[1],
  /const collection = currentCollection\(\)/
);
assert.match(
  levelAvailability[1],
  /collection\.kind === "normal"[\s\S]*?directChildren\(bodyScope\.currentFolder\)/
);
assert.match(
  levelAvailability[1],
  /collection\.kind === "smart"[\s\S]*?currentRenameItems\(\)/
);

const renameEnabled = source.match(
  /function renameEnabled\(\) \{([\s\S]*?)\n    \}\n\n    function inheritedRenameExecutionBlocked/
);
assert.ok(renameEnabled, "auto-number eligibility boundary must exist");
assert.match(
  renameEnabled[1],
  /currentCollection\(\)\.kind !== "normal"[\s\S]*?return false/,
  "a smart collection must not inherit auto-number state from a stale normal folder"
);
const smartRenamePlanGuard = source.match(
  /function buildCurrentRenamePlan\(\) \{([\s\S]*?)\n    \}\n\n    function buildManualDropRenamePlan/
);
assert.ok(smartRenamePlanGuard, "rename plan builder should have a smart collection boundary");
assert.match(
  smartRenamePlanGuard[1],
  /collection\.kind === "smart"[\s\S]*?smart-collection-rename-disabled/,
  "smart collections must not generate auto-number plans"
);
assert.match(collectionSettingsRendererSource, /renameSection\?\.remove\?\.\(\)/);
assert.match(
  collectionSettingsRendererSource,
  /collectionActionsContainer\.append\(renameSection\)/,
  "normal folders must still create the auto-number section"
);
assert.doesNotMatch(
  source,
  /renameSection\.style\.display = smartScope \? "none" : "flex"/,
  "smart collections must remove the auto-number row instead of greying or hiding it"
);
assert.match(
  source,
  /function applyRenamePlan\(plan, options = \{\}\) \{[\s\S]*?currentCollection\(\)\.kind !== "normal"/,
  "rename execution must reject smart collections even if called programmatically"
);
assert.match(source, /const dragOverHandler = \(event\) =>/);
assert.match(source, /const dropHandler = \(event\) =>/);
assert.match(source, /const dragEndHandler = \(event\) =>/);
assert.match(source, /performManualDrop\(\{\s+target: helper\s*\}/s);
assert.match(source, /nativeStartsPreserved \+= 1/);
const nativeDragStartSource = source.match(
  /const dragStartHandler = \(event\) => \{([\s\S]*?)\n\s+\};\s+const dragHandler/
);
assert.ok(nativeDragStartSource, "native dragstart observer should be present");
assert.doesNotMatch(
  nativeDragStartSource[1],
  /preventDefault|stopPropagation|stopImmediatePropagation|dataTransfer\s*[.=]/,
  "dragstart must remain entirely owned by Eagle for external file dragging"
);
const dragOverSource = source.match(
  /const dragOverHandler = \(event\) => \{([\s\S]*?)\n\s+\};\s+const dropHandler/
);
assert.ok(dragOverSource, "in-grid dragover handler should be present");
assert.match(dragOverSource[1], /valid: Boolean\(helper\)/);
assert.match(dragOverSource[1], /sortingOwnership\.classify/);
assert.match(dragOverSource[1], /applyEventOwnership\(event, decision\)/);
assert.match(
  dragOverSource[1],
  /dragState\.lastHelper = helper/,
  "the one native drag state must retain the last valid in-grid target"
);
const dragEndSource = source.match(
  /const dragEndHandler = \(event\) => \{([\s\S]*?)\n\s+\};\s+const keyDownHandler/
);
assert.ok(
  dragEndSource,
  "dragend must provide a same-grid fallback when Eagle omits drop"
);
assert.match(dragEndSource[1], /const dragState = api\.dragState/);
assert.match(
  dragEndSource[1],
  /dropHelperAtPoint\(event\.clientX, event\.clientY\)[\s\S]*?dragState\.lastHelper/
);
assert.match(
  dragEndSource[1],
  /submitManualDrop\(dragState, helper\)/
);
assert.doesNotMatch(
  dragEndSource[1],
  /preventDefault|stopPropagation|stopImmediatePropagation|dataTransfer\s*[.=]/,
  "dragend fallback must remain observational so native external dragging survives"
);

function runDragEndScenario({
  dragState = {
    collectionId: "smart-A",
    selectedIds: ["item-A"],
    lastHelper: null
  },
  helper = { id: "helper-B" },
  collectionId = "smart-A",
  manualEnabled = true
} = {}) {
  const calls = {
    points: [],
    drops: [],
    finishes: 0
  };
  const handler = new Function(
    "api",
    "observeSmartNativeDrag",
    "submitSmartHostInputResult",
    "dropHelperAtPoint",
    "submitManualDrop",
    "finishManualDrag",
    `return (event) => {${dragEndSource[1]}};`
  )(
    { dragState },
    () => ({ handled: false, result: null, target: null }),
    () => false,
    (clientX, clientY) => {
      calls.points.push([clientX, clientY]);
      return helper;
    },
    (state, target) => {
      if (collectionId === state.collectionId && manualEnabled && target) {
        calls.drops.push({ state, target });
      }
    },
    () => {
      calls.finishes += 1;
    }
  );
  handler({ clientX: 120, clientY: 240 });
  return calls;
}

const smartDragEnd = runDragEndScenario();
assert.deepStrictEqual(smartDragEnd.points, [[120, 240]]);
assert.deepStrictEqual(smartDragEnd.drops, [{
  state: {
    collectionId: "smart-A",
    selectedIds: ["item-A"],
    lastHelper: null
  },
  target: { id: "helper-B" }
}]);
assert.strictEqual(smartDragEnd.finishes, 1);

for (const scenario of [
  { dragState: null },
  { helper: null },
  { collectionId: "smart-B" },
  { manualEnabled: false }
]) {
  const result = runDragEndScenario(scenario);
  assert.strictEqual(result.drops.length, 0);
  assert.strictEqual(result.finishes, scenario.dragState === null ? 0 : 1);
}
const retainedTarget = { id: "retained-helper", isConnected: true };
const retainedDragEnd = runDragEndScenario({
  dragState: {
    collectionId: "smart-A",
    selectedIds: ["item-A"],
    lastHelper: retainedTarget
  },
  helper: null
});
assert.strictEqual(retainedDragEnd.drops[0].target, retainedTarget);

const submitManualDropSource = source.match(
  /function submitManualDrop\(dragState, helper\) \{([\s\S]*?)\n    \}\n\n    function startSortingModule/
);
assert.ok(submitManualDropSource, "all native event routes need one MoveCommand submitter");
const submittedCalls = [];
const submitManualDrop = new Function(
  "api",
  "currentContextId",
  "canHandleManualDrag",
  "performManualDrop",
  `return (dragState, helper) => {${submitManualDropSource[1]}};`
)(
  {
    hostInputAdapter: {
      nativeDropCommitted() {}
    }
  },
  () => "smart-A",
  () => true,
  (_event, selectedIds) => {
    submittedCalls.push(selectedIds);
    return true;
  }
);
const sharedDragState = {
  collectionId: "smart-A",
  selectedIds: ["item-A"],
  submitted: false
};
assert.strictEqual(submitManualDrop(sharedDragState, { id: "helper-B" }), true);
assert.strictEqual(submitManualDrop(sharedDragState, { id: "helper-B" }), false);
assert.deepStrictEqual(submittedCalls, [["item-A"]]);
assert.match(
  source,
  /createSmartDragTargetResolver/
);
assert.match(
  source,
  /document\.elementsFromPoint/
);
assert.match(
  source,
  /observeSmartNativeDrag\(\s*"nativeDragStart"/
);
assert.match(
  source,
  /observeSmartNativeDrag\("nativeDrag"/
);
assert.match(
  source,
  /observeSmartNativeDrag\(\s*"nativeDragEnd"/
);
const smartNativeObserverSource = source.match(
  /function observeSmartNativeDrag\(method, event, options = \{\}\) \{([\s\S]*?)\n    \}/
);
assert.ok(
  smartNativeObserverSource,
  "smart native drag observer should use the one HostInputAdapter session"
);
assert.doesNotMatch(
  smartNativeObserverSource[1],
  /preventDefault|stopPropagation|stopImmediatePropagation|dataTransfer\s*[.=]|setPointerCapture/,
  "smart native drag observation must remain passive"
);
assert.match(
  dragOverSource[1],
  /smartObservation[\s\S]*?if \(smartObservation\.handled\) return;[\s\S]*?applyEventOwnership/,
  "smart dragover must leave before the normal-folder ownership branch"
);
const smartSubmitSource = source.match(
  /function submitSmartHostInputResult\(result\) \{([\s\S]*?)\n    \}\n\n    function observeSmartNativeDrag/
);
assert.ok(smartSubmitSource, "smart MoveCommand application boundary should exist");
assert.match(
  smartSubmitSource[1],
  /smartMoveApplicationRuntime\.apply\(\{\s+command: result\.command/,
  "smart submission must apply the supplied command without rebuilding it from DOM"
);
assert.doesNotMatch(
  smartSubmitSource[1],
  /box-sortable-helper|performManualDrop|scheduleAutoRename|buildCurrentRenamePlan|buildManualDropRenamePlan/,
  "smart submission must not depend on a stale helper or enter rename policy"
);
for (const handlerName of [
  "pointerDownHandler",
  "pointerMoveHandler",
  "pointerUpHandler",
  "pointerCancelHandler"
]) {
  const handlerSource = source.match(
    new RegExp(
      `const ${handlerName} = \\(event\\) => \\{([\\s\\S]*?)\\n\\s+\\};`
    )
  );
  assert.ok(handlerSource, `${handlerName} should exist`);
  assert.doesNotMatch(
    handlerSource[1],
    /preventDefault|stopPropagation|stopImmediatePropagation|dataTransfer\s*[.=]/,
    `${handlerName} must remain a passive Eagle observer`
  );
  assert.doesNotMatch(
    handlerSource[1],
    /scheduleAutoRename|buildCurrentRenamePlan|buildManualDropRenamePlan/,
    `${handlerName} must not contain rename policy`
  );
}
assert.match(source, /collection\.kind !== "smart"[\s\S]*?pointerDown/);
assert.match(source, /hostInputAdapter\?\.nativeDropCommitted\(\)/);
assert.match(source, /hostInputAdapter\.previewOpened\(\)/);
assert.match(source, /hostInputAdapter\?\.lockChanged\(\)/);
assert.match(source, /hostInputAdapter\?\.contextChanged\(\)/);
assert.match(source, /hostInputAdapter\.windowBlurred\(\)/);
assert.match(source, /hostInputAdapter\.pointerCancelled\(/);
assert.match(source, /command: result\.command/);
assert.match(source, /hostInputDiagnostics:/);
assert.match(source, /moveDiagnostics:/);
for (const stage of [
  "MOVE_RECEIVED",
  "REDUCER_BEFORE_AFTER",
  "PERSIST_OK",
  "PERSIST_ERROR",
  "RENDER_REQUESTED",
  "VISIBLE_VERIFY_OK",
  "VISIBLE_VERIFY_FAIL"
]) {
  assert.match(manualMoveApplicationSource, new RegExp(stage));
}
const manualDropSource = source.match(
  /function performManualDrop\(event, selectedIds, options = \{\}\) \{([\s\S]*?)\n    \}\n\n    function startSortingModule/
);
assert.ok(manualDropSource, "manual MoveCommand submission should exist");
assert.match(manualDropSource[1], /createMoveCommand/);
assert.match(manualDropSource[1], /manualMoveRuntime\.reduce/);
assert.match(manualDropSource[1], /commitPresentedManualStateTransaction\(\{/);
assert.match(manualDropSource[1], /presentation,/);
assert.match(manualDropSource[1], /rollbackState:/);
assert.match(manualDropSource[1], /api\.manualStore = JSON\.parse\(JSON\.stringify\(previousManualStore\)\)/);
assert.doesNotMatch(
  manualDropSource[1],
  /api\.refresh\?\.\(\)/,
  "normal manual drop rollback cannot depend on a later host refresh"
);
assert.match(
  manualDropSource[1],
  /collection\.kind === "normal"[\s\S]*?scheduleAutoRename/,
  "only a normal collection may enter the auto-number scheduling branch"
);
assert.match(source, /window\.onDropBoxItem = api\.original\.onDropBoxItem/);
assert.match(source, /const CANONICAL_PLUGIN_DIRECTORY = "com\.max\.eagle-photo-taken-sort"/);
assert.match(source, /const CACHE_VERSION = CACHE_SCHEMA_VERSION/);
assert.match(source, /createMetadataCacheRuntime/);
assert.match(source, /modifiedAt: item\.modifiedAt/);
assert.match(source, /batchSize: 1/);
assert.match(source, /concurrency: 1/);
assert.match(source, /RESOURCE_QUERY_/);
assert.doesNotMatch(
  source,
  /cache\.items = \{\}/,
  "switching Library must never destroy another Library's metadata cache"
);
assert.match(
  source,
  /path\.basename\(path\.normalize\(pluginPath\)\) === CANONICAL_PLUGIN_DIRECTORY/
);
assert.match(source, /if \(!runtimeInstanceAllowed\) \{[\s\S]*?non-canonical-instance/);
assert.match(source, /eagle\.onLibraryChanged\(\(libraryPath\) => \{\s+if \(!runtimeInstanceAllowed\) return;/);
assert.match(source, /window\.addEventListener\(eventName, handler, true\)/);
const ensureMenuSource = source.match(
  /function ensureMenu\(\) \{([\s\S]*?)\n    \}\n\n    function sortingHostProjectionSignature/
);
assert.ok(ensureMenuSource, "menu refresh should be present");
assert.doesNotMatch(ensureMenuSource[1], /\bscheduleAutoRename\(\)/);
assert.doesNotMatch(ensureMenuSource[1], /observeMembershipChange/);
const passiveEnsureMenuSource = ensureMenuSource[1].replace(
  "if (refreshHostScope()) renderSettings();",
  ""
);
assert.doesNotMatch(
  passiveEnsureMenuSource,
  /syncManualContext|syncMetaContext|syncRenameContext|renderSettings|restoreSmartManualView|observeSmartCollectionHost/,
  "the 500ms poll may only re-render after a proven host-scope rebound"
);
assert.match(source, /bodyScope\.\$watch\(\s*sortingHostProjectionSignature/);
assert.match(source, /new MutationObserver\(\(records\) => \{/);
assert.match(source, /records\.every\(mutationOwnedByPlugin\)/);
assert.match(source, /createSmartCollectionLifecycleController\(\{/);
assert.doesNotMatch(
  source,
  /setTimeout\(\(\) => api\.restoreSmartManualView|attempt:\s*Number\(request\.attempt/
);
assert.doesNotMatch(source, /observeMembershipChange/);
assert.doesNotMatch(source, /membershipContextId/);
assert.match(source, /function renameBatchStatusForCurrentContext\(\)/);
assert.match(source, /function queueCurrentRenamePlan\(plan\)/);
assert.match(sortingSystemSource, /mode: "current-folder"/);
assert.match(source, /createCurrentFolderRenameRequest\(/);
assert.match(sortingSystemSource, /finalOrder/);
assert.match(
  source,
  /if \(result\?\.mode !== "current-folder"\) api\.refresh\?\.\(\)/
);
const renameBatchHandler = source.match(
  /async function handleRenameBatchRequest\(request\) \{([\s\S]*?)\n\}/
);
assert.ok(renameBatchHandler, "rename batch handler should be present");
assert.doesNotMatch(
  renameBatchHandler[1],
  /refreshMainList\(\)/,
  "current-folder numbering must not trigger a second full grid refresh"
);
assert.match(source, /: queueCurrentRenamePlan\(plan\)/);
assert.match(source, /async function executeSafeRenameChanges\(/);
assert.match(source, /backgroundRenameRuntime\.buildExecutionPhases\(/);
assert.match(source, /async function dispatchNativeRenameBatch\(/);
assert.match(source, /Promise\.all\(entries\.map\(async \(entry\) =>/);
assert.doesNotMatch(source, /verifyRenameItemState/);
assert.match(source, /ayncsImagesChange\(items\)/);
assert.match(
  source,
  /dispatchNativeRenamePhase\(\s*phases\.temporary[\s\S]*?dispatchNativeRenamePhase\(\s*phases\.final/
);
const renamePhaseSource = source.match(
  /async function dispatchNativeRenamePhase\([\s\S]*?\n}\n\nasync function rollbackRenameItems\(/
);
assert.ok(renamePhaseSource, "paced native rename phase should be present");
assert.match(renamePhaseSource[0], /const batchSize = 3/);
assert.match(renamePhaseSource[0], /entries\.slice\(index, index \+ batchSize\)/);
assert.match(renamePhaseSource[0], /await dispatchNativeRenameBatch\(/);
assert.match(source, /async function rollbackRenameItems\(/);
const safeRenameSource = source.match(
  /function renameItemPaths\([\s\S]*?\nasync function processRenameBatch\(/
);
assert.ok(safeRenameSource, "native safe rename implementation should be present");
assert.match(safeRenameSource[0], /function dispatchNativeRename\(/);
assert.match(safeRenameSource[0], /ayncsImagesChange\(\[item\]\)/);
assert.match(safeRenameSource[0], /metadata\.json/);
assert.match(safeRenameSource[0], /metadata identity is invalid/);
assert.match(
  safeRenameSource[0],
  /fs\.promises\.readFile\(oldPaths\.metadataPath/
);
assert.match(safeRenameSource[0], /source file is missing/);
assert.match(safeRenameSource[0], /destination already exists/);
assert.match(safeRenameSource[0], /native rename verification failed/);
assert.doesNotMatch(safeRenameSource[0], /item\.save\(\)/);
assert.match(source, /function beginVisibleRenameMask\(plan\)/);
assert.match(source, /function finishVisibleRenameMask\(commitFinalNames = false\)/);
assert.match(source, /#inspector-name/);
assert.match(source, /\.name span,\.ext-icon-name/);
assert.match(source, /beginVisibleRenameMask\(plan\)/);
assert.match(source, /finishVisibleRenameMask\(true\)/);
assert.match(source, /bodyScope\.updateSelection\(\)/);
assert.match(source, /async function processApprovedRenameRecovery\(\)/);
assert.match(source, /async function prepareRenameRecoveryWork\(request, itemsById\)/);
assert.match(source, /mode === "restore-interrupted-batch"/);
assert.match(source, /currentName\.startsWith\("__eagle_number_"\)/);
assert.match(
  source,
  /expectedMetadataName:\s*String\(entry\.newName \|\| ""\)/
);
assert.match(
  source,
  /entry\.expectedMetadataName \?\? entry\.oldName/
);
assert.match(source, /dispatchNativeRenameBatch\(\s*batch,\s*itemsById,/s);
assert.match(source, /request\?\.approved !== true/);
assert.match(source, /request\?\.status !== "pending"/);
assert.match(source, /path\.normalize\(request\.libraryPath \|\| ""\)/);
assert.match(source, /eagle\.item\.get\(\{ folders: \[request\.folderId\] \}\)/);
assert.match(source, /await refreshMainListForFolder\(request\.folderId\)/);
assert.ok(
  fs.existsSync(path.join(__dirname, "..", "scripts", "build-interrupted-rename-recovery.js")),
  "interrupted rename recovery generator should exist"
);
assert.match(source, /pendingAfterRun: false/);
assert.match(
  source,
  /scheduleAutoRename\("manual-drop-continuation", AUTO_RENAME_QUIET_MS, true\)/
);
assert.match(
  source,
  /scheduleAutoRename\("manual-media-drop", AUTO_RENAME_QUIET_MS, true\)/
);
assert.match(source, /scheduleAutoRename\("manual-folder-drop", 350, true\)/);
assert.doesNotMatch(
  source,
  /scheduleAutoRename\((?!\s*(?:cause\b|"manual-(?:media|folder)-drop"|"manual-drop-continuation"))/
);
assert.match(
  source,
  /function buildManualDropRenamePlan\(nextItems, previousItemsOverride = null\)/
);
assert.match(source, /beginVisibleRenameMask\(immediatePlan\)/);
assert.match(
  source,
  /if \(api\.rename\.running \|\| api\.rename\.batchRequest\) \{\s+api\.rename\.pendingAfterRun = true/s
);
assert.doesNotMatch(source, /mapWithConcurrency\(plan\.changes, 4/);
assert.match(source, /sourceContextId: currentContextId\(\)/);
assert.match(
  source,
  /renameBatchStatus: renameBatchStatusForCurrentContext\(\)/
);
const metaTreeHandler = source.match(
  /function applyMetaToCurrentTree\(\) \{([\s\S]*?)\n    \}\n\n    function saveCurrentContainer/
);
assert.ok(metaTreeHandler, "meta tree batch handler should be present");
assert.doesNotMatch(metaTreeHandler[1], /skipFolder/);
assert.match(
  source,
  /collection\.kind === "smart"\s+\? \(smartReady \? smartSnapshot\.members\.slice\(\) : \[\]\)\s+\: currentItems\(\)/s
);
assert.match(source, /if \(!isPluginSort\(\)\) \{/);
assert.match(source, /manualEnabled\(\) &&\s+!folderLocked\(\)/s);
assert.match(source, /function applyHostManualOverlay\(items, orderBy = currentOrder\(\)\)/);
assert.match(source, /return applyHostManualOverlay\(\s*api\.original\.sortData\.call/s);
assert.doesNotMatch(
  source,
  /function applyManualOverlay\(items, orderBy = currentOrder\(\)\)/,
  "R68: host wrappers must never shadow the pure order-coordinator overlay in Eagle's injection scope"
);
assert.match(
  source,
  /const desired = resolveHostOrder\(data, effectiveOrderBy, true\)/
);
assert.match(
  source,
  /function scheduleNormalOrderPresentation\(\)/,
  "R74: opening a normal folder with an already-persisted plugin sort must actively present the authoritative order"
);
assert.match(
  source,
  /resolveHostOrder\(sourceItems, effectivePluginOrderBy\(\), true\)/,
  "R74: normal-folder first presentation must use the same plugin order chain as host callbacks"
);
assert.match(
  source,
  /presentOrderTransaction\(\{[\s\S]*?nextItems: nextItems[\s\S]*?arrays: arrayPlans/s,
  "R74: normal-folder presentation must atomically verify arrays and visible grid rather than trusting a delayed native refresh"
);
assert.ok(
  source.indexOf("${hostOrderSameIds.toString()}") < source.indexOf("${presentOrderTransaction.toString()}"),
  "R83: injected host presentation helpers must include sameIds before presentOrderTransaction"
);
const r82NormalPresenterSource = source.match(
  /normalOrderPresentation\.applying = true;([\s\S]*?)normalOrderStabilityGate\.complete\(/
);
assert.ok(r82NormalPresenterSource, "R82: normal presentation transaction must have an explicit completion boundary");
assert.match(
  r82NormalPresenterSource[1],
  /try \{[\s\S]*?presentOrderTransaction\(/s,
  "R82: a host presentation exception must be contained rather than leaving the transaction active"
);
assert.match(
  r82NormalPresenterSource[1],
  /finally \{\s*normalOrderPresentation\.applying = false;/s,
  "R82: reentrant host updates must never permanently strand normal presentation in applying state"
);
assert.match(source, /diagnoseNormalOrderPresentation\("PRESENT_THROW"/,
  "R82: fail-open must retain a bounded normal presenter error stage");
assert.match(source, /const normalOrderStabilityGate = createNormalOrderStabilityGate\(\);/,
  "R85: normal-folder presentation must own an explicit stability gate");
assert.match(source, /normalOrderStabilityGate\.request\(\{[\s\S]*?expectedVisibleIds,[\s\S]*?observedVisibleIds: originalVisibleIds/s,
  "R85: the existing host boundary must compare the visible grid before deduping a normal presentation");
assert.match(source, /stability\.action !== "present"[\s\S]*?"SKIP_STABLE"[\s\S]*?"FAIL_OPEN"/s,
  "R85: stable normal grids must be no-ops and repeated late rewrites must fail open");
assert.doesNotMatch(source, /NORMAL_PRESENTER_POST_COMMIT[\s\S]{0,500}setTimeout/s,
  "R85: late-order reconciliation must be event-observed, not a timer retry");
const r74EnsureMenuSource = source.match(
  /function ensureMenu\(\) \{([\s\S]*?)\n    \}\n\n    function sortingHostProjectionSignature/
);
assert.ok(r74EnsureMenuSource, "R74: menu readiness loop must exist");
assert.match(
  r74EnsureMenuSource[1],
  /scheduleNormalOrderPresentation\(\);/,
  "R74: the plugin's own ready-loop must notice a normal folder restored after injection even when Eagle emits no Angular watch event"
);
assert.match(source, /if \(!isPluginSort\(\)\) \{\s+bodyScope\.rebindRefresh\?\./s);
const r80RefreshSource = source.match(
  /api\.refresh = \(\) => \{([\s\S]*?)\n    \};\n\n    function syncSubFolderManualMode/
);
assert.ok(r80RefreshSource, "R80: plugin refresh boundary should be present");
assert.match(
  r80RefreshSource[1],
  /const refreshContextId = currentContextId\(\);/,
  "R80: a rule edit must bind its follow-up presentation to the collection it refreshed"
);
assert.match(
  r80RefreshSource[1],
  /bodyScope\.\$evalAsync\(\(\) => \{[\s\S]*?scheduleNormalOrderPresentation\(\);/s,
  "R80: normal-folder rule edits must request a verified presentation after Eagle completes its refresh"
);
assert.match(
  source,
  /let smartHostQueryKey = "";/,
  "R70: smart-query lifecycle must track stable semantic query identity separately from host array references"
);
assert.match(
  source,
  /const queryKey = \[\s*sourceIsSmartQuery \? hostSource\.sourceIdentity : "untrusted",\s*membershipFingerprint\s*\]\.join\("\|"\)/s,
  "R70: reference churn alone must not manufacture a new smart query epoch"
);
assert.doesNotMatch(
  source,
  /if \(hostSource\.sourceReference !== smartHostQuerySource\) \{\s+smartHostQuerySource = hostSource\.sourceReference;\s+smartHostQueryEpoch \+= 1;/s,
  "R70: host array replacement is a rerender detail, not a query identity change"
);
assert.match(source, /publishTeamState/);
assert.match(source, /exportTeamState/);
assert.match(source, /importTeamState/);
assert.match(source, /statePathForLibrary/);
assert.match(source, /library-sidecar/);
assert.match(source, /自动编号已携带但未自动启用/);
assert.match(source, /autoRenamePausedFolderCount/);
assert.match(source, /renameLibrary\.folders = \{\}/);
assert.match(source, /eagle\.folder\.getAll\(\)/);
assert.match(source, /showSaveDialog/);
assert.match(source, /showOpenDialog/);
assert.ok(
  indexSource.indexOf("团队排序与展示状态") >
    indexSource.indexOf("所有坐标识别都在本机离线完成"),
  "team handoff controls should stay at the bottom of the plugin window"
);

// Folder rename is an Eagle-native L0 operation. Sorting protection can guard
// plugin-owned ordering and auto-numbering, but must never wrap or reject
// Eagle's own context-menu folder rename command.
assert.doesNotMatch(
  source,
  /bodyScope\.changeFolderName\s*=/,
  "sorting code must not wrap or block Eagle native folder rename"
);

console.log("plugin source tests passed");
