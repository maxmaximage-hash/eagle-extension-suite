"use strict";

const {
  createModuleLifecycle
} = require("./module-lifecycle.js");
const {
  createNormalCollectionAdapter,
  createSmartCollectionAdapter
} = require("./host-adapter.js");
const {
  createEventOwnership,
  applyEventOwnership
} = require("./event-ownership.js");

function registerLegacyResource(register, resource) {
  if (!resource) return;
  if (typeof resource === "function") {
    register(resource);
    return;
  }
  if (typeof resource.dispose === "function") register(resource);
}

function createSortingModuleFacade({
  host,
  legacy = {},
  windowId = "",
  hostAppId = "host",
  collectionId = ""
} = {}) {
  const ownership = createEventOwnership({
    enabled: false,
    windowId,
    hostAppId,
    collectionId
  });
  const adapters = {
    normal: createNormalCollectionAdapter({ host }),
    smart: createSmartCollectionAdapter({ host })
  };
  const lifecycle = createModuleLifecycle({
    moduleId: "sorting",
    onStart: async ({ register }) => {
      ownership.setEnabled(true);
      try {
        const resource = await legacy.start?.();
        registerLegacyResource(register, resource);
      } catch (error) {
        ownership.setEnabled(false);
        throw error;
      }
    },
    onStop: async () => {
      ownership.setEnabled(false);
      await legacy.stop?.();
    }
  });

  function adapterFor(refOrContext) {
    const kind = String(refOrContext?.ref?.kind || refOrContext?.kind || "");
    const adapter = adapters[kind];
    if (!adapter) throw new Error("Unsupported collection adapter kind");
    return adapter;
  }

  return Object.freeze({
    enable: async (context) => {
      await lifecycle.setEnabled(true);
      return lifecycle.start(context);
    },
    disable: (reason) => lifecycle.setEnabled(false, reason || "disabled"),
    start: (context) => lifecycle.start(context),
    stop: (reason) => lifecycle.stop(reason),
    status: () => lifecycle.status(),
    setCollectionContext: (context) => ownership.setContext(context),
    classifyEvent: (event) => ownership.classify(event),
    applyEvent: (event, decision) => applyEventOwnership(event, decision),
    readSnapshot: async (context) => adapterFor(context).readSnapshot(context),
    writeManualView: async (command) =>
      adapterFor(command.snapshot).writeManualView(command),
    requestHostConfirmation: async (command) =>
      adapterFor(command).requestHostConfirmation(command)
  });
}

module.exports = { createSortingModuleFacade };
