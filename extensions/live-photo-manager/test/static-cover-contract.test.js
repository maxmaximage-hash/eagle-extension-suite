"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createStaticCoverEditPlan, assertStaticCoverEditPlan } = require("../lib/static-cover-contract");

test("static cover edit plan keeps MOV pairing immutable and stages outside Eagle Library", () => {
  const plan = createStaticCoverEditPlan({
    groupId: "live:img-4154",
    nativeItemId: "native-4154",
    sourceImagePath: "/tmp/live/IMG_4154.HEIC",
    sourceMoviePath: "/tmp/live/IMG_4154.MOV",
    editedCoverPath: "/tmp/edits/IMG_4154-cover.HEIC",
    stagingPackagePath: "/tmp/live-staging/IMG_4154.livp",
  });

  assert.equal(plan.type, "static-cover-edit");
  assert.equal(plan.status, "planned");
  assert.equal(plan.preserved.movie, true);
  assert.equal(plan.writeback.mode, "stage-then-eagle-item-replaceFile");
  assert.doesNotThrow(() => assertStaticCoverEditPlan(plan));
});

test("static cover edit plan rejects direct Library writeback", () => {
  assert.throws(() => createStaticCoverEditPlan({
    groupId: "live:img-4154",
    nativeItemId: "native-4154",
    sourceImagePath: "/tmp/live/IMG_4154.HEIC",
    sourceMoviePath: "/tmp/live/IMG_4154.MOV",
    editedCoverPath: "/tmp/edits/IMG_4154-cover.HEIC",
    stagingPackagePath: "/Volumes/library.library/images/IMG_4154.livp",
  }), /Library|staging/i);
});
