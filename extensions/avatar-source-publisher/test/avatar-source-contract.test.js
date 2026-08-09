"use strict";

const assert = require("assert");
const test = require("node:test");
const {
  applyDuplicateIssues,
  buildManifestIntegrity,
  parseDisplayName,
  validateAvatarCandidate,
  verifyManifestIntegrity
} = require("../lib/avatar-source-contract");

test("parses known platform suffixes without using names as identity", () => {
  assert.deepStrictEqual(parseDisplayName("鹿其鹿粦Kylin - 小红书"), {
    rawName: "鹿其鹿粦Kylin - 小红书",
    displayName: "鹿其鹿粦Kylin",
    sourcePlatform: "xiaohongshu",
    issue: null
  });
});

test("marks the known tall Douyin candidate invalid", () => {
  const result = validateAvatarCandidate({
    name: "锐评男生朋友圈从夯到拉 干货分享 直男必看 恋爱技巧 - 抖音",
    ext: "webp",
    width: 1152,
    height: 2520,
    url: "https://www.douyin.com/video/7653073326386023722"
  });
  assert.strictEqual(result.status, "invalid");
  assert.ok(result.issues.includes("NON_AVATAR_ASPECT"));
});

test("duplicate display names and fingerprints are warnings, not silent merges", () => {
  const records = applyDuplicateIssues([
    { displayName: "A", contentFingerprint: "a".repeat(64), validationIssues: [], status: "active", resourceRef: {} },
    { displayName: "Ａ", contentFingerprint: "a".repeat(64), validationIssues: [], status: "active", resourceRef: {} }
  ]);
  for (const record of records) {
    assert.ok(record.validationIssues.includes("DUPLICATE_DISPLAY_NAME"));
    assert.ok(record.validationIssues.includes("DUPLICATE_CONTENT"));
    assert.strictEqual(record.status, "active");
  }
});

test("manifest integrity excludes only the integrity field", () => {
  const manifest = { kind: "gravity.avatar-source-manifest.v1", schemaVersion: 1, records: [] };
  manifest.integrity = buildManifestIntegrity(manifest);
  assert.strictEqual(verifyManifestIntegrity(manifest), true);
  manifest.records.push({ eagleItemId: "changed" });
  assert.strictEqual(verifyManifestIntegrity(manifest), false);
});
