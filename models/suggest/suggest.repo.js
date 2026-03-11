// models/suggest/suggest.repo.js
const productModel = require("../product/product.model");
const storeModel = require("../store/store.model");
const categoryModel = require("../category/category.model");
const {
  normalizeAssetUrl,
  normalizeFields,
} = require("../../helpers/url.helper");

const escapeRegex = (s) =>
  String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseTypes = (type) => {
  if (!type) return ["product", "store", "category"];

  const raw = Array.isArray(type) ? type.join(",") : String(type);
  const list = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const allowed = new Set(["product", "store", "category"]);
  const cleaned = [...new Set(list)].filter((t) => allowed.has(t));

  return cleaned.length ? cleaned : ["product", "store", "category"];
};

const toPosInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
};

const activeFilter = { isActive: { $ne: false } };

const scoreText = (value, needle) => {
  const text = String(value || "").trim().toLowerCase();
  const q = String(needle || "").trim().toLowerCase();

  if (!text || !q) return 0;
  if (text === q) return 120;
  if (text.startsWith(q)) return 80;
  if (text.includes(q)) return 40;
  return 0;
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
};

const cleanStr = (value) => String(value || "").trim();

const normalizeMediaArray = (value) => {
  return toArray(value)
    .map((x) => cleanStr(x))
    .filter(Boolean)
    .map((x) => normalizeAssetUrl(x));
};

const pickFirstMedia = (...values) => {
  for (const value of values) {
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      const normalized = normalizeAssetUrl(cleanStr(item));
      if (normalized) return normalized;
    }
  }
  return "";
};

const normalizeProductImages = (row = {}) => {
  const base = normalizeFields(row, ["mainImage", "thumbnail"]);

  const images = normalizeMediaArray(base.images);
  const image = pickFirstMedia(base.mainImage, base.thumbnail, images);

  return {
    ...base,
    images,
    image,
  };
};

const normalizeStoreImages = (row = {}) => {
  const base = normalizeFields(row, ["logo", "image"]);
  const image = pickFirstMedia(base.logo, base.image);

  return {
    ...base,
    image,
  };
};

const normalizeCategoryImages = (row = {}) => {
  const base = normalizeFields(row, ["image"]);
  return {
    ...base,
    image: cleanStr(base.image),
  };
};

const scoreProduct = (doc, query) => {
  const scores = [
    scoreText(doc?.name, query),
    scoreText(doc?.description, query),
    scoreText(doc?.sku, query),
    scoreText(doc?.providerProductId, query),
  ];

  for (const cat of toArray(doc?.categories)) {
    scores.push(scoreText(cat?.name, query));
    scores.push(scoreText(cat?.nameEn, query));
    scores.push(scoreText(cat?.nameAr, query));
  }

  for (const variant of toArray(doc?.variants)) {
    scores.push(scoreText(variant?.name, query));
    scores.push(scoreText(variant?.sku, query));
  }

  return Math.max(...scores, 0);
};

const scoreStore = (doc, query) => {
  return Math.max(
    scoreText(doc?.businessName, query),
    scoreText(doc?.storeId, query),
    scoreText(doc?.name, query),
    scoreText(doc?.nameEn, query),
    scoreText(doc?.nameAr, query),
    scoreText(doc?.search, query)
  );
};

const scoreCategory = (doc, query) => {
  return Math.max(
    scoreText(doc?.name, query),
    scoreText(doc?.nameEn, query),
    scoreText(doc?.nameAr, query),
    scoreText(doc?.search, query)
  );
};

exports.searchAll = async ({ q, type, limit = 12, perType = 6 }) => {
  try {
    const query = String(q || "").trim();

    if (!query) {
      return {
        success: true,
        code: 200,
        result: {
          products: [],
          stores: [],
          categories: [],
        },
      };
    }

    const rx = new RegExp(escapeRegex(query), "i");
    const types = parseTypes(type);

    const totalLimit = toPosInt(limit, 12);
    const eachLimit = toPosInt(perType, 6);
    const fetchPerType = Math.min(Math.max(eachLimit * 3, eachLimit), 30);

    const result = {
      products: [],
      stores: [],
      categories: [],
    };

    const tasks = [];

    if (types.includes("product")) {
      tasks.push(
        productModel
          .find({
            $and: [
              activeFilter,
              {
                $or: [
                  { name: rx },
                  { description: rx },
                  { sku: rx },
                  { providerProductId: rx },
                  { "categories.name": rx },
                  { "categories.nameEn": rx },
                  { "categories.nameAr": rx },
                  { "variants.name": rx },
                  { "variants.sku": rx },
                ],
              },
            ],
          })
          .limit(fetchPerType)
          .select(
            [
              "name",
              "description",
              "images",
              "mainImage",
              "thumbnail",
              "price",
              "priceBefore",
              "salePrice",
              "store",
              "provider",
              "providerProductId",
              "sku",
              "categories",
              "variants",
              "isAvailable",
              "status",
              "stock",
              "discount",
            ].join(" ")
          )
          .lean()
          .then((rows) => {
            result.products = rows
              .map((row) => {
                const normalized = normalizeProductImages(row);
                return {
                  ...normalized,
                  __score: scoreProduct(normalized, query),
                };
              })
              .filter((row) => row.__score > 0)
              .sort((a, b) => b.__score - a.__score)
              .slice(0, eachLimit)
              .map(({ __score, ...item }) => item);
          })
      );
    }

    if (types.includes("store")) {
      tasks.push(
        storeModel
          .find({
            $and: [
              activeFilter,
              {
                $or: [
                  { businessName: rx },
                  { storeId: rx },
                  { name: rx },
                  { nameEn: rx },
                  { nameAr: rx },
                  { search: rx },
                ],
              },
            ],
          })
          .limit(fetchPerType)
          .select("businessName storeId logo image name nameEn nameAr")
          .lean()
          .then((rows) => {
            result.stores = rows
              .map((row) => {
                const normalized = normalizeStoreImages(row);
                return {
                  ...normalized,
                  __score: scoreStore(normalized, query),
                };
              })
              .filter((row) => row.__score > 0)
              .sort((a, b) => b.__score - a.__score)
              .slice(0, eachLimit)
              .map(({ __score, ...item }) => item);
          })
      );
    }

    if (types.includes("category")) {
      tasks.push(
        categoryModel
          .find({
            $and: [
              activeFilter,
              {
                $or: [
                  { name: rx },
                  { nameEn: rx },
                  { nameAr: rx },
                  { search: rx },
                ],
              },
            ],
          })
          .limit(fetchPerType)
          .select("name nameEn nameAr image store providerCategoryId")
          .lean()
          .then((rows) => {
            result.categories = rows
              .map((row) => {
                const normalized = normalizeCategoryImages(row);
                return {
                  ...normalized,
                  __score: scoreCategory(normalized, query),
                };
              })
              .filter((row) => row.__score > 0)
              .sort((a, b) => b.__score - a.__score)
              .slice(0, eachLimit)
              .map(({ __score, ...item }) => item);
          })
      );
    }

    await Promise.all(tasks);

    if (totalLimit > 0) {
      const totalNow =
        result.products.length +
        result.stores.length +
        result.categories.length;

      if (totalNow > totalLimit) {
        const merged = [
          ...result.products.map((x) => ({
            ...x,
            __bucket: "products",
            __score: scoreProduct(x, query),
          })),
          ...result.stores.map((x) => ({
            ...x,
            __bucket: "stores",
            __score: scoreStore(x, query),
          })),
          ...result.categories.map((x) => ({
            ...x,
            __bucket: "categories",
            __score: scoreCategory(x, query),
          })),
        ]
          .sort((a, b) => b.__score - a.__score)
          .slice(0, totalLimit);

        result.products = merged
          .filter((x) => x.__bucket === "products")
          .map(({ __bucket, __score, ...item }) => item);

        result.stores = merged
          .filter((x) => x.__bucket === "stores")
          .map(({ __bucket, __score, ...item }) => item);

        result.categories = merged
          .filter((x) => x.__bucket === "categories")
          .map(({ __bucket, __score, ...item }) => item);
      }
    }

    return {
      success: true,
      code: 200,
      result,
    };
  } catch (e) {
    return {
      success: false,
      code: 500,
      message: "Suggest failed",
      error: e?.message,
    };
  }
};