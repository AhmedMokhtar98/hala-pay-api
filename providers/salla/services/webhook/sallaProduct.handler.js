const Stores = require("../../../../models/store/store.model");
const Products = require("../../../../models/product/product.model");

async function handleSallaProduct(payload) {
  const product = payload?.data;
  if (!product) return;

  const providerStoreId = String(payload?.merchant?.id || "");
  if (!providerStoreId) return;

  const store = await Stores.findOne({
    "provider.name": "salla",
    "provider.storeId": providerStoreId,
  });

  if (!store) return;

  await Products.updateOne(
    {
      provider: "salla",
      providerProductId: String(product.id),
    },
    {
      $set: {
        store: store._id,
        name: product.name,
        price: Number(product.price?.amount || 0),
        currency: product.price?.currency || "SAR",
        isAvailable: Boolean(product.is_available),
        raw: product,
      },
    },
    { upsert: true }
  );

  console.log("✅ Product synced:", product.id);
}

module.exports = { handleSallaProduct };