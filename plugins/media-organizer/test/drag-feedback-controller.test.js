"use strict";

const assert = require("assert");
const {
  createDragFeedbackController
} = require("../lib/drag-feedback-controller");

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(...names) {
      for (const name of names) values.add(name);
    },
    remove(...names) {
      for (const name of names) values.delete(name);
    },
    contains(name) {
      return values.has(name);
    },
    toggle(name, force) {
      if (force === true) values.add(name);
      else if (force === false) values.delete(name);
      else if (values.has(name)) values.delete(name);
      else values.add(name);
      return values.has(name);
    }
  };
}

function createStyle(initial = {}) {
  const values = new Map(
    Object.entries(initial).map(([name, entry]) => [
      name,
      typeof entry === "string"
        ? { value: entry, priority: "" }
        : { value: entry.value || "", priority: entry.priority || "" }
    ])
  );
  const mutations = [];
  return {
    setProperty(name, value, priority = "") {
      values.set(name, { value, priority });
      mutations.push({ type: "set", name, value, priority });
    },
    removeProperty(name) {
      values.delete(name);
      mutations.push({ type: "remove", name });
    },
    getPropertyValue(name) {
      return values.get(name)?.value || "";
    },
    getPropertyPriority(name) {
      return values.get(name)?.priority || "";
    },
    mutations
  };
}

function createCard(id, options = {}) {
  const card = {
    id: `box-${id}`,
    computedPosition: options.computedPosition || "absolute",
    classList: createClassList(["box", ...(options.classes || [])]),
    helpers: [],
    getAttribute(name) {
      return name === "data-box-id" ? id : null;
    },
    querySelector(selector) {
      return this.helpers.find((helper) =>
        selector.includes(".left")
          ? helper.classList.contains("left")
          : selector.includes(".right")
            ? helper.classList.contains("right")
            : true
      ) || null;
    }
  };
  for (const side of options.withHelpers === false ? [] : ["left", "right"]) {
    const helper = {
      card,
      isConnected: true,
      classList: createClassList(["box-sortable-helper", side]),
      style: createStyle(options.helperStyles?.[side] || {}),
      closest(selector) {
        return selector === ".box" ? card : null;
      }
    };
    card.helpers.push(helper);
  }
  return card;
}

function createHarness(cards) {
  const body = { classList: createClassList() };
  const allHelpers = cards.flatMap((card) => card.helpers);
  const document = {
    body,
    querySelectorAll(selector) {
      if (selector === ".box-sortable-helper") return allHelpers;
      if (selector === ".box-sortable-helper.drag-over") {
        return allHelpers.filter((helper) =>
          helper.classList.contains("drag-over")
        );
      }
      if (selector === ".box.eagle-photo-drop-target") {
        return cards.filter((card) =>
          card.classList.contains("eagle-photo-drop-target")
        );
      }
      return [];
    }
  };
  const pending = [];
  const controller = createDragFeedbackController({
    document,
    getComputedStyle(element) {
      return { position: element?.computedPosition || "static" };
    },
    schedule(callback) {
      pending.push(callback);
      return callback;
    },
    cancelScheduled(callback) {
      const index = pending.indexOf(callback);
      if (index >= 0) pending.splice(index, 1);
    }
  });
  return { controller, body, pending };
}

