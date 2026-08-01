#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const ORIGINAL_ARCHIVE_SHA256 =
  "b04a2efdb8bc8d06910552f43f38c056e6964c8f74798e1b2849f1bffab8a1bd";

const PATCHES = [
  {
    path: "app/js/plugin/api.js",
    originalSha256:
      "2bfcbc03d912065d25ec25f38e66c053ef8ab0550a35ce3214377415dfc679a5",
    patchedSha256:
      "6a1833ed9bf3ecbf2709c5a27583be7ebd4388daf468cba1d249e64c2da3bca9",
    anchor:
      "\tonLibraryChanged: (callback) => { pluginIPC.addCallback('library-changed', callback); },\n\tapp: {",
    replacement:
      "\tonLibraryChanged: (callback) => { pluginIPC.addCallback('library-changed', callback); },\n" +
      "\tphotoTakenSort: {\n" +
      "\t\texecute: async (source) => {\n" +
      "\t\t\treturn await ipcRenderer.r2r(global?.parentID, 'photo-taken-sort.execute', source);\n" +
      "\t\t}\n" +
      "\t},\n" +
      "\tapp: {",
  },
  {
    path: "app/js/plugin/index.js",
    originalSha256:
      "0d05827316a9f7405eecd8bb43a40c6c601124555e1af7434dd92c26aa850832",
    patchedSha256:
      "7f8cda10b3ef706e3e51afd13877bae09e53ff0ab3bbd02b5203c36260a61353",
    anchor:
      "function initIPC () {\n\n\tipcRenderer.on('enable-plugin', (e, pluginId) => {",
    replacement:
      "function initIPC () {\n\n" +
      "\tipcRenderer.on('photo-taken-sort.execute', async (event, params) => {\n" +
      "\t\tlet result;\n" +
      "\t\ttry {\n" +
      "\t\t\tif (!params?.data?.startsWith('/* eagle-photo-taken-sort */')) {\n" +
      "\t\t\t\tthrow new Error('Rejected unrecognized script request.');\n" +
      "\t\t\t}\n" +
      "\t\t\tresult = await eval(params.data);\n" +
      "\t\t}\n" +
      "\t\tcatch (error) {\n" +
      "\t\t\tresult = {\n" +
      "\t\t\t\t__error: error?.stack || error?.message || String(error)\n" +
      "\t\t\t};\n" +
      "\t\t}\n" +
      "\t\tipcRenderer.sendTo(params.windowID, params.channel, result);\n" +
      "\t});\n\n" +
      "\tipcRenderer.on('enable-plugin', (e, pluginId) => {",
  },
];

