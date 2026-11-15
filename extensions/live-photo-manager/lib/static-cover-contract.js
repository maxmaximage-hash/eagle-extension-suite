"use strict";

const path = require("path");

const STATIC_COVER_EDIT_SCHEMA_VERSION = 1;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".heic"]);

function required(value, label) {
  if (!value || typeof value !== "string") throw new Error(`${label} is required`);
  return value;
}

function assertOutsideLibrary(filePath, label) {
  const normalized = path.resolve(filePath);
  if (/\.library(?:\/|$)/i.test(normalized)) {
    throw new Error(`${label} must be staged outside Eagle Library`);
  }
}

function createStaticCoverEditPlan({
  groupId,
  nativeItemId,
  sourceImagePath,
  sourceMoviePath,
  editedCoverPath,
  stagingPackagePath,
} = {}) {
  required(groupId, "groupId");
  required(nativeItemId, "nativeItemId");
  required(sourceImagePath, "sourceImagePath");
  required(sourceMoviePath, "sourceMoviePath");
  required(editedCoverPath, "editedCoverPath");
  required(stagingPackagePath, "stagingPackagePath");
  if (!IMAGE_EXTENSIONS.has(path.extname(editedCoverPath).toLowerCase())) {
    throw new Error("editedCoverPath must be JPG, JPEG or HEIC");
  }
  if (path.resolve(sourceImagePath) === path.resolve(sourceMoviePath)) {
    throw new Error("Static cover and MOV source paths must be different");
  }
  assertOutsideLibrary(stagingPackagePath, "stagingPackagePath");
  return {
    schemaVersion: STATIC_COVER_EDIT_SCHEMA_VERSION,
    type: "static-cover-edit",
    status: "planned",
    groupId: String(groupId),
    nativeItemId: String(nativeItemId),
    source: {
      imagePath: sourceImagePath,
      moviePath: sourceMoviePath,
    },
    editedCoverPath,
    preserved: {
      movie: true,
      pairingIdentity: "unchanged",
      originalSource: true,
    },
    output: {
      stagingPackagePath,
    },
    writeback: {
      mode: "stage-then-eagle-item-replaceFile",
      status: "planned",
    },
  };
}

function assertStaticCoverEditPlan(plan) {
  if (!plan || plan.schemaVersion !== STATIC_COVER_EDIT_SCHEMA_VERSION) {
    throw new Error("Unsupported static cover edit plan");
  }
  if (plan.type !== "static-cover-edit" || plan.status !== "planned") {
    throw new Error("Static cover edit plan must start in planned state");
  }
  required(plan.groupId, "groupId");
  required(plan.nativeItemId, "nativeItemId");
  required(plan.source?.imagePath, "source.imagePath");
  required(plan.source?.moviePath, "source.moviePath");
  required(plan.editedCoverPath, "editedCoverPath");
  required(plan.output?.stagingPackagePath, "output.stagingPackagePath");
  assertOutsideLibrary(plan.output.stagingPackagePath, "output.stagingPackagePath");
  if (plan.preserved?.movie !== true || plan.preserved?.pairingIdentity !== "unchanged") {
    throw new Error("Static cover edit must preserve the paired MOV and identity");
  }
  if (plan.writeback?.mode !== "stage-then-eagle-item-replaceFile") {
    throw new Error("Static cover writeback must use Eagle item replaceFile after staging");
  }
  return plan;
}

module.exports = {
  STATIC_COVER_EDIT_SCHEMA_VERSION,
  createStaticCoverEditPlan,
  assertStaticCoverEditPlan,
};
