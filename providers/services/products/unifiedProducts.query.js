// services/products/unifiedProducts.query.js
const mongoose = require("mongoose");
const { toPositiveInt, normalizeText } = require("../../../utils/helpers");

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function normalizeUnifiedStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  if (!s) return "";
  if (["active", "published", "sale"].includes(s)) return "active";
  if (["draft", "inactive", "hidden"].includes(s)) return "draft";
  if (["archived", "deleted"].includes(s)) return "archived";
  return s;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseSort(sortRaw) {
  const s = String(sortRaw || "-createdAt").trim();
  if (!s) return { createdAt: -1 };

  const dir = s.startsWith("-") ? -1 : 1;
  const field = s.replace(/^[+-]/, "");

  const allowed = new Set([
    "createdAt",
    "updatedAt",
    "name",
    "status",
    "price.amount",
    "compareAtPrice.amount",
    "salePrice.amount",
    "stock",
  ]);

  if (!allowed.has(field)) return { createdAt: -1 };
  return { [field]: dir };
}

/* =========================
   Multi helpers
========================= */

function toStr(v) {
  return String(v ?? "").trim();
}

function normProvider(v) {
  const s = toStr(v).toLowerCase();
  if (!s || s === "all" || s === "null" || s === "undefined") return "";
  return s;
}

function isObjectId(x) {
  const s = toStr(x);
  return mongoose.Types.ObjectId.isValid(s);
}

function parseMulti(v) {
  if (v == null) return [];

  if (Array.isArray(v)) return v.flatMap(parseMulti);

  if (typeof v === "object") {
    if (v._id) return parseMulti(v._id);
    if (v.value) return parseMulti(v.value);
    if (v.id) return parseMulti(v.id);
    return [];
  }

  const s = toStr(v);
  if (!s) return [];

  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Category condition supports:
 * - internal category ObjectId(s) => categories.categoryRef
 * - provider category id(s) => categories.providerCategoryId
 * - fallback => raw.categories.id (number|string)
 */
function buildCategoryCondition(filters = {}) {
  const rawVal =
    filters.categories ??
    filters.category ??
    filters.categoryId ??
    filters.category_id ??
    filters.categoryRef ??
    filters.categoryRefId ??
    filters.providerCategoryId;

  const vals = parseMulti(rawVal)
    .map(toStr)
    .filter((x) => {
      const s = x.toLowerCase();
      return s && s !== "all" && s !== "null" && s !== "undefined";
    });

  if (!vals.length) return null;

  const internalIds = vals
    .filter(isObjectId)
    .map((x) => new mongoose.Types.ObjectId(toStr(x)));

  const providerIds = vals.filter((x) => !isObjectId(x)).map(toStr);

  const or = [];

  if (internalIds.length) {
    or.push({ "categories.categoryRef": { $in: internalIds } });
  }

  if (providerIds.length) {
    or.push({ "categories.providerCategoryId": { $in: providerIds } });

    const mixed = providerIds.map((x) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : x;
    });

    or.push({ "raw.categories.id": { $in: mixed } });
  }

  if (!or.length) return null;
  return or.length === 1 ? or[0] : { $or: or };
}

/**
 * Build Mongo query for unified products DB
 * Supports:
 * - global mode (no storeObjectId => no store filter)
 * - provider-only mode (filters.provider)
 * - store mode (storeObjectId)
 * - categories multi filter (ObjectIds + providerCategoryId)
 */
function buildProductsDbQuery(filters = {}, storeObjectId) {
  const page = toPositiveInt(filters.page, 1);
  const limit = clampInt(
    toPositiveInt(filters.limit ?? filters.per_page ?? filters.perPage, 20),
    1,
    100
  );
  const skip = (page - 1) * limit;

  const keyword = normalizeText(filters.keyword || filters.search || filters.q);
  const status = normalizeUnifiedStatus(filters.status);

  const provider = normProvider(filters.provider);

  const query = {
    isActive: true,
  };

  // ✅ store filter ONLY if storeObjectId is provided & valid
  if (storeObjectId && mongoose.Types.ObjectId.isValid(String(storeObjectId))) {
    query.store = new mongoose.Types.ObjectId(String(storeObjectId));
  }

  // ✅ provider-only mode
  if (provider) {
    query.provider = provider;
  }

  // ✅ status
  if (status) query.status = status;

  const and = [];

  // ✅ keyword search (index-friendly-ish)
  if (keyword) {
    const rx = escapeRegex(keyword);
    and.push({
      $or: [
        { name: { $regex: rx, $options: "i" } },
        { description: { $regex: rx, $options: "i" } },
        { sku: { $regex: rx, $options: "i" } },
      ],
    });
  }

  // ✅ categories filter (supports categories=184,106 ...)
  const catCond = buildCategoryCondition(filters);
  if (catCond) and.push(catCond);

  if (and.length) query.$and = and;

  const sort = parseSort(filters.sort || filters.orderBy);

  // projection optional
  const projection =
    String(filters.light || "0") === "1"
      ? {
          raw: 0, // hide raw huge provider data
        }
      : {};

  return { query, page, limit, skip, sort, projection };
}

module.exports = { buildProductsDbQuery };