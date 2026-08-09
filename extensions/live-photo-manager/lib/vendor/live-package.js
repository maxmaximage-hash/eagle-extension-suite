"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".heic"]);
const MOV_EXTENSION = ".mov";

function lowerExt(filePath) {
  return path.extname(filePath).toLowerCase();
}

function stableStem(filePath) {
  return path.basename(filePath, path.extname(filePath)).toLowerCase();
}

function isLiveImage(filePath) {
  return IMAGE_EXTENSIONS.has(lowerExt(filePath));
}

function isMov(filePath) {
  return lowerExt(filePath) === MOV_EXTENSION;
}

function findLivePairs(directory) {
  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  const groups = new Map();
  for (const filename of files) {
    const ext = lowerExt(filename);
    if (!IMAGE_EXTENSIONS.has(ext) && ext !== MOV_EXTENSION) continue;
    const stem = stableStem(filename);
    if (!groups.has(stem)) {
      groups.set(stem, { stem, images: [], movies: [] });
    }
    const group = groups.get(stem);
    if (IMAGE_EXTENSIONS.has(ext)) {
      group.images.push(filename);
    } else {
      group.movies.push(filename);
    }
  }

  return [...groups.values()].map((group) => {
    const image = chooseImage(group.images);
    const movie = chooseMovie(group.movies);
    const status = image && movie ? "ready" : "incomplete";
    return {
      stem: group.stem,
      image: image ? path.join(directory, image) : null,
      movie: movie ? path.join(directory, movie) : null,
      status,
      issues: [
        image ? null : "image missing",
        movie ? null : "mov missing",
        group.images.length > 1 ? `multiple images: ${group.images.join(", ")}` : null,
        group.movies.length > 1 ? `multiple movies: ${group.movies.join(", ")}` : null,
      ].filter(Boolean),
    };
  });
}

function chooseImage(images) {
  if (images.length === 0) return null;
  const priority = [".heic", ".jpeg", ".jpg"];
  return [...images].sort((left, right) => {
    return priority.indexOf(lowerExt(left)) - priority.indexOf(lowerExt(right)) || left.localeCompare(right);
  })[0];
}

function chooseMovie(movies) {
  if (movies.length === 0) return null;
  return [...movies].sort((left, right) => left.localeCompare(right))[0];
}

function imagePackageName(imagePath) {
  const ext = lowerExt(imagePath);
  if (ext === ".heic") return "image.heic";
  return "image.jpeg";
}

function safePackageStem(stem) {
  return String(stem || "live-photo")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "live-photo";
}

function safeOutputBasename(filename, fallback) {
  const cleaned = path.basename(String(filename || fallback || "live-photo"))
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback || "live-photo";
}

