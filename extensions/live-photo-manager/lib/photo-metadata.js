"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".heic"]);

const MDLS_FIELDS = Object.freeze({
  dateTimeOriginal: "kMDItemContentCreationDate",
  make: "kMDItemAcquisitionMake",
  model: "kMDItemAcquisitionModel",
  altitude: "kMDItemAltitude",
  latitude: "kMDItemLatitude",
  longitude: "kMDItemLongitude",
  focalLength: "kMDItemFocalLength",
  focalLength35mm: "kMDItemFocalLength35mm",
  aperture: "kMDItemAperture",
  fNumber: "kMDItemFNumber",
  exposureTime: "kMDItemExposureTimeSeconds",
  iso: "kMDItemISOSpeed",
  orientation: "kMDItemOrientation",
  profile: "kMDItemProfileName",
  dpiWidth: "kMDItemResolutionWidthDPI",
  dpiHeight: "kMDItemResolutionHeightDPI",
  fileSize: "kMDItemFSSize",
  width: "kMDItemPixelWidth",
  height: "kMDItemPixelHeight",
  gpsDateStamp: "kMDItemGPSDateStamp",
  imageDirection: "kMDItemImageDirection",
  cameraOwner: "kMDItemCameraOwnerName",
  lensModel: "kMDItemLensModel",
  whiteBalance: "kMDItemWhiteBalance",
  exposureProgram: "kMDItemExposureProgram",
  exposureMode: "kMDItemExposureMode",
  flash: "kMDItemFlashOnOff",
  meteringMode: "kMDItemMeteringMode",
  sceneType: "kMDItemSceneType",
  colorSpace: "kMDItemColorSpace",
  bitsPerSample: "kMDItemBitsPerSample",
  pixelCount: "kMDItemPixelCount",
  contentType: "kMDItemContentType",
  creator: "kMDItemCreator",
});

function scalar(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === "(null)" || text === "(null)\n") return null;
  return text;
}

function numberOrNull(value) {
  const text = scalar(value);
  if (text === null) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function integerOrNull(value) {
  const numeric = numberOrNull(value);
  return numeric === null ? null : Math.trunc(numeric);
}

function parseDate(value) {
  const text = scalar(value);
  if (!text) return null;
  const exif = text.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\s*(Z|[+-]\d{2}:?\d{2}))?$/);
  const normalized = exif
    ? `${exif[1]}-${exif[2]}-${exif[3]}T${exif[4]}:${exif[5]}:${exif[6]}${exif[7] && exif[7] !== "Z" ? (exif[7].includes(":") ? exif[7] : `${exif[7].slice(0, 3)}:${exif[7].slice(3)}`) : "Z"}`
    : text;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

function parseSips(output) {
  const result = {};
  for (const line of String(output || "").split(/\r?\n/)) {
    const match = line.match(/^\s*([^:]+):\s*(.*?)\s*$/);
    if (!match) continue;
    result[match[1].trim()] = match[2].trim();
  }
  return result;
}

function defaultCommand(command, args) {
  return childProcess.execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function readStaticPhotoMetadata(imagePath, { run = defaultCommand } = {}) {
  if (!imagePath || !fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) {
    throw new Error(`Static photo is unavailable: ${imagePath || "(missing)"}`);
  }
  const ext = path.extname(imagePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) throw new Error(`Unsupported static photo: ${imagePath}`);

  let sips = {};
  try { sips = parseSips(run("sips", ["-g", "all", imagePath])); } catch {}
  const raw = {};
  for (const [key, field] of Object.entries(MDLS_FIELDS)) {
    try { raw[key] = run("mdls", ["-raw", "-name", field, "-nullMarker", "", imagePath]); } catch { raw[key] = null; }
  }
  const stat = fs.statSync(imagePath);
  const width = integerOrNull(raw.width) ?? integerOrNull(sips.pixelWidth);
  const height = integerOrNull(raw.height) ?? integerOrNull(sips.pixelHeight);
  const format = scalar(sips.format)?.toUpperCase() || (ext === ".heic" ? "HEIC" : "JPEG");
  const dateTimeOriginal = parseDate(raw.dateTimeOriginal) || parseDate(sips.creation);
  const rawMetadata = Object.fromEntries(Object.entries(raw).map(([key, value]) => [MDLS_FIELDS[key], scalar(value)]));
  return {
    schemaVersion: 1,
    sourcePath: path.resolve(imagePath),
    sourceType: "static-photo",
    ext: ext.slice(1).toUpperCase(),
    format,
    width,
    height,
    fileSize: integerOrNull(raw.fileSize) ?? stat.size,
    modifiedAt: stat.mtime.toISOString(),
    takenAt: dateTimeOriginal,
    rawMetadata,
    exif: {
      dateTimeOriginal,
      make: scalar(raw.make) || scalar(sips.make),
      model: scalar(raw.model) || scalar(sips.model),
      software: scalar(sips.software),
      aperture: numberOrNull(raw.aperture) ?? numberOrNull(raw.fNumber),
      exposureTime: numberOrNull(raw.exposureTime),
      iso: integerOrNull(raw.iso),
      focalLength: numberOrNull(raw.focalLength),
      focalLength35mm: integerOrNull(raw.focalLength35mm),
      orientation: integerOrNull(raw.orientation),
      profile: scalar(raw.profile) || scalar(sips.profile),
      dpiWidth: numberOrNull(raw.dpiWidth) ?? numberOrNull(sips.dpiWidth),
      dpiHeight: numberOrNull(raw.dpiHeight) ?? numberOrNull(sips.dpiHeight),
      gpsDateStamp: scalar(raw.gpsDateStamp),
      imageDirection: numberOrNull(raw.imageDirection),
    },
    gps: {
      latitude: numberOrNull(raw.latitude),
      longitude: numberOrNull(raw.longitude),
      altitude: numberOrNull(raw.altitude),
    },
  };
}

function createStaticPhotoProjection({ metadata, packagePath = null, imageEntry = null } = {}) {
  if (!metadata || metadata.sourceType !== "static-photo") throw new Error("Static photo metadata is required");
  return {
    sourceType: "static-photo",
    format: metadata.format,
    ext: metadata.ext,
    width: metadata.width,
    height: metadata.height,
    fileSize: metadata.fileSize,
    takenAt: metadata.takenAt,
    exif: { ...metadata.exif },
    gps: { ...metadata.gps },
    source: {
      imagePath: metadata.sourcePath,
      imageEntry: imageEntry || null,
      packagePath: packagePath || null,
      containerRole: packagePath ? "internal-only" : null,
    },
  };
}

function mergeStaticPhotoMetadata(manifest, metadata) {
  return {
    ...(manifest || {}),
    staticPhotoMetadata: metadata ? {
      ...metadata,
      sourcePath: null,
    } : manifest?.staticPhotoMetadata || null,
  };
}

module.exports = {
  IMAGE_EXTENSIONS,
  MDLS_FIELDS,
  parseDate,
  parseSips,
  readStaticPhotoMetadata,
  createStaticPhotoProjection,
  mergeStaticPhotoMetadata,
};
