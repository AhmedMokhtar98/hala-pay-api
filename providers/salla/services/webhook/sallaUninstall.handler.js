const Stores = require("../../../../models/store/store.model");

async function handleSallaUninstall(payload) {
  const providerStoreId = String(payload?.merchant?.id || "");
  if (!providerStoreId) return;

  const store = await Stores.findOne({
    "provider.name": "salla",
    "provider.storeId": providerStoreId,
  });

  if (!store) return;

  await Stores.updateOne(
    { _id: store._id },
    {
      $set: {
        isActive: false,
        "auth.accessToken": "",
        "auth.refreshToken": "",
      },
    }
  );

  console.log("🚫 Store deactivated:", providerStoreId);
}

module.exports = { handleSallaUninstall };