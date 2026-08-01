"use strict";

const assert = require("assert");
const {
  createFfprobeUnavailableError,
  extractVideoLocation,
  normalizeLocation,
  parseIso6709Location,
  readVideoLocation
} = require("../lib/media-location");
const {
  createGeoResolver,
  pointInGeometry,
  shortChinaPlaceName,
  shortCountryName
} = require("../lib/geo-resolver");

assert.deepStrictEqual(parseIso6709Location("+30.274085+120.155070/"), {
  latitude: 30.274085,
  longitude: 120.15507
});
assert.deepStrictEqual(parseIso6709Location("-33.8688+151.2093+012.0/"), {
  latitude: -33.8688,
  longitude: 151.2093
});
assert.strictEqual(parseIso6709Location("not-a-location"), null);
assert.strictEqual(normalizeLocation(0, 0), null);
assert.strictEqual(normalizeLocation(91, 120), null);
assert.deepStrictEqual(
  extractVideoLocation({
    format: {
      tags: { "com.apple.quicktime.location.ISO6709": "+35.6762+139.6503/" }
    }
  }),
  { latitude: 35.6762, longitude: 139.6503 }
);

(async () => {
  await assert.rejects(
    () => readVideoLocation("/tmp/example.mov", null),
    (error) => error.code === "FFPROBE_UNAVAILABLE" && /ffprobe/.test(error.message),
    "a missing ffprobe must be a visible diagnostic rather than a silent no-GPS result"
  );
  assert.strictEqual(createFfprobeUnavailableError().code, "FFPROBE_UNAVAILABLE");
  console.log("geo video dependency diagnostics passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

assert.strictEqual(shortChinaPlaceName("杭州市"), "杭州");
assert.strictEqual(shortChinaPlaceName("阿坝藏族羌族自治州"), "阿坝");
assert.strictEqual(shortChinaPlaceName("西双版纳傣族自治州"), "西双版纳");
assert.strictEqual(shortCountryName("美利坚合众国"), "美国");

const square = {
  type: "Polygon",
  coordinates: [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]
  ]
};
assert.strictEqual(pointInGeometry(2, 2, square), true);
assert.strictEqual(pointInGeometry(5, 5, square), false);
assert.strictEqual(pointInGeometry(10, 5, square), true);

const resolver = createGeoResolver({
  cities: {
    version: "test",
    features: [{
      name: "杭州市",
      code: "330100",
      bbox: [119, 29, 121, 31],
      geometry: {
        type: "Polygon",
        coordinates: [[[119, 29], [121, 29], [121, 31], [119, 31], [119, 29]]]
      }
    }]
  },
  specialRegions: {
    features: [{
      name: "香港特别行政区",
      code: "810000",
      bbox: [113, 22, 115, 23],
      geometry: {
        type: "Polygon",
        coordinates: [[[113, 22], [115, 22], [115, 23], [113, 23], [113, 22]]]
      }
    }]
  },
  countries: {
    version: "test",
    features: [{
      name: "日本",
      code: "JP",
      bbox: [130, 30, 146, 46],
      geometry: {
        type: "Polygon",
        coordinates: [[[130, 30], [146, 30], [146, 46], [130, 46], [130, 30]]]
      }
    }]
  }
});
assert.strictEqual(resolver.resolve(30.2, 120.1).label, "杭州");
assert.strictEqual(resolver.resolve(22.4, 114.1).label, "香港");
assert.strictEqual(resolver.resolve(35.6, 139.7).label, "日本");
assert.strictEqual(resolver.resolve(-30, -100).status, "unresolved");
assert.strictEqual(resolver.labels.has("杭州"), true);

console.log("geo location tests passed");
