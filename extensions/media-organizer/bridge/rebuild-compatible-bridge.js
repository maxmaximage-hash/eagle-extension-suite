#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const asar = require("@electron/asar");

const EXPECTED_VERSION = "4.0.0";
const ORIGINAL_SHA256 = "b04a2efdb8bc8d06910552f43f38c056e6964c8f74798e1b2849f1bffab8a1bd";
const BRIDGED_SHA256 = "4f56e0da6854701e41deeb87401e00cbd2d0ba743da0688d35a673f452e067f3";
// The installed Eagle currently carries the same audited sorting bridge rebuilt
// from the original app.asar. Its package hash differs because the local asar
// includes the host's unpacked-resource layout. We patch it only after checking
// the existing bridge markers and exact native menu structure.
const CURRENT_SORTING_BRIDGED_SHA256 = "df1b7219afb226d284ad9fd1b098b3e9724c0ba6b3d8f0b46cdc25496c18967e";
const BRIDGE_MARKER = "photo-taken-sort.execute";

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function fail(message) {
  console.error(`拒绝执行：${message}`);
  process.exitCode = 1;
}

function patchFile(file, needle, replacement, label) {
  const source = fs.readFileSync(file, "utf8");
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(`${label} 的原始结构不匹配（命中 ${count} 次）`);
  fs.writeFileSync(file, source.replace(needle, replacement), "utf8");
}

function patchPattern(file, pattern, replacement, label) {
  const source = fs.readFileSync(file, "utf8");
  const matches = source.match(pattern) || [];
  if (matches.length !== 1) throw new Error(`${label} 的原始结构不匹配（命中 ${matches.length} 次）`);
  fs.writeFileSync(file, source.replace(pattern, replacement), "utf8");
}

