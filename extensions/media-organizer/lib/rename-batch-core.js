"use strict";

function createRenameBatchRuntime(options = {}) {
  const sortRuntime = options.sortRuntime;
  const renameRuntime = options.renameRuntime;
  const sortingSystemRuntime = options.sortingSystemRuntime;
  if (!sortRuntime || !renameRuntime) {
    throw new Error("sortRuntime and renameRuntime are required");
  }

  function buildPlan(folders, itemsByFolder, timestamps = {}) {
    const normalizedFolders = Array.isArray(folders) ? folders : [];
    const memberships = new Map();

    for (const folder of normalizedFolders) {
      const items = itemsByFolder?.[folder.id] || [];
      for (const item of items) {
        if (
          !item?.id ||
          !sortRuntime.isMedia(item) ||
          !renameRuntime.groupFromName(item.name)
        ) {
          continue;
        }
        const id = String(item.id);
        if (!memberships.has(id)) memberships.set(id, new Set());
        memberships.get(id).add(String(folder.id));
      }
    }

    const conflicts = new Set(
      Array.from(memberships.entries())
        .filter(([, folderIds]) => folderIds.size > 1)
        .map(([id]) => id)
    );
    const folderPlans = [];
    const changes = [];

    for (const folder of normalizedFolders) {
      const items = (itemsByFolder?.[folder.id] || []).filter(
        (item) => !conflicts.has(String(item?.id || ""))
      );
      let ordered = [];
      let orderError = null;
      if (Array.isArray(folder.finalOrder) && sortingSystemRuntime) {
        const resolved = sortingSystemRuntime.resolveRequestedOrder(folder, items);
        if (resolved.ok) ordered = resolved.items;
        else orderError = resolved.reason;
      } else if (sortingSystemRuntime) {
        const snapshot = sortingSystemRuntime.resolveOrder({
          collection: {
            kind: "normal",
            id: String(folder.id || ""),
            key: "normal:" + String(folder.id || "")
          },
          contextId: "normal:" + String(folder.id || ""),
          targetKind: "direct-media",
          items,
          pluginSort: true,
          sortMode: "automatic",
          manualOrder: folder.manualOrder || [],
          manualOverlay: folder.manualOverlay || [],
          rules: folder.rules,
          timestamps
        });
        ordered = snapshot.finalItems;
      } else {
        ordered = sortRuntime.sortDesired(items, {
          folderId: folder.id,
          manualOrder: folder.manualOrder || [],
          rules: folder.rules,
          timestamps
        });
      }
      const plan = orderError
        ? {
            sceneName: "",
            groups: { people: 0, environment: 0 },
            ignoredCount: 0,
            changes: [],
            error: orderError
          }
        : renameRuntime.buildPlan(ordered, {
        folderName: folder.name
          });
      const allowedChangeIds = Array.isArray(folder.allowedChangeIds)
        ? new Set(folder.allowedChangeIds.map(String))
        : null;
      const folderChanges = plan.changes
        .filter((entry) =>
          !allowedChangeIds || allowedChangeIds.has(String(entry.id))
        )
        .map((entry) => ({
        ...entry,
        folderId: String(folder.id),
        folderName: String(folder.name || "")
        }));
      folderPlans.push({
        folderId: String(folder.id),
        folderName: String(folder.name || ""),
        sceneName: plan.sceneName,
        groups: plan.groups,
        ignoredCount: plan.ignoredCount,
        changes: folderChanges.length,
        error: plan.error
      });
      changes.push(...folderChanges);
    }

    return {
      folders: folderPlans,
      changes,
      conflictIds: Array.from(conflicts),
      folderCount: folderPlans.length,
      changeCount: changes.length,
      errorCount: folderPlans.filter((folder) => folder.error).length,
      errors: folderPlans
        .filter((folder) => folder.error)
        .map((folder) => ({
          folderId: folder.folderId,
          folderName: folder.folderName,
          reason: folder.error
        }))
    };
  }

  return { buildPlan };
}

module.exports = { createRenameBatchRuntime };
