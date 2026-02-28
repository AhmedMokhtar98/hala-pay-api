const Categories = require("../../../models/category/category.model");
const { getProviderAdapter } = require("../..");

async function syncProviderCategories({ store }) {
  const provider = store.provider.name.toLowerCase();
  const adapter = getProviderAdapter(provider);

  if (!adapter.listCategories) {
    throw new Error("Provider does not support category listing");
  }

  const providerResp = await adapter.listCategories({
    store: store.toObject(),
  });

  const list = Array.isArray(providerResp?.result)
    ? providerResp.result
    : [];

  let inserted = 0;
  let updated = 0;

  for (const cat of list) {
    const providerCategoryId = String(cat.id);

    const update = {
      store: store._id,
      provider,
      providerCategoryId,
      nameEn: cat.name || "",
      nameAr: cat.name || "",
      image: cat.image || null,
      isActive: cat.status === "active",
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