"use strict";

const path = require("path");
const { createAvatarSourceExporter } = require("../lib/avatar-source-exporter");
const { readBoundedAvatarLibrary } = require("../lib/bounded-library-source-reader");

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : String(process.argv[index + 1] || "");
}

async function main() {
  const libraryPath = option("--library");
  const cachePath = option("--cache");
  if (!libraryPath || !cachePath) {
    throw new Error("Usage: node scripts/publish-from-bounded-library-cache.js --library <path> --cache <path>");
  }
  const exporter = createAvatarSourceExporter();
  const result = await exporter.refresh({
    libraryPath: path.resolve(libraryPath),
    readSourceSnapshot: () => readBoundedAvatarLibrary({ libraryPath, cachePath })
  });
  process.stdout.write(`${JSON.stringify({
    changed: result.changed,
    outputRoot: result.outputRoot,
    manifestVersion: result.manifest?.manifestVersion || null,
    counts: result.manifest?.counts || null,
    integrity: result.manifest?.integrity || null
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
