"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "plugin.js"),
  "utf8"
);

assert.match(source, /createRenameCommandQueue/);
assert.match(source, /createRenameLifecycleRuntime/);
assert.match(source, /createOrderCoordinator/);
assert.match(source, /renameCommandQueue\.enqueue/);
assert.match(source, /acknowledgeRenameEnqueue/);
assert.match(source, /rejectRenameEnqueue/);
assert.match(source, /restoreRenameBatch/);
assert.doesNotMatch(source, /renameBatchInProgress/);
assert.match(source, /collectionId/);
assert.match(source, /snapshotVersion/);
assert.match(source, /snapshotIdentity/);
assert.match(source, /signature/);

const handler = source.match(
  /async function handleRenameBatchRequest\(request\) \{([\s\S]*?)\n\}/
);
assert.ok(handler, "rename handler should exist");
assert.doesNotMatch(
  handler[1],
  /renameBatchInProgress/,
  "global rename mutex must not block another collection"
);
assert.match(handler[1], /renameCommandQueue\.enqueue/);
assert.match(handler[1], /acknowledgeMainRenameEnqueue/);
assert.match(handler[1], /rejectMainRenameEnqueue/);

const executor = source.match(
  /async function executeRenameCommand\(command\) \{([\s\S]*?)\n\}\n\nasync function handleRenameBatchRequest/
);
assert.ok(executor, "rename command executor should exist");
assert.doesNotMatch(
  executor[1],
  /restoreMainRenameBatch/,
  "a failed command must settle visibly and wait for an explicit user retry"
);
assert.match(
  executor[1],
  /completeMainRenameBatch/,
  "a failed command must publish its terminal result to the active context"
);

