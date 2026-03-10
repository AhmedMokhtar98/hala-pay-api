// services/categories/syncCategories.service.js
const Categories = require("../../../models/category/category.model");
const { getProviderAdapter } = require("../..");

function toStr(v) {
  return String(v ?? "").trim();
}

function normalizeProviderName(v) {
  const s = toStr(v).toLowerCase();
  return s && s !== "all" ? s : "";
}

function pickProviderFromStore(store) {
  const storeObj = store?.toObject ? store.toObject() : store || {};

  if (storeObj?.provider?.name) {
    return normalizeProviderName(storeObj.provider.name);
  }

  if (Array.isArray(storeObj?.providers) && storeObj.providers.length) {
    const first = storeObj.providers.find((p) => normalizeProviderName(p?.name)) || storeObj.providers[0];
    return normalizeProviderName(first?.name);
  }

  return "";
}

async function syncProviderCategories({ store }) {
  if (!store?._id) {
    throw new Error("Store is required");
  }

  const provider = pickProviderFromStore(store);
  if (!provider) {
    throw new Error("Store provider is missing");
  }

  const adapter = getProviderAdapter(provider);

  if (!adapter.listCategories) {
    throw new Error("Provider does not support category listing");
  }

  const providerResp = await adapter.listCategories({
    store: store.toObject ? store.toObject() : store,
  });

  const list = Array.isArray(providerResp?.result) ? providerResp.result : [];

  let inserted = 0;
  let updated = 0;

  for (const cat of list) {
    const providerCategoryId = toStr(cat?.providerCategoryId || cat?.id);
    const name = toStr(cat?.name);
    const nameEn = toStr(cat?.nameEn) || name;
    const nameAr = toStr(cat?.nameAr) || name;

    // skip invalid empty categories
    if (!providerCategoryId && !nameEn && !nameAr) {
      continue;
    }

    const update = {
      store: store._id,
      provider,
      providerCategoryId,
      nameEn,
      nameAr,
      image: toStr(cat?.image) || null,
      isActive: typeof cat?.status === "string" ? cat.status === "active" : true,
    };

    const result = await Categories.updateOne(
      {
        store: store._id,
        provider,
        providerCategoryId,
      },
      { $set: update },
      { upsert: true }
    );

    if (result.upsertedCount) inserted++;
    else if (result.modifiedCount) updated++;
  }

  return {
    success: true,
    inserted,
    updated,
    total: list.length,
  };
}

module.exports = {
  syncProviderCategories,
};