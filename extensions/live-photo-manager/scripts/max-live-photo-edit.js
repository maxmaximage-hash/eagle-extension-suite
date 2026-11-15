#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  readJson,
  waitForExternalEdit,
  launchEditor,
  stageExternalEdit,
} = require("../lib/external-cover-edit-helper");

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}

async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.session) throw new Error("--session is required");
  const sessionPath = path.resolve(args.session);
  const session = readJson(sessionPath);
  if (!session.editedCoverPath || !fs.existsSync(session.editedCoverPath)) {
    throw new Error(`Edited cover is unavailable: ${session.editedCoverPath || "missing"}`);
  }
  const initial = fs.statSync(session.editedCoverPath);
  if (!args["no-launch"]) launchEditor(session);
  await waitForExternalEdit(session, {
    initialMtime: initial.mtimeMs,
    initialSize: initial.size,
    timeoutMs: Number(args.timeout || 15 * 60 * 1000),
  });
  const ready = stageExternalEdit(session);
  process.stdout.write(`${JSON.stringify({
    status: ready.status,
    sessionPath,
    stagedPackagePath: ready.stagedPackagePath,
    nativeItemId: ready.nativeItemId,
  })}\n`);
  return ready;
}

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, run };

