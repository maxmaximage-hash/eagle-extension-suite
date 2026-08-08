"use strict";

const assert = require("assert");
const {
  createSmartDragTargetResolver
} = require("../lib/smart-drag-target-resolver");

function classList(values = []) {
  const names = new Set(values);
  return {
    contains: (name) => names.has(name)
  };
}

function node(options = {}) {
  const element = {
    id: options.id || "",
    parentElement: options.parent || null,
    classList: classList(options.classes),
    dataset: options.boxId ? { boxId: options.boxId } : {},
    isConnected: options.isConnected !== false,
    matches(selector) {
      if (selector === "#box-list") return this.id === "box-list";
      if (selector === ".box") return this.classList.contains("box");
      if (selector === ".box-sortable-helper") {
        return this.classList.contains("box-sortable-helper");
      }
      return false;
    },
    closest(selector) {
      let current = this;
      while (current) {
        if (current.matches?.(selector)) return current;
        current = current.parentElement;
      }
      return null;
    },
    getAttribute(name) {
      if (name === "data-box-id") return options.boxId || null;
      return null;
    },
    getBoundingClientRect() {
      return {
        left: options.left || 0,
        width: options.width || 100
      };
    },
    querySelector(selector) {
      return options.helpers?.[selector] || null;
    }
  };
  return element;
}

const grid = node({ id: "box-list" });
const leftB = node({ classes: ["box-sortable-helper", "left"] });
const rightB = node({ classes: ["box-sortable-helper", "right"] });
const cardA = node({
  id: "box-item-A",
  boxId: "item-A",
  classes: ["box"],
  parent: grid,
  left: 0,
  width: 100
});
const cardB = node({
  id: "box-item-B",
  boxId: "item-B",
  classes: ["box"],
  parent: grid,
  left: 100,
  width: 100,
  helpers: {
    ".box-sortable-helper.left": leftB,
    ".box-sortable-helper.right": rightB
  }
});
leftB.parentElement = cardB;
rightB.parentElement = cardB;
const childA = node({ parent: cardA });
const childB = node({ parent: cardB });
const nativeOverlay = node();
const outside = node();

{
  const resolver = createSmartDragTargetResolver({
    elementsFromPoint: () => [nativeOverlay, childB, cardB, grid]
  });
  const result = resolver.resolve({
    target: nativeOverlay,
    composedPath: () => [nativeOverlay],
    clientX: 175,
    clientY: 20
  }, {
    selectedIds: ["item-A"]
  });
  assert.strictEqual(result.insideGrid, true);
  assert.strictEqual(result.targetId, "item-B");
  assert.strictEqual(result.insertAfter, true);
  assert.strictEqual(result.helper, rightB);
  assert.strictEqual(result.targetBox, cardB);
}

{
  const resolver = createSmartDragTargetResolver({
    elementsFromPoint: () => []
  });
  const result = resolver.resolve({
    target: childA,
    composedPath: () => [childA, cardA, grid],
    clientX: 25,
    clientY: 20
  });
  assert.strictEqual(result.insideGrid, true);
  assert.strictEqual(result.targetId, "item-A");
  assert.strictEqual(result.targetBox, cardA);
}

{
  const resolver = createSmartDragTargetResolver({
    elementsFromPoint: () => [childB, cardB, grid]
  });
  const result = resolver.resolve({
    target: nativeOverlay,
    composedPath: () => [nativeOverlay],
    clientX: 125,
    clientY: 20
  }, {
    selectedIds: ["item-B"]
  });
  assert.strictEqual(result.insideGrid, true);
  assert.strictEqual(result.targetId, "");
  assert.strictEqual(result.reason, "selected-target");
}

{
  const resolver = createSmartDragTargetResolver({
    elementsFromPoint: () => [outside]
  });
  const result = resolver.resolve({
    target: outside,
    composedPath: () => [outside],
    clientX: 400,
    clientY: 400
  });
  assert.strictEqual(result.insideGrid, false);
  assert.strictEqual(result.targetId, "");
}

// qa.19 real sequence: a native drag overlay may expose a different surface
// before the actual card. The target card's owning grid remains authoritative.
{
  const virtualGrid = node({ id: "box-list" });
  const overlayInVirtualGrid = node({ parent: virtualGrid });
  const resolver = createSmartDragTargetResolver({
    elementsFromPoint: () => [
      overlayInVirtualGrid,
      childB,
      cardB,
      grid
    ]
  });
  const start = resolver.resolve({
    target: childA,
    composedPath: () => [childA, cardA, grid],
    clientX: 25,
    clientY: 20
  });
  const target = resolver.resolve({
    target: overlayInVirtualGrid,
    composedPath: () => [overlayInVirtualGrid, virtualGrid],
    clientX: 175,
    clientY: 20
  }, {
    selectedIds: ["item-A"],
    startGridIdentity: start.gridIdentity,
    allowUnknownSurface: true
  });
  assert.strictEqual(start.gridIdentity, grid);
  assert.strictEqual(target.gridIdentity, grid);
  assert.strictEqual(target.insideGrid, true);
  assert.strictEqual(target.targetId, "item-B");
}

// A dragend overlay alone is not proof that the pointer left the starting
// grid. The adapter must be allowed to retain the last valid same-grid target.
{
  const resolver = createSmartDragTargetResolver({
    elementsFromPoint: () => [nativeOverlay]
  });
  const result = resolver.resolve({
    target: nativeOverlay,
    composedPath: () => [nativeOverlay],
    clientX: 175,
    clientY: 20
  }, {
    selectedIds: ["item-A"],
    startGridIdentity: grid,
    allowUnknownSurface: true
  });
  assert.strictEqual(result.insideGrid, undefined);
  assert.strictEqual(result.gridIdentity, null);
  assert.strictEqual(result.reason, "target-unknown");
}

console.log("smart drag target resolver tests passed");
