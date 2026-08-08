"use strict";

function createManualMoveRuntime({ sortRuntime, orderCoordinator } = {}) {
  if (!sortRuntime || typeof sortRuntime.moveItems !== "function") {
    throw new TypeError("sortRuntime.moveItems is required");
  }
  if (
    !orderCoordinator ||
    typeof orderCoordinator.overlayForMove !== "function" ||
    typeof orderCoordinator.normalizeManualOverlay !== "function"
  ) {
    throw new TypeError("orderCoordinator is required");
  }

  function sameOrder(left, right) {
    return left.length === right.length &&
      left.every((item, index) => item === right[index]);
  }

  function createMoveCommand(input = {}) {
    const collection = input.collection || {};
    const items = Array.isArray(input.items) ? input.items.slice() : [];
    const selectedIds = Array.from(input.selectedIds || [])
      .map(String)
      .filter(Boolean);
    const targetId = String(input.targetId || "");
    if (!collection.id || !["normal", "smart"].includes(collection.kind)) {
      return { ok: false, reason: "collection-required" };
    }
    if (input.locked === true) {
      return { ok: false, reason: "sorting-protected" };
    }
    if (!items.length || !selectedIds.length || !targetId) {
      return { ok: false, reason: "move-target-required" };
    }
    const insertAfter = input.insertAfter === true;
    const nextItems = sortRuntime.moveItems(
      items,
      selectedIds,
      targetId,
      insertAfter
    );
    if (!Array.isArray(nextItems) || sameOrder(nextItems, items)) {
      return { ok: false, reason: "order-unchanged" };
    }
    const relations = orderCoordinator.overlayForMove(
      items,
      selectedIds,
      targetId,
      insertAfter
    );
    if (!relations.length) {
      return { ok: false, reason: "move-relation-empty" };
    }
    return {
      ok: true,
      command: Object.freeze({
        type: "MoveCommand",
        collection: Object.freeze({
          kind: collection.kind,
          id: String(collection.id),
          key: String(collection.key || "")
        }),
        targetKind: "direct-media",
        selectedIds: Object.freeze(selectedIds),
        targetId,
        insertAfter,
        sourceItems: Object.freeze(items),
        nextItems: Object.freeze(nextItems),
        relations: Object.freeze(relations)
      })
    };
  }

  function reduce(state = {}, command, revision = Date.now()) {
    if (!command || command.type !== "MoveCommand") {
      throw new TypeError("MoveCommand is required");
    }
    const moved = new Set(command.selectedIds.map(String));
    const retained = (Array.isArray(state.relations) ? state.relations : [])
      .filter((relation) =>
        !moved.has(String(relation.itemId)) &&
        !moved.has(String(relation.anchorId))
      );
    const previous = orderCoordinator.normalizeManualOverlay(
      Array.isArray(state.relations) ? state.relations : []
    );
    const history = Array.isArray(state.history) ? state.history.slice() : [];
    history.push(previous);
    if (history.length > 30) history.shift();
    const legacyOrder = Array.isArray(state.legacyOrder) &&
      state.legacyOrder.length
      ? state.legacyOrder.map(String)
      : command.sourceItems.map((item) => String(item.id));
    return {
      relations: orderCoordinator.normalizeManualOverlay(
        retained.concat(command.relations)
      ),
      legacyOrder,
      order: legacyOrder.slice(),
      history,
      targetKind: "direct-media",
      revision: Math.max(0, Number(revision) || 0),
      mode: "overlay"
    };
  }

  return Object.freeze({
    createMoveCommand,
    reduce
  });
}

module.exports = { createManualMoveRuntime };
