"use strict";

const MOVE_APPLICATION_STAGES = Object.freeze({
  MOVE_RECEIVED: "MOVE_RECEIVED",
  REDUCER_BEFORE_AFTER: "REDUCER_BEFORE_AFTER",
  PERSIST_OK: "PERSIST_OK",
  PERSIST_ERROR: "PERSIST_ERROR",
  RENDER_REQUESTED: "RENDER_REQUESTED",
  VISIBLE_VERIFY_OK: "VISIBLE_VERIFY_OK",
  VISIBLE_VERIFY_FAIL: "VISIBLE_VERIFY_FAIL"
});

function createManualMoveApplicationRuntime(options = {}) {
  const reduce = options.reduce;
  const persist = options.persist;
  const present = options.present;
  const readVisibleIds = options.readVisibleIds;
  const resolvePersistedOrder = options.resolvePersistedOrder;
  const diagnose = typeof options.diagnose === "function"
    ? options.diagnose
    : () => {};
  const now = typeof options.now === "function" ? options.now : Date.now;
  if (typeof reduce !== "function") {
    throw new TypeError("reduce is required");
  }
  if (typeof persist !== "function") {
    throw new TypeError("persist is required");
  }
  if (typeof present !== "function") {
    throw new TypeError("present is required");
  }
  if (typeof readVisibleIds !== "function") {
    throw new TypeError("readVisibleIds is required");
  }

  function idsOf(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => String(
        item && typeof item === "object" ? item.id || "" : item || ""
      ))
      .filter(Boolean);
  }

  function summarizeIds(values) {
    const ids = idsOf(values);
    return {
      count: ids.length,
      head: ids.slice(0, 3),
      tail: ids.length > 6 ? ids.slice(-3) : []
    };
  }

  function sameIds(left, right) {
    return left.length === right.length &&
      left.every((id, index) => id === right[index]);
  }

  function emit(stage, payload = {}) {
    try {
      diagnose(stage, payload);
    } catch {}
  }

  function validate(command, collection) {
    if (!command || command.type !== "MoveCommand") {
      return "move-command-required";
    }
    if (
      command.collection?.kind !== "smart" ||
      collection?.kind !== "smart" ||
      String(command.collection?.id || "") !== String(collection?.id || "")
    ) {
      return "collection-changed";
    }
    if (
      !String(command.targetId || "") ||
      !Array.isArray(command.selectedIds) ||
      command.selectedIds.length === 0 ||
      !Array.isArray(command.sourceItems) ||
      !Array.isArray(command.nextItems) ||
      command.sourceItems.length !== command.nextItems.length
    ) {
      return "move-command-invalid";
    }
    return "";
  }

  async function apply(input = {}) {
    const command = input.command;
    const collection = input.collection || {};
    const receivedPayload = {
      collectionId: String(command?.collection?.id || ""),
      selectedCount: Array.isArray(command?.selectedIds)
        ? command.selectedIds.length
        : 0,
      targetId: String(command?.targetId || ""),
      insertAfter: command?.insertAfter === true,
      source: summarizeIds(command?.sourceItems),
      next: summarizeIds(command?.nextItems)
    };
    emit(MOVE_APPLICATION_STAGES.MOVE_RECEIVED, receivedPayload);
    const validationError = validate(command, collection);
    if (validationError) {
      return {
        ok: false,
        reason: validationError,
        stage: MOVE_APPLICATION_STAGES.MOVE_RECEIVED
      };
    }

    let nextState;
    try {
      nextState = reduce(input.state || {}, command, now());
    } catch {
      emit(MOVE_APPLICATION_STAGES.PERSIST_ERROR, {
        collectionId: String(collection.id || ""),
        reason: "reducer-error"
      });
      return {
        ok: false,
        reason: "reducer-error",
        stage: MOVE_APPLICATION_STAGES.PERSIST_ERROR
      };
    }
    emit(MOVE_APPLICATION_STAGES.REDUCER_BEFORE_AFTER, {
      collectionId: String(collection.id || ""),
      before: summarizeIds(command.sourceItems),
      after: summarizeIds(command.nextItems),
      beforeRelationCount: Array.isArray(input.state?.relations)
        ? input.state.relations.length
        : 0,
      afterRelationCount: Array.isArray(nextState?.relations)
        ? nextState.relations.length
        : 0
    });

    try {
      const persisted = await persist(nextState, {
        collection,
        command
      });
      if (persisted === false) throw new Error("persist-rejected");
    } catch {
      emit(MOVE_APPLICATION_STAGES.PERSIST_ERROR, {
        collectionId: String(collection.id || ""),
        reason: "persist-error"
      });
      return {
        ok: false,
        reason: "persist-error",
        stage: MOVE_APPLICATION_STAGES.PERSIST_ERROR
      };
    }
    emit(MOVE_APPLICATION_STAGES.PERSIST_OK, {
      collectionId: String(collection.id || ""),
      revision: Math.max(0, Number(nextState?.revision) || 0),
      relationCount: Array.isArray(nextState?.relations)
        ? nextState.relations.length
        : 0
    });

    const expectedVisibleIds = idsOf(
      Array.isArray(input.expectedVisibleIds)
        ? input.expectedVisibleIds
        : command.nextItems
    );
    emit(MOVE_APPLICATION_STAGES.RENDER_REQUESTED, {
      collectionId: String(collection.id || ""),
      expected: summarizeIds(expectedVisibleIds)
    });
    try {
      await present({
        context: input.presentationContext,
        targetId: String(command.targetId),
        insertAfter: command.insertAfter === true,
        selectedIds: command.selectedIds.map(String),
        nextItems: command.nextItems,
        nextState,
        expectedVisibleIds
      });
    } catch {}

    const actualVisibleIds = idsOf(await readVisibleIds());
    const visible = sameIds(actualVisibleIds, expectedVisibleIds);
    const stage = visible
      ? MOVE_APPLICATION_STAGES.VISIBLE_VERIFY_OK
      : MOVE_APPLICATION_STAGES.VISIBLE_VERIFY_FAIL;
    emit(stage, {
      collectionId: String(collection.id || ""),
      expected: summarizeIds(expectedVisibleIds),
      actual: summarizeIds(actualVisibleIds)
    });
    return {
      ok: visible,
      reason: visible ? "" : "visible-order-mismatch",
      stage,
      nextState,
      expectedVisibleIds,
      actualVisibleIds
    };
  }

  async function restore(input = {}) {
    const collection = input.collection || {};
    const state = input.state || {};
    if (
      collection.kind !== "smart" ||
      !Array.isArray(state.relations) ||
      state.relations.length === 0 ||
      !Array.isArray(input.sourceItems) ||
      typeof resolvePersistedOrder !== "function"
    ) {
      return {
        ok: false,
        reason: "persisted-overlay-unavailable",
        stage: MOVE_APPLICATION_STAGES.RENDER_REQUESTED
      };
    }

    let nextItems;
    try {
      nextItems = resolvePersistedOrder(
        input.sourceItems.slice(),
        state.relations.map((relation) => ({ ...relation }))
      );
    } catch {
      nextItems = null;
    }
    if (
      !Array.isArray(nextItems) ||
      nextItems.length !== input.sourceItems.length
    ) {
      return {
        ok: false,
        reason: "persisted-overlay-invalid",
        stage: MOVE_APPLICATION_STAGES.RENDER_REQUESTED
      };
    }

    const expectedVisibleIds = idsOf(
      Array.isArray(input.expectedVisibleIds)
        ? input.expectedVisibleIds
        : nextItems
    );
    emit(MOVE_APPLICATION_STAGES.RENDER_REQUESTED, {
      collectionId: String(collection.id || ""),
      reason: "context-reentry",
      expected: summarizeIds(expectedVisibleIds)
    });
    try {
      await present({
        context: input.presentationContext,
        restore: true,
        selectedIds: [],
        targetId: "",
        insertAfter: false,
        nextItems,
        nextState: state,
        expectedVisibleIds
      });
    } catch {}

    const actualVisibleIds = idsOf(await readVisibleIds());
    const visible = sameIds(actualVisibleIds, expectedVisibleIds);
    const stage = visible
      ? MOVE_APPLICATION_STAGES.VISIBLE_VERIFY_OK
      : MOVE_APPLICATION_STAGES.VISIBLE_VERIFY_FAIL;
    emit(stage, {
      collectionId: String(collection.id || ""),
      reason: "context-reentry",
      expected: summarizeIds(expectedVisibleIds),
      actual: summarizeIds(actualVisibleIds)
    });
    return {
      ok: visible,
      reason: visible ? "" : "visible-order-mismatch",
      stage,
      nextItems,
      expectedVisibleIds,
      actualVisibleIds
    };
  }

  return Object.freeze({
    apply,
    restore,
    summarizeIds
  });
}

module.exports = {
  MOVE_APPLICATION_STAGES,
  createManualMoveApplicationRuntime
};
