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
    "priceBefore.amount",
    "salePrice.amount",
    "stock",
  ]);

  if (!allowed.has(field)) return { createdAt: -1 };
  return { [field]: dir };
}

function toStr(v) {
  return String(v ?? "").trim();
}

function normProvider(v) {
  const s = toStr(v).toLowerCase();
  if (!s || s === "all" || s === "null" || s === "undefined") return "";
  return s;
}

/**
 * Build Mongo query for unified products DB
 * Category filtering is handled ONLY in unifiedProducts.service.js
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

  if (storeObjectId && mongoose.Types.ObjectId.isValid(String(storeObjectId))) {
    query.store = new mongoose.Types.ObjectId(String(storeObjectId));
  }

  if (provider) {
    query.provider = provider;
  }

  if (status) {
    query.status = status;
  }

  const and = [];

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

  if (and.length) {
    query.$and = and;
  }

  const sort = parseSort(filters.sort || filters.orderBy);

  const projection =
    String(filters.light || "0") === "1"
      ? {
          raw: 0,
        }
      : {};

  return { query, page, limit, skip, sort, projection };
}

module.exports = { buildProductsDbQuery };