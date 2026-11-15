"use strict";

const fs = require("fs");
const path = require("path");
const { packageLivePair } = require("./vendor/live-package");

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isUsableNativeItem(item) {
  return Boolean(
    item &&
    String(item.ext || "").toLowerCase() === "livp" &&
    Number(item.width) > 0 &&
    Number(item.height) > 0 &&
    item.noPreview !== true,
  );
}

async function importPairAsNativeItem({
  eagle,
  pair,
  folderId,
  stageDirectory,
  confirmTimeoutMs = 20_000,
  pollIntervalMs = 250,
} = {}) {
  if (!eagle?.item?.addFromPath || !eagle?.item?.getById) {
    throw new Error("Eagle item adapter is unavailable");
  }
  if (!pair?.imagePath || !pair?.moviePath) throw new Error("A complete Live Photo pair is required");
  if (!folderId) throw new Error("A target Eagle folder is required");
  fs.mkdirSync(stageDirectory, { recursive: true });
  const packagePath = packageLivePair({
    stem: pair.stem,
    image: pair.imagePath,
    movie: pair.moviePath,
  }, stageDirectory, { name: pair.stem });

  const itemId = await eagle.item.addFromPath(packagePath, { folders: [folderId] });
  const acceptedAt = new Date().toISOString();
  const deadline = Date.now() + confirmTimeoutMs;
  let lastItem = null;
  while (Date.now() <= deadline) {
    lastItem = await eagle.item.getById(itemId);
    if (isUsableNativeItem(lastItem)) {
      return {
        status: "confirmed",
        itemId,
        packagePath,
        acceptedAt,
        confirmedAt: new Date().toISOString(),
        item: lastItem,
      };
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(`Eagle item accepted but not confirmed: ${itemId} (${path.basename(packagePath)})`);
}

module.exports = {
  importPairAsNativeItem,
  isUsableNativeItem,
};
