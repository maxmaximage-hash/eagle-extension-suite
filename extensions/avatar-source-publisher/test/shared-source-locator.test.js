"use strict";

const assert = require("assert");
const fs = require("fs").promises;
const os = require("os");
const path = require("path");
const test = require("node:test");
const { resolveSharedAvatarSource } = require("../lib/shared-source-locator");

async function writeLocator(root, identity) {
  const directory = path.join(root, "GravitySharedSources", "eagle-avatar-source", "v1");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "locator.json"), JSON.stringify({
    kind: "gravity.avatar-source-locator.v1",
    schemaVersion: 1,
    sourceId: "gravity.eagle.avatar-source.v1",
    libraryIdentity: identity,
    currentManifest: "manifests/current.json",
    assetRoot: "assets"
  }));
}

test("resolves the same logical source on differently named mounts", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avatar-mounts-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const firstMount = path.join(root, "Team NAS");
  const secondMount = path.join(root, "团队文件-MAX线上协作中台");
  await writeLocator(firstMount, "library-identity-1");
  await writeLocator(secondMount, "library-identity-1");
  const source = await resolveSharedAvatarSource({
    mountRoots: [firstMount],
    libraryIdentity: "library-identity-1"
  });
  const sameSourceOnAnotherMachine = await resolveSharedAvatarSource({
    mountRoots: [secondMount],
    libraryIdentity: "library-identity-1"
  });
  assert.ok(source);
  assert.strictEqual(source.sourceId, "gravity.eagle.avatar-source.v1");
  assert.strictEqual(source.libraryIdentity, "library-identity-1");
  assert.ok(source.manifestPath.endsWith(path.join("manifests", "current.json")));
  assert.strictEqual(sameSourceOnAnotherMachine.libraryIdentity, source.libraryIdentity);
});
