// services/products/syncProductsToDb.service.js

const mongoose = require("mongoose");

const Products = require("../../../models/product/product.model");
const Categories = require("../../../models/category/category.model");

/* ======================================================
   SMALL UTILS
====================================================== */

function toStr(v) {
  return String(v ?? "").trim();
}

function toObjIdOrNull(v) {
  const raw = v && typeof v === "object" && v._id ? v._id : v;
  const s = toStr(raw);
  return /^[a-fA-F0-9]{24}$/.test(s)
    ? new mongoose.Types.ObjectId(s)
    : null;
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePrice(value, fallbackCurrency = "SAR") {
  const amount = Number(value?.amount);
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    currency: toStr(value?.currency) || fallbackCurrency,
  };
}

function getSourceCategories(product) {
  if (Array.isArray(product?.categories) && product.categories.length) {
    return product.categories;
  }

  if (Array.isArray(product?.raw?.categories) && product.raw.categories.length) {
    return product.raw.categories;
  }

  return [];
}

function normalizeCategoryNames(cat = {}) {
  const plainName = toStr(cat?.name);
  const nameEn = toStr(cat?.nameEn) || plainName || toStr(cat?.nameAr);
  const nameAr = toStr(cat?.nameAr) || plainName || nameEn;
  const name = plainName || nameEn || nameAr;

  return {
    name,
    nameEn,
    nameAr,
  };
}

/* ======================================================
   CATEGORY RESOLUTION (AUTO CREATE + LINK)
====================================================== */

async function resolveCategoryRefs(product, storeId, provider) {
  const sourceCategories = getSourceCategories(product);
  if (!sourceCategories.length) return [];

  const resolved = [];

  for (const c of sourceCategories) {
    const providerCategoryId = toStr(c?.providerCategoryId || c?.id);
    const { name, nameEn, nameAr } = normalizeCategoryNames(c);

    let categoryId = toObjIdOrNull(c?.categoryRef);

    // 1) if explicit categoryRef exists, trust it
    if (categoryId) {
      resolved.push({
        providerCategoryId,
        name,
        nameEn,
        nameAr,
        categoryRef: categoryId,
      });
      continue;
    }

    let category = null;

    // 2) try resolve by providerCategoryId first
    if (providerCategoryId) {
      category = await Categories.findOne({
        store: storeId,
        provider,
        providerCategoryId,
      }).select("_id nameEn nameAr");

      // auto-create if missing
      if (!category) {
        category = await Categories.create({
          store: storeId,
          provider,
          providerCategoryId,
          nameEn: nameEn || name || "",
          nameAr: nameAr || nameEn || name || "",
          image: c?.image || c?.imageUrl || null,
          isActive: c?.status ? c.status === "active" : true,
        });
      }
    }

    // 3) fallback: resolve by name if no providerCategoryId
    if (!category && (nameEn || nameAr || name)) {
      const exactNameRegexes = [
        nameEn,
        nameAr,
        name,
      ]
        .map(toStr)
        .filter(Boolean)
        .map((x) => new RegExp(`^${escapeRegex(x)}$`, "i"));

      if (exactNameRegexes.length) {
        category = await Categories.findOne({
          store: storeId,
          provider,
          isActive: true,
          $or: [
            { nameEn: { $in: exactNameRegexes } },
            { nameAr: { $in: exactNameRegexes } },
          ],
        }).select("_id nameEn nameAr");
      }
    }

    resolved.push({
      providerCategoryId,
      name,
      nameEn: nameEn || toStr(category?.nameEn) || name || "",
      nameAr: nameAr || toStr(category?.nameAr) || nameEn || name || "",
      categoryRef: category?._id || null,
    });
  }

  return resolved.filter(
    (c) =>
      c.categoryRef ||
      c.providerCategoryId ||
      c.name ||
      c.nameEn ||
      c.nameAr
  );
}

/* ======================================================
   UPSERT PRODUCTS
====================================================== */

async function upsertProducts(products = []) {
  if (!Array.isArray(products) || !products.length) {
    return { inserted: 0, updated: 0, total: 0 };
  }

  let inserted = 0;
  let updated = 0;

  for (const item of products) {
    const storeId = item.store;
    const provider = toStr(item.provider);

    const categories = await resolveCategoryRefs(item, storeId, provider);

    const update = {
      store: storeId,
      provider,
      providerProductId: toStr(item.providerProductId),

      name: toStr(item.name),
      description: item.description || "",

      thumbnail: toStr(item.thumbnail),
      mainImage: toStr(item.mainImage),
      images: Array.isArray(item.images) ? item.images : [],

      price: normalizePrice(item.price),
      priceBefore: normalizePrice(item.priceBefore || item.compareAtPrice),
      salePrice: normalizePrice(item.salePrice),

      stock: Number.isFinite(Number(item.stock)) ? Number(item.stock) : 0,
      unlimited: !!item.unlimited,
      isAvailable: !!item.isAvailable,
      isActive:
        typeof item.isActive === "boolean" ? item.isActive : true,

      status: toStr(item.status) || "active",

      categories,

      sku: toStr(item.sku),
      weight: Number.isFinite(Number(item.weight)) ? Number(item.weight) : 0,
      weightUnit: toStr(item.weightUnit) || "kg",

      rating: item.rating || { count: 0, rate: 0 },
      discount: Number.isFinite(Number(item.discount)) ? Number(item.discount) : 0,

      urls: {
        admin: toStr(item?.urls?.admin),
        customer: toStr(item?.urls?.customer),
        product_card: toStr(item?.urls?.product_card),
      },

      variants: Array.isArray(item.variants) ? item.variants : [],

      raw: item.raw || null,
    };

    const result = await Products.updateOne(
      {
        store: storeId,
        provider,
        providerProductId: toStr(item.providerProductId),
      },
      { $set: update },
      { upsert: true }
    );

    if (result.upsertedCount) inserted++;
    else if (result.modifiedCount) updated++;
  }

  return {
    inserted,
    updated,
    total: products.length,
  };
}

module.exports = {
  upsertProducts,
};