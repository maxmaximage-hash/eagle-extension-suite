"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../server");

function request(port, requestPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : Buffer.from(JSON.stringify(body));
    const requestHandle = http.request({
      hostname: "127.0.0.1",
      port,
      path: requestPath,
      method: body == null ? "GET" : "POST",
      headers: payload ? {
        "Content-Type": "application/json",
        "Content-Length": payload.length,
      } : undefined,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      }));
    });
    requestHandle.on("error", reject);
    if (payload) requestHandle.write(payload);
    requestHandle.end();
  });
}

test("exports a selected Live group through the local API and records the operation", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-export-api-test-"));
  const source = path.join(root, "source");
  const output = path.join(root, "output");
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, "IMG_0005.JPG"), "still");
  fs.writeFileSync(path.join(source, "IMG_0005.MOV"), "motion");
  const server = startServer({ sourceDirectory: source, ledgerPath: path.join(root, "ledger.json"), port: "0" });

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const state = await request(server.address().port, "/api/state");
    const item = state.body.items[0];
    const response = await request(server.address().port, "/api/export", {
      groupIds: [item.id],
      outputDirectory: output,
      mode: "components",
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.operation.status, "completed");
    assert.equal(response.body.results[0].status, "confirmed");
    assert.equal(fs.existsSync(path.join(output, "IMG_0005.JPG")), true);
    assert.equal(fs.existsSync(path.join(output, "IMG_0005.MOV")), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
