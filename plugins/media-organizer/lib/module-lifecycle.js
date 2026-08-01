"use strict";

function normalizeError(error) {
  return {
    name: String(error?.name || "Error"),
    message: String(error?.message || error || "Unknown module error")
  };
}

function asDisposer(resource) {
  if (typeof resource === "function") return resource;
  if (resource && typeof resource.dispose === "function") {
    return () => resource.dispose();
  }
  throw new TypeError("A module resource must be a disposer function or object");
}

function createModuleLifecycle({
  moduleId,
  onStart = async () => undefined,
  onStop = async () => undefined,
  now = () => Date.now()
} = {}) {
  if (!moduleId) throw new TypeError("moduleId is required");

  let enabled = false;
  let state = "disabled";
  let startedAt = null;
  let stoppedAt = null;
  let lastError = null;
  let startPromise = null;
  let stopPromise = null;
  let startContext = null;
  const resources = [];

  function status(extra = {}) {
    return {
      moduleId: String(moduleId),
      enabled,
      state,
      startedAt,
      stoppedAt,
      resourceCount: resources.length,
      lastError,
      ...extra
    };
  }

  async function disposeResources() {
    const pending = resources.splice(0).reverse();
    const errors = [];
    for (const dispose of pending) {
      try {
        await dispose();
      } catch (error) {
        errors.push(normalizeError(error));
      }
    }
    if (errors.length) {
      const error = new Error(
        errors.map((entry) => entry.message).join("; ")
      );
      error.code = "MODULE_RESOURCE_DISPOSE_FAILED";
      error.causes = errors;
      throw error;
    }
  }

  function register(resource) {
    const dispose = asDisposer(resource);
    if (state !== "starting" && state !== "running") {
      throw new Error("Cannot register a resource while module is stopped");
    }
    resources.push(dispose);
    let active = true;
    return async () => {
      if (!active) return;
      active = false;
      const index = resources.indexOf(dispose);
      if (index >= 0) resources.splice(index, 1);
      await dispose();
    };
  }

  async function start(context) {
    if (!enabled) return status({ skipped: "disabled" });
    if (state === "running") return status({ reused: true });
    if (startPromise) return startPromise;

    state = "starting";
    startContext = context;
    lastError = null;
    startPromise = Promise.resolve()
      .then(() => onStart({
        context,
        register,
        status
      }))
      .then((result) => {
        state = "running";
        startedAt = now();
        return status({ result });
      })
      .catch(async (error) => {
        lastError = normalizeError(error);
        state = "error";
        try {
          await disposeResources();
        } catch (disposeError) {
          lastError = normalizeError(disposeError);
        }
        throw error;
      })
      .finally(() => {
        startPromise = null;
      });
    return startPromise;
  }

  async function stop(reason = "requested") {
    if (stopPromise) return stopPromise;
    if (state === "disabled" && resources.length === 0) {
      return status({ reused: true });
    }

    state = "stopping";
    stopPromise = Promise.resolve()
      .then(async () => {
        let result;
        let failure = null;
        try {
          result = await onStop({ reason, context: startContext, status });
        } catch (error) {
          failure = error;
        }
        try {
          await disposeResources();
        } catch (error) {
          failure = failure || error;
        }
        if (failure) {
          lastError = normalizeError(failure);
          state = "error";
          throw failure;
        }
        state = enabled ? "stopped" : "disabled";
        stoppedAt = now();
        startContext = null;
        return status({ result });
      })
      .finally(() => {
        stopPromise = null;
      });
    return stopPromise;
  }

  async function setEnabled(nextEnabled, reason = "disabled") {
    enabled = nextEnabled === true;
    if (!enabled) return stop(reason);
    if (state === "disabled") state = "stopped";
    return status();
  }

  return Object.freeze({
    moduleId: String(moduleId),
    start,
    stop,
    setEnabled,
    register,
    status
  });
}

module.exports = {
  createModuleLifecycle,
  normalizeError
};