// qa.24 HOST FAIL: the card box-shadow was clipped to a small blue point.
// Smart mode may therefore expose exactly the current resolved Eagle helper,
// but it must be absolute (zero masonry footprint), restore every prior inline
// style when the target changes, and never expose the other helpers.
{
  const source = createCard("A");
  const targetB = createCard("B", {
    helperStyles: {
      left: {
        display: { value: "none", priority: "important" },
        position: "relative",
        top: "7px"
      }
    }
  });
  const targetC = createCard("C");
  const { controller, body } = createHarness([source, targetB, targetC]);
  const leftB = targetB.helpers[0];
  const rightB = targetB.helpers[1];
  const leftC = targetC.helpers[0];

  const allHelpers = [source, targetB, targetC]
    .flatMap((card) => card.helpers);
  controller.start(["A"], { mode: "smart" });
  controller.update({
    mode: "smart",
    insideGrid: true,
    targetId: "B",
    targetBox: targetB,
    helper: leftB,
    insertAfter: false
  });
  assert.strictEqual(body.classList.contains("eagle-photo-sort-dragging"), false);
  assert.strictEqual(body.classList.contains("eagle-photo-smart-dragging"), true);
  assert.strictEqual(
    allHelpers.filter(
      (helper) =>
        helper.classList.contains("eagle-photo-smart-active-helper") &&
        helper.style.getPropertyValue("display") === "block"
    ).length,
    1,
    "smart feedback must expose exactly one current helper"
  );
  assert.strictEqual(leftB.classList.contains("drag-over"), true);
  assert.strictEqual(leftB.style.getPropertyValue("position"), "absolute");
  assert.strictEqual(leftB.style.getPropertyPriority("position"), "important");
  assert.strictEqual(leftB.style.getPropertyValue("top"), "0");
  assert.strictEqual(leftB.style.getPropertyValue("bottom"), "0");
  assert.strictEqual(leftB.style.getPropertyValue("height"), "auto");
  assert.strictEqual(
    targetB.classList.contains("eagle-photo-smart-target-host"),
    false,
    "the helper-present path must not mark or restyle the masonry card"
  );
  assert.strictEqual(rightB.style.mutations.length, 0);
  assert.strictEqual(leftC.style.mutations.length, 0);

  controller.update({
    mode: "smart",
    insideGrid: undefined,
    targetId: "",
    targetBox: null,
    helper: null,
    reason: "target-unknown"
  });
  assert.strictEqual(
    leftB.classList.contains("drag-over"),
    true,
    "an unknown native surface must retain the last valid blue target"
  );

  controller.update({
    mode: "smart",
    insideGrid: true,
    targetId: "B",
    targetBox: targetB,
    helper: rightB,
    insertAfter: true
  });
  assert.strictEqual(leftB.classList.contains("drag-over"), false);
  assert.strictEqual(leftB.style.getPropertyValue("display"), "none");
  assert.strictEqual(leftB.style.getPropertyPriority("display"), "important");
  assert.strictEqual(leftB.style.getPropertyValue("position"), "relative");
  assert.strictEqual(leftB.style.getPropertyValue("top"), "7px");
  assert.strictEqual(leftB.style.getPropertyValue("bottom"), "");
  assert.strictEqual(rightB.classList.contains("drag-over"), true);
  assert.strictEqual(rightB.style.getPropertyValue("position"), "absolute");

  controller.update({
    mode: "smart",
    insideGrid: true,
    targetId: "C",
    targetBox: targetC,
    helper: leftC,
    insertAfter: false
  });
  assert.strictEqual(rightB.classList.contains("drag-over"), false);
  assert.strictEqual(rightB.style.getPropertyValue("display"), "");
  assert.strictEqual(rightB.style.getPropertyValue("position"), "");
  assert.strictEqual(targetB.classList.contains("eagle-photo-smart-target-host"), false);
  assert.strictEqual(leftC.classList.contains("drag-over"), true);
  assert.strictEqual(leftC.style.getPropertyValue("display"), "block");
  assert.strictEqual(targetC.classList.contains("eagle-photo-smart-target-host"), false);

  controller.update({
    mode: "smart",
    insideGrid: true,
    targetId: "",
    targetBox: source,
    helper: null,
    reason: "selected-target"
  });
  assert.strictEqual(leftC.classList.contains("drag-over"), false);
  assert.strictEqual(leftC.style.getPropertyValue("display"), "");
  assert.strictEqual(targetC.classList.contains("eagle-photo-smart-target-host"), false);
}

