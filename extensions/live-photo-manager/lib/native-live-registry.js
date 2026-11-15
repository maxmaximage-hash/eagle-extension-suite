"use strict";

const path = require("path");
const {
  createOperation,
  recordOperationResult,
  transitionOperation,
} = require("./live-photo-ledger");
const {
  exportLivePairComponent,
  exportLivePairComponents,
  exportLivePairPackage,
} = require("./export-service");

/**
 * Attach the Eagle native item id to the durable Live Photo group record.
 *
 * The mapping is deliberately kept outside Eagle's item metadata.  Eagle's
 * native grid remains the source of truth for selection and display while the
 * plugin's ledger provides the small amount of provenance needed by export
 * actions.
 */
function registerNativeItem(ledger, {
  group,
  groupId,
  itemId,
  packagePath = null,
} = {}) {
  if (!ledger) throw new Error("Live Photo ledger is required");
  if (!itemId) throw new Error("Native Eagle item id is required");
  const resolved = group || (groupId && ledger.groups[groupId]);
  if (!resolved) throw new Error(`Live Photo group not found: ${groupId || "(missing)"}`);
  if (!resolved.id) throw new Error("Live Photo group id is required");
  if (!resolved.imagePath || !resolved.moviePath) {
    throw new Error("Live Photo group has no complete source pair");
  }
  resolved.nativeItemId = String(itemId);
  resolved.nativePackagePath = packagePath || resolved.nativePackagePath || null;
  // A host-side registration is only emitted after the pair has been
  // packaged and accepted by Eagle, so the source pair is exportable even if
  // its earlier diagnostic queue state was `paired`/`preview_ready`.
  resolved.status = "ready";
  resolved.updatedAt = new Date().toISOString();
  ledger.events.push({
    at: resolved.updatedAt,
    type: "native-item.registered",
    groupId: resolved.id,
    itemId: resolved.nativeItemId,
    packagePath: resolved.nativePackagePath,
  });
  if (ledger.events.length > 2000) ledger.events.splice(0, ledger.events.length - 2000);
  return resolved;
}

function findGroupByNativeItemId(ledger, itemId) {
  if (!ledger || !itemId) return null;
  const needle = String(itemId);
  return Object.values(ledger.groups || {}).find(
    (group) => String(group.nativeItemId || "") === needle,
  ) || null;
}

function assertExportableGroup(group) {
  if (!group) throw new Error("Live Photo group not found");
  if (group.status !== "ready") {
    throw new Error(`Live Photo group is not exportable: ${group.status}`);
  }
  if (!group.imagePath || !group.moviePath) {
    throw new Error("Live Photo group has no complete source pair");
  }
}

/**
 * Run a native-grid export action using only an Eagle item id.  This is the
 * service-mode boundary used by the host context-menu bridge; it never opens
 * or manipulates the diagnostic manager window.
 */
function exportNativeItem(ledger, {
  itemId,
  mode,
  outputDirectory,
  overwrite = false,
} = {}) {
  if (!["image", "movie", "components", "livp"].includes(mode)) {
    throw new Error(`Unsupported export mode: ${mode}`);
  }
  const group = findGroupByNativeItemId(ledger, itemId);
  assertExportableGroup(group);
  if (!outputDirectory) throw new Error("Output directory is required");
  const operation = createOperation(ledger, {
    type: mode === "livp" ? "export-livp" : `export-${mode}`,
    groupIds: [group.id],
    outputDirectory: path.resolve(outputDirectory),
    metadata: { nativeItemId: String(itemId), source: "native-context-menu" },
  });
  transitionOperation(ledger, operation.id, "running");
  try {
    const result = mode === "livp"
      ? exportLivePairPackage(group, operation.outputDirectory, { overwrite })
      : mode === "components"
        ? exportLivePairComponents(group, operation.outputDirectory, { overwrite })
        : exportLivePairComponent(group, operation.outputDirectory, mode, { overwrite });
    recordOperationResult(ledger, operation.id, group.id, {
      status: "confirmed",
      ...result,
    });
    transitionOperation(ledger, operation.id, "completed");
  } catch (error) {
    recordOperationResult(ledger, operation.id, group.id, {
      status: "failed",
      error: error.message,
    });
    transitionOperation(ledger, operation.id, "failed");
    throw error;
  }
  return ledger.operations[operation.id];
}

module.exports = {
  registerNativeItem,
  findGroupByNativeItemId,
  exportNativeItem,
};

