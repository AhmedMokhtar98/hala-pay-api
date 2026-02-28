// scripts/migrateStoresToUnified.js
require("dotenv").config();
const mongoose = require("mongoose");
const Store = require("../models/store/store.model");

mongoose.set("strictQuery", false);

function getMongoUri() {
  return (
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.DB_URL ||
    process.env.DATABASE_URL
  );
}

function toLowerSafe(x) {
  return String(x || "").trim().toLowerCase();
}

function str(x) {
  const v = String(x ?? "").trim();
  return v;
}

async function run() {
  const uri = getMongoUri();
  if (!uri) {
    console.error(
      "❌ Missing Mongo URI. Set one of: MONGO_URI, MONGODB_URI, MONGO_URL, DB_URL, DATABASE_URL"
    );
    console.error("ℹ️ cwd:", process.cwd());
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅ Mongo connected");

  // bring all docs (or only those likely old)
  const docs = await Store.collection
    .find({})
    .project({
      businessName: 1,
      provider: 1,
      storeId: 1,
      merchant: 1,
      accessToken: 1,
      refreshToken: 1,
      scope: 1,
      tokenType: 1,
      expiresAt: 1,
      logo: 1,
      isActive: 1,
      auth: 1,
    })
    .toArray();

  console.log("Found docs:", docs.length);

  let migrated = 0;
  let skipped = 0;

  for (const d of docs) {
    const isOldProviderString = typeof d.provider === "string";
    const isNewProviderObject = d.provider && typeof d.provider === "object" && d.provider.name;

    // derive providerName & providerStoreId from any shape
    const providerName = isNewProviderObject
      ? toLowerSafe(d.provider.name)
      : toLowerSafe(d.provider);

    const providerStoreId = isNewProviderObject
      ? str(d.provider.storeId)
      : str(d.storeId);

    if (!providerName || !providerStoreId) {
      console.log("⚠️ Skip (missing provider/storeId):", d._id, {
        provider: d.provider,
        storeId: d.storeId,
      });
      skipped++;
      continue;
    }

    // -------- Step 1: Ensure provider object exists (NO unset provider here)
    // If doc already has provider object, we only patch missing fields.
    await Store.collection.updateOne(
      { _id: d._id },
      {
        $set: {
          businessName: str(d.businessName),
          provider: {
            name: providerName,
            storeId: providerStoreId,
            domain: str(d?.provider?.domain),
            merchant: d?.provider?.merchant ?? d.merchant ?? null,
          },
          auth: {
            accessToken: str(d?.auth?.accessToken || d.accessToken),
            refreshToken: str(d?.auth?.refreshToken || d.refreshToken),
            scope: str(d?.auth?.scope || d.scope),
            tokenType: str(d?.auth?.tokenType || d.tokenType || "bearer") || "bearer",
            expiresAt: d?.auth?.expiresAt || d.expiresAt || null,
            meta: d?.auth?.meta ?? null,
          },
          logo: str(d.logo),
          isActive: d.isActive !== false,
        },
      }
    );

    // -------- Step 2: Cleanup legacy fields (safe)
    // IMPORTANT: don't unset provider now because it is the new object.
    // only unset OLD fields that used to live at root.
    const unset = {};
    if (d.storeId !== undefined) unset.storeId = "";
    if (d.accessToken !== undefined) unset.accessToken = "";
    if (d.refreshToken !== undefined) unset.refreshToken = "";
    if (d.scope !== undefined) unset.scope = "";
    if (d.tokenType !== undefined) unset.tokenType = "";
    if (d.expiresAt !== undefined) unset.expiresAt = "";
    if (d.merchant !== undefined) unset.merchant = "";

    // If provider was string originally, after step1 it became object,
    // so no need to unset provider at all (and doing so would delete the new object).
    if (Object.keys(unset).length > 0) {
      await Store.collection.updateOne({ _id: d._id }, { $unset: unset });
    }

    migrated++;
  }

  console.log("✅ Migrated:", migrated, "| Skipped:", skipped);

//   Optional: create unique index after migration (run once)
  try {
    await Store.collection.createIndex(
      { "provider.name": 1, "provider.storeId": 1 },
      { unique: true }
    );
    console.log("✅ Unique index ensured: provider.name + provider.storeId");
  } catch (e) {
    console.log("⚠️ Index create skipped/failed:", e.message);
  }

  await mongoose.disconnect();
  console.log("✅ Done");
}

run().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});