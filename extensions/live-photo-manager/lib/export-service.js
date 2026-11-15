"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { packageLivePair } = require("./vendor/live-package");
const { validateLivePhotoIdentity } = require("./live-photo-identity");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function assertFile(filePath, label) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`${label} is unavailable: ${filePath || "missing path"}`);
  }
}

function safeStem(value) {
  const stem = path.basename(String(value || "live-photo"));
  return stem.replace(/[\\/:*?"<>|]/g, "-").trim() || "live-photo";
}

function copyAtomic(sourcePath, targetPath, { overwrite = false } = {}) {
  assertFile(sourcePath, "Live component");
  if (fs.existsSync(targetPath) && !overwrite) {
    throw new Error(`Output already exists: ${targetPath}`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.copyFileSync(sourcePath, temporaryPath);
    fs.renameSync(temporaryPath, targetPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
  return targetPath;
}

function buildManifest(pair) {
  assertFile(pair.imagePath, "Image component");
  assertFile(pair.moviePath, "Movie component");
  if (pair.identity) {
    const validation = validateLivePhotoIdentity(pair.identity);
    if (!validation.valid) throw new Error(`Live Photo identity is invalid: ${validation.issues.join("; ")}`);
  }
  return {
    schemaVersion: 1,
    groupId: pair.id,
    identity: pair.identity || null,
    stem: pair.stem,
    components: {
      image: {
        filename: path.basename(pair.imagePath),
        bytes: fs.statSync(pair.imagePath).size,
        sha256: sha256(pair.imagePath),
      },
      movie: {
        filename: path.basename(pair.moviePath),
        bytes: fs.statSync(pair.moviePath).size,
        sha256: sha256(pair.moviePath),
      },
    },
    createdAt: new Date().toISOString(),
  };
}

function exportLivePairComponents(pair, outputDirectory, options = {}) {
  const manifest = buildManifest(pair);
  const stem = safeStem(pair.stem);
  const imageName = `${stem}${path.extname(pair.imagePath).toLowerCase() || ".jpg"}`;
  const movieName = `${stem}.MOV`;
  const manifestName = `${stem}.live-photo.json`;
  const imagePath = path.join(outputDirectory, imageName);
  const moviePath = path.join(outputDirectory, movieName);
  const manifestPath = path.join(outputDirectory, manifestName);
  if (!options.overwrite) {
    for (const target of [imagePath, moviePath, manifestPath]) {
      if (fs.existsSync(target)) throw new Error(`Output already exists: ${target}`);
    }
  }
  copyAtomic(pair.imagePath, imagePath, options);
  copyAtomic(pair.moviePath, moviePath, options);
  const manifestText = `${JSON.stringify({ ...manifest, outputs: { imageName, movieName } }, null, 2)}\n`;
  const manifestTemp = `${manifestPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(manifestTemp, manifestText, "utf8");
    fs.renameSync(manifestTemp, manifestPath);
  } finally {
    fs.rmSync(manifestTemp, { force: true });
  }
  return { imagePath, moviePath, manifestPath, manifest };
}

function exportLivePairComponent(pair, outputDirectory, kind, options = {}) {
  if (!["image", "movie"].includes(kind)) throw new Error(`Unsupported component export: ${kind}`);
  const manifest = buildManifest(pair);
  const sourcePath = kind === "image" ? pair.imagePath : pair.moviePath;
  const targetName = `${safeStem(pair.stem)}${path.extname(sourcePath).toLowerCase() || (kind === "image" ? ".jpg" : ".MOV")}`;
  const targetPath = path.join(outputDirectory, targetName);
  const outputManifest = path.join(outputDirectory, `${safeStem(pair.stem)}.${kind}.live-photo.json`);
  if (!options.overwrite && (fs.existsSync(targetPath) || fs.existsSync(outputManifest))) {
    throw new Error(`Output already exists: ${fs.existsSync(targetPath) ? targetPath : outputManifest}`);
  }
  copyAtomic(sourcePath, targetPath, options);
  const manifestText = `${JSON.stringify({ ...manifest, mode: kind, output: targetName }, null, 2)}\n`;
  const manifestTemp = `${outputManifest}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(manifestTemp, manifestText, "utf8");
    fs.renameSync(manifestTemp, outputManifest);
  } finally {
    fs.rmSync(manifestTemp, { force: true });
  }
  return { path: targetPath, manifestPath: outputManifest, manifest };
}

function exportLivePairPackage(pair, outputDirectory, options = {}) {
  assertFile(pair.imagePath, "Image component");
  assertFile(pair.moviePath, "Movie component");
  const packagePath = packageLivePair({
    stem: pair.stem,
    image: pair.imagePath,
    movie: pair.moviePath,
  }, outputDirectory, { name: safeStem(pair.stem), overwrite: options.overwrite });
  return { packagePath, manifest: buildManifest(pair) };
}

module.exports = {
  sha256,
  exportLivePairComponent,
  exportLivePairComponents,
  exportLivePairPackage,
};
