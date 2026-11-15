#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const {
  DEFAULT_SAMPLE_DIRECTORY,
  createPreviewQueue,
  scanDirectory,
  snapshotPayload,
} = require("./lib/live-photo-service");
const {
  createLedger,
  loadLedger,
  saveLedger,
  ensureGroup,
  createOperation,
  transitionOperation,
  recordOperationResult,
} = require("./lib/live-photo-ledger");
const {
  exportLivePairComponent,
  exportLivePairComponents,
  exportLivePairPackage,
} = require("./lib/export-service");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("Request body is too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".heic") return "image/heic";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".png") return "image/png";
  return "application/octet-stream";
}

function serveFile(request, response, filePath, cache = false) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(response, 404, { error: "File not found" });
    return;
  }
  const size = fs.statSync(filePath).size;
  const range = request.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      response.writeHead(416, { "Content-Range": `bytes */${size}` });
      response.end();
      return;
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
      response.writeHead(416, { "Content-Range": `bytes */${size}` });
      response.end();
      return;
    }
    response.writeHead(206, {
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": end - start + 1,
      "Content-Type": contentType(filePath),
      "Cache-Control": cache ? "private, max-age=3600" : "no-store",
    });
    fs.createReadStream(filePath, { start, end }).pipe(response);
    return;
  }
  response.writeHead(200, {
    "Accept-Ranges": "bytes",
    "Content-Length": size,
    "Content-Type": contentType(filePath),
    "Cache-Control": cache ? "private, max-age=3600" : "no-store",
  });
  fs.createReadStream(filePath).pipe(response);
}

function createManager(sourceDirectory, options = {}) {
  let queue;
  const ledgerPath = path.resolve(options.ledgerPath || path.join(process.env.HOME || os.homedir(), ".eagle-live-photo-manager", "ledger.json"));
  let ledger = fs.existsSync(ledgerPath) ? loadLedger(ledgerPath) : createLedger({ sourceDirectory });
  ledger.sourceDirectory = sourceDirectory;

  function persist() {
    saveLedger(ledgerPath, ledger);
  }

  function publicState() {
    const payload = snapshotPayload(sourceDirectory, queue.snapshot(), "browser-demo");
    payload.items = payload.items.map((item) => ({
      ...item,
      imageUrl: item.imagePath ? `/media/${item.id}/image` : null,
      movieUrl: item.moviePath ? `/media/${item.id}/movie` : null,
      imagePath: undefined,
      moviePath: undefined,
    }));
    payload.operations = Object.values(ledger.operations);
    return payload;
  }

  function reset() {
    if (queue) queue.cancel();
    queue = createPreviewQueue({ timeoutMs: 10000, maxConsecutiveFailures: 3 });
    const items = scanDirectory(sourceDirectory);
    for (const item of items) {
      ensureGroup(ledger, item);
    }
    queue.enqueue(items);
    queue.start().catch(() => {});
    persist();
    return publicState();
  }

  function exportGroups({ groupIds, outputDirectory, mode = "components", overwrite = false } = {}) {
    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      throw new Error("At least one Live Photo group must be selected");
    }
    if (!outputDirectory) throw new Error("Output directory is required");
    if (!["components", "image", "movie", "livp"].includes(mode)) throw new Error(`Unsupported export mode: ${mode}`);
    const operation = createOperation(ledger, {
      type: mode === "livp" ? "export-livp" : `export-${mode}`,
      groupIds,
      outputDirectory: path.resolve(outputDirectory),
    });
    transitionOperation(ledger, operation.id, "running");
    persist();
    let failed = false;
    for (const groupId of operation.groupIds) {
      const group = ledger.groups[groupId];
      try {
        if (!group) throw new Error(`Live Photo group not found: ${groupId}`);
        if (group.status !== "ready") throw new Error(`Live Photo group is not exportable: ${group.status}`);
        const result = mode === "livp"
          ? exportLivePairPackage(group, operation.outputDirectory, { overwrite })
          : mode === "components"
            ? exportLivePairComponents(group, operation.outputDirectory, { overwrite })
            : exportLivePairComponent(group, operation.outputDirectory, mode, { overwrite });
        recordOperationResult(ledger, operation.id, groupId, {
          status: "confirmed",
          ...result,
        });
      } catch (error) {
        failed = true;
        recordOperationResult(ledger, operation.id, groupId, {
          status: "failed",
          error: error.message,
        });
      }
      persist();
    }
    transitionOperation(ledger, operation.id, failed ? "failed" : "completed");
    persist();
    return { operation: ledger.operations[operation.id], results: ledger.operations[operation.id].results };
  }

  function itemPath(id, kind) {
    const record = queue.records.get(id);
    if (!record) return null;
    return kind === "image" ? record.imagePath : kind === "movie" ? record.moviePath : null;
  }

  reset();
  return {
    state: publicState,
    reset,
    itemPath,
    pause: () => queue.pause(),
    resume: () => queue.resume(),
    cancel: () => queue.cancel(),
    retry: () => queue.retryFailed(),
    exportGroups,
  };
}

function startServer(options = {}) {
  const sourceDirectory = path.resolve(options.sourceDirectory || DEFAULT_SAMPLE_DIRECTORY);
  const port = Number(options.port || 4177);
  const manager = createManager(sourceDirectory, options);
  const root = __dirname;

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
      if (request.method === "GET" && url.pathname === "/api/state") {
        sendJson(response, 200, manager.state());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/scan") {
        sendJson(response, 200, manager.reset());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/export") {
        const body = await readJsonBody(request);
        sendJson(response, 200, manager.exportGroups(body));
        return;
      }
      if (request.method === "POST" && ["/api/pause", "/api/resume", "/api/cancel", "/api/retry"].includes(url.pathname)) {
        const action = url.pathname.slice(5);
        await manager[action]();
        sendJson(response, 200, manager.state());
        return;
      }
      const mediaMatch = /^\/media\/([a-f0-9]{16})\/(image|movie)$/.exec(url.pathname);
      if (request.method === "GET" && mediaMatch) {
        const filePath = manager.itemPath(mediaMatch[1], mediaMatch[2]);
        if (!filePath) {
          sendJson(response, 404, { error: "Unknown Live Photo component" });
          return;
        }
        serveFile(request, response, filePath, true);
        return;
      }
      const staticFiles = {
        "/": "index.html",
        "/index.html": "index.html",
        "/app.js": "app.js",
        "/styles.css": "styles.css",
        "/plugin.js": "plugin.js",
        "/logo.png": "logo.png",
      };
      if (request.method === "GET" && staticFiles[url.pathname]) {
        serveFile(request, response, path.join(root, staticFiles[url.pathname]));
        return;
      }
      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
  });

  server.listen(port, "127.0.0.1", () => {
    const boundPort = server.address().port;
    process.stdout.write(`MAX Live Photo demo: http://127.0.0.1:${boundPort}/\n`);
    process.stdout.write(`Read-only source: ${sourceDirectory}\n`);
  });
  return server;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  startServer({ sourceDirectory: args.source, port: args.port });
}

module.exports = { createManager, startServer };
