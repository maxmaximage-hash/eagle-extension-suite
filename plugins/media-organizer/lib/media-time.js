"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const util = require("util");
const exifr = require("exifr");

const execFile = util.promisify(childProcess.execFile);

const IMAGE_EXTENSIONS = [
  "arw", "avif", "bmp", "cr2", "cr3", "dng", "gif", "heic", "heif",
  "ico", "jpeg", "jpg", "livp", "nef", "orf", "pef", "png", "psd",
  "raf", "rw2", "sr2", "srw", "svg", "tga", "tif", "tiff", "webp"
];

const VIDEO_EXTENSIONS = [
  "3g2", "3gp", "avi", "flv", "m2ts", "m4v", "mkv", "mov", "mp4",
  "mpeg", "mpg", "mts", "ogv", "rm", "rmvb", "ts", "vob", "webm", "wmv"
];

const IMAGE_EXTENSION_SET = new Set(IMAGE_EXTENSIONS);
const VIDEO_EXTENSION_SET = new Set(VIDEO_EXTENSIONS);

function timestampFromValue(value) {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;

  const normalized = value
    .trim()
    .replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function mediaTypeForExtension(extension) {
  const normalized = String(extension || "").toLowerCase();
  if (IMAGE_EXTENSION_SET.has(normalized)) return "image";
  if (VIDEO_EXTENSION_SET.has(normalized)) return "video";
  return null;
}

async function readImageTakenAt(filePath) {
  const metadata = await exifr.parse(filePath, {
    pick: [
      "DateTimeOriginal",
      "CreateDate",
      "DateCreated",
      "ModifyDate",
      "GPSDateStamp",
      "GPSTimeStamp"
    ],
    translateValues: false,
    reviveValues: true,
    mergeOutput: true
  });

  if (!metadata) return null;
  return (
    timestampFromValue(metadata.DateTimeOriginal) ||
    timestampFromValue(metadata.DateCreated) ||
    timestampFromValue(metadata.CreateDate) ||
    timestampFromValue(metadata.ModifyDate)
  );
}

function extractVideoTimestamp(probeResult) {
  const values = [];
  if (probeResult && probeResult.format && probeResult.format.tags) {
    values.push(
      probeResult.format.tags.creation_time,
      probeResult.format.tags.date,
      probeResult.format.tags.com_apple_quicktime_creationdate
    );
  }
  for (const stream of probeResult && probeResult.streams || []) {
    if (!stream.tags) continue;
    values.push(
      stream.tags.creation_time,
      stream.tags.date,
      stream.tags.com_apple_quicktime_creationdate
    );
  }

  for (const value of values) {
    const timestamp = timestampFromValue(value);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

function findFfprobe() {
  const executable = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  const candidates = [
    path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Eagle",
      "Plugins",
      "ffmpeg-mac-arm64",
      executable
    ),
    path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Eagle",
      "Plugins",
      "ffmpeg-mac-x64",
      executable
    ),
    executable
  ];

  return candidates.find((candidate) => {
    if (candidate === executable) return true;
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

async function readVideoTakenAt(filePath, ffprobePath = findFfprobe()) {
  if (!ffprobePath) return null;
  const { stdout } = await execFile(
    ffprobePath,
    [
      "-v", "error",
      "-show_entries",
      "format_tags=creation_time,date,com.apple.quicktime.creationdate:" +
        "stream_tags=creation_time,date,com.apple.quicktime.creationdate",
      "-of", "json",
      filePath
    ],
    {
      maxBuffer: 1024 * 1024,
      timeout: 15000
    }
  );
  return extractVideoTimestamp(JSON.parse(stdout));
}

async function readMediaTakenAt(filePath, extension) {
  const mediaType = mediaTypeForExtension(extension);
  if (mediaType === "image") return readImageTakenAt(filePath);
  if (mediaType === "video") return readVideoTakenAt(filePath);
  return null;
}

module.exports = {
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  extractVideoTimestamp,
  findFfprobe,
  mediaTypeForExtension,
  readMediaTakenAt,
  timestampFromValue
};
