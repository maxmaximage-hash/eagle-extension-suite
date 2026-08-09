"use strict";

const crypto = require("crypto");
const fsDefault = require("fs").promises;
const pathDefault = require("path");
const {
  LOCATOR_KIND,
  MANIFEST_KIND,
  RESOURCE_SCHEME,
  SCHEMA_VERSION,
  SOURCE_ID,
  applyDuplicateIssues,
  buildManifestIntegrity,
  canonicalSha256,
  parseDisplayName,
  safeRelativeAssetPath,
  validateAvatarCandidate,
  verifyManifestIntegrity
} = require("./avatar-source-contract");

const AVATAR_FOLDERS = [
  { gender: "female", folderId: "MR6L4NLN5G4Y0" },
  { gender: "male", folderId: "MR6L4IMOVX6XL" }
];
const OUTPUT_SEGMENTS = ["GravitySharedSources", "eagle-avatar-source", "v1"];

function nowIso(now) {
  return new Date(now()).toISOString();
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sourceRootForLibrary(libraryPath, path = pathDefault) {
  if (!libraryPath) throw new Error("avatar-source-library-path-required");
  return path.join(path.dirname(path.resolve(libraryPath)), ...OUTPUT_SEGMENTS);
}

function pathsForRoot(root, path = pathDefault) {
  return {
    root,
    locator: path.join(root, "locator.json"),
    current: path.join(root, "manifests", "current.json"),
    versions: path.join(root, "manifests", "versions"),
    assets: path.join(root, "assets", "sha256"),
    staging: path.join(root, "staging"),
    lock: path.join(root, "publish.lock")
  };
}

function readableError(error, fallback) {
  return error?.code === "ENOENT" ? fallback : error;
}

async function readJson(fs, filePath, missingValue = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return missingValue;
    throw error;
  }
}

async function exists(fs, filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function mkdirParents(fs, paths) {
  await Promise.all(paths.map((directory) => fs.mkdir(directory, { recursive: true })));
}

async function writeAtomic(fs, path, filePath, content, random) {
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.tmp-${random()}`);
  try {
    await fs.writeFile(temporary, content, "utf8");
    await fs.rename(temporary, filePath);
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}

function snapshotComparable(manifest) {
  return {
    source: {
      sourceId: manifest.source?.sourceId || "",
      libraryIdentity: manifest.source?.libraryIdentity || "",
      folders: manifest.source?.folders || []
    },
    records: manifest.records,
    tombstones: manifest.tombstones,
    counts: manifest.counts
  };
}

function createAvatarSourceExporter(options = {}) {
  const fs = options.fs || fsDefault;
  const path = options.path || pathDefault;
  const now = options.now || (() => Date.now());
  const random = options.random || (() => crypto.randomUUID());
  const sourceId = options.sourceId || SOURCE_ID;
  const folders = options.folders || AVATAR_FOLDERS;

  async function acquireLock(lockPath) {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.writeFile(JSON.stringify({ sourceId, createdAt: nowIso(now) }));
      return handle;
    } catch (error) {
      if (error?.code === "EEXIST") {
        const lockError = new Error("avatar-source-publish-lock-held");
        lockError.code = "AVATAR_SOURCE_LOCK_HELD";
        throw lockError;
      }
      throw error;
    }
  }

  async function ensureLocator(paths, libraryPath) {
    const existing = await readJson(fs, paths.locator);
    if (existing) {
      if (
        existing.kind !== LOCATOR_KIND ||
        existing.schemaVersion !== SCHEMA_VERSION ||
        existing.sourceId !== sourceId ||
        !existing.libraryIdentity
      ) {
        throw new Error("avatar-source-locator-incompatible");
      }
      return existing;
    }
    const locator = {
      kind: LOCATOR_KIND,
      schemaVersion: SCHEMA_VERSION,
      sourceId,
      libraryIdentity: crypto.randomUUID(),
      currentManifest: "manifests/current.json",
      discoveryPath: "GravitySharedSources/eagle-avatar-source/v1/locator.json",
      assetRoot: "assets",
      createdAt: nowIso(now),
      libraryName: path.basename(path.resolve(libraryPath))
    };
    await writeAtomic(fs, path, paths.locator, `${JSON.stringify(locator, null, 2)}\n`, random);
    return locator;
  }

  async function sourceItems(readSourceSnapshot) {
    const snapshot = await readSourceSnapshot();
    if (!snapshot || typeof snapshot !== "object") throw new Error("avatar-source-snapshot-required");
    const result = [];
    for (const folder of folders) {
      const items = snapshot[folder.folderId];
      if (!Array.isArray(items)) throw new Error(`avatar-source-folder-unavailable:${folder.folderId}`);
      for (const item of items) {
        if (!item || item.isDeleted || !item.id) continue;
        const itemFolders = Array.isArray(item.folders) ? item.folders.map(String) : [];
        if (itemFolders.length && !itemFolders.includes(folder.folderId)) continue;
        result.push({ ...item, _avatarSource: folder });
      }
    }
    const ids = new Set();
    for (const item of result) {
      if (ids.has(String(item.id))) throw new Error(`avatar-source-duplicate-eagle-item:${item.id}`);
      ids.add(String(item.id));
    }
    return result;
  }

  async function ensureAsset(paths, pendingAssets, item, extension) {
    if (!item.filePath) throw new Error(`avatar-source-file-path-required:${item.id}`);
    const bytes = await fs.readFile(item.filePath).catch((error) => {
      throw readableError(error, new Error(`avatar-source-file-unavailable:${item.id}`));
    });
    const fingerprint = sha256(bytes);
    const relativePath = safeRelativeAssetPath(fingerprint, extension);
    const assetPath = path.join(paths.root, ...relativePath.split("/"));
    await fs.mkdir(path.dirname(assetPath), { recursive: true });
    if (await exists(fs, assetPath)) {
      const existing = await fs.readFile(assetPath);
      if (sha256(existing) !== fingerprint) throw new Error(`avatar-source-asset-integrity-conflict:${fingerprint}`);
    } else {
      pendingAssets.push({ bytes, assetPath, relativePath, fingerprint });
    }
    return { fingerprint, relativePath };
  }

  async function stagePendingAssets(stageRoot, pendingAssets) {
    const stagedAssets = [];
    for (const pending of pendingAssets) {
      const stagedPath = path.join(stageRoot, ...pending.relativePath.split("/"));
      await fs.mkdir(path.dirname(stagedPath), { recursive: true });
      await fs.writeFile(stagedPath, pending.bytes);
      stagedAssets.push({ ...pending, stagedPath });
    }
    return stagedAssets;
  }

  async function commitStagedAssets(stagedAssets) {
    for (const asset of stagedAssets) {
      await fs.mkdir(path.dirname(asset.assetPath), { recursive: true });
      if (await exists(fs, asset.assetPath)) {
        const existing = await fs.readFile(asset.assetPath);
        if (sha256(existing) !== asset.fingerprint) {
          throw new Error(`avatar-source-asset-integrity-conflict:${asset.fingerprint}`);
        }
        continue;
      }
      await fs.rename(asset.stagedPath, asset.assetPath);
    }
  }

  async function buildRecords(paths, items, locator) {
    const pendingAssets = [];
    const records = [];
    for (const item of items) {
      const parsed = parseDisplayName(item.name);
      const validation = validateAvatarCandidate(item, parsed);
      const record = {
        eagleItemId: String(item.id),
        rawName: parsed.rawName,
        displayName: parsed.displayName,
        sourcePlatform: parsed.sourcePlatform,
        sourceUrl: String(item.url || ""),
        gender: item._avatarSource.gender,
        sourceFolderId: item._avatarSource.folderId,
        mediaType: validation.extension ? `image/${validation.extension === "jpg" ? "jpeg" : validation.extension}` : "",
        width: Number(item.width || 0),
        height: Number(item.height || 0),
        contentFingerprint: null,
        status: validation.status,
        validationIssues: [...validation.issues],
        resourceRef: null
      };
      if (record.status === "active") {
        const asset = await ensureAsset(paths, pendingAssets, item, validation.extension);
        record.contentFingerprint = asset.fingerprint;
        record.resourceRef = {
          scheme: RESOURCE_SCHEME,
          authority: sourceId,
          assetKey: `sha256:${asset.fingerprint}`,
          relativePath: asset.relativePath,
          integrity: { algorithm: "sha256", value: asset.fingerprint }
        };
      }
      records.push(record);
    }
    return {
      records: applyDuplicateIssues(records).sort((left, right) => left.eagleItemId.localeCompare(right.eagleItemId)),
      pendingAssets
    };
  }

  function buildTombstones(previous, records) {
    const previousIds = new Map((previous?.records || []).map((record) => [String(record.eagleItemId), record]));
    const currentIds = new Set(records.map((record) => String(record.eagleItemId)));
    const tombstones = new Map((previous?.tombstones || []).map((entry) => [String(entry.eagleItemId), entry]));
    for (const [eagleItemId, record] of previousIds) {
      if (!currentIds.has(eagleItemId)) {
        tombstones.set(eagleItemId, {
          eagleItemId,
          priorContentFingerprint: record.contentFingerprint || null,
          removedAt: nowIso(now),
          reason: "deleted-or-moved-out"
        });
      }
    }
    for (const record of records) tombstones.delete(String(record.eagleItemId));
    return [...tombstones.values()].sort((left, right) => left.eagleItemId.localeCompare(right.eagleItemId));
  }

  function countsFor(records, tombstones) {
    return {
      active: records.filter((record) => record.status === "active").length,
      invalid: records.filter((record) => record.status === "invalid").length,
      removed: tombstones.length
    };
  }

  async function refresh({ libraryPath, readSourceSnapshot }) {
    const root = sourceRootForLibrary(libraryPath, path);
    const paths = pathsForRoot(root, path);
    await mkdirParents(fs, [paths.root, path.dirname(paths.current), paths.versions, paths.assets, paths.staging]);
    const lock = await acquireLock(paths.lock);
    const runId = random();
    let stageRoot = "";
    async function beginStage() {
      if (stageRoot) return stageRoot;
      stageRoot = path.join(paths.staging, runId);
      await fs.mkdir(stageRoot, { recursive: true });
      await fs.writeFile(path.join(stageRoot, "publish.json"), JSON.stringify({
        runId,
        sourceId,
        status: "building",
        startedAt: nowIso(now)
      }, null, 2) + "\n", "utf8");
      return stageRoot;
    }
    try {
      const locator = await ensureLocator(paths, libraryPath);
      const previous = await readJson(fs, paths.current);
      if (previous && !verifyManifestIntegrity(previous)) throw new Error("avatar-source-current-manifest-integrity-invalid");
      const firstItems = await sourceItems(readSourceSnapshot);
      const previousActiveIds = new Set((previous?.records || [])
        .filter((record) => record.status === "active")
        .map((record) => String(record.eagleItemId)));
      const firstIds = new Set(firstItems.map((item) => String(item.id)));
      const requiresDeletionConfirmation = [...previousActiveIds].some((id) => !firstIds.has(id));
      const items = requiresDeletionConfirmation ? await sourceItems(readSourceSnapshot) : firstItems;
      const built = await buildRecords(paths, items, locator);
      const records = built.records;
      const tombstones = buildTombstones(previous, records);
      const manifest = {
        kind: MANIFEST_KIND,
        schemaVersion: SCHEMA_VERSION,
        manifestVersion: Number(previous?.manifestVersion || 0) + 1,
        snapshotKind: "full",
        source: {
          sourceId,
          libraryIdentity: locator.libraryIdentity,
          generatedAt: nowIso(now),
          folders: folders.map((folder) => ({ gender: folder.gender, sourceFolderId: folder.folderId }))
        },
        records,
        tombstones,
        counts: countsFor(records, tombstones)
      };
      manifest.integrity = buildManifestIntegrity(manifest);
      const snapshotUnchanged = previous && canonicalSha256(snapshotComparable(previous)) === canonicalSha256(snapshotComparable(manifest));
      if (snapshotUnchanged && built.pendingAssets.length === 0) {
        return {
          changed: false,
          manifest: previous,
          outputRoot: root,
          reason: "snapshot-unchanged"
        };
      }
      await beginStage();
      await commitStagedAssets(await stagePendingAssets(stageRoot, built.pendingAssets));
      if (snapshotUnchanged) {
        await fs.writeFile(path.join(stageRoot, "publish.json"), JSON.stringify({
          runId,
          sourceId,
          status: "assets-repaired",
          completedAt: nowIso(now),
          manifestVersion: previous.manifestVersion
        }, null, 2) + "\n", "utf8");
        return {
          changed: false,
          manifest: previous,
          outputRoot: root,
          reason: "assets-repaired"
        };
      }
      const content = `${JSON.stringify(manifest, null, 2)}\n`;
      const versionPath = path.join(paths.versions, `${manifest.manifestVersion}.json`);
      await writeAtomic(fs, path, versionPath, content, random);
      await writeAtomic(fs, path, paths.current, content, random);
      await fs.writeFile(path.join(stageRoot, "publish.json"), JSON.stringify({
        runId,
        sourceId,
        status: "published",
        completedAt: nowIso(now),
        manifestVersion: manifest.manifestVersion,
        counts: manifest.counts,
        integrity: manifest.integrity
      }, null, 2) + "\n", "utf8");
      return {
        changed: true,
        manifest,
        outputRoot: root,
        versionPath,
        currentPath: paths.current
      };
    } catch (error) {
      if (stageRoot) {
        await fs.writeFile(path.join(stageRoot, "publish.json"), JSON.stringify({
          runId,
          sourceId,
          status: "failed",
          failedAt: nowIso(now),
          error: String(error?.message || error)
        }, null, 2) + "\n", "utf8").catch(() => {});
      }
      throw error;
    } finally {
      await lock.close().catch(() => {});
      await fs.unlink(paths.lock).catch(() => {});
    }
  }

  async function rollbackToVersion({ libraryPath, manifestVersion }) {
    const root = sourceRootForLibrary(libraryPath, path);
    const paths = pathsForRoot(root, path);
    await mkdirParents(fs, [paths.root, path.dirname(paths.current), paths.versions, paths.assets, paths.staging]);
    const lock = await acquireLock(paths.lock);
    try {
      const locator = await ensureLocator(paths, libraryPath);
      const previous = await readJson(fs, paths.current);
      if (!previous || !verifyManifestIntegrity(previous)) {
        throw new Error("avatar-source-current-manifest-integrity-invalid");
      }
      const target = await readJson(fs, path.join(paths.versions, `${Number(manifestVersion)}.json`));
      if (!target || !verifyManifestIntegrity(target)) {
        throw new Error(`avatar-source-rollback-version-unavailable:${manifestVersion}`);
      }
      if (target.source?.sourceId !== sourceId || target.source?.libraryIdentity !== locator.libraryIdentity) {
        throw new Error("avatar-source-rollback-source-mismatch");
      }
      const manifest = {
        ...target,
        manifestVersion: Number(previous.manifestVersion || 0) + 1,
        rollbackOf: Number(target.manifestVersion),
        source: { ...target.source, generatedAt: nowIso(now) }
      };
      manifest.integrity = buildManifestIntegrity(manifest);
      const content = `${JSON.stringify(manifest, null, 2)}\n`;
      await writeAtomic(fs, path, path.join(paths.versions, `${manifest.manifestVersion}.json`), content, random);
      await writeAtomic(fs, path, paths.current, content, random);
      return { changed: true, manifest, outputRoot: root, currentPath: paths.current };
    } finally {
      await lock.close().catch(() => {});
      await fs.unlink(paths.lock).catch(() => {});
    }
  }

  return {
    AVATAR_FOLDERS: folders,
    OUTPUT_SEGMENTS,
    pathsForRoot: (root) => pathsForRoot(root, path),
    refresh,
    rollbackToVersion,
    sourceRootForLibrary: (libraryPath) => sourceRootForLibrary(libraryPath, path)
  };
}

module.exports = {
  AVATAR_FOLDERS,
  OUTPUT_SEGMENTS,
  createAvatarSourceExporter,
  pathsForRoot,
  sourceRootForLibrary
};
