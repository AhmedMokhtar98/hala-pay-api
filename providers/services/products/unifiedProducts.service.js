// services/products/unifiedProducts.service.js
const mongoose = require("mongoose");

const Stores = require("../../../models/store/store.model");
const Products = require("../../../models/product/product.model");

const { buildProductsDbQuery } = require("./unifiedProducts.query");
const { upsertProducts } = require("./syncProductsToDb.service");
const { getProviderAdapter } = require("../..");
const { NotFoundException } = require("../../../middlewares/errorHandler/exceptions");

/* ======================================================
   ENV HELPERS
====================================================== */
function envInt(name, def) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function envAllOrInt(name, defInt) {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  if (!v) return defInt;
  if (v === "all" || v === "-1") return "all";
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : defInt;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ======================================================
   BASIC UTILS
====================================================== */
function toStr(v) {
  return String(v ?? "").trim();
}

function normalizeProviderName(v) {
  const s = toStr(v).toLowerCase().trim();
  return s && s !== "all" ? s : "";
}

function isObjectId(x) {
  const s = toStr(x);
  return mongoose.Types.ObjectId.isValid(s);
}

/**
 * parseMulti supports:
 * - "id1,id2"
 * - ["id1","id2"]
 * - { _id: "..." } / { value: "..." } / { id: "..." }
 * - { categoryRef: "..." } / { categoryRef: { _id: "..." } }
 */
function parseMulti(v) {
  if (v == null) return [];

  if (Array.isArray(v)) return v.flatMap(parseMulti);

  if (typeof v === "object") {
    if (v._id) return parseMulti(v._id);
    if (v.value) return parseMulti(v.value);
    if (v.id) return parseMulti(v.id);
    if (v.categoryRef) return parseMulti(v.categoryRef);
    if (v.category) return parseMulti(v.category);
    return [];
  }

  const s = toStr(v);
  if (!s) return [];

  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/* ======================================================
   GET STORE (supports store.provider AND store.providers[])
====================================================== */
async function getStoreByProviderStoreId(providerStoreId, providerNameOptional) {
  const storeId = toStr(providerStoreId);
  if (!storeId) {
    const err = new NotFoundException("providerStoreId is required to resolve store");
    err.status = 400;
    throw err;
  }

  const providerName = providerNameOptional
    ? normalizeProviderName(providerNameOptional)
    : "";

  const q = providerName
    ? {
        isActive: true,
        $or: [
          { "provider.storeId": storeId, "provider.name": providerName },
          {
            providers: {
              $elemMatch: { storeId, name: providerName },
            },
          },
        ],
      }
    : {
        isActive: true,
        $or: [{ "provider.storeId": storeId }, { "providers.storeId": storeId }],
      };

  const store = await Stores.findOne(q);
  if (!store) {
    const err = new NotFoundException("Store not found for given providerStoreId");
    err.status = 404;
    throw err;
  }
  return store;
}

/**
 * Pick provider subdoc from store:
 * - if store.provider exists -> may use it
 * - else use store.providers[] (by name/storeId if possible)
 * returns: { providerName, providerSubdoc, storeForAdapter }
 */
function pickProviderFromStore(storeDoc, providerStoreId, providerNameFromQuery) {
  const pnameQ = providerNameFromQuery ? normalizeProviderName(providerNameFromQuery) : "";
  const pstoreId = toStr(providerStoreId);

  const storeObj = storeDoc?.toObject ? storeDoc.toObject() : storeDoc || {};
  let providerSubdoc = null;

  // 1) legacy single provider
  if (storeObj?.provider?.name) {
    const legacyName = normalizeProviderName(storeObj.provider.name);
    if (!pnameQ || pnameQ === legacyName) providerSubdoc = storeObj.provider;
  }

  // 2) multi providers[]
  if (!providerSubdoc && Array.isArray(storeObj.providers) && storeObj.providers.length) {
    if (pnameQ) {
      providerSubdoc =
        storeObj.providers.find(
          (p) =>
            normalizeProviderName(p?.name) === pnameQ &&
            (!pstoreId || toStr(p?.storeId) === pstoreId)
        ) || null;
    }

    if (!providerSubdoc && pstoreId) {
      providerSubdoc = storeObj.providers.find((p) => toStr(p?.storeId) === pstoreId) || null;
    }

    if (!providerSubdoc) providerSubdoc = storeObj.providers[0];
  }

  const providerName = normalizeProviderName(
    providerSubdoc?.name || storeObj?.provider?.name || ""
  );

  // ensure adapters always see store.provider as selected provider
  const storeForAdapter = { ...storeObj };
  if (providerSubdoc) storeForAdapter.provider = providerSubdoc;

  return { providerName, providerSubdoc, storeForAdapter };
}

/* ======================================================
   PROVIDER FILTER (for "provider only" mode)
====================================================== */
function applyProviderFilterToQuery(query, filters) {
  const providerName = normalizeProviderName(filters?.provider);
  if (!providerName) return query;

  const cond = { provider: providerName };

  if (!query || typeof query !== "object") return cond;

  if (Array.isArray(query.$and)) {
    return { ...query, $and: [...query.$and, cond] };
  }
  return { $and: [query, cond] };
}

/* ======================================================
   CATEGORY FILTERING (id OR categoryRef OR providerCategoryId)
====================================================== */
function buildCategoryCondition(filters = {}) {
  const rawVal =
    filters.category ??
    filters.categoryId ??
    filters.categoryRef ??
    filters.categoryRefId ??
    filters.providerCategoryId ??
    filters.categories; // ✅ supports categories=1840076683,1066038932

  const vals = parseMulti(rawVal)
    .map(toStr)
    .filter((x) => {
      const s = x.toLowerCase();
      return s && s !== "all" && s !== "null" && s !== "undefined";
    });

  if (!vals.length) return null;

  const internalIds = vals
    .filter(isObjectId)
    .map((x) => new mongoose.Types.ObjectId(toStr(x)));

  const providerIds = vals.filter((x) => !isObjectId(x)).map(toStr);

  const or = [];

  if (internalIds.length) {
    or.push({ "categories.categoryRef": { $in: internalIds } });
    // optional backward compat
    or.push({ category: { $in: internalIds } });
  }

  if (providerIds.length) {
    or.push({ "categories.providerCategoryId": { $in: providerIds } });

    // raw.categories.id could be string or number
    const mixed = providerIds.map((x) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : x;
    });

    or.push({ "raw.categories.id": { $in: mixed } });
  }

  if (!or.length) return null;
  return or.length === 1 ? or[0] : { $or: or };
}

function applyCategoryFilterToQuery(query, filters) {
  const cond = buildCategoryCondition(filters);
  if (!cond) return query;

  if (!query || typeof query !== "object") return cond;

  if (Array.isArray(query.$and)) {
    return { ...query, $and: [...query.$and, cond] };
  }
  return { $and: [query, cond] };
}

/**
 * If provider adapter returns raw.categories only (no normalized categories[]),
 * build normalized categories for DB upsert.
 */
function normalizeProviderCategoriesFromRaw(x) {
  const rawCats = x?.raw?.categories;
  if (!Array.isArray(rawCats) || rawCats.length === 0) return [];

  return rawCats
    .map((c) => ({
      providerCategoryId: toStr(c?.id),
      name: toStr(c?.name),
      categoryRef: null,
    }))
    .filter((c) => c.providerCategoryId || c.name);
}

/* ======================================================
   DB LIST (SAFE POPULATE + OPTIONAL GLOBAL MODE)
====================================================== */
async function listProductsFromDb({ store, filters }) {
  const storeId = store?._id || null;

  // buildProductsDbQuery SHOULD allow storeId=null and not force store filtering
  const { query, page, limit, skip, sort, projection } = buildProductsDbQuery(
    filters,
    storeId
  );

  // ✅ provider-only mode
  const q1 = applyProviderFilterToQuery(query, filters);

  // ✅ category filter
  const finalQuery = applyCategoryFilterToQuery(q1, filters);

  // ✅ include-mode projection must include these for populate + fallbacks
  const mustHave = { store: 1, categories: 1, raw: 1 };
  const finalProjection = (() => {
    if (!projection || Object.keys(projection).length === 0) return projection;

    const vals = Object.values(projection);
    const isIncludeMode = vals.some((v) => v === 1 || v === true);
    if (!isIncludeMode) return projection;

    return { ...projection, ...mustHave };
  })();

  const categoryPopulateMatch = storeId
    ? { isActive: true, store: storeId }
    : { isActive: true };

  const [items, count] = await Promise.all([
    Products.find(finalQuery)
      .select(finalProjection)
      .sort(sort)
      .skip(skip)
      .limit(limit)

      // ✅ store populate always
      .populate({
        path: "store",
        select: "businessName domain provider providers isActive",
        match: { isActive: true },
      })

      // ✅ categoryRef populate (optional) - match by store when we know store
      .populate({
        path: "categories.categoryRef",
        match: categoryPopulateMatch,
        select: "nameEn nameAr image isActive",
      })
      .lean(),

    Products.countDocuments(finalQuery),
  ]);

  const cleaned = (items || [])
    .filter((p) => p.store) // optional: remove products whose store is not active anymore
    .map((p) => {
      const cats = Array.isArray(p.categories) ? p.categories : [];
      const first = cats[0] || null;

      const catRef = first?.categoryRef || null;
      const rawCat = Array.isArray(p?.raw?.categories) ? p.raw.categories[0] : null;

      // ✅ UI-friendly "category"
      const category =
        catRef ||
        (first?.name || first?.providerCategoryId
          ? {
              _id: null,
              nameEn: first?.name || "—",
              nameAr: first?.name || "—",
              image: "",
              providerCategoryId: first?.providerCategoryId || "",
            }
          : rawCat?.name || rawCat?.id
          ? {
              _id: null,
              nameEn: toStr(rawCat?.name) || "—",
              nameAr: toStr(rawCat?.name) || "—",
              image: "",
              providerCategoryId: toStr(rawCat?.id) || "",
            }
          : null);

      const categoryName =
        catRef?.nameEn ||
        first?.name ||
        toStr(rawCat?.name) ||
        "—";

      const categoryId =
        (catRef?._id && String(catRef._id)) ||
        (first?.categoryRef && String(first.categoryRef)) ||
        "";

      return {
        ...p,
        categories: cats,
        category,
        categoryName,
        categoryId,
      };
    });

  return {
    success: true,
    code: 200,
    result: cleaned,
    count,
    page,
    limit,
  };
}

/* ======================================================
   FETCH PROVIDER PRODUCTS (PAGED)
====================================================== */
async function fetchProviderProductsPaged({ adapter, storeForAdapter, filters, maxPages, perPage }) {
  const maxRequests = envInt("PRODUCTS_SYNC_MAX_REQUESTS", 5000);
  const delayMs = envInt("PRODUCTS_SYNC_DELAY_MS", 200);

  const all = [];
  const seen = new Set();

  let page = Number(filters.page || 1) || 1;
  let reqCount = 0;

  while (true) {
    reqCount++;

    if (reqCount > maxRequests) {
      const err = new Error(`Sync aborted: exceeded maxRequests=${maxRequests}`);
      err.status = 429;
      throw err;
    }

    if (maxPages !== "all" && page > maxPages) break;

    const providerResp = await adapter.listProducts({
      store: storeForAdapter,
      filters: { ...filters, page, limit: perPage },
    });

    const list = Array.isArray(providerResp?.result) ? providerResp.result : [];
    if (!list.length) break;

    for (const item of list) {
      const pid = String(item?.providerProductId || item?.id || "");
      const key = pid
        ? `${item?.provider || storeForAdapter?.provider?.name || ""}:${pid}`
        : JSON.stringify(item);

      if (!seen.has(key)) {
        seen.add(key);
        all.push(item);
      }
    }

    if (list.length < perPage) break;

    page++;
    if (delayMs) await sleep(delayMs);
  }

  return all;
}

/* ======================================================
   MAIN ENTRY
====================================================== */
async function listUnifiedProducts({ providerStoreId, filters = {}, store: storeFromReq }) {
  const providerNameFromQuery = normalizeProviderName(filters.provider);
  const storeIdFromArg = toStr(providerStoreId);

  // ✅ GLOBAL MODE:
  // if no store middleware + no storeId query => return ALL (or provider-only filter if provided)
  const hasStoreKey = !!storeFromReq;
  const hasStoreId = !!storeIdFromArg;

  if (!hasStoreKey && !hasStoreId) {
    // no sync in global mode
    const sync = String(filters.sync || "0") === "1";
    if (sync) {
      const err = new Error("Sync requires storeId (or req.store from middleware)");
      err.status = 400;
      throw err;
    }

    // provider-only filter works via applyProviderFilterToQuery()
    const dbResp = await listProductsFromDb({ store: null, filters });
    return { ...dbResp, sync: null };
  }

  // ✅ Store mode (resolve store if middleware didn't provide it)
  const store =
    storeFromReq ||
    (await getStoreByProviderStoreId(storeIdFromArg, providerNameFromQuery || null));

  const { providerName, storeForAdapter } = pickProviderFromStore(
    store,
    storeIdFromArg,
    providerNameFromQuery || null
  );

  if (!providerName) {
    const err = new Error("Store provider is missing");
    err.status = 400;
    throw err;
  }

  const sync = String(filters.sync || "0") === "1";
  const syncPageAll = String(filters.syncPageAll || "0") === "1";
  let syncMeta = null;

  /* ======================
     SYNC IF REQUESTED
  ====================== */
  if (sync) {
    const adapter = getProviderAdapter(providerName);

    const perPage = (() => {
      const n = Number(filters.limit || filters.per_page || filters.perPage || 50);
      if (!Number.isFinite(n)) return 50;
      return Math.max(1, Math.min(100, Math.trunc(n)));
    })();

    const maxPagesDefault = envAllOrInt("PRODUCTS_SYNC_MAX_PAGES", 5);
    const maxPages = syncPageAll ? maxPagesDefault : 1;

    const fetchFilters = syncPageAll
      ? { ...filters, page: 1 }
      : { ...filters, page: Number(filters.page || 1) || 1 };

    const all = await fetchProviderProductsPaged({
      adapter,
      storeForAdapter,
      filters: fetchFilters,
      maxPages,
      perPage,
    });

    const normalized = all.map((x) => {
      const cats =
        Array.isArray(x?.categories) && x.categories.length
          ? x.categories
          : normalizeProviderCategoriesFromRaw(x);

      return {
        ...x,
        categories: cats,
        store: store._id,
        provider: providerName,
      };
    });

    const up = await upsertProducts(normalized);

    syncMeta = {
      provider: providerName,
      inserted: up.inserted,
      updated: up.updated,
      totalFetched: up.total,
      syncPageAll,
      pagesCap: maxPages,
      perPage,
    };
  }

  /* ======================
     RETURN DB DATA
  ====================== */
  // ✅ enforce provider inside filters for store-mode (so provider-only filters don't conflict)
  const effectiveFilters = { ...filters, provider: providerName };

  const dbResp = await listProductsFromDb({ store, filters: effectiveFilters });

  return {
    ...dbResp,
    sync: syncMeta,
  };
}

module.exports = {
  listUnifiedProducts,
  getStoreByProviderStoreId,
  listProductsFromDb,
};