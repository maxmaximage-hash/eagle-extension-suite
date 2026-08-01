"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createTeamStateFileRuntime } = require(
  "../lib/team-state-file-core"
);

async function run() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "team-state-"));
  const filePath = path.join(root, "Library.library.eagle-team-state.json");
  const runtime = createTeamStateFileRuntime({
    now: () => 1700000000000,
    random: () => "test"
  });
  await fs.promises.writeFile(filePath, "{\"revision\":1,\"writerId\":\"a\"}\n");
  const original = await runtime.readIdentity(filePath);
  const result = await runtime.writeAtomic(
    filePath,
    "{\"revision\":2,\"writerId\":\"b\"}\n",
    { expectedIdentity: original, writerId: "b" }
  );
  assert.strictEqual(result.sidecarIdentity.revision, 2);
  assert.strictEqual((await fs.promises.readFile(filePath, "utf8")).includes('"revision":2'), true);

  await fs.promises.writeFile(filePath, "{\"revision\":3,\"writerId\":\"other\"}\n");
  await assert.rejects(
    runtime.writeAtomic(
      filePath,
      "{\"revision\":4}\n",
      { expectedIdentity: original, writerId: "b" }
    ),
    (error) => error.code === "TEAM_STATE_CONFLICT" && error.reason === "sidecar-changed"
  );
  assert.match(await fs.promises.readFile(filePath, "utf8"), /"revision":3/);

  await fs.promises.writeFile(`${filePath}.lock`, "held");
  await assert.rejects(
    runtime.writeAtomic(filePath, "{\"revision\":5}\n", { writerId: "c" }),
    (error) => error.code === "TEAM_STATE_CONFLICT" && error.reason === "lock-held"
  );
  await fs.promises.unlink(`${filePath}.lock`);
  const newPath = path.join(root, "new.json");
  await runtime.writeAtomic(newPath, "{\"revision\":1}\n");
  assert.match(await fs.promises.readFile(newPath, "utf8"), /revision/);
  console.log("team state file core tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
