"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const pluginDirectory = path.join(__dirname, "..");
const pluginPath = path.join(pluginDirectory, "plugin.js");
const source = fs.readFileSync(pluginPath, "utf8");
const lifecycleHandlers = {};
const sandbox = {
  Buffer,
  URL,
  clearInterval,
  clearTimeout,
  console,
  eagle: {
    library: {},
    onLibraryChanged(handler) {
      lifecycleHandlers.libraryChanged = handler;
    },
    onPluginCreate(handler) {
      lifecycleHandlers.pluginCreate = handler;
    },
    onPluginRun(handler) {
      lifecycleHandlers.pluginRun = handler;
    }
  },
  process,
  require,
  setInterval,
  setTimeout,
  window: {
    location: {
      pathname: path.join(pluginDirectory, "index.html")
    }
  }
};

vm.runInNewContext(
  `${source}\n;globalThis.__buildEagleInjectionSource = injectionSource;`,
  sandbox,
  { filename: pluginPath }
);

assert.strictEqual(
  typeof sandbox.__buildEagleInjectionSource,
  "function",
  "plugin.js must expose the exact injectionSource function to this compilation gate"
);

const injectedSource = sandbox.__buildEagleInjectionSource();
assert.doesNotThrow(
  () => new Function(injectedSource),
  "the complete JavaScript payload sent to Eagle must compile before packaging"
);

assert.deepStrictEqual(
  Object.keys(lifecycleHandlers).sort(),
  ["libraryChanged", "pluginCreate", "pluginRun"],
  "the compilation gate must load the same plugin lifecycle module without starting Eagle"
);

console.log("injection source compilation gate passed");
