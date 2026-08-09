"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  createGeoTagService,
  locationDistributionForIds,
  statsForIds
} = require("../lib/geo-tag-service");

function createItem(id, options = {}) {
  return {
    id,
    name: options.name || id,
    ext: options.ext || "jpg",
    filePath: `/tmp/${id}.${options.ext || "jpg"}`,
    tags: [...(options.tags || [])],
    thumbnailURL: `file:///tmp/${id}.jpg`,
    saveCount: 0,
    async save() {
      this.saveCount += 1;
      return true;
    }
  };
}

(async () => {
  const pluginPath = fs.mkdtempSync(path.join(os.tmpdir(), "geo-tag-service-"));
  const old = createItem("old");
  const existing = createItem("existing", { tags: ["日本"] });
  const fresh = createItem("fresh");
  const preview = createItem("preview");
  const missingA = createItem("missing-a");
  const missingB = createItem("missing-b");
  const items = new Map([[old.id, old], [existing.id, existing]]);
  const eagle = {
    library: { path: "/test.library" },
    item: {
      async getIdsWithModifiedAt() {
        return Array.from(items.keys()).map((id) => ({ id, modifiedAt: 1 }));
      },
      async getByIds(ids) {
        return ids.map((id) => items.get(id)).filter(Boolean);
      }
    }
  };
  const locations = new Map([
    [old.filePath, { latitude: 30, longitude: 120 }],
    [fresh.filePath, { latitude: 35, longitude: 139 }],
    [preview.filePath, { latitude: 30, longitude: 120 }]
  ]);
  const service = createGeoTagService({
    eagle,
    pluginPath,
    resolver: {
      version: "test",
      labels: new Set(["杭州", "日本", "伊朗", "阿联酋"]),
      resolve(latitude) {
        return latitude === 30
          ? { status: "resolved", label: "杭州", scope: "china-city" }
          : { status: "resolved", label: "日本", scope: "country" };
      }
    },
    mediaTypeForExtension: (ext) => ext === "jpg" ? "image" : ext === "mov" ? "video" : null,
    readMediaLocation: async (filePath) => {
      if (filePath.includes("ffprobe-missing")) {
        const error = new Error("视频地点读取需要 ffprobe");
        error.code = "FFPROBE_UNAVAILABLE";
        throw error;
      }
      return locations.get(filePath) || null;
    },
    log: { warn() {} }
  });

  await service.initialize();
  assert.strictEqual(service.getSnapshot().globalEnabled, false);
  assert.strictEqual(
    service.getSnapshot().stats.total,
    0,
    "a clean install must not enumerate the existing library during initialization"
  );
  assert.strictEqual(old.saveCount, 0);
  assert.strictEqual(existing.saveCount, 0);

  await service.setGlobalEnabled(true);
  assert.strictEqual(service.getSnapshot().stats.pending, 2);
  assert.strictEqual(old.saveCount, 0, "enabling must establish a baseline, not write tags");
  assert.strictEqual(existing.saveCount, 0, "baseline items must not be auto-tagged");
  await service.poll();
  assert.strictEqual(old.saveCount, 0, "a baseline item must never be treated as new");
  assert.strictEqual(existing.saveCount, 0, "a baseline item must never be treated as new");

  await service.scanExisting();
  assert.strictEqual(old.tags.includes("杭州"), true);
  assert.strictEqual(old.saveCount, 1);
  assert.strictEqual(existing.saveCount, 0);
  assert.strictEqual(service.getSnapshot().stats.tagged, 1);
  assert.strictEqual(service.getSnapshot().stats.existing, 1);

  await service.scanCurrent([old.id, existing.id]);
  assert.deepStrictEqual(service.getSnapshot().resultLocations, [
    { tag: "日本", total: 1, suggested: 0, added: 0, existing: 1 },
    { tag: "杭州", total: 1, suggested: 0, added: 0, existing: 1 }
  ]);
  assert.deepStrictEqual(
    (await service.listResultItemsByTag("杭州")).map((item) => item.id),
    [old.id]
  );

  items.set(fresh.id, fresh);
  await service.poll();
  assert.strictEqual(fresh.tags.includes("日本"), true);
  assert.strictEqual(fresh.saveCount, 1);

  fresh.tags = [];
  await service.poll();
  assert.strictEqual(fresh.tags.length, 0, "manual removal must not be undone");

  items.set(preview.id, preview);
  await service.scanCurrent([preview.id]);
  assert.deepStrictEqual(preview.tags, [], "current-folder scan must only preview tags");
  assert.strictEqual(preview.saveCount, 0);
  assert.strictEqual(service.getSnapshot().resultStats.suggested, 1);
  assert.deepStrictEqual(service.getSnapshot().resultLocations, [
    { tag: "杭州", total: 1, suggested: 1, added: 0, existing: 0 }
  ]);
  const confirmed = await service.confirmCurrentSuggestions();
  assert.deepStrictEqual(confirmed, { processed: 1, succeeded: 1, failed: 0 });
  assert.strictEqual(preview.tags.includes("杭州"), true);
  assert.strictEqual(preview.saveCount, 1);
  assert.strictEqual(service.getSnapshot().resultStats.suggested, 0);

  items.set(missingA.id, missingA);
  items.set(missingB.id, missingB);
  await service.scanCurrent([missingA.id]);
  assert.deepStrictEqual(
    (await service.listExceptions("no_gps")).map((item) => item.id),
    [missingA.id]
  );
  await service.scanCurrent([missingB.id]);
  assert.deepStrictEqual(
    (await service.listExceptions("no_gps")).map((item) => item.id),
    [missingB.id],
    "a new current-folder scan must replace the previous result scope"
  );
  assert.strictEqual(service.getSnapshot().resultStats.noGps, 1);

  await service.retryExceptions();
  assert.deepStrictEqual(
    (await service.listExceptions("no_gps")).map((item) => item.id),
    [],
    "retry must not rescan files that clearly have no GPS metadata"
  );
  await service.markManualTags([missingB.id], "杭州");
  assert.strictEqual(service.getSnapshot().stats.existing, 2);

  const scopedLibrary = {
    records: {
      a: { status: "tagged", tag: "阿联酋" },
      b: { status: "existing", tag: "阿联酋" },
      c: { status: "existing", tag: "沙特阿拉伯" },
      d: { status: "no_gps" }
    }
  };
  assert.deepStrictEqual(locationDistributionForIds(scopedLibrary, ["a", "b", "c", "d"]), [
    { tag: "阿联酋", total: 2, suggested: 0, added: 1, existing: 1 },
    { tag: "沙特阿拉伯", total: 1, suggested: 0, added: 0, existing: 1 }
  ]);
  assert.deepStrictEqual(statsForIds(scopedLibrary, ["a", "b", "c", "d"]), {
    pending: 0,
    suggested: 0,
    tagged: 1,
    existing: 2,
    noGps: 1,
    unresolved: 0,
    unsupported: 0,
    total: 4
  });

  const wrongCountry = createItem("wrong-country", {
    tags: ["伊朗", "人物"]
  });
  items.set(wrongCountry.id, wrongCountry);
  await service.scanCurrent([wrongCountry.id, missingA.id]);
  let correction = await service.assignManualLocation([wrongCountry.id], "阿联酋");
  assert.deepStrictEqual(correction, { processed: 1, succeeded: 1, failed: 0 });
  assert.deepStrictEqual(wrongCountry.tags.sort(), ["人物", "阿联酋"].sort());
  correction = await service.assignManualLocation([missingA.id], "迪拜");
  assert.strictEqual(correction.succeeded, 1);
  assert.strictEqual(missingA.tags.includes("迪拜"), true);
  await service.scanCurrent([missingA.id]);
  assert.strictEqual(
    service.getSnapshot().resultLocations[0].tag,
    "迪拜",
    "a manual location outside the resolver label set must survive rescanning"
  );
  assert.deepStrictEqual(
    service.locationTagSuggestions(["杭州", "人物", "迪拜", "阿联酋", "杭州"]),
    ["杭州", "迪拜", "阿联酋"],
    "location picker must exclude unrelated Eagle tags"
  );

  const ffprobeMissing = createItem("ffprobe-missing", { ext: "mov" });
  items.set(ffprobeMissing.id, ffprobeMissing);
  await service.scanCurrent([ffprobeMissing.id]);
  assert.strictEqual(service.getSnapshot().resultStats.unresolved, 1);
  assert.match((await service.listExceptions("unresolved"))[0].reason, /ffprobe/);

  console.log("geo tag service tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
