"use strict";

const crypto = require("crypto");

function conflictError(reason) {
  const error = new Error(`team-state-conflict:${reason}`);
  error.code = "TEAM_STATE_CONFLICT";
  error.reason = reason;
  return error;
}

function createTeamStateFileRuntime(options = {}) {
  const fs = options.fs || require("fs").promises;
  const path = options.path || require("path");
  const now = options.now || (() => Date.now());
  const random = options.random || (() => `${now()}-${process.pid}`);

  async function readIdentity(filePath) {
    let stat;
    let raw;
    try {
      [stat, raw] = await Promise.all([
        fs.stat(filePath),
        fs.readFile(filePath)
      ]);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(raw.toString("utf8"));
    } catch {}
    return {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      rawSha256: crypto.createHash("sha256").update(raw).digest("hex"),
      revision: Number(parsed?.revision || 0),
      writerId: String(parsed?.writerId || "")
    };
  }

  function sameIdentity(expected, actual) {
    if (!expected && !actual) return true;
    if (!expected || !actual) return false;
    if (expected.rawSha256 && actual.rawSha256) {
      return expected.rawSha256 === actual.rawSha256;
    }
    return expected.mtimeMs === actual.mtimeMs && expected.size === actual.size;
  }

  async function writeAtomic(filePath, content, options = {}) {
    const directory = path.dirname(filePath);
    await fs.access(directory);
    const lockPath = `${filePath}.lock`;
    let lockHandle;
    let lockAcquired = false;
    try {
      lockHandle = await fs.open(lockPath, "wx");
      lockAcquired = true;
      await lockHandle.writeFile(JSON.stringify({
        writerId: options.writerId || "unknown-writer",
        createdAt: new Date(now()).toISOString()
      }));
    } catch (error) {
      if (error?.code === "EEXIST") throw conflictError("lock-held");
      await lockHandle?.close().catch(() => {});
      if (lockAcquired) await fs.unlink(lockPath).catch(() => {});
      throw error;
    }
    const temporaryPath = `${filePath}.tmp-${random()}`;
    try {
      const current = await readIdentity(filePath);
      if (options.expectedIdentity !== undefined &&
          !sameIdentity(options.expectedIdentity, current)) {
        throw conflictError("sidecar-changed");
      }
      if (typeof options.beforeReplace === "function") {
        await options.beforeReplace(current);
      }
      await fs.writeFile(temporaryPath, content, "utf8");
      await fs.rename(temporaryPath, filePath);
      return { sidecarIdentity: await readIdentity(filePath) };
    } finally {
      await fs.unlink(temporaryPath).catch(() => {});
      await lockHandle.close().catch(() => {});
      await fs.unlink(lockPath).catch(() => {});
    }
  }

  return { conflictError, readIdentity, sameIdentity, writeAtomic };
}

module.exports = { createTeamStateFileRuntime, conflictError };