function fail(message) {
  throw new Error(message);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function align4(value) {
  return (value + 3) & ~3;
}

function parseArchive(buffer) {
  if (buffer.length < 16 || buffer.readUInt32LE(0) !== 4) {
    fail("不是受支持的 ASAR 归档格式。");
  }
  const headerSize = buffer.readUInt32LE(4);
  if (headerSize < 8 || 8 + headerSize > buffer.length) {
    fail("ASAR 头部长度异常。");
  }
  const headerBuffer = buffer.subarray(8, 8 + headerSize);
  const payloadSize = headerBuffer.readUInt32LE(0);
  const jsonSize = headerBuffer.readUInt32LE(4);
  if (payloadSize + 4 !== headerSize || 8 + jsonSize > headerBuffer.length) {
    fail("ASAR 头部内容异常。");
  }
  const headerString = headerBuffer.subarray(8, 8 + jsonSize).toString("utf8");
  return {
    header: JSON.parse(headerString),
    headerString,
    headerSize,
    data: buffer.subarray(8 + headerSize),
  };
}

function getEntry(header, entryPath) {
  let current = header;
  for (const part of entryPath.split("/")) {
    current = current?.files?.[part];
    if (!current) fail(`ASAR 缺少目标文件：${entryPath}`);
  }
  if (current.unpacked || typeof current.offset !== "string") {
    fail(`目标文件不是归档内的普通文件：${entryPath}`);
  }
  return current;
}

function visitPackedEntries(node, callback, currentPath = "") {
  for (const [name, entry] of Object.entries(node.files || {})) {
    const entryPath = currentPath ? `${currentPath}/${name}` : name;
    if (entry.files) visitPackedEntries(entry, callback, entryPath);
    else if (!entry.unpacked && typeof entry.offset === "string") callback(entry, entryPath);
  }
}

function makeHeaderBuffer(headerString) {
  const json = Buffer.from(headerString, "utf8");
  const paddedJsonSize = align4(json.length);
  const payloadSize = 4 + paddedJsonSize;
  const headerBuffer = Buffer.alloc(4 + payloadSize);
  headerBuffer.writeUInt32LE(payloadSize, 0);
  headerBuffer.writeUInt32LE(json.length, 4);
  json.copy(headerBuffer, 8);
  return headerBuffer;
}

function patchArchive(source) {
  if (sha256(source) !== ORIGINAL_ARCHIVE_SHA256) {
    fail("源 app.asar 不是已审计的 Eagle 4.0.0 build 23 原版。");
  }
  const archive = parseArchive(source);
  if (JSON.stringify(archive.header) !== archive.headerString) {
    fail("ASAR 头部不是可无损重建的标准 JSON。");
  }

  const replacements = PATCHES.map((definition) => {
    const entry = getEntry(archive.header, definition.path);
    const offset = Number(entry.offset);
    const original = archive.data.subarray(offset, offset + entry.size);
    if (sha256(original) !== definition.originalSha256) {
      fail(`${definition.path} 原始指纹不匹配。`);
    }
    const text = original.toString("utf8");
    const first = text.indexOf(definition.anchor);
    if (first < 0 || text.indexOf(definition.anchor, first + 1) >= 0) {
      fail(`${definition.path} 的补丁锚点缺失或不唯一。`);
    }
    const replaced = text.replace(definition.anchor, definition.replacement);
    const patched = Buffer.from(replaced.endsWith("\n") ? replaced : `${replaced}\n`, "utf8");
    if (sha256(patched) !== definition.patchedSha256) {
      fail(`${definition.path} 补丁结果指纹不匹配。`);
    }
    return { definition, entry, offset, originalSize: entry.size, patched };
  }).sort((a, b) => a.offset - b.offset);

  for (let index = 1; index < replacements.length; index += 1) {
    const previous = replacements[index - 1];
    if (replacements[index].offset < previous.offset + previous.originalSize) {
      fail("目标文件在 ASAR 数据区发生重叠。");
    }
  }

  visitPackedEntries(archive.header, (entry, entryPath) => {
    const originalOffset = Number(entry.offset);
    const owner = replacements.find(({ definition }) => definition.path === entryPath);
    const shift = replacements.reduce(
      (total, replacement) => total + (replacement.offset < originalOffset
        ? replacement.patched.length - replacement.originalSize
        : 0),
      0,
    );
    entry.offset = String(originalOffset + shift);
    if (owner) {
      entry.size = owner.patched.length;
      delete entry.integrity;
    }
  });

  const dataParts = [];
  let cursor = 0;
  for (const replacement of replacements) {
    dataParts.push(archive.data.subarray(cursor, replacement.offset));
    dataParts.push(replacement.patched);
    cursor = replacement.offset + replacement.originalSize;
  }
  dataParts.push(archive.data.subarray(cursor));
  const data = Buffer.concat(dataParts);
  const headerBuffer = makeHeaderBuffer(JSON.stringify(archive.header));
  const sizeBuffer = Buffer.alloc(8);
  sizeBuffer.writeUInt32LE(4, 0);
  sizeBuffer.writeUInt32LE(headerBuffer.length, 4);
  return Buffer.concat([sizeBuffer, headerBuffer, data]);
}

const [sourcePath, destinationPath] = process.argv.slice(2);
if (!sourcePath || !destinationPath) {
  console.error("用法：node patch-host-bridge.mjs <原始 app.asar> <输出 app.asar>");
  process.exit(2);
}

try {
  const result = patchArchive(fs.readFileSync(sourcePath));
  fs.writeFileSync(destinationPath, result, { flag: "wx", mode: 0o644 });
  console.log(sha256(result));
} catch (error) {
  console.error(`桥接生成失败：${error.message}`);
  process.exit(1);
}
