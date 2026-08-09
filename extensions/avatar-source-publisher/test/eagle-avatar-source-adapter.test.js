"use strict";

const assert = require("assert");
const fs = require("fs").promises;
const os = require("os");
const path = require("path");
const test = require("node:test");
const { createEagleAvatarSourceAdapter } = require("../lib/eagle-avatar-source-adapter");

test("uses the bounded local Eagle cache before a potentially slow folder API call", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avatar-adapter-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const library = path.join(root, "library.library");
  const cacheDirectory = path.join(root, "cache");
  const infoDirectory = path.join(library, "images", "female.info");
  await fs.mkdir(infoDirectory, { recursive: true });
  await fs.mkdir(cacheDirectory, { recursive: true });
  await fs.writeFile(path.join(infoDirectory, "female - 小红书.webp"), "avatar");
  await fs.writeFile(path.join(infoDirectory, "metadata.json"), JSON.stringify({
    id: "female",
    name: "female - 小红书",
    ext: "webp",
    width: 540,
    height: 540,
    url: "https://www.xiaohongshu.com/user/profile/female",
    folders: ["MR6L4NLN5G4Y0"]
  }));
  await fs.writeFile(path.join(cacheDirectory, "source.txt"), [
    JSON.stringify({ id: "female", folders: ["MR6L4NLN5G4Y0"] }),
    "cache-marker-\"MR6L4IMOVX6XL\""
  ].join("\n"));
  const never = new Promise(() => {});
  const adapter = createEagleAvatarSourceAdapter({
    library: { path: library },
    item: { get: async () => never }
  }, { cacheDirectory, queryTimeoutMs: 5 });
  const snapshot = await adapter.readSourceSnapshot();
  assert.strictEqual(snapshot.MR6L4NLN5G4Y0.length, 1);
  assert.deepStrictEqual(snapshot.MR6L4IMOVX6XL, []);
});
