"use strict";

const assert = require("assert");
const { correctNativeHostOrder } = require("../lib/host-native-order-core");

const isolatedHelper = Function(
  `"use strict"; return (${correctNativeHostOrder.toString()});`
)();

const oldest = { id: "oldest" };
const middle = { id: "middle" };
const newest = { id: "newest" };

assert.deepStrictEqual(
  correctNativeHostOrder([oldest, middle, newest], {
    orderBy: "IMPORT",
    sortIncrease: false
  }).map((item) => item.id),
  ["newest", "middle", "oldest"],
  "R140: native IMPORT descending must correct Eagle's inverted host result"
);
assert.deepStrictEqual(
  isolatedHelper([oldest, middle, newest], {
    orderBy: "IMPORT",
    sortIncrease: false
  }).map((item) => item.id),
  ["newest", "middle", "oldest"],
  "R140: the injected native-date helper must execute without module scope"
);
assert.deepStrictEqual(
  correctNativeHostOrder([newest, middle, oldest], {
    orderBy: "CREATEDATE",
    sortIncrease: true
  }).map((item) => item.id),
  ["oldest", "middle", "newest"],
  "R140: native CREATEDATE ascending must correct Eagle's inverted host result"
);
assert.deepStrictEqual(
  correctNativeHostOrder([oldest, newest], {
    orderBy: "NAME",
    sortIncrease: false
  }).map((item) => item.id),
  ["oldest", "newest"],
  "R71/L0: non-date native keys must preserve Eagle's result"
);

console.log("host native order core tests passed");
