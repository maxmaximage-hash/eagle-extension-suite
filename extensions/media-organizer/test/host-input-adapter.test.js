"use strict";

const assert = require("assert");
const {
  createHostInputAdapter
} = require("../lib/host-input-adapter");

function smartContext(overrides = {}) {
  return {
    libraryId: "library-A",
    collectionId: "smart-A",
    collectionKind: "smart",
    targetKind: "direct-media",
    manualAllowed: true,
    locked: false,
    preview: false,
    ...overrides
  };
}

function createHarness(options = {}) {
  const moveInputs = [];
  const adapter = createHostInputAdapter({
    thresholdPx: 8,
    diagnosticLimit: options.diagnosticLimit || 8,
    createMoveCommand(input) {
      moveInputs.push(input);
      return {
        ok: true,
        command: {
          type: "MoveCommand",
          collectionId: input.collectionId,
          selectedIds: input.selectedIds,
          targetId: input.targetId,
          insertAfter: input.insertAfter
        }
      };
    }
  });
  return { adapter, moveInputs };
}

{
  const { adapter, moveInputs } = createHarness();
  assert.strictEqual(adapter.pointerDown({
    ...smartContext(),
    pointerId: 7,
    button: 0,
    isPrimary: true,
    sourceId: "item-A",
    selectedIds: ["item-A"],
    clientX: 10,
    clientY: 10
  }).ok, true);
  adapter.pointerMove({
    ...smartContext(),
    pointerId: 7,
    clientX: 30,
    clientY: 10,
    insideGrid: true,
    targetId: "item-B",
    insertAfter: false
  });
  const result = adapter.pointerUp({
    ...smartContext(),
    pointerId: 7,
    clientX: 30,
    clientY: 10,
    insideWindow: true,
    insideGrid: true,
    targetId: "item-B",
    insertAfter: false
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.command.type, "MoveCommand");
  assert.deepStrictEqual(moveInputs, [{
    libraryId: "library-A",
    collectionId: "smart-A",
    collectionKind: "smart",
    sourceId: "item-A",
    selectedIds: ["item-A"],
    targetId: "item-B",
    insertAfter: false
  }]);
  assert.deepStrictEqual(
    adapter.diagnostics().map((entry) => entry.type),
    ["pointer-start", "pointer-commit"]
  );
}

for (const blocked of [
  { collectionKind: "normal" },
  { collectionKind: "global" },
  { collectionKind: "unknown" },
  { button: 1 },
  { isPrimary: false },
  { manualAllowed: false },
  { locked: true },
  { preview: true },
  { targetKind: "direct-folders" }
]) {
  const { adapter } = createHarness();
  const result = adapter.pointerDown({
    ...smartContext(),
    pointerId: 1,
    button: 0,
    isPrimary: true,
    sourceId: "item-A",
    selectedIds: ["item-A"],
    clientX: 0,
    clientY: 0,
    ...blocked
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(adapter.snapshot().active, false);
  assert.deepStrictEqual(adapter.diagnostics(), []);
}

for (const scenario of [
  {
    name: "below-threshold",
    up: { clientX: 15, clientY: 10 }
  },
  {
    name: "same-target",
    up: { clientX: 30, clientY: 10, targetId: "item-A" }
  },
  {
    name: "selected-target",
    selectedIds: ["item-A", "item-B"],
    up: { clientX: 30, clientY: 10, targetId: "item-B" }
  },
  {
    name: "grid-outside",
    up: { clientX: 30, clientY: 10, insideGrid: false }
  },
  {
    name: "window-outside",
    up: { clientX: 30, clientY: 10, insideWindow: false }
  },
  {
    name: "library-changed",
    up: { libraryId: "library-B", clientX: 30, clientY: 10 }
  },
  {
    name: "collection-changed",
    up: { collectionId: "smart-B", clientX: 30, clientY: 10 }
  },
  {
    name: "locked",
    up: { locked: true, clientX: 30, clientY: 10 }
  },
  {
    name: "preview",
    up: { preview: true, clientX: 30, clientY: 10 }
  }
]) {
  const { adapter, moveInputs } = createHarness();
  const selectedIds = scenario.selectedIds || ["item-A"];
  adapter.pointerDown({
    ...smartContext(),
    pointerId: 2,
    button: 0,
    isPrimary: true,
    sourceId: "item-A",
    selectedIds,
    clientX: 10,
    clientY: 10
  });
  const up = {
    ...smartContext(),
    pointerId: 2,
    clientX: 30,
    clientY: 10,
    insideWindow: true,
    insideGrid: true,
    targetId: "item-B",
    insertAfter: true,
    ...scenario.up
  };
  const result = adapter.pointerUp(up);
  assert.strictEqual(result.ok, false, scenario.name);
  assert.deepStrictEqual(moveInputs, [], scenario.name);
  assert.strictEqual(adapter.snapshot().active, false, scenario.name);
  assert.strictEqual(
    adapter.diagnostics().at(-1).type,
    "pointer-cancel",
    scenario.name
  );
}

for (const cancellation of [
  ["escape", "escape"],
  ["previewOpened", "preview"],
  ["lockChanged", "locked"],
  ["contextChanged", "context-changed"],
  ["windowBlurred", "window-blur"],
  ["pointerCancelled", "pointer-cancelled"]
]) {
  const { adapter } = createHarness();
  adapter.pointerDown({
    ...smartContext(),
    pointerId: 3,
    button: 0,
    isPrimary: true,
    sourceId: "item-A",
    selectedIds: ["item-A"],
    clientX: 10,
    clientY: 10
  });
  adapter[cancellation[0]]();
  assert.strictEqual(adapter.snapshot().active, false);
  assert.strictEqual(adapter.diagnostics().at(-1).reason, cancellation[1]);
}

{
  const { adapter, moveInputs } = createHarness();
  adapter.pointerDown({
    ...smartContext(),
    pointerId: 4,
    button: 0,
    isPrimary: true,
    sourceId: "item-A",
    selectedIds: ["item-A"],
    clientX: 10,
    clientY: 10
  });
  adapter.pointerMove({
    ...smartContext(),
    pointerId: 4,
    clientX: 30,
    clientY: 10,
    insideGrid: true,
    targetId: "item-B"
  });
  adapter.nativeDropCommitted();
  const result = adapter.pointerUp({
    ...smartContext(),
    pointerId: 4,
    clientX: 30,
    clientY: 10,
    insideWindow: true,
    insideGrid: true,
    targetId: "item-B"
  });
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(moveInputs, []);
  assert.strictEqual(
    adapter.diagnostics().at(-1).reason,
    "native-drop-committed"
  );
}

{
  const { adapter } = createHarness({ diagnosticLimit: 3 });
  for (let pointerId = 10; pointerId < 14; pointerId += 1) {
    adapter.pointerDown({
      ...smartContext(),
      pointerId,
      button: 0,
      isPrimary: true,
      sourceId: `item-${pointerId}`,
      selectedIds: [`item-${pointerId}`],
      clientX: 0,
      clientY: 0
    });
    adapter.escape();
  }
  assert.strictEqual(adapter.diagnostics().length, 3);
  assert.deepStrictEqual(
    adapter.diagnostics().map((entry) => entry.sequence),
    [6, 7, 8]
  );
}

// qa.17 real sequence: native drag takes over after pointerdown, so a
// threshold-less pointerup must not destroy the only session before dragend.
{
  const { adapter, moveInputs } = createHarness();
  const gridIdentity = {};
  adapter.pointerDown({
    ...smartContext(),
    pointerId: 21,
    button: 0,
    isPrimary: true,
    sourceId: "item-A",
    selectedIds: ["item-A"],
    clientX: 10,
    clientY: 10,
    startGridIdentity: gridIdentity
  });
  assert.strictEqual(adapter.nativeDragStart({
    ...smartContext(),
    sourceId: "item-A",
    clientX: 10,
    clientY: 10,
    insideGrid: true,
    gridIdentity
  }).ok, true);
  assert.strictEqual(adapter.pointerUp({
    ...smartContext(),
    pointerId: 21,
    clientX: 10,
    clientY: 10,
    insideWindow: true,
    insideGrid: true,
    gridIdentity,
    targetId: ""
  }).reason, "native-drag-pending");
  adapter.nativeDrag({
    ...smartContext(),
    clientX: 40,
    clientY: 10,
    insideGrid: true,
    gridIdentity,
    targetId: "item-B",
    insertAfter: true
  });
  const result = adapter.nativeDragEnd({
    ...smartContext(),
    clientX: 0,
    clientY: 0,
    insideWindow: true,
    insideGrid: undefined,
    gridIdentity: null,
    targetId: ""
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.command.type, "MoveCommand");
  assert.strictEqual(result.targetId, "item-B");
  assert.strictEqual(moveInputs.length, 1);
  assert.strictEqual(adapter.snapshot().active, false);
}

// qa.19 real sequence: another virtualized grid surface cannot replace the
// grid identity captured at pointerdown.
{
  const { adapter, moveInputs } = createHarness();
  const startGridIdentity = {};
  adapter.pointerDown({
    ...smartContext(),
    pointerId: 25,
    button: 0,
    isPrimary: true,
    sourceId: "item-A",
    selectedIds: ["item-A"],
    clientX: 10,
    clientY: 10,
    startGridIdentity
  });
  assert.strictEqual(
    adapter.snapshot().session.startGridIdentity,
    startGridIdentity
  );
  adapter.nativeDragStart({
    ...smartContext(),
    sourceId: "item-A",
    clientX: 10,
    clientY: 10,
    insideGrid: true,
    gridIdentity: startGridIdentity
  });
  const result = adapter.nativeDrag({
    ...smartContext(),
    clientX: 50,
    clientY: 10,
    insideGrid: true,
    gridIdentity: {},
    targetId: "item-B"
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "grid-mismatch");
  assert.strictEqual(adapter.snapshot().active, false);
  assert.deepStrictEqual(moveInputs, []);
}

// Virtualized smart grids may replace the DOM element during a drag.  A
// stable semantic key keeps the session alive while still rejecting a
// different grid key.
{
  const { adapter, moveInputs } = createHarness();
  const firstGrid = {};
  const replacementGrid = {};
  adapter.pointerDown({
    ...smartContext(),
    pointerId: 26,
    button: 0,
    isPrimary: true,
    sourceId: "item-A",
    selectedIds: ["item-A"],
    clientX: 10,
    clientY: 10,
    startGridIdentity: firstGrid,
    startGridKey: "box-list"
  });
  adapter.nativeDragStart({
    ...smartContext(),
    sourceId: "item-A",
    clientX: 10,
    clientY: 10,
    insideGrid: true,
    gridIdentity: firstGrid,
    gridKey: "box-list"
  });
  assert.strictEqual(adapter.nativeDrag({
    ...smartContext(),
    clientX: 50,
    clientY: 10,
    insideGrid: true,
    gridIdentity: replacementGrid,
    gridKey: "box-list",
    targetId: "item-B"
  }).ok, true);
  const result = adapter.nativeDragEnd({
    ...smartContext(),
    clientX: 50,
    clientY: 10,
    insideWindow: true,
    insideGrid: true,
    gridIdentity: replacementGrid,
    gridKey: "box-list",
    targetId: "item-B"
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(moveInputs.length, 1);
}

// qa.17 real sequence: an invalid pointerup target defers to the last valid
// same-grid native drag observation.
{
  const { adapter } = createHarness();
  adapter.pointerDown({
    ...smartContext(),
    pointerId: 22,
    button: 0,
    isPrimary: true,
    sourceId: "item-A",
    selectedIds: ["item-A"],
    clientX: 10,
    clientY: 10
  });
  adapter.nativeDragStart({
    ...smartContext(),
    sourceId: "item-A",
    clientX: 10,
    clientY: 10,
    insideGrid: true
  });
  adapter.nativeDrag({
    ...smartContext(),
    clientX: 50,
    clientY: 10,
    insideGrid: true,
    targetId: "item-B",
    insertAfter: false
  });
  assert.strictEqual(adapter.pointerUp({
    ...smartContext(),
    pointerId: 22,
    clientX: 50,
    clientY: 10,
    insideWindow: true,
    insideGrid: true,
    targetId: "item-A"
  }).reason, "native-drag-pending");
  const result = adapter.nativeDragEnd({
    ...smartContext(),
    clientX: 50,
    clientY: 10,
    insideWindow: true,
    insideGrid: true,
    targetId: ""
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.targetId, "item-B");
}

// qa.17 real sequence: duplicate pointerdown for the same physical session
// reuses the session instead of replacing and cancelling it.
{
  const { adapter } = createHarness();
  const input = {
    ...smartContext(),
    pointerId: 23,
    button: 0,
    isPrimary: true,
    sourceId: "item-A",
    selectedIds: ["item-A"],
    clientX: 10,
    clientY: 10
  };
  assert.strictEqual(adapter.pointerDown(input).ok, true);
  const duplicate = adapter.pointerDown(input);
  assert.strictEqual(duplicate.ok, true);
  assert.strictEqual(duplicate.reused, true);
  assert.strictEqual(
    adapter.diagnostics().some(
      (entry) =>
        entry.type === "pointer-cancel" &&
        entry.reason === "replaced-session"
    ),
    false
  );
}

// qa.17 real sequence: leaving Eagle remains a hard cancellation even after
// a valid native drag target was observed.
{
  const { adapter, moveInputs } = createHarness();
  adapter.pointerDown({
    ...smartContext(),
    pointerId: 24,
    button: 0,
    isPrimary: true,
    sourceId: "item-A",
    selectedIds: ["item-A"],
    clientX: 10,
    clientY: 10
  });
  adapter.nativeDragStart({
    ...smartContext(),
    sourceId: "item-A",
    clientX: 10,
    clientY: 10,
    insideGrid: true
  });
  adapter.nativeDrag({
    ...smartContext(),
    clientX: 50,
    clientY: 10,
    insideGrid: true,
    targetId: "item-B"
  });
  adapter.windowBlurred();
  assert.strictEqual(adapter.snapshot().active, false);
  assert.deepStrictEqual(moveInputs, []);
  assert.strictEqual(
    adapter.diagnostics().at(-1).reason,
    "window-blur"
  );
}

// qa.23 recording contract: native smart drag may report the source/unknown
// surface between a valid non-origin target and dragend. The last valid target
// must commit exactly once; a duplicate drop/dragend cannot create a second
// MoveCommand.
{
  const { adapter, moveInputs } = createHarness();
  const gridIdentity = {};
  adapter.pointerDown({
    ...smartContext(),
    pointerId: 31,
    button: 0,
    isPrimary: true,
    sourceId: "item-A",
    selectedIds: ["item-A"],
    clientX: 10,
    clientY: 10,
    startGridIdentity: gridIdentity
  });
  assert.strictEqual(adapter.nativeDragStart({
    ...smartContext(),
    sourceId: "item-A",
    clientX: 10,
    clientY: 10,
    insideGrid: true,
    gridIdentity
  }).ok, true);
  assert.strictEqual(adapter.nativeDrag({
    ...smartContext(),
    clientX: 90,
    clientY: 10,
    insideGrid: true,
    gridIdentity,
    targetId: "item-C",
    insertAfter: true
  }).ok, true);
  assert.strictEqual(adapter.nativeDrag({
    ...smartContext(),
    clientX: 91,
    clientY: 10,
    insideGrid: undefined,
    gridIdentity: null,
    targetId: ""
  }).ok, true);
  const committed = adapter.nativeDragEnd({
    ...smartContext(),
    clientX: 91,
    clientY: 10,
    insideWindow: true,
    insideGrid: undefined,
    gridIdentity: null,
    targetId: ""
  });
  assert.strictEqual(committed.ok, true);
  assert.strictEqual(committed.targetId, "item-C");
  assert.strictEqual(committed.insertAfter, true);
  assert.strictEqual(moveInputs.length, 1);
  assert.strictEqual(
    adapter.nativeDragEnd({
      ...smartContext(),
      insideWindow: true,
      insideGrid: true,
      targetId: "item-D"
    }).reason,
    "no-session"
  );
  assert.strictEqual(moveInputs.length, 1);
}

// A mismatched pointerup/move indicates the browser lost the original drag
// session. It must release ownership so the next drag can start immediately.
{
  const { adapter } = createHarness();
  const context = smartContext();
  adapter.pointerDown({
    ...context, pointerId: 41, button: 0, isPrimary: true,
    sourceId: "item-A", selectedIds: ["item-A"], clientX: 10, clientY: 10
  });
  assert.strictEqual(adapter.pointerUp({
    ...context, pointerId: 99, insideWindow: true, insideGrid: true
  }).reason, "pointer-mismatch");
  assert.strictEqual(adapter.snapshot().active, false);
  assert.strictEqual(adapter.pointerDown({
    ...context, pointerId: 42, button: 0, isPrimary: true,
    sourceId: "item-A", selectedIds: ["item-A"], clientX: 10, clientY: 10
  }).ok, true);
}

console.log("host input adapter tests passed");
