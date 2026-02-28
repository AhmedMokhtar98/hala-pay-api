// services/products/syncProductsToDb.service.js

const Products = require("../../../models/product/product.model");
const Categories = require("../../../models/category/category.model");

/* ======================================================
   CATEGORY RESOLUTION (AUTO CREATE + LINK)
====================================================== */

async function resolveCategoryRefs(product, storeId, provider) {
  if (!product.raw?.categories?.length) return [];

  const resolved = [];

  for (const c of product.raw.categories) {
    const providerCategoryId = String(c.id);

    let category = await Categories.findOne({
      store: storeId,
      provider,
      providerCategoryId,
    });

    // 🔥 Auto create if missing
    if (!category) {
      category = await Categories.create({
        store: storeId,
        provider,
        providerCategoryId,
        nameEn: c.name || "",
        nameAr: c.name || "",
        image: c.image || null,
        isActive: c.status === "active",
      });
    }

    resolved.push({
      providerCategoryId,
      name: c.name || "",
      categoryRef: category._id,
    });
  }

  return resolved;
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
    const provider = item.provider;

    const categories = await resolveCategoryRefs(
      item,
      storeId,
      provider
    );

    const update = {
      store: storeId,
      provider,
      providerProductId: String(item.providerProductId),

      name: item.name || "",
      description: item.description || "",

      thumbnail: item.thumbnail || "",
      mainImage: item.mainImage || "",
      images: item.images || [],

      price: item.price || { amount: 0, currency: "SAR" },
      compareAtPrice: item.compareAtPrice || {
        amount: 0,
        currency: "SAR",
      },
      salePrice: item.salePrice || {
        amount: 0,
        currency: "SAR",
      },

      stock: item.stock || 0,
      unlimited: !!item.unlimited,
      isAvailable: !!item.isAvailable,

      status: item.status || "active",

      categories,

      sku: item.sku || "",
      weight: item.weight || 0,
      weightUnit: item.weightUnit || "kg",

      rating: item.rating || { count: 0, rate: 0 },

      raw: item.raw || null,
      isActive: true,
    };

    const result = await Products.updateOne(
      {
        store: storeId,
        provider,
        providerProductId: String(item.providerProductId),
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