"use strict";

function createPublicRenameFallbackRuntime(options = {}) {
  const buildPlan = typeof options.buildPlan === "function"
    ? options.buildPlan
    : () => ({ error: "rename-plan-unavailable", entries: [], changes: [] });
  const saveItem = typeof options.saveItem === "function"
    ? options.saveItem
    : async (item) => item.save();

  function findConflicts(changes, availableItems) {
    const changingIds = new Set(
      (Array.isArray(changes) ? changes : [])
        .map((entry) => String(entry?.id || ""))
        .filter(Boolean)
    );
    const owners = new Map();
    for (const item of Array.isArray(availableItems) ? availableItems : []) {
      const id = String(item?.id || "");
      const name = String(item?.name || "");
      if (id && name && !owners.has(name)) owners.set(name, id);
    }
    return (Array.isArray(changes) ? changes : [])
      .map((entry) => {
        const target = String(entry?.newName || "");
        const ownerId = owners.get(target);
        if (!target || !ownerId || changingIds.has(ownerId)) return null;
        return { id: String(entry?.id || ""), newName: target, ownerId };
      })
      .filter(Boolean);
  }

  async function applyPlan(plan, items, options = {}) {
    if (!plan || plan.error) {
      return { ok: false, reason: plan?.error || "rename-plan-unavailable", renamed: 0, rolledBack: 0 };
    }
    const byId = new Map(
      (Array.isArray(items) ? items : [])
        .filter((item) => item?.id)
        .map((item) => [String(item.id), item])
    );
    const changed = (Array.isArray(plan.changes) ? plan.changes : [])
      .map((entry) => ({
        entry,
        item: byId.get(String(entry.id))
      }))
      .filter((record) => record.item && record.entry.newName);
    const conflicts = findConflicts(
      changed.map((record) => record.entry),
      options.availableItems || items
    );
    if (conflicts.length) {
      return {
        ok: false,
        reason: `目标名称已被当前文件夹中的其他图片占用：${conflicts[0].newName}`,
        conflictNames: conflicts.map((conflict) => conflict.newName),
        renamed: 0,
        rolledBack: 0
      };
    }
    const saved = [];
    try {
      for (const record of changed) {
        const oldName = String(record.item.name || "");
        record.item.name = String(record.entry.newName);
        await saveItem(record.item);
        saved.push({ item: record.item, oldName });
      }
      return { ok: true, renamed: saved.length, rolledBack: 0 };
    } catch (error) {
      let rolledBack = 0;
      for (const record of saved.slice().reverse()) {
        try {
          record.item.name = record.oldName;
          await saveItem(record.item);
          rolledBack += 1;
        } catch {}
      }
      return {
        ok: false,
        reason: error?.message || String(error),
        renamed: 0,
        rolledBack
      };
    }
  }

  return { applyPlan, buildPlan };
}

module.exports = { createPublicRenameFallbackRuntime };
