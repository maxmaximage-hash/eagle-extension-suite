"use strict";

const assert = require("assert");
const { createTeamStateSyncRuntime, fingerprint } = require(
  "../lib/team-state-sync-core"
);

function deferredTimers() {
  const timers = [];
  return {
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout(handle) {
      timers[handle - 1] = null;
    },
    async flush() {
      while (timers.length) {
        const callback = timers.shift();
        if (callback) await callback();
      }
    }
  };
}

async function run() {
  assert.strictEqual(
    fingerprint({ storage: { rules: 1 }, createdAt: "a" }),
    fingerprint({ storage: { rules: 1 }, createdAt: "b", revision: 9 })
  );
  assert.strictEqual(
    fingerprint({
      storage: {
        "eagle.list.meta.type": "RESOLUTION",
        "eagle.list.sortIncrease": true,
        "eagle.photoTakenSort.rules.v2": "stable"
      }
    }),
    fingerprint({
      storage: {
        "eagle.list.meta.type": "PHOTO_TAKEN",
        "eagle.list.sortIncrease": false,
        "eagle.photoTakenSort.rules.v2": "stable"
      }
    }),
    "switching folders must not rewrite team state for legacy current-view keys"
  );
  assert.notStrictEqual(
    fingerprint({
      storage: { "eagle.photoTakenSort.rules.v2": "before" }
    }),
    fingerprint({
      storage: { "eagle.photoTakenSort.rules.v2": "after" }
    }),
    "modern per-folder rules must still trigger team synchronization"
  );
  const timers = deferredTimers();
  const writes = [];
  const runtime = createTeamStateSyncRuntime({
    debounceMs: 1,
    writerId: "computer-a",
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    now: () => 1700000000000
  });
  runtime.seed({
    localFingerprint: fingerprint({
      libraryId: "/Volumes/team.library",
      storage: { "eagle.photoTakenSort.manualViews.v2": "old" }
    }),
    writtenFingerprint: fingerprint({
      libraryId: "/Volumes/team.library",
      storage: { "eagle.photoTakenSort.manualViews.v2": "old" }
    }),
    sidecarIdentity: { revision: 4, mtimeMs: 10 }
  });

  const first = runtime.schedule(
    {
      libraryId: "/Volumes/team.library",
      storage: {
        "eagle.photoTakenSort.manualViews.v2": "new",
        "eagle.photoTakenSort.sortingLocks.v3": "on",
        "eagle.photoTakenSort.manualMode.v1": "on",
        "eagle.photoTakenSort.rules.v2": "v2"
      }
    },
    {
      write: async (snapshot, metadata) => {
        writes.push({ snapshot, metadata });
        return { sidecarIdentity: { revision: metadata.revision, mtimeMs: 11 } };
      }
    }
  );
  const second = runtime.schedule(
    {
      libraryId: "/Volumes/team.library",
      storage: {
        "eagle.photoTakenSort.manualViews.v2": "last",
        "eagle.photoTakenSort.sortingLocks.v3": "off",
        "eagle.photoTakenSort.manualMode.v1": "on",
        "eagle.photoTakenSort.rules.v2": "v2"
      }
    },
    {
      write: async (snapshot, metadata) => {
        writes.push({ snapshot, metadata });
        return { sidecarIdentity: { revision: metadata.revision, mtimeMs: 12 } };
      }
    }
  );
  await timers.flush();
  const firstResult = await first;
  const secondResult = await second;
  assert.strictEqual(writes.length, 1, "debounce should write only once");
  assert.strictEqual(
    writes[0].snapshot.storage["eagle.photoTakenSort.manualViews.v2"],
    "last"
  );
  assert.strictEqual(writes[0].metadata.revision, 5);
  assert.strictEqual(firstResult.skipped, "superseded");
  assert.strictEqual(secondResult.ok, true);

  const imported = createTeamStateSyncRuntime({
    debounceMs: 1,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout
  });
  const oldState = {
    schemaVersion: 2,
    storage: {
      "eagle.photoTakenSort.rules.v2": { libraries: {} }
    }
  };
  assert.strictEqual(imported.noteImportedState(oldState, { revision: 3 }, "same"), true);
  const upgradeWrite = imported.schedule(
    {
      libraryId: "/Volumes/team.library",
      storage: { "eagle.photoTakenSort.manualViews.v2": { libraries: {} } }
    },
    {
      reason: "initial-import-upgrade",
      write: async (_snapshot, metadata) => ({
        sidecarIdentity: { revision: metadata.revision }
      })
    }
  );
  await timers.flush();
  await upgradeWrite;
  assert.strictEqual(imported.snapshot().writeCount, 1);

  const changedOnDisk = createTeamStateSyncRuntime({
    debounceMs: 1,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout
  });
  changedOnDisk.seed({
    localFingerprint: "base",
    writtenFingerprint: "base",
    sidecarIdentity: { revision: 7, mtimeMs: 20 }
  });
  let conflictSeen = false;
  const conflictResult = changedOnDisk.schedule(
    {
      libraryId: "/Volumes/team.library",
      storage: { "eagle.photoTakenSort.manualViews.v2": "local" }
    },
    {
      write: async (_snapshot, metadata) => {
        assert.deepStrictEqual(metadata.expectedSidecar, { revision: 7, mtimeMs: 20 });
        conflictSeen = true;
        throw new Error("sidecar-conflict");
      }
    }
  );
  await timers.flush();
  await assert.rejects(conflictResult, /sidecar-conflict/);
  assert.strictEqual(conflictSeen, true);
  assert.strictEqual(changedOnDisk.snapshot().lastWrittenFingerprint, "base");
  changedOnDisk.block("sidecar-changed");
  const blocked = await changedOnDisk.schedule(
    {
      libraryId: "/Volumes/team.library",
      storage: { "eagle.photoTakenSort.manualViews.v2": "new-local-change" }
    },
    { write: async () => { throw new Error("must-not-write"); } }
  );
  assert.strictEqual(blocked.skipped, "blocked");

  console.log("team state sync core tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
