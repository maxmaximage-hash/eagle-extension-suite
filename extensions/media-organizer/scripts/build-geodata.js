"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "data");
const SOURCES = {
  cities:
    "https://raw.githubusercontent.com/13Cohen/GeoToolCN/master/" +
    "GeoToolCN/data/china_city.geojson",
  provinces:
    "https://raw.githubusercontent.com/13Cohen/GeoToolCN/master/" +
    "GeoToolCN/data/china_province.geojson",
  version:
    "https://raw.githubusercontent.com/13Cohen/GeoToolCN/master/" +
    "GeoToolCN/data/DATA_VERSION.json",
  countries:
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/" +
    "geojson/ne_50m_admin_0_countries.geojson"
};

async function downloadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

function visitCoordinates(coordinates, visitor) {
  if (!Array.isArray(coordinates)) return;
  if (
    coordinates.length >= 2 &&
    Number.isFinite(coordinates[0]) &&
    Number.isFinite(coordinates[1])
  ) {
    visitor(coordinates[0], coordinates[1]);
    return;
  }
  for (const child of coordinates) visitCoordinates(child, visitor);
}

function geometryBbox(geometry) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  visitCoordinates(geometry.coordinates, (longitude, latitude) => {
    bbox[0] = Math.min(bbox[0], longitude);
    bbox[1] = Math.min(bbox[1], latitude);
    bbox[2] = Math.max(bbox[2], longitude);
    bbox[3] = Math.max(bbox[3], latitude);
  });
  return bbox;
}

function minimalFeature(feature, properties) {
  return {
    ...properties,
    bbox: feature.bbox || geometryBbox(feature.geometry),
    geometry: feature.geometry
  };
}

function writeGzipJson(fileName, value) {
  const output = zlib.gzipSync(Buffer.from(JSON.stringify(value)), { level: 9 });
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), output);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const [cities, provinces, countries, dataVersion] = await Promise.all([
    downloadJson(SOURCES.cities),
    downloadJson(SOURCES.provinces),
    downloadJson(SOURCES.countries),
    downloadJson(SOURCES.version)
  ]);

  const cityFeatures = cities.features.map((feature) =>
    minimalFeature(feature, {
      name: feature.properties.name,
      code: String(feature.properties.adcode || "")
    })
  );

  const specialCodes = new Set([
    "110000", "120000", "310000", "500000", "710000", "810000", "820000"
  ]);
  const specialFeatures = provinces.features
    .filter((feature) => specialCodes.has(String(feature.properties.adcode)))
    .map((feature) =>
      minimalFeature(feature, {
        name: feature.properties.name,
        code: String(feature.properties.adcode || "")
      })
    );

  const countryFeatures = countries.features.map((feature) =>
    minimalFeature(feature, {
      name: feature.properties.NAME_ZH || feature.properties.NAME,
      code:
        feature.properties.ISO_A2_EH ||
        feature.properties.ISO_A2 ||
        feature.properties.ADM0_A3
    })
  );

  const builtAt = new Date().toISOString();
  writeGzipJson("china-cities.json.gz", {
    version: dataVersion.fetched_at,
    builtAt,
    features: cityFeatures
  });
  writeGzipJson("china-special-regions.json.gz", {
    version: dataVersion.fetched_at,
    builtAt,
    features: specialFeatures
  });
  writeGzipJson("world-countries.json.gz", {
    version: "Natural Earth 5.1.x 1:50m",
    builtAt,
    features: countryFeatures
  });

  console.log(
    `Built ${cityFeatures.length} cities, ${specialFeatures.length} special regions, ` +
      `${countryFeatures.length} countries.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
