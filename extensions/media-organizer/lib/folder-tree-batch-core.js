"use strict";

function createFolderTreeBatchRuntime(options = {}) {
  const collectFolderTree =
    typeof options.collectFolderTree === "function"
      ? options.collectFolderTree
      : defaultCollectFolderTree;

  function defaultCollectFolderTree(folder) {
    if (!folder || !folder.id) return [];
    const result = [];
    const visited = new Set();
    const stack = [folder];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || !current.id || visited.has(current.id)) continue;
      visited.add(current.id);
      result.push(current);
      const children = Array.isArray(current.children) ? current.children : [];
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push(children[index]);
      }
    }
    return result;
  }

  function folderId(folder) {
    return String(folder && folder.id || "");
  }

  function errorMessage(error) {
    return error && error.message ? String(error.message) : String(error);
  }

  function collectDescendantIds(folder) {
    const ids = [];
    const stack = Array.isArray(folder?.children)
      ? folder.children.slice()
      : [];
    while (stack.length > 0) {
      const current = stack.pop();
      const id = folderId(current);
      if (id) ids.push(id);
      const children = Array.isArray(current?.children)
        ? current.children
        : [];
      for (const child of children) stack.push(child);
    }
    return ids;
  }

  function applyToFolderTree(rootOrFolders, config = {}) {
    const folders = Array.isArray(rootOrFolders)
      ? rootOrFolders
      : collectFolderTree(rootOrFolders);
    const subtreeSkipEnabled = config.skipDescendantsOfSkipped === true;
    const blockedBySkippedAncestor = new Set();
    const result = {
      total: folders.length,
      applied: [],
      skipped: [],
      failures: []
    };

    for (const folder of folders) {
      const id = folderId(folder);
      if (!id) {
        result.failures.push({
          folder,
          id,
          name: "",
          error: "Folder is missing an id"
        });
        continue;
      }

      if (subtreeSkipEnabled && blockedBySkippedAncestor.has(id)) {
        result.skipped.push({
          folder,
          id,
          name: String(folder.name || ""),
          reason: String(config.descendantSkipReason || "locked-descendant")
        });
        for (const childId of collectDescendantIds(folder)) {
          blockedBySkippedAncestor.add(childId);
        }
        continue;
      }

      if (typeof config.skipFolder === "function") {
        let skipReason = "";
        try {
          skipReason = config.skipFolder(folder);
        } catch (error) {
          result.failures.push({
            folder,
            id,
            name: String(folder.name || ""),
            error: errorMessage(error)
          });
          continue;
        }
        if (skipReason) {
          result.skipped.push({
            folder,
            id,
            name: String(folder.name || ""),
            reason: String(skipReason)
          });
          if (subtreeSkipEnabled) {
            for (const childId of collectDescendantIds(folder)) {
              blockedBySkippedAncestor.add(childId);
            }
          }
          continue;
        }
      }

      try {
        const snapshot =
          typeof config.snapshot === "function"
            ? config.snapshot(folder)
            : undefined;
        if (typeof config.apply === "function") {
          config.apply(folder);
        }
        result.applied.push({
          folder,
          id,
          name: String(folder.name || ""),
          snapshot
        });
      } catch (error) {
        result.failures.push({
          folder,
          id,
          name: String(folder.name || ""),
          error: errorMessage(error)
        });
      }
    }

    return result;
  }

  function rollbackApplied(result, rollback) {
    if (!result || typeof rollback !== "function") return 0;
    let rolledBack = 0;
    for (let index = result.applied.length - 1; index >= 0; index -= 1) {
      const entry = result.applied[index];
      try {
        rollback(entry.folder, entry.snapshot, entry);
        rolledBack += 1;
      } catch {}
    }
    return rolledBack;
  }

  function counts(result) {
    return {
      total: Number(result && result.total) || 0,
      applied: Array.isArray(result && result.applied)
        ? result.applied.length
        : 0,
      skipped: Array.isArray(result && result.skipped)
        ? result.skipped.length
        : 0,
      failed: Array.isArray(result && result.failures)
        ? result.failures.length
        : 0
    };
  }

  return {
    applyToFolderTree,
    collectFolderTree,
    counts,
    rollbackApplied
  };
}

module.exports = {
  createFolderTreeBatchRuntime
};