// Normal folders retain Eagle's original helper projection.
{
  const source = createCard("A");
  const target = createCard("B");
  const { controller, body } = createHarness([source, target]);
  controller.start(["A"], { mode: "normal" });
  controller.update({
    mode: "normal",
    insideGrid: true,
    targetId: "B",
    targetBox: target,
    helper: target.helpers[0],
    insertAfter: false
  });
  assert.strictEqual(body.classList.contains("eagle-photo-sort-dragging"), true);
  assert.strictEqual(body.classList.contains("eagle-photo-smart-dragging"), false);
  assert.strictEqual(target.helpers[0].classList.contains("drag-over"), true);
  assert.strictEqual(
    target.helpers[0].style.getPropertyValue("display"),
    "block"
  );
}

// Smart virtual-grid projections with no helper may use the card pseudo-element
// only when Eagle already positions that card. The controller never changes the
// card's position/overflow, so the fallback cannot rewrite masonry ownership.
{
  const source = createCard("A", { withHelpers: false });
  const target = createCard("B", { withHelpers: false });
  const { controller } = createHarness([source, target]);

  controller.start(["A"], { mode: "smart" });
  controller.update({
    mode: "smart",
    insideGrid: true,
    targetId: "B",
    targetBox: target,
    helper: null,
    insertAfter: false,
    reason: "helper-missing"
  });
  assert.strictEqual(target.classList.contains("eagle-photo-drop-target"), true);
  assert.strictEqual(target.classList.contains("eagle-photo-drop-before"), true);
  assert.strictEqual(target.classList.contains("eagle-photo-drop-after"), false);
  assert.strictEqual(
    target.classList.contains("eagle-photo-smart-target-host"),
    true
  );

  controller.update({
    mode: "smart",
    insideGrid: true,
    targetId: "B",
    targetBox: target,
    helper: null,
    insertAfter: true,
    reason: "helper-missing"
  });
  assert.strictEqual(target.classList.contains("eagle-photo-drop-before"), false);
  assert.strictEqual(target.classList.contains("eagle-photo-drop-after"), true);
}

{
  const source = createCard("A", { withHelpers: false });
  const staticTarget = createCard("B", {
    withHelpers: false,
    computedPosition: "static"
  });
  const { controller } = createHarness([source, staticTarget]);

  controller.start(["A"], { mode: "smart" });
  controller.update({
    mode: "smart",
    insideGrid: true,
    targetId: "B",
    targetBox: staticTarget,
    helper: null,
    insertAfter: false,
    reason: "helper-missing"
  });
  assert.strictEqual(
    staticTarget.classList.contains("eagle-photo-drop-target"),
    false,
    "a static host card must fail open instead of changing masonry positioning"
  );
  assert.strictEqual(controller.state().hasCardFallback, false);
}

for (const reason of [
  "grid-outside",
  "drop",
  "dragend",
  "pointercancel",
  "escape",
  "preview",
  "context-changed",
  "window-blur"
]) {
  const source = createCard("A");
  const target = createCard("B");
  const { controller, body } = createHarness([source, target]);
  controller.start(["A"], { mode: "smart" });
  controller.update({
    mode: "smart",
    insideGrid: true,
    targetId: "B",
    targetBox: target,
    helper: target.helpers[0],
    insertAfter: false
  });
  controller.clear({ reason, schedulePostCleanup: false });
  assert.strictEqual(
    body.classList.contains("eagle-photo-sort-dragging"),
    false,
    reason
  );
  assert.strictEqual(
    body.classList.contains("eagle-photo-smart-dragging"),
    false,
    reason
  );
  assert.strictEqual(
    target.helpers[0].classList.contains("drag-over"),
    false,
    reason
  );
  assert.strictEqual(
    target.helpers[0].classList.contains("eagle-photo-smart-active-helper"),
    false,
    reason
  );
  assert.strictEqual(
    target.helpers[0].style.getPropertyValue("display"),
    "",
    reason
  );
  assert.strictEqual(
    target.classList.contains("eagle-photo-drop-target"),
    false,
    reason
  );
}

console.log("drag feedback controller tests passed");
