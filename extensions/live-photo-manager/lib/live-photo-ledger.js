"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SCHEMA_VERSION = 1;
const OPERATION_STATUSES = new Set(["planned", "running", "completed", "failed", "cancelled"]);
const TRANSITIONS = {
  planned: new Set(["running", "cancelled"]),
  running: new Set(["completed", "failed", "cancelled"]),
  completed: new Set(),
  failed: new Set(["running", "cancelled"]),
  cancelled: new Set(["running"]),
};

function now() {
  return new Date().toISOString();
}

function createLedger({ sourceDirectory = null } = {}) {
  const createdAt = now();
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt,
    updatedAt: createdAt,
    sourceDirectory,
    groups: {},
    operations: {},
    events: [],
  };
}

function assertLedger(ledger) {
  if (!ledger || ledger.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported Live Photo ledger schema: ${ledger?.schemaVersion ?? "missing"}`);
  }
  if (!ledger.groups || !ledger.operations || !Array.isArray(ledger.events)) {
    throw new Error("Live Photo ledger is missing required collections");
  }
}

function loadLedger(filePath) {
  if (!fs.existsSync(filePath)) return createLedger();
  const ledger = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assertLedger(ledger);
  return ledger;
}

function saveLedger(filePath, ledger) {
  assertLedger(ledger);
  ledger.updatedAt = now();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const handle = fs.openSync(tempPath, "w");
  try {
    fs.writeFileSync(handle, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  fs.renameSync(tempPath, filePath);
}

function addEvent(ledger, type, payload = {}) {
  ledger.events.push({ at: now(), type, ...payload });
  if (ledger.events.length > 2000) ledger.events.splice(0, ledger.events.length - 2000);
}

function ensureGroup(ledger, input) {
  assertLedger(ledger);
  if (!input?.id) throw new Error("Live Photo group id is required");
  const existing = ledger.groups[input.id];
  if (existing) return existing;
  const group = {
    id: input.id,
    stem: input.stem || input.id,
    status: input.status || "discovered",
    imagePath: input.imagePath || null,
    moviePath: input.moviePath || null,
    image: input.image || null,
    movie: input.movie || null,
    identity: input.identity || null,
    groupId: input.groupId || input.identity?.groupId || null,
    // Native Eagle cards are the user-facing record.  Keep the mapping in
    // the ledger so background context-menu actions can resolve a card back
    // to its original pair without opening the manager window.
    nativeItemId: input.nativeItemId || null,
    nativePackagePath: input.nativePackagePath || null,
    issues: Array.isArray(input.issues) ? [...input.issues] : [],
    createdAt: now(),
    updatedAt: now(),
  };
  ledger.groups[group.id] = group;
  addEvent(ledger, "group.discovered", { groupId: group.id });
  return group;
}

function createOperation(ledger, { id = null, type, groupIds = [], outputDirectory = null, metadata = {} } = {}) {
  assertLedger(ledger);
  if (!type) throw new Error("Operation type is required");
  const operationId = id || `op-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  if (ledger.operations[operationId]) return ledger.operations[operationId];
  const operation = {
    id: operationId,
    type,
    status: "planned",
    groupIds: [...new Set(groupIds)],
    outputDirectory,
    metadata: { ...metadata },
    results: [],
    createdAt: now(),
    updatedAt: now(),
  };
  ledger.operations[operation.id] = operation;
  addEvent(ledger, "operation.created", { operationId: operation.id, type });
  return operation;
}

function transitionOperation(ledger, operationId, status, patch = {}) {
  assertLedger(ledger);
  if (!OPERATION_STATUSES.has(status)) throw new Error(`Unsupported operation status: ${status}`);
  const operation = ledger.operations[operationId];
  if (!operation) throw new Error(`Operation not found: ${operationId}`);
  if (operation.status !== status && !TRANSITIONS[operation.status].has(status)) {
    throw new Error(`Invalid operation transition: ${operation.status} -> ${status}`);
  }
  Object.assign(operation, patch, { status, updatedAt: now() });
  addEvent(ledger, "operation.status", { operationId, status });
  return operation;
}

function recordOperationResult(ledger, operationId, groupId, result = {}) {
  assertLedger(ledger);
  const operation = ledger.operations[operationId];
  if (!operation) throw new Error(`Operation not found: ${operationId}`);
  if (!operation.groupIds.includes(groupId)) {
    throw new Error(`Group ${groupId} is not part of operation ${operationId}`);
  }
  if (operation.results.some((entry) => entry.groupId === groupId)) {
    throw new Error(`Operation ${operationId} already has a result for ${groupId}`);
  }
  const entry = { groupId, ...result, recordedAt: now() };
  operation.results.push(entry);
  operation.updatedAt = now();
  addEvent(ledger, "operation.result", { operationId, groupId, status: result.status || null });
  return entry;
}

module.exports = {
  SCHEMA_VERSION,
  createLedger,
  loadLedger,
  saveLedger,
  ensureGroup,
  createOperation,
  transitionOperation,
  recordOperationResult,
};
