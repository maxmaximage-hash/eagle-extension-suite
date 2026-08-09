"use strict";

const fsDefault = require("fs").promises;
const pathDefault = require("path");
const { LOCATOR_KIND, SCHEMA_VERSION, SOURCE_ID } = require("./avatar-source-contract");

const DISCOVERY_SEGMENTS = ["GravitySharedSources", "eagle-avatar-source", "v1", "locator.json"];

async function readLocator(fs, filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function validLocator(locator, sourceId) {
  return Boolean(
    locator &&
    locator.kind === LOCATOR_KIND &&
    locator.schemaVersion === SCHEMA_VERSION &&
    locator.sourceId === sourceId &&
    locator.libraryIdentity &&
    locator.currentManifest === "manifests/current.json" &&
    locator.assetRoot === "assets"
  );
}

async function resolveSharedAvatarSource(options = {}) {
  const fs = options.fs || fsDefault;
  const path = options.path || pathDefault;
  const sourceId = options.sourceId || SOURCE_ID;
  const mounts = [...new Set((options.mountRoots || []).map((root) => path.resolve(root)))];
  const matches = [];
  for (const mountRoot of mounts) {
    const locatorPath = path.join(mountRoot, ...DISCOVERY_SEGMENTS);
    const locator = await readLocator(fs, locatorPath);
    if (!validLocator(locator, sourceId)) continue;
    matches.push({
      sourceId,
      libraryIdentity: locator.libraryIdentity,
      locator,
      manifestPath: path.join(path.dirname(locatorPath), ...locator.currentManifest.split("/")),
      assetRoot: path.join(path.dirname(locatorPath), ...locator.assetRoot.split("/"))
    });
  }
  if (matches.length === 0) return null;
  const requestedIdentity = String(options.libraryIdentity || "");
  const filtered = requestedIdentity
    ? matches.filter((entry) => entry.libraryIdentity === requestedIdentity)
    : matches;
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 0) return null;
  const error = new Error("avatar-source-discovery-ambiguous");
  error.code = "AVATAR_SOURCE_DISCOVERY_AMBIGUOUS";
  throw error;
}

module.exports = { DISCOVERY_SEGMENTS, resolveSharedAvatarSource, validLocator };
