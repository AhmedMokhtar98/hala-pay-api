// scripts/cleanupOrphanCategories.js
/* eslint-disable no-console */
require("dotenv").config();
const mongoose = require("mongoose");

// ✅ TODO: عدّل المسارات حسب مشروعك
const CategoriesModel = require("../models/category/category.model"); // <-- عدّل
// مفيش داعي نستورد StoreModel لأننا هنستخدم $lookup على collection "stores"

mongoose.set("strictQuery", false);

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    apply: false,
    soft: false,
    batch: 500,
    limitPrint: 5,
  };

  for (const a of argv) {
    if (a === "--apply") args.apply = true;
    if (a === "--soft") args.soft = true; // بدل delete => isActive=false (اختياري)
    if (a.startsWith("--batch=")) args.batch = Number(a.split("=")[1]) || args.batch;
    if (a.startsWith("--print=")) args.limitPrint = Number(a.split("=")[1]) || args.limitPrint;
  }

  return args;
}

async function connectMongo() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL;

  if (!uri) throw new Error("Missing Mongo URI env (MONGO_URI / MONGODB_URI)");

  console.log(`🧩 Mongo: ${uri.replace(/\/\/.*:.*@/, "//****:****@")}`);
  await mongoose.connect(uri);
  console.log("✅ Mongo connected");
}

async function cleanupOrphanCategories({ apply, soft, batch, limitPrint }) {
  console.log(`🟢 MODE: ${apply ? (soft ? "SOFT(APPLY)" : "APPLY") : "DRY-RUN"}`);
  console.log(`📦 batch: ${batch}`);

  // collection name in MongoDB (Your Store model is mongoose.model("stores", ...))
  const STORES_COLLECTION = "stores";

  let lastId = null;
  let totalFound = 0;
  let totalDeletedOrDisabled = 0;

  while (true) {
    const pipeline = [
      {
        $match: {
          ...(lastId ? { _id: { $gt: lastId } } : {}),
          store: { $exists: true, $ne: null },
        },
      },
      // optional: لو store مش ObjectId عندك شيل السطر ده
      { $match: { store: { $type: "objectId" } } },

      {
        $lookup: {
          from: STORES_COLLECTION,
          localField: "store",
          foreignField: "_id",
          as: "_store",
        },
      },
      { $match: { _store: { $eq: [] } } },
      { $project: { _id: 1, store: 1, name: 1, title: 1 } },
      { $sort: { _id: 1 } },
      { $limit: batch },
    ];

    const docs = await CategoriesModel.aggregate(pipeline).allowDiskUse(true);

    if (!docs.length) break;

    // print samples
    for (let i = 0; i < Math.min(limitPrint, docs.length); i++) {
      const d = docs[i];
      console.log(
        `  • orphan category: ${String(d._id)} ref= ${String(d.store)} name=${d.name || d.title || "-"}`
      );
    }

    totalFound += docs.length;

    if (apply) {
      const ids = docs.map((d) => d._id);

      if (soft) {
        // optional soft disable
        const r = await CategoriesModel.updateMany(
          { _id: { $in: ids } },
          { $set: { isActive: false } }
        );
        totalDeletedOrDisabled += Number(r.modifiedCount ?? r.nModified ?? 0);
      } else {
        const r = await CategoriesModel.deleteMany({ _id: { $in: ids } });
        totalDeletedOrDisabled += Number(r.deletedCount || 0);
      }
    }

    lastId = docs[docs.length - 1]._id;
  }

  console.log("\n==============================");
  console.log(`✅ FINAL (${apply ? (soft ? "SOFT(APPLY)" : "APPLY") : "DRY-RUN"})`);
  console.log(`Total orphan categories found: ${totalFound}`);
  console.log(
    apply
      ? `Total orphan categories ${soft ? "disabled" : "deleted"}: ${totalDeletedOrDisabled}`
      : "Total orphan categories deleted: 0"
  );
  console.log("==============================\n");
}

async function main() {
  const args = parseArgs();
  try {
    await connectMongo();
    await cleanupOrphanCategories(args);
    process.exit(0);
  } catch (e) {
    console.error("❌ Script failed:", e);
    process.exit(1);
  }
}

main();