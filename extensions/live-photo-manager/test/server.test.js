"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../server");

function request(port, requestPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const requestHandle = http.request({
      hostname: "127.0.0.1",
      port,
      path: requestPath,
      method: "GET",
      headers,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    requestHandle.on("error", reject);
    requestHandle.end();
  });
}

test("serves one Live item and byte ranges without modifying its components", async () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-server-test-"));
  const image = path.join(source, "IMG_0004.JPG");
  const movie = path.join(source, "IMG_0004.MOV");
  fs.writeFileSync(image, "still-data");
  fs.writeFileSync(movie, "motion-data");
  const before = [fs.readFileSync(image), fs.readFileSync(movie)];
  const server = startServer({ sourceDirectory: source, port: "0" });

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const port = server.address().port;
    const stateResponse = await request(port, "/api/state");
    const state = JSON.parse(stateResponse.body.toString("utf8"));
    assert.equal(state.counts.total, 1);
    assert.equal(state.items.length, 1);

    const mediaResponse = await request(port, state.items[0].movieUrl, { Range: "bytes=0-5" });
    assert.equal(mediaResponse.status, 206);
    assert.equal(mediaResponse.headers["content-range"], "bytes 0-5/11");
    assert.equal(mediaResponse.body.toString("utf8"), "motion");
    assert.deepEqual([fs.readFileSync(image), fs.readFileSync(movie)], before);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(source, { recursive: true, force: true });
  }
});
