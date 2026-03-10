#!/usr/bin/env node

require("dotenv").config();
const mongoose = require("mongoose");

const Products = require("../models/product/product.model");
const Categories = require("../models/category/category.model");

/* ======================================================
   CONFIG
====================================================== */

const MONGO_URI =
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  process.env.DB_URI ||
  process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error(
    "❌ Missing Mongo URI. Set one of: MONGO_URI, MONGODB_URI, DB_URI, DATABASE_URL"
  );
  process.exit(1);
}

/* ======================================================
   ARGS
====================================================== */

function getArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((x) => x.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const FILTER_STORE = getArg("store");
const FILTER_PROVIDER = String(getArg("provider") || "").trim().toLowerCase();
const DRY_RUN = hasFlag("dry-run");
const LIMIT = Number(getArg("limit") || 0) || 0;

/* ======================================================
   UTILS
====================================================== */

function toStr(v) {
  return String(v ?? "").trim();
}

function isObjectId(v) {
  return /^[a-fA-F0-9]{24}$/.test(toStr(v));
}

function toObjIdOrNull(v) {
  const raw = v && typeof v === "object" && v._id ? v._id : v;
  return isObjectId(raw) ? new mongoose.Types.ObjectId(toStr(raw)) : null;
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeNameTriplet({ name, nameEn, nameAr }) {
  const _name = toStr(name);
  const _nameEn = toStr(nameEn) || _name || toStr(nameAr);
  const _nameAr = toStr(nameAr) || _name || _nameEn;

  return {
    name: _name || _nameEn || _nameAr,
    nameEn: _nameEn || _nameAr || "",
    nameAr: _nameAr || _nameEn || "",
  };
}

function uniqueCategories(list = []) {
  const out = [];
  const seen = new Set();

  for (const c of list) {
    const key = [
      toStr(c?.categoryRef),
      toStr(c?.providerCategoryId),
      toStr(c?.name).toLowerCase(),
      toStr(c?.nameEn).toLowerCase(),
      toStr(c?.nameAr).toLowerCase(),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }

  return out;
}

function categoriesEqual(a = [], b = []) {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const x = a[i] || {};
    const y = b[i] || {};

    if (toStr(x.providerCategoryId) !== toStr(y.providerCategoryId)) return false;
    if (toStr(x.name) !== toStr(y.name)) return false;
    if (toStr(x.nameEn) !== toStr(y.nameEn)) return false;
    if (toStr(x.nameAr) !== toStr(y.nameAr)) return false;
    if (toStr(x.categoryRef) !== toStr(y.categoryRef)) return false;
  }

  return true;
}

/* ======================================================
   CATEGORY CACHE
====================================================== */

const categoryByIdCache = new Map();
const categoryByProviderIdCache = new Map();
const categoryByNameCache = new Map();

async function getCategoryById(id) {
  const key = toStr(id);
  if (!key) return null;
  if (categoryByIdCache.has(key)) return categoryByIdCache.get(key);

  const doc = await Categories.findById(id)
    .select("_id store provider providerCategoryId nameEn nameAr")
    .lean();

  categoryByIdCache.set(key, doc || null);
  return doc || null;
}

async function getCategoryByProviderId(storeId, provider, providerCategoryId) {
  const key = `${toStr(storeId)}|${toStr(provider)}|${toStr(providerCategoryId)}`;
  if (!toStr(providerCategoryId)) return null;
  if (categoryByProviderIdCache.has(key)) return categoryByProviderIdCache.get(key);

  const doc = await Categories.findOne({
    store: storeId,
    provider,
    providerCategoryId: toStr(providerCategoryId),
  })
    .select("_id store provider providerCategoryId nameEn nameAr")
    .lean();

  categoryByProviderIdCache.set(key, doc || null);
  return doc || null;
}

async function getCategoryByName(storeId, provider, { name, nameEn, nameAr }) {
  const names = [name, nameEn, nameAr].map(toStr).filter(Boolean);
  if (!names.length) return null;

  const key = `${toStr(storeId)}|${toStr(provider)}|${names
    .map((x) => x.toLowerCase())
    .sort()
    .join("|")}`;

  if (categoryByNameCache.has(key)) return categoryByNameCache.get(key);

  const regexes = names.map((x) => new RegExp(`^${escapeRegex(x)}$`, "i"));

  let doc = await Categories.findOne({
    store: storeId,
    provider,
    isActive: true,
    $or: [{ nameEn: { $in: regexes } }, { nameAr: { $in: regexes } }],
  })
    .select("_id store provider providerCategoryId nameEn nameAr")
    .lean();

  // relaxed fallback without provider for old manual/internal inconsistencies
  if (!doc) {
    doc = await Categories.findOne({
      store: storeId,
      isActive: true,
      $or: [{ nameEn: { $in: regexes } }, { nameAr: { $in: regexes } }],
    })
      .select("_id store provider providerCategoryId nameEn nameAr")
      .lean();
  }

  categoryByNameCache.set(key, doc || null);
  return doc || null;
}

/* ======================================================
   NORMALIZATION
====================================================== */

function getRawCategories(product) {
  return Array.isArray(product?.raw?.categories) ? product.raw.categories : [];
}

function findMatchingRawCategory(rawCats, cat) {
  const providerCategoryId = toStr(cat?.providerCategoryId || cat?.id);
  const candidateNames = [
    toStr(cat?.name),
    toStr(cat?.nameEn),
    toStr(cat?.nameAr),
  ]
    .filter(Boolean)
    .map((x) => x.toLowerCase());

  return (
    rawCats.find((r) => toStr(r?.id) === providerCategoryId) ||
    rawCats.find((r) => candidateNames.includes(toStr(r?.name).toLowerCase())) ||
    null
  );
}

async function normalizeOneCategory(cat, product, storeId, provider) {
  const rawCats = getRawCategories(product);
  const rawCat = findMatchingRawCategory(rawCats, cat);

  let providerCategoryId = toStr(cat?.providerCategoryId || rawCat?.id);
  let categoryRef = toObjIdOrNull(cat?.categoryRef);

  let linkedCategory = null;

  if (categoryRef) {
    linkedCategory = await getCategoryById(categoryRef);
  }

  if (!linkedCategory && providerCategoryId) {
    linkedCategory = await getCategoryByProviderId(storeId, provider, providerCategoryId);
  }

  const normalizedNames = normalizeNameTriplet({
    name: cat?.name || rawCat?.name || "",
    nameEn: cat?.nameEn || "",
    nameAr: cat?.nameAr || "",
  });

  if (!linkedCategory) {
    linkedCategory = await getCategoryByName(storeId, provider, normalizedNames);
  }

  if (linkedCategory && !providerCategoryId) {
    providerCategoryId = toStr(linkedCategory.providerCategoryId);
  }

  const finalNameEn =
    normalizedNames.nameEn ||
    toStr(linkedCategory?.nameEn) ||
    normalizedNames.name ||
    "";
  const finalNameAr =
    normalizedNames.nameAr ||
    toStr(linkedCategory?.nameAr) ||
    finalNameEn ||
    normalizedNames.name ||
    "";
  const finalName =
    normalizedNames.name ||
    finalNameEn ||
    finalNameAr ||
    "";

  return {
    providerCategoryId,
    name: finalName,
    nameEn: finalNameEn,
    nameAr: finalNameAr,
    categoryRef: linkedCategory?._id || categoryRef || null,
  };
}

async function buildNormalizedCategories(product) {
  const storeId = product.store;
  const provider = toStr(product.provider).toLowerCase();
  const currentCats = Array.isArray(product.categories) ? product.categories : [];
  const rawCats = getRawCategories(product);

  let sourceCats = currentCats;

  if (!sourceCats.length && rawCats.length) {
    sourceCats = rawCats.map((r) => ({
      providerCategoryId: toStr(r?.id),
      name: toStr(r?.name),
      nameEn: toStr(r?.name),
      nameAr: toStr(r?.name),
      categoryRef: null,
    }));
  }

  if (!sourceCats.length) return [];

  const normalized = [];
  for (const cat of sourceCats) {
    const fixed = await normalizeOneCategory(cat, product, storeId, provider);
    if (
      fixed.categoryRef ||
      fixed.providerCategoryId ||
      fixed.name ||
      fixed.nameEn ||
      fixed.nameAr
    ) {
      normalized.push(fixed);
    }
  }

  return uniqueCategories(normalized);
}

/* ======================================================
   MAIN
====================================================== */

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Mongo connected");

  const filter = {};
  if (FILTER_STORE && isObjectId(FILTER_STORE)) {
    filter.store = new mongoose.Types.ObjectId(FILTER_STORE);
  }
  if (FILTER_PROVIDER) {
    filter.provider = FILTER_PROVIDER;
  }

  let query = Products.find(filter).select(
    "_id store provider providerProductId categories raw"
  );

  if (LIMIT > 0) {
    query = query.limit(LIMIT);
  }

  const cursor = query.cursor();

  let scanned = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for await (const product of cursor) {
    scanned++;

    try {
      const currentCategories = Array.isArray(product.categories)
        ? product.categories.map((c) => ({
            providerCategoryId: toStr(c?.providerCategoryId),
            name: toStr(c?.name),
            nameEn: toStr(c?.nameEn),
            nameAr: toStr(c?.nameAr),
            categoryRef: c?.categoryRef || null,
          }))
        : [];

      const nextCategories = await buildNormalizedCategories(product);

      if (categoriesEqual(currentCategories, nextCategories)) {
        unchanged++;
        if (scanned % 100 === 0) {
          console.log(`... scanned=${scanned} updated=${updated} unchanged=${unchanged}`);
        }
        continue;
      }

      if (DRY_RUN) {
        console.log(`🧪 DRY-RUN would update product ${product._id}`, {
          before: currentCategories,
          after: nextCategories,
        });
        updated++;
      } else {
        await Products.updateOne(
          { _id: product._id },
          { $set: { categories: nextCategories } }
        );
        updated++;
      }

      if (scanned % 100 === 0) {
        console.log(`... scanned=${scanned} updated=${updated} unchanged=${unchanged}`);
      }
    } catch (err) {
      failed++;
      console.error(`❌ Failed product ${product._id}:`, err.message);
    }
  }

  console.log("");
  console.log("========= DONE =========");
  console.log(`scanned   : ${scanned}`);
  console.log(`updated   : ${updated}`);
  console.log(`unchanged : ${unchanged}`);
  console.log(`failed    : ${failed}`);
  console.log(`dryRun    : ${DRY_RUN ? "yes" : "no"}`);

  await mongoose.disconnect();
  console.log("✅ Mongo disconnected");
}

run().catch(async (err) => {
  console.error("❌ Migration failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});