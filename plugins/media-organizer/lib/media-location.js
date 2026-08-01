"use strict";

const childProcess = require("child_process");
const util = require("util");
const exifr = require("exifr");
const { findFfprobe, mediaTypeForExtension } = require("./media-time");

const execFile = util.promisify(childProcess.execFile);

function createFfprobeUnavailableError(cause) {
  const error = new Error(
    "视频地点读取需要 ffprobe；请安装 FFmpeg，或安装 Eagle 的 ffmpeg 插件后重试"
  );
  error.code = "FFPROBE_UNAVAILABLE";
  if (cause) error.cause = cause;
  return error;
}

function normalizeLocation(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180 ||
    (lat === 0 && lon === 0)
  ) {
    return null;
  }
  return { latitude: lat, longitude: lon };
}

function parseIso6709Location(value) {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/\s+/g, "");
  const match = compact.match(
    /^([+-]\d{1,2}(?:\.\d+)?)([+-]\d{1,3}(?:\.\d+)?)(?:[+-]\d+(?:\.\d+)?)?\/?$/
  );
  if (!match) return null;
  return normalizeLocation(match[1], match[2]);
}

function locationFromTagObject(tags) {
  if (!tags || typeof tags !== "object") return null;
  const entries = Object.entries(tags);
  const normalized = Object.fromEntries(
    entries.map(([key, value]) => [String(key).toLowerCase(), value])
  );
  const locationKeys = [
    "com.apple.quicktime.location.iso6709",
    "com_apple_quicktime_location_iso6709",
    "location",
    "location-eng"
  ];
  for (const key of locationKeys) {
    const parsed = parseIso6709Location(normalized[key]);
    if (parsed) return parsed;
  }

  return normalizeLocation(
    normalized.latitude || normalized.gpslatitude,
    normalized.longitude || normalized.gpslongitude
  );
}

function extractVideoLocation(probeResult) {
  const tagObjects = [];
  if (probeResult?.format?.tags) tagObjects.push(probeResult.format.tags);
  for (const stream of probeResult?.streams || []) {
    if (stream.tags) tagObjects.push(stream.tags);
  }
  for (const tags of tagObjects) {
    const location = locationFromTagObject(tags);
    if (location) return location;
  }
  return null;
}

async function readImageLocation(filePath) {
  const location = await exifr.gps(filePath);
  return normalizeLocation(location?.latitude, location?.longitude);
}

async function readVideoLocation(filePath, ffprobePath = findFfprobe()) {
  if (!ffprobePath) throw createFfprobeUnavailableError();
  try {
    const { stdout } = await execFile(
      ffprobePath,
      [
        "-v", "error",
        "-show_entries", "format_tags:stream_tags",
        "-of", "json",
        filePath
      ],
      { maxBuffer: 1024 * 1024, timeout: 15000 }
    );
    return extractVideoLocation(JSON.parse(stdout));
  } catch (error) {
    if (error?.code === "ENOENT") throw createFfprobeUnavailableError(error);
    throw error;
  }
}

async function readMediaLocation(filePath, extension) {
  const mediaType = mediaTypeForExtension(extension);
  if (mediaType === "image") return readImageLocation(filePath);
  if (mediaType === "video") return readVideoLocation(filePath);
  return null;
}

module.exports = {
  createFfprobeUnavailableError,
  extractVideoLocation,
  locationFromTagObject,
  normalizeLocation,
  parseIso6709Location,
  readVideoLocation,
  readMediaLocation
};