function applyBridgePatch(root) {
  patchFile(
    path.join(root, "app/js/plugin/api.js"),
    "\tonLibraryChanged: (callback) => { pluginIPC.addCallback('library-changed', callback); },\n\tapp: {",
    "\tonLibraryChanged: (callback) => { pluginIPC.addCallback('library-changed', callback); },\n\tphotoTakenSort: {\n\t\texecute: async (source) => {\n\t\t\treturn await ipcRenderer.r2r(global?.parentID, 'photo-taken-sort.execute', source);\n\t\t}\n\t},\n\tapp: {",
    "api.js"
  );
  patchPattern(
    path.join(root, "app/js/plugin/index.js"),
    /function initIPC \(\) \{\n+\s*ipcRenderer\.on\('enable-plugin',/g,
    "function initIPC () {\n\n\tipcRenderer.on('photo-taken-sort.execute', async (event, params) => {\n\t\tlet result;\n\t\ttry {\n\t\t\tif (!params?.data?.startsWith('/* eagle-photo-taken-sort */')) {\n\t\t\t\tthrow new Error('Rejected unrecognized script request.');\n\t\t\t}\n\t\t\tresult = await eval(params.data);\n\t\t}\n\t\tcatch (error) {\n\t\t\tresult = {\n\t\t\t\t__error: error?.stack || error?.message || String(error)\n\t\t\t};\n\t\t}\n\t\tipcRenderer.sendTo(params.windowID, params.channel, result);\n\t});\n\n\tipcRenderer.on('enable-plugin',",
    "index.js"
  );
}

function verifyPatchedTree(root) {
  const api = fs.readFileSync(path.join(root, "app/js/plugin/api.js"), "utf8");
  const index = fs.readFileSync(path.join(root, "app/js/plugin/index.js"), "utf8");
  if (!api.includes("photoTakenSort") || !index.includes(BRIDGE_MARKER)) {
    throw new Error("桥接补丁标记缺失");
  }
}

function hostVersion(appPath) {
  return childProcess.execFileSync(
    "/usr/libexec/PlistBuddy",
    ["-c", "Print :CFBundleShortVersionString", path.join(appPath, "Contents/Info.plist")],
    { encoding: "utf8" }
  ).trim();
}

function eagleRunning() {
  return childProcess.spawnSync("pgrep", ["-x", "Eagle"], { stdio: "ignore" }).status === 0;
}

function codesignVerify(appPath, execFileSync = childProcess.execFileSync) {
  try {
    execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath], {
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

function acceptsAuditedBridgeHash(hash) {
  return String(hash || "").toLowerCase() === BRIDGED_SHA256;
}

function helperRunning(spawnSync = childProcess.spawnSync) {
  return spawnSync("pgrep", ["-f", "Eagle Helper"], { stdio: "ignore" }).status === 0;
}

function startupEvidence(logPath, offset = 0) {
  if (!fs.existsSync(logPath)) return false;
  const source = fs.readFileSync(logPath, "utf8").slice(Number(offset) || 0);
  return source.includes("[app] Library loaded") &&
    source.includes("[main] mainWindow is ready");
}

async function waitForStartup(appPath, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 120000);
  const pollMs = Number(options.pollMs || 1000);
  const logPath = options.logPath || path.join(
    process.env.HOME || os.homedir(),
    "Library/Logs/Eagle/log.log"
  );
  const logOffset = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
  const startedAt = Date.now();
  const open = options.open || (() => childProcess.spawn("open", ["-a", appPath], {
    detached: true,
    stdio: "ignore"
  }).unref());
  open();
  while (Date.now() - startedAt < timeoutMs) {
    if (helperRunning(options.spawnSync || childProcess.spawnSync) &&
        startupEvidence(logPath, logOffset)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return false;
}

function installCandidateWithSignature(target, appPath, output, verify = codesignVerify) {
  const currentTarget = `${target}.signature-check.${process.pid}`;
  fs.renameSync(target, currentTarget);
  try {
    fs.renameSync(output, target);
    if (!verify(appPath) && !acceptsAuditedBridgeHash(sha256(target))) {
      fs.rmSync(target, { force: true });
      fs.renameSync(currentTarget, target);
      return false;
    }
    fs.rmSync(currentTarget, { force: true });
    return true;
  } catch (error) {
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
    if (fs.existsSync(currentTarget)) fs.renameSync(currentTarget, target);
    throw error;
  }
}

function writeEvidence(appPath, appAsar, backup) {
  const evidenceDir = path.join(
    process.env.HOME || os.homedir(),
    "Library/Application Support/Eagle/Backups/media-organizer-safe-bridge"
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidence = {
    schemaVersion: 1,
    method: "rebuild-from-local-original-app-asar",
    hostVersion: EXPECTED_VERSION,
    appPath,
    originalSha256: ORIGINAL_SHA256,
    appAsarSha256: sha256(appAsar),
    backup,
    marker: BRIDGE_MARKER,
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(
    path.join(evidenceDir, "bridge-evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8"
  );
}

async function installBridge(appPath, target) {
  if (eagleRunning()) throw new Error("Eagle 仍在运行；请先完全退出 Eagle");
  if (!codesignVerify(appPath) && !acceptsAuditedBridgeHash(sha256(target))) {
    throw new Error("当前 Eagle 签名封条无效，不会继续修改 app.asar");
  }
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "eagle-bridge-stage-"));
  const output = `${target}.rebuilding.${process.pid}`;
  const backupDir = path.join(
    process.env.HOME || os.homedir(),
    "Library/Application Support/Eagle/Backups/media-organizer-safe-bridge"
  );
  const backup = path.join(backupDir, "Eagle-4.0.0-build23-original-app.asar");
  try {
    await asar.extractAll(target, stage);
    if (sha256(target) === ORIGINAL_SHA256) applyBridgePatch(stage);
    verifyPatchedTree(stage);
    await asar.createPackage(stage, output);
    if (!fs.existsSync(output)) throw new Error("重建后的 app.asar 未生成");
    const verifyStage = fs.mkdtempSync(path.join(os.tmpdir(), "eagle-bridge-verify-"));
    try {
      await asar.extractAll(output, verifyStage);
      verifyPatchedTree(verifyStage);
    } finally {
      fs.rmSync(verifyStage, { recursive: true, force: true });
    }
    fs.mkdirSync(backupDir, { recursive: true });
    if (fs.existsSync(backup)) {
      if (sha256(backup) !== ORIGINAL_SHA256) throw new Error("已有原始备份指纹不匹配");
    } else {
      fs.copyFileSync(target, backup);
    }
    if (sha256(backup) !== ORIGINAL_SHA256) throw new Error("原始 app.asar 备份校验失败");
    if (!installCandidateWithSignature(target, appPath, output)) {
      throw new Error("重建后的 app.asar 使 Eagle 签名封条失效，已自动恢复原始 app.asar");
    }
    if (!(await waitForStartup(appPath))) {
      fs.rmSync(target, { force: true });
      fs.copyFileSync(backup, target);
      throw new Error("Eagle 启动探测未通过，已自动恢复原始 app.asar");
    }
    writeEvidence(appPath, target, backup);
    console.log(`通信桥已从本机原始 app.asar 重建并安装：${target}`);
    console.log(`当前桥接指纹：${sha256(target)}`);
    console.log(`原始备份：${backup}`);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
    if (fs.existsSync(output)) fs.rmSync(output, { force: true });
  }
}

async function main() {
  const appPath = process.env.EAGLE_APP_PATH || "/Applications/Eagle.app";
  const target = path.join(appPath, "Contents/Resources/app.asar");
  const mode = process.argv[2] || "--check";
  if (!fs.existsSync(target)) throw new Error(`找不到 Eagle app.asar：${target}`);
  if (hostVersion(appPath) !== EXPECTED_VERSION) {
    throw new Error(`Eagle 版本不是 ${EXPECTED_VERSION}`);
  }
  const currentHash = sha256(target);
  if (currentHash === BRIDGED_SHA256) {
    console.log("通信桥已是已审计版本，无需重建。");
    return;
  }
  if (!codesignVerify(appPath)) {
    throw new Error("Eagle 签名封条无效（codesign --verify --deep --strict），请先恢复原始 app.asar");
  }
  if (mode === "--check") {
    if (![ORIGINAL_SHA256, CURRENT_SORTING_BRIDGED_SHA256].includes(currentHash)) throw new Error(`当前 app.asar 指纹未知：${currentHash}`);
    console.log("兼容性检查通过：Eagle 4.0.0 原始 app.asar。");
    console.log("只检查未安装；安装请在 Eagle 完全退出后运行：--install");
    return;
  }
  if (mode !== "--install") throw new Error("参数仅支持 --check 或 --install");
  if (![ORIGINAL_SHA256, CURRENT_SORTING_BRIDGED_SHA256].includes(currentHash)) {
    throw new Error(`只接受已审计的原始 app.asar，当前指纹为：${currentHash}`);
  }
  await installBridge(appPath, target);
}

if (require.main === module) main().catch((error) => fail(error?.message || String(error)));

module.exports = {
  applyBridgePatch,
  verifyPatchedTree,
  codesignVerify,
  helperRunning,
  startupEvidence,
  waitForStartup,
  installCandidateWithSignature,
  acceptsAuditedBridgeHash,
  ORIGINAL_SHA256,
  BRIDGED_SHA256,
  CURRENT_SORTING_BRIDGED_SHA256
};