function zipEntries(zipPath) {
  return childProcess.execFileSync("unzip", ["-Z", "-1", zipPath], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function safeZipEntry(entry) {
  if (!entry || path.isAbsolute(entry)) return false;
  const parts = entry.split(/[\\/]+/);
  return !parts.includes("..") && !entry.endsWith("/");
}

function readPackageManifest(packagePath, entries) {
  const manifestEntry = entries.find((entry) => path.basename(entry).toLowerCase() === "manifest.json");
  if (!manifestEntry || !safeZipEntry(manifestEntry)) return null;
  try {
    return JSON.parse(childProcess.execFileSync("unzip", ["-p", packagePath, manifestEntry], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    }));
  } catch {
    return null;
  }
}

function choosePackageEntry(entries, manifest, kind) {
  const manifestName = kind === "image"
    ? manifest?.eagleCompatibility?.imageName
    : manifest?.eagleCompatibility?.movieName;
  if (manifestName) {
    const matched = entries.find((entry) => entry === manifestName || path.basename(entry) === manifestName);
    if (matched && safeZipEntry(matched)) return matched;
  }

  const expected = kind === "image" ? IMAGE_EXTENSIONS : new Set([MOV_EXTENSION]);
  return entries.find((entry) => safeZipEntry(entry) && expected.has(lowerExt(entry))) || null;
}

function extractZipEntry(packagePath, entry, outputPath, options = {}) {
  if (!safeZipEntry(entry)) {
    throw new Error(`Unsafe package entry: ${entry}`);
  }
  if (fs.existsSync(outputPath) && !options.overwrite) {
    throw new Error(`Output already exists: ${outputPath}`);
  }

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-export-"));
  try {
    childProcess.execFileSync("unzip", ["-q", packagePath, entry, "-d", tempDirectory]);
    const extractedPath = path.join(tempDirectory, entry);
    if (!fs.existsSync(extractedPath) || !fs.statSync(extractedPath).isFile()) {
      throw new Error(`Package entry was not extracted: ${entry}`);
    }
    const temporaryOutput = `${outputPath}.tmp`;
    fs.rmSync(temporaryOutput, { force: true });
    fs.copyFileSync(extractedPath, temporaryOutput);
    fs.renameSync(temporaryOutput, outputPath);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function exportLivePackageComponents(packagePath, outputDirectory, options = {}) {
  if (!packagePath || lowerExt(packagePath) !== ".livp") {
    throw new Error("A .livp package path is required");
  }
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Package does not exist: ${packagePath}`);
  }
  fs.mkdirSync(outputDirectory, { recursive: true });

  const entries = zipEntries(packagePath).filter(safeZipEntry);
  const manifest = readPackageManifest(packagePath, entries);
  const imageEntry = choosePackageEntry(entries, manifest, "image");
  const movieEntry = choosePackageEntry(entries, manifest, "movie");
  if (!imageEntry || !movieEntry) {
    throw new Error(`Package must include one image and one MOV: ${packagePath}`);
  }

  const packageStem = safePackageStem(path.basename(packagePath, path.extname(packagePath)));
  const sourceImageName = safeOutputBasename(
    manifest?.source?.image,
    `${packageStem}${path.extname(imageEntry) || ".jpg"}`,
  );
  const sourceMovieName = safeOutputBasename(
    manifest?.source?.movie,
    `${packageStem}${path.extname(movieEntry) || ".mov"}`,
  );

  const imageOutputPath = path.join(outputDirectory, sourceImageName);
  const movieOutputPath = path.join(outputDirectory, sourceMovieName);
  if (imageOutputPath === movieOutputPath) {
    throw new Error(`Image and movie output names collide for package: ${packagePath}`);
  }

  const mode = options.mode || "all";
  const outputs = {
    package: packagePath,
    manifest,
    image: null,
    movie: null,
  };
  if (mode === "all" || mode === "image") {
    extractZipEntry(packagePath, imageEntry, imageOutputPath, options);
    outputs.image = imageOutputPath;
  }
  if (mode === "all" || mode === "movie") {
    extractZipEntry(packagePath, movieEntry, movieOutputPath, options);
    outputs.movie = movieOutputPath;
  }
  return outputs;
}

function packageLivePair(pair, outputDirectory, options = {}) {
  if (!pair || !pair.image || !pair.movie) {
    throw new Error("Live pair must include image and movie paths");
  }
  fs.mkdirSync(outputDirectory, { recursive: true });
  const packageStem = safePackageStem(options.name || pair.stem);
  const outputPath = path.join(outputDirectory, `${packageStem}.livp`);
  if (fs.existsSync(outputPath) && !options.overwrite) {
    throw new Error(`Output already exists: ${outputPath}`);
  }

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "max-live-package-"));
  try {
    const imageName = imagePackageName(pair.image);
    const movieName = "motion.mov";
    const manifestName = "manifest.json";
    fs.copyFileSync(pair.image, path.join(tempDirectory, imageName));
    fs.copyFileSync(pair.movie, path.join(tempDirectory, movieName));
    fs.writeFileSync(
      path.join(tempDirectory, manifestName),
      JSON.stringify({
        format: "max-live-photo-package",
        version: 1,
        source: {
          image: path.basename(pair.image),
          movie: path.basename(pair.movie),
        },
        eagleCompatibility: {
          extension: "livp",
          imageName,
          movieName,
        },
        createdAt: new Date().toISOString(),
      }, null, 2),
      "utf8",
    );

    const temporaryOutput = `${outputPath}.tmp`;
    fs.rmSync(temporaryOutput, { force: true });
    childProcess.execFileSync("zip", [
      "-X",
      "-q",
      "-j",
      temporaryOutput,
      path.join(tempDirectory, imageName),
      path.join(tempDirectory, movieName),
      path.join(tempDirectory, manifestName),
    ]);
    fs.renameSync(temporaryOutput, outputPath);
    return outputPath;
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

module.exports = {
  IMAGE_EXTENSIONS,
  findLivePairs,
  packageLivePair,
  exportLivePackageComponents,
  isLiveImage,
  isMov,
};
