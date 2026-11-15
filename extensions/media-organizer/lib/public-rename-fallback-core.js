"use strict";

function createPublicRenameFallbackRuntime(options = {}) {
  const buildPlan = typeof options.buildPlan === "function"
    ? options.buildPlan
    : () => ({ error: "rename-plan-unavailable", entries: [], changes: [] });
  const saveItem = typeof options.saveItem === "function"
    ? options.saveItem
    : async (item) => item.save();

  async function applyPlan(plan, items) {
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