const visibleMaskCompletion = source.match(
  /function finishVisibleRenameMask\(commitFinalNames = false\) \{([\s\S]*?)\n    \}\n\n    function queueCurrentRenamePlan/
);
assert.ok(visibleMaskCompletion, "visible rename mask completion should exist");
assert.match(
  visibleMaskCompletion[1],
  /if \(!commitFinalNames[\s\S]*?bodyScope\.updateItemsView/,
  "a failed rename must restore masked cards from the current Eagle items"
);
assert.match(
  visibleMaskCompletion[1],
  /if \(!commitFinalNames[\s\S]*?bodyScope\.updateSelection/,
  "a failed rename must restore the selected inspector projection"
);

const renameCheckboxProjection = source.match(
  /if \(renameCheckbox\) \{([\s\S]*?)\n          \}/
);
assert.ok(renameCheckboxProjection, "auto-number checkbox projection should exist");
assert.doesNotMatch(
  renameCheckboxProjection[1],
  /api\.rename\.running/,
  "rename task lifecycle must not become permission to toggle auto-number"
);
assert.match(
  renameCheckboxProjection[1],
  /canToggleAutoNumber/,
  "auto-number toggle permission must come from the lifecycle policy"
);

const maybe = source.match(
  /function maybeAutoRename\(\) \{([\s\S]*?)\n    \}\n\n    function scheduleAutoRename/
);
assert.ok(maybe, "automatic rename entry should exist");
assert.doesNotMatch(
  maybe[1],
  /api\.rename\.lastSignature = signature;\s+applyRenamePlan/,
  "signature cannot be claimed before queue acceptance"
);

const dragOver = source.match(
  /const dragOverHandler = \(event\) => \{([\s\S]*?)\n\s+\};\s+const dropHandler/
);
assert.ok(dragOver, "dragover handler should exist");
assert.match(dragOver[1], /classifyEvent|eventOwnership|sortingOwnership/);
assert.doesNotMatch(
  dragOver[1],
  /event\.preventDefault\(\)[\s\S]*?if \(!helper\)/,
  "ownership must be decided before cancellation"
);
assert.match(source, /applyEventOwnership|applyOwnership/);
assert.match(
  source,
  /createSmartCollectionLifecycleController\(\{/,
  "smart collection re-entry must use the generation-owned lifecycle"
);
assert.match(
  source,
  /scheduleSmartHostObservation\(\)/,
  "smart collection re-entry must be driven by host observations"
);
assert.match(
  source,
  /smartMoveApplicationRuntime\.restore\(\{/,
  "smart re-entry must use the existing application runtime"
);
assert.doesNotMatch(
  source,
  /setTimeout\(\(\) => api\.restoreSmartManualView|attempt:\s*Number\(request\.attempt/,
  "smart re-entry cannot depend on fixed-delay retries"
);
assert.match(
  source,
  /const dragFeedbackController = createDragFeedbackController\(\{ document \}\)/,
  "normal and smart drag must share one feedback controller"
);
assert.match(
  source,
  /showSmartDragFeedback\(selectedIds,\s*target\)/,
  "smart drag must continuously project the resolved target through the shared controller"
);
assert.match(
  source,
  /dragFeedbackController\.start\(selectedIds,\s*\{\s*mode:\s*"smart"\s*\}\)/,
  "smart drag must explicitly select the non-layout feedback strategy"
);
assert.match(
  source,
  /dragFeedbackController\.update\(\{\s*\.\.\.target,\s*mode:\s*"smart"\s*\}\)/,
  "smart drag targets must never fall through to normal host-helper projection"
);
const smartFeedback = source.match(
  /function showSmartDragFeedback\(selectedIds, target = \{\}\) \{([\s\S]*?)\n    \}/
);
assert.ok(smartFeedback, "smart feedback helper should exist");
assert.doesNotMatch(
  smartFeedback[1],
  /setDropTargetsVisible\(/,
  "smart feedback cannot indirectly expose every host helper"
);
assert.match(
  source,
  /eagle-photo-smart-active-helper[\s\S]*?position:absolute!important[\s\S]*?top:0!important[\s\S]*?bottom:0!important/,
  "the single smart helper must be full-height and removed from masonry layout"
);
assert.match(
  source,
  /eagle-photo-drop-target:before[\s\S]*?top:0[\s\S]*?bottom:0[\s\S]*?width:3px/,
  "helper-missing fallback must be a complete vertical marker, not a clipped box-shadow"
);
assert.doesNotMatch(
  source,
  /eagle-photo-drop-(?:before|after)\\?\"?\\?\\}?[^\\n]*box-shadow:inset/,
  "smart fallback cannot return to the qa.24 clipped inset box-shadow"
);
assert.doesNotMatch(
  source,
  /eagle-photo-smart-target-host\{[^}]*\b(?:position|overflow)\s*:/,
  "smart feedback must never rewrite the target card's masonry positioning or clipping"
);
assert.match(
  source,
  /dragFeedbackController\.update\(\{\s*mode:\s*"normal",[\s\S]*?targetId:/,
  "the ordinary folder helper path must use the same feedback controller"
);
assert.match(
  source,
  /sortMode:\s*currentSortMode\(orderBy\)/,
  "all host order resolution must declare the current order authority"
);
assert.doesNotMatch(
  source,
  /ok:\s*manualOverlayActive\s*\|\|/,
  "a manual view cannot make the taken-time visual check pass"
);
assert.match(
  source,
  /手动拖动（默认开启）/,
  "manual dragging must be an intrinsic collection capability"
);
assert.match(
  source,
  /恢复自动排序/,
  "the user needs an explicit way to leave manual authority"
);
const manualDrop = source.match(
  /function performManualDrop\(event, selectedIds, options = \{\}\) \{([\s\S]*?)\n    \}/
);
assert.ok(manualDrop, "manual drop function should exist");
assert.doesNotMatch(
  manualDrop[1],
  /preventDefault|stopPropagation|stopImmediatePropagation/,
  "manual drop cannot independently seize native event ownership"
);

const listeners = source.match(
  /for \(const \[eventName, handler\] of Object\.entries\(api\.handlers\)\) \{([\s\S]*?)\n    \}/
);
assert.ok(listeners, "listener registration should exist");
assert.match(source, /sortingModuleLifecycle|sortingLifecycle|moduleLifecycle/);
assert.match(source, /register\(/);

console.log("plugin integration contract tests passed");
