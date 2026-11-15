"use strict";

const INVERTED_NATIVE_DATE_KEYS = new Set(["IMPORT", "CREATEDATE"]);

function correctNativeHostOrder(items, options = {}) {
  const invertedNativeDateKeys = new Set(["IMPORT", "CREATEDATE"]);
  const source = Array.isArray(items) ? items.slice() : [];
  const orderBy = String(options.orderBy || "").toUpperCase();
  if (!invertedNativeDateKeys.has(orderBy)) return source;
  return source.reverse();
}

module.exports = {
  INVERTED_NATIVE_DATE_KEYS,
  correctNativeHostOrder
};
