"use strict";

const assert = require("assert");
const { createMediaSortRuntime } = require("../lib/sort-core");
const { createPublicSortPreviewRuntime } = require(
  "../lib/public-sort-preview-core"
);

const sortRuntime = createMediaSortRuntime({ imageExtensions: ["jpg"] });
const previewRuntime = createPublicSortPreviewRuntime({ sortRuntime });
const items = [
  { id: "b", name: "2-scene", ext: "jpg", modificationTime: 2 },
  { id: "a", name: "1-scene", ext: "jpg", modificationTime: 1 }
];
const preview = previewRuntime.buildPreview(items, {
  rules: [{ field: "NAME", direction: "asc" }]
});

assert.deepStrictEqual(
  preview.orderedItems.map((item) => item.id),
  ["a", "b"]
);
assert.strictEqual(previewRuntime.exportLines(preview), "1. 1-scene\n2. 2-scene");
console.log("public sort preview core tests passed");
