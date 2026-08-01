"use strict";

const fs = require("fs");
const zlib = require("zlib");

const ETHNICITY = [
  "蒙古", "回", "藏", "维吾尔", "苗", "彝", "壮", "布依", "朝鲜",
  "满", "侗", "瑶", "白", "土家", "哈尼", "哈萨克", "傣", "黎",
  "傈僳", "佤", "畲", "高山", "拉祜", "水", "东乡", "纳西", "景颇",
  "柯尔克孜", "土", "达斡尔", "仫佬", "羌", "布朗", "撒拉", "毛南",
  "仡佬", "锡伯", "阿昌", "普米", "塔吉克", "怒", "乌孜别克",
  "俄罗斯", "鄂温克", "德昂", "保安", "裕固", "京", "塔塔尔",
  "独龙", "鄂伦春", "赫哲", "门巴", "珞巴", "基诺"
].sort((a, b) => b.length - a.length);
const ETHNIC_SUFFIX = new RegExp(
  `(?:${ETHNICITY.join("|")})族?(?:(?:${ETHNICITY.join("|")})族?)*自治州$`
);

const SPECIAL_NAMES = new Map([
  ["110000", "北京"],
  ["120000", "天津"],
  ["310000", "上海"],
  ["500000", "重庆"],
  ["710000", "台湾"],
  ["810000", "香港"],
  ["820000", "澳门"]
]);

const COUNTRY_ALIASES = new Map([
  ["中华人民共和国", "中国"],
  ["中国", "中国"],
  ["香港", "香港"],
  ["澳门", "澳门"],
  ["台湾", "台湾"],
  ["美利坚合众国", "美国"],
  ["大不列颠及北爱尔兰联合王国", "英国"]
]);

function loadGzipJson(filePath) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(filePath)).toString("utf8"));
}

function shortChinaPlaceName(name) {
  let value = String(name || "").trim();
  value = value.replace(/特别行政区$/, "");
  value = value.replace(/(?:市|地区|盟|林区)$/, "");
  if (value.endsWith("自治州")) {
    value = value.replace(ETHNIC_SUFFIX, "").replace(/自治州$/, "");
  }
  return value || String(name || "").trim();
}

function shortCountryName(name) {
  const value = String(name || "").trim();
  return COUNTRY_ALIASES.get(value) || value;
}

function pointInBbox(longitude, latitude, bbox) {
  return (
    longitude >= bbox[0] &&
    longitude <= bbox[2] &&
    latitude >= bbox[1] &&
    latitude <= bbox[3]
  );
}

function pointOnSegment(x, y, ax, ay, bx, by) {
  const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
  if (Math.abs(cross) > 1e-10) return false;
  return (
    x >= Math.min(ax, bx) - 1e-10 &&
    x <= Math.max(ax, bx) + 1e-10 &&
    y >= Math.min(ay, by) - 1e-10 &&
    y <= Math.max(ay, by) + 1e-10
  );
}

function pointInRing(longitude, latitude, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    if (pointOnSegment(longitude, latitude, x, y, previousX, previousY)) {
      return true;
    }
    const intersects =
      y > latitude !== previousY > latitude &&
      longitude < ((previousX - x) * (latitude - y)) / (previousY - y) + x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(longitude, latitude, polygon) {
  if (!polygon.length || !pointInRing(longitude, latitude, polygon[0])) {
    return false;
  }
  for (let index = 1; index < polygon.length; index += 1) {
    if (pointInRing(longitude, latitude, polygon[index])) return false;
  }
  return true;
}

function pointInGeometry(longitude, latitude, geometry) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return pointInPolygon(longitude, latitude, geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) =>
      pointInPolygon(longitude, latitude, polygon)
    );
  }
  return false;
}

function findFeature(features, longitude, latitude) {
  return features.find(
    (feature) =>
      pointInBbox(longitude, latitude, feature.bbox) &&
      pointInGeometry(longitude, latitude, feature.geometry)
  );
}

function createGeoResolver({ cities, specialRegions, countries }) {
  const cityFeatures = cities.features || [];
  const specialFeatures = specialRegions.features || [];
  const countryFeatures = countries.features || [];
  const labels = new Set();

  for (const feature of cityFeatures) labels.add(shortChinaPlaceName(feature.name));
  for (const feature of specialFeatures) {
    labels.add(SPECIAL_NAMES.get(feature.code) || shortChinaPlaceName(feature.name));
  }
  for (const feature of countryFeatures) labels.add(shortCountryName(feature.name));
  labels.delete("中国");

  return {
    version: `${cities.version}|${countries.version}`,
    labels,
    resolve(latitude, longitude) {
      const lat = Number(latitude);
      const lon = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return { status: "unresolved", reason: "坐标无效" };
      }

      const special = findFeature(specialFeatures, lon, lat);
      if (special) {
        return {
          status: "resolved",
          label: SPECIAL_NAMES.get(special.code) || shortChinaPlaceName(special.name),
          scope: "china-special",
          code: special.code
        };
      }

      const city = findFeature(cityFeatures, lon, lat);
      if (city) {
        return {
          status: "resolved",
          label: shortChinaPlaceName(city.name),
          scope: "china-city",
          code: city.code
        };
      }

      const country = findFeature(countryFeatures, lon, lat);
      if (!country) return { status: "unresolved", reason: "坐标未落入国家边界" };
      const label = shortCountryName(country.name);
      if (label === "中国") {
        return { status: "unresolved", reason: "中国境内未匹配到城市" };
      }
      return {
        status: "resolved",
        label,
        scope: "country",
        code: country.code
      };
    }
  };
}

module.exports = {
  createGeoResolver,
  findFeature,
  loadGzipJson,
  pointInGeometry,
  shortChinaPlaceName,
  shortCountryName
};
