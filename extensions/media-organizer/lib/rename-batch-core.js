"use strict";

function createRenameBatchRuntime(options = {}) {
  const sortRuntime = options.sortRuntime;
  const renameRuntime = options.renameRuntime;
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
      const sorted = sortRuntime.sortDesired(items, {
        folderId: folder.id,
        manualOrder: folder.manualOrder || [],
        rules: folder.rules,
        timestamps
      });
      const plan = renameRuntime.buildPlan(sorted, {
        folderName: folder.name
      });
      const folderChanges = plan.changes.map((entry) => ({
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
      errorCount: folderPlans.filter((folder) => folder.error).length
    };
  }

  return { buildPlan };
}

module.exports = { createRenameBatchRuntime };
