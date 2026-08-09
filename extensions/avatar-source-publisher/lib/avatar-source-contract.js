"use strict";

const crypto = require("crypto");

const SCHEMA_VERSION = 1;
const SOURCE_ID = "gravity.eagle.avatar-source.v1";
const LOCATOR_KIND = "gravity.avatar-source-locator.v1";
const MANIFEST_KIND = "gravity.avatar-source-manifest.v1";
const RESOURCE_SCHEME = "gravity.avatar.asset.v1";
const ALLOWED_EXTENSIONS = new Set(["webp", "png", "jpg", "jpeg"]);
const PLATFORM_SUFFIXES = [
  [" - 小红书", "xiaohongshu"],
  [" - 抖音", "douyin"]
];

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableJson(value[key]);
    return result;
  }, {});
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalSha256(value) {
  return sha256(JSON.stringify(stableJson(value)));
}

function normalizeDisplayName(value) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function parseDisplayName(rawName) {
  const raw = String(rawName || "").normalize("NFKC").trim();
  for (const [suffix, sourcePlatform] of PLATFORM_SUFFIXES) {
    if (raw.endsWith(suffix)) {
      const displayName = raw.slice(0, -suffix.length).trim();
      return {
        rawName: raw,
        displayName,
        sourcePlatform,
        issue: displayName ? null : "EMPTY_DISPLAY_NAME"
      };
    }
  }
  return {
    rawName: raw,
    displayName: raw,
    sourcePlatform: "unknown",
    issue: "NAME_PARSE_UNCERTAIN"
  };
}

function safeExtension(value) {
  const extension = String(value || "").toLowerCase().replace(/^\./, "");
  return ALLOWED_EXTENSIONS.has(extension) ? extension : "";
}

function validHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validateAvatarCandidate(item, parsed = parseDisplayName(item?.name)) {
  const issues = [];
  const width = Number(item?.width || 0);
  const height = Number(item?.height || 0);
  const extension = safeExtension(item?.ext || item?.extension);
  if (!extension) issues.push("UNSUPPORTED_MEDIA_TYPE");
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    issues.push("MISSING_DIMENSIONS");
  } else {
    const ratio = width / height;
    if (ratio < 0.85 || ratio > 1.15) issues.push("NON_AVATAR_ASPECT");
  }
  if (!validHttpUrl(item?.url)) issues.push("MISSING_SOURCE_URL");
  if (!parsed.displayName) issues.push(parsed.issue || "EMPTY_DISPLAY_NAME");
  else if (parsed.issue) issues.push(parsed.issue);
  return {
    extension,
    issues,
    status: issues.some((issue) => issue !== "NAME_PARSE_UNCERTAIN")
      ? "invalid"
      : "active"
  };
}

function safeRelativeAssetPath(fingerprint, extension) {
  if (!/^[a-f0-9]{64}$/.test(String(fingerprint || ""))) {
    throw new Error("avatar-source-invalid-fingerprint");
  }
  const safeExt = safeExtension(extension);
  if (!safeExt) throw new Error("avatar-source-invalid-extension");
  return `assets/sha256/${fingerprint.slice(0, 2)}/${fingerprint}.${safeExt}`;
}

function recordFingerprint(record) {
  const copy = { ...record };
  delete copy.contentFingerprint;
  delete copy.resourceRef;
  delete copy.validationIssues;
  delete copy.status;
  return canonicalSha256(copy);
}

function applyDuplicateIssues(records) {
  const byName = new Map();
  const byFingerprint = new Map();
  for (const record of records) {
    const name = normalizeDisplayName(record.displayName);
    if (name) {
      const list = byName.get(name) || [];
      list.push(record);
      byName.set(name, list);
    }
    if (record.contentFingerprint) {
      const list = byFingerprint.get(record.contentFingerprint) || [];
      list.push(record);
      byFingerprint.set(record.contentFingerprint, list);
    }
  }
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    for (const record of group) record.validationIssues.push("DUPLICATE_DISPLAY_NAME");
  }
  for (const group of byFingerprint.values()) {
    if (group.length < 2) continue;
    for (const record of group) record.validationIssues.push("DUPLICATE_CONTENT");
  }
  for (const record of records) {
    record.validationIssues = [...new Set(record.validationIssues)].sort();
    if (record.validationIssues.some((issue) => issue !== "NAME_PARSE_UNCERTAIN" && issue !== "DUPLICATE_DISPLAY_NAME" && issue !== "DUPLICATE_CONTENT")) {
      record.status = "invalid";
      record.resourceRef = null;
    }
  }
  return records;
}

function buildManifestIntegrity(manifest) {
  const payload = { ...manifest };
  delete payload.integrity;
  return {
    algorithm: "sha256",
    canonicalPayloadSha256: canonicalSha256(payload)
  };
}

function verifyManifestIntegrity(manifest) {
  if (!manifest || manifest.kind !== MANIFEST_KIND || manifest.schemaVersion !== SCHEMA_VERSION) return false;
  const actual = buildManifestIntegrity(manifest).canonicalPayloadSha256;
  return actual === manifest?.integrity?.canonicalPayloadSha256;
}

module.exports = {
  ALLOWED_EXTENSIONS,
  LOCATOR_KIND,
  MANIFEST_KIND,
  PLATFORM_SUFFIXES,
  RESOURCE_SCHEME,
  SCHEMA_VERSION,
  SOURCE_ID,
  applyDuplicateIssues,
  buildManifestIntegrity,
  canonicalSha256,
  normalizeDisplayName,
  parseDisplayName,
  recordFingerprint,
  safeExtension,
  safeRelativeAssetPath,
  stableJson,
  validateAvatarCandidate,
  verifyManifestIntegrity
};
