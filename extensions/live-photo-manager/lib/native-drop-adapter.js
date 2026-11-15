"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { packageLivePair } = require("./vendor/live-package");

const IMAGE_EXTENSIONS = new Set([".heic", ".jpg", ".jpeg"]);
const MOV_EXTENSION = ".mov";

function extension(filePath) {
  return path.extname(String(filePath || "")).toLowerCase();
}

function keyFor(filePath) {
  const absolute = path.resolve(filePath);
  return `${path.dirname(absolute)}\0${path.basename(absolute, path.extname(absolute)).toLowerCase()}`;
}

function imagePriority(filePath) {
  return [".heic", ".jpeg", ".jpg"].indexOf(extension(filePath));
}

function isRegularFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function mergeMetadata(image, movie) {
  return {
    id: image.id || movie.id,
    name: path.basename(image.path, path.extname(image.path)),
    folders: [...new Set([...(image.folders || []), ...(movie.folders || [])])],
    tags: [...new Set([...(image.tags || []), ...(movie.tags || [])])],
    annotation: image.annotation || movie.annotation || "",
    website: image.website || movie.website || "",
    modificationTime: Math.min(
      Number(image.modificationTime || Date.now()),
      Number(movie.modificationTime || Date.now()),
    ),
    star: image.star ?? movie.star,
  };
}

/**
 * Collapse complete same-stem still+MOV drops into one native `.livp` file.
 * Ambiguous groups are returned untouched so Eagle keeps its original behavior.
 */
function groupLiveDropFiles(files, options = {}) {
  if (!Array.isArray(files) || files.length < 2) return { files: files || [], pairs: [] };
  const stageDirectory = options.stageDirectory || fs.mkdtempSync(path.join(os.tmpdir(), "max-live-drop-"));
  fs.mkdirSync(stageDirectory, { recursive: true });
  const groups = new Map();
  const passthrough = [];

  for (const file of files) {
    if (!file?.path || !isRegularFile(file.path)) {
      passthrough.push(file);
      continue;
    }
    const ext = extension(file.path);
    if (!IMAGE_EXTENSIONS.has(ext) && ext !== MOV_EXTENSION) {
      passthrough.push(file);
      continue;
    }
    const key = keyFor(file.path);
    if (!groups.has(key)) groups.set(key, { images: [], movies: [] });
    const group = groups.get(key);
    (IMAGE_EXTENSIONS.has(ext) ? group.images : group.movies).push(file);
  }

  const groupedFiles = [];
  const pairs = [];
  for (const group of groups.values()) {
    if (group.images.length !== 1 || group.movies.length !== 1) {
      passthrough.push(...group.images, ...group.movies);
      continue;
    }
    const image = group.images.slice().sort((a, b) => imagePriority(a.path) - imagePriority(b.path))[0];
    const movie = group.movies[0];
    const stem = path.basename(image.path, path.extname(image.path));
    const safeStageName = `${stem}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const packagePath = packageLivePair({
      stem,
      image: image.path,
      movie: movie.path,
    }, stageDirectory, { name: safeStageName });
    // The staged package name is collision-safe; Eagle's native item name is
    // supplied separately by `name: stem` below.
    const namedPackagePath = packagePath;
    const nativeFile = {
      ...mergeMetadata(image, movie),
      path: namedPackagePath,
      name: stem,
      type: "application/x-eagle-livp",
      ext: "livp",
      maxLivePair: {
        stem,
        imagePath: image.path,
        moviePath: movie.path,
        packagePath: namedPackagePath,
      },
    };
    groupedFiles.push(nativeFile);
    pairs.push(nativeFile.maxLivePair);
  }

  return { files: [...passthrough, ...groupedFiles], pairs };
}

module.exports = {
  groupLiveDropFiles,
  keyFor,
};
