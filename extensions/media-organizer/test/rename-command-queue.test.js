"use strict";

const assert = require("assert");
const {
  createRenameCommandQueue
} = require("../lib/rename-command-queue.js");

async function main() {
  const execution = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const queue = createRenameCommandQueue({
    execute: async (command) => {
      execution.push(`start:${command.commandId}`);
      if (command.commandId === "a1") await firstGate;
      if (command.commandId === "a-fail") throw new Error("NAS unavailable");
      execution.push(`done:${command.commandId}`);
      return { renamed: command.plan.changes.length };
    }
  });

  const base = (overrides = {}) => ({
    collectionId: "folder-a",
    commandId: "a1",
    snapshotVersion: "7",
    snapshotIdentity: "3:abc",
    signature: "sig-a1",
    plan: { changes: [{ id: "1" }] },
    ...overrides
  });

  const accepted = queue.enqueue(base());
  assert.strictEqual(accepted.accepted, true);
  assert.strictEqual(queue.hasSignature("folder-a", "sig-a1"), true);

  const crossCollection = queue.enqueue(base({
    collectionId: "folder-b",
    commandId: "b1",
    signature: "sig-b1"
  }));
  assert.strictEqual(crossCollection.accepted, true);

  const sameCollection = queue.enqueue(base({
    commandId: "a2",
    signature: "sig-a2"
  }));
  assert.strictEqual(sameCollection.accepted, true);

  const duplicate = queue.enqueue(base({
    commandId: "a-duplicate"
  }));
  assert.deepStrictEqual(
    { accepted: duplicate.accepted, reason: duplicate.reason },
    { accepted: false, reason: "duplicate-signature" }
  );

  releaseFirst();
  await queue.idle();
  assert.deepStrictEqual(execution, [
    "start:a1",
    "start:b1",
    "done:b1",
    "done:a1",
    "start:a2",
    "done:a2"
  ]);
  assert.strictEqual(queue.status("a1").state, "success");
  assert.strictEqual(queue.status("a2").state, "success");
  assert.strictEqual(queue.status("b1").state, "success");

  const failed = queue.enqueue(base({
    commandId: "a-fail",
    signature: "sig-fail"
  }));
  assert.strictEqual(failed.accepted, true);
  await queue.idle();
  assert.strictEqual(queue.status("a-fail").state, "failed");
  assert.strictEqual(
    queue.hasSignature("folder-a", "sig-fail"),
    false,
    "failed command must release its signature for retry"
  );
  const retry = queue.enqueue(base({
    commandId: "a-retry",
    signature: "sig-fail"
  }));
  assert.strictEqual(retry.accepted, true);
  await queue.idle();

  const deferred = queue.enqueue(base({
    commandId: "a-deferred",
    signature: "sig-deferred"
  }), { defer: true });
  assert.strictEqual(deferred.accepted, true);
  assert.strictEqual(queue.cancelAll("library-changed"), 1);
  assert.strictEqual(queue.status("a-deferred").state, "cancelled");
  assert.strictEqual(queue.hasSignature("folder-a", "sig-deferred"), false);

  assert.throws(
    () => queue.enqueue({
      collectionId: "folder-a",
      commandId: "invalid",
      plan: { changes: [] }
    }),
    /requires collectionId/
  );
  console.log("rename-command-queue tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
