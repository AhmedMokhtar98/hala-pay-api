const mongoose = require("mongoose");

const Stores = require("../../../models/store/store.model");
const Products = require("../../../models/product/product.model");
const Categories = require("../../../models/category/category.model");

const { buildProductsDbQuery } = require("./unifiedProducts.query");
const { upsertProducts } = require("./syncProductsToDb.service");
const { getProviderAdapter } = require("../..");
const { NotFoundException } = require("../../../middlewares/errorHandler/exceptions");
const { normalizeAssetUrl, normalizeFields } = require("../../../helpers/url.helper");

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
  return /^[a-fA-F0-9]{24}$/.test(s);
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAdminRole(role) {
  const normalizedRole = String(role || "").toLowerCase().trim();
  return ["admin", "superadmin"].includes(normalizedRole);
}

function parseBooleanLike(value) {
  const s = String(value ?? "").trim().toLowerCase();

  if (!s || s === "all" || s === "null" || s === "undefined") return null;
  if (["true", "1", "yes"].includes(s)) return true;
  if (["false", "0", "no"].includes(s)) return false;

  return null;
}

function mergeAnd(query, cond) {
  if (!cond) return query || {};
  if (!query || typeof query !== "object" || !Object.keys(query).length) return cond;

  if (Array.isArray(query.$and)) {
    return { ...query, $and: [...query.$and, cond] };
  }

  return { $and: [query, cond] };
}

function impossibleQuery() {
  return { _id: { $exists: false } };
}

/**
 * parseMulti supports:
 * - "id1,id2"
 * - ["id1","id2"]
 * - { _id: "..." } / { value: "..." } / { id: "..." }
 * - { categoryRef: "..." } / { categoryRef: { _id: "..." } }
 * - { category: "..." }
 * - { name: "..." }
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
    if (v.name) return parseMulti(v.name);
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
async function getStoreByProviderStoreId(providerStoreId, providerNameOptional, role = "") {
  const storeId = toStr(providerStoreId);
  if (!storeId) {
    const err = new NotFoundException("providerStoreId is required to resolve store");
    err.status = 400;
    throw err;
  }

  const providerName = providerNameOptional
    ? normalizeProviderName(providerNameOptional)
    : "";

  const isAdmin = isAdminRole(role);

  const q = providerName
    ? {
        ...(isAdmin ? {} : { isActive: true }),
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
        ...(isAdmin ? {} : { isActive: true }),
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

  if (storeObj?.provider?.name) {
    const legacyName = normalizeProviderName(storeObj.provider.name);
    if (!pnameQ || pnameQ === legacyName) providerSubdoc = storeObj.provider;
  }

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

  const storeForAdapter = { ...storeObj };
  if (providerSubdoc) storeForAdapter.provider = providerSubdoc;

  return { providerName, providerSubdoc, storeForAdapter };
}

/* ======================================================
   PROVIDER FILTER
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
   ROLE VISIBILITY FILTERS
   - non-admin:
     * product.isActive must be true (already handled in query builder)
     * store must be active
     * category must not be inactive-only
====================================================== */
async function applyRoleVisibilityToQuery(
  query,
  { role = "", storeId = null, providerName = "" } = {}
) {
  if (isAdminRole(role)) return query;

  let storeCond = null;

  if (storeId) {
    const activeStore = await Stores.exists({
      _id: storeId,
      isActive: true,
    });

    if (!activeStore) {
      return impossibleQuery();
    }

    storeCond = { store: storeId };
  } else {
    const activeStores = await Stores.find({ isActive: true }).select("_id").lean();
    const activeStoreIds = activeStores.map((x) => x._id);

    if (!activeStoreIds.length) {
      return impossibleQuery();
    }

    storeCond = { store: { $in: activeStoreIds } };
  }

  const categoryQuery = { isActive: true };
  if (storeId) categoryQuery.store = storeId;
  if (providerName) categoryQuery.provider = providerName;

  const activeCategories = await Categories.find(categoryQuery)
    .select("_id store provider providerCategoryId")
    .lean();

  const activeCategoryIds = activeCategories.map((x) => x._id);

  const activeProviderCategoryIds = activeCategories
    .map((x) => toStr(x.providerCategoryId))
    .filter(Boolean);

  const topLevelCategoryCond = {
    $or: [
      { category: { $exists: false } },
      { category: null },
      ...(activeCategoryIds.length ? [{ category: { $in: activeCategoryIds } }] : []),
    ],
  };

  const nestedCategoryHasNoLinkedRefsCond = {
    $or: [
      { categories: { $exists: false } },
      { categories: { $size: 0 } },
      {
        categories: {
          $not: {
            $elemMatch: {
              $or: [
                { categoryRef: { $exists: true, $ne: null } },
                { providerCategoryId: { $exists: true, $nin: [null, ""] } },
              ],
            },
          },
        },
      },
    ],
  };

  const nestedCategoryActiveOr = [];

  if (activeCategoryIds.length) {
    nestedCategoryActiveOr.push({
      categories: {
        $elemMatch: {
          categoryRef: { $in: activeCategoryIds },
        },
      },
    });
  }

  if (storeId && providerName) {
    if (activeProviderCategoryIds.length) {
      nestedCategoryActiveOr.push({
        categories: {
          $elemMatch: {
            providerCategoryId: { $in: activeProviderCategoryIds },
          },
        },
      });
    }
  } else {
    const comboOr = activeCategories
      .filter((x) => toStr(x.providerCategoryId))
      .map((x) => {
        const conds = [
          { store: x.store },
          { categories: { $elemMatch: { providerCategoryId: toStr(x.providerCategoryId) } } },
        ];

        const p = normalizeProviderName(x.provider);
        if (p) conds.push({ provider: p });

        return conds.length === 1 ? conds[0] : { $and: conds };
      });

    if (comboOr.length) {
      nestedCategoryActiveOr.push({ $or: comboOr });
    }
  }

  const nestedCategoryCond = {
    $or: [nestedCategoryHasNoLinkedRefsCond, ...nestedCategoryActiveOr],
  };

  return mergeAnd(mergeAnd(query, storeCond), {
    $and: [topLevelCategoryCond, nestedCategoryCond],
  });
}
/* ======================================================
   CATEGORY FILTERING (SMART LOOSE MATCH)
   - one word   => partial contains match
   - multi word => all words must exist in the SAME category item
   - english words are token-aware, so "mens" won't match "womens"
====================================================== */
function splitSearchTerms(value) {
  const s = toStr(value)
    .replace(/[_\-./\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return [];
  return s.split(" ").map((x) => x.trim()).filter(Boolean);
}

function isLatinTerm(value) {
  return /^[a-z0-9]+$/i.test(toStr(value));
}

function regexSmart(value) {
  const term = toStr(value);
  if (!term) return /.^/;

  if (isLatinTerm(term)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(term)}([^a-z0-9]|$)`, "i");
  }

  return new RegExp(escapeRegex(term), "i");
}

function buildCategoryElemMatch(terms = []) {
  if (!terms.length) return null;

  return {
    $and: terms.map((term) => {
      const rx = regexSmart(term);
      return {
        $or: [{ name: rx }, { nameEn: rx }, { nameAr: rx }],
      };
    }),
  };
}

function buildRawCategoryElemMatch(terms = []) {
  if (!terms.length) return null;

  return {
    $and: terms.map((term) => ({
      name: regexSmart(term),
    })),
  };
}

function buildCategoryLookupQuery(terms = [], storeId = null, providerName = "") {
  if (!terms.length) return null;

  const query = {
    isActive: true,
    $and: terms.map((term) => {
      const rx = regexSmart(term);
      return {
        $or: [{ nameEn: rx }, { nameAr: rx }],
      };
    }),
  };

  if (storeId) query.store = storeId;
  if (providerName) query.provider = providerName;

  return query;
}

async function buildCategoryCondition(filters = {}, storeId = null, providerName = "") {
  const rawVal =
    filters.category ??
    filters.categoryName ??
    filters.categoryId ??
    filters.categoryRef ??
    filters.categoryRefId ??
    filters.categories;

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

  const names = vals.filter((x) => !isObjectId(x));

  const or = [];

  if (internalIds.length) {
    or.push({ "categories.categoryRef": { $in: internalIds } });
    or.push({ category: { $in: internalIds } });
  }

  for (const value of names) {
    const terms = splitSearchTerms(value);
    if (!terms.length) continue;

    const categoryElemMatch = buildCategoryElemMatch(terms);
    const rawCategoryElemMatch = buildRawCategoryElemMatch(terms);
    const categoryLookupQuery = buildCategoryLookupQuery(terms, storeId, providerName);

    if (categoryElemMatch) {
      or.push({
        categories: {
          $elemMatch: categoryElemMatch,
        },
      });
    }

    if (rawCategoryElemMatch) {
      or.push({
        "raw.categories": {
          $elemMatch: rawCategoryElemMatch,
        },
      });
    }

    if (categoryLookupQuery) {
      const matchedCategories = await Categories.find(categoryLookupQuery)
        .select("_id")
        .lean();

      const matchedCategoryIds = matchedCategories.map((c) => c._id);

      if (matchedCategoryIds.length) {
        or.push({ "categories.categoryRef": { $in: matchedCategoryIds } });
        or.push({ category: { $in: matchedCategoryIds } });
      }
    }
  }

  if (!or.length) return null;
  return or.length === 1 ? or[0] : { $or: or };
}

async function applyCategoryFilterToQuery(query, filters, storeId = null, providerName = "") {
  const cond = await buildCategoryCondition(filters, storeId, providerName);
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
    .map((c) => {
      const name = toStr(c?.name);
      return {
        providerCategoryId: toStr(c?.id),
        name,
        nameEn: name,
        nameAr: name,
        categoryRef: null,
      };
    })
    .filter((c) => c.providerCategoryId || c.name || c.nameEn || c.nameAr);
}

/* ======================================================
   NORMALIZE PRODUCT DOC
====================================================== */
function normalizeProductDoc(p) {
  if (!p) return p;

  const cats = Array.isArray(p.categories) ? p.categories : [];
  const rawCats = Array.isArray(p?.raw?.categories) ? p.raw.categories : [];

  const normalizedStore = p.store ? normalizeFields(p.store, ["logo"]) : p.store;

  const normalizedCategories = cats.map((cat) => {
    const catRef = cat?.categoryRef ? normalizeFields(cat.categoryRef, ["image"]) : null;

    const fallbackName =
      toStr(catRef?.nameEn) ||
      toStr(catRef?.nameAr) ||
      toStr(cat?.nameEn) ||
      toStr(cat?.nameAr) ||
      toStr(cat?.name) ||
      "—";

    return {
      ...cat,
      categoryRef: catRef,
      name: toStr(cat?.name) || fallbackName,
      nameEn: toStr(cat?.nameEn) || toStr(catRef?.nameEn) || fallbackName,
      nameAr:
        toStr(cat?.nameAr) ||
        toStr(catRef?.nameAr) ||
        toStr(cat?.nameEn) ||
        toStr(catRef?.nameEn) ||
        fallbackName,
    };
  });

  const firstNormalized = normalizedCategories[0] || null;
  const catRef = firstNormalized?.categoryRef || null;
  const rawCat = rawCats[0] || null;

  const category =
    catRef ||
    (firstNormalized?.nameEn ||
    firstNormalized?.nameAr ||
    firstNormalized?.name ||
    firstNormalized?.providerCategoryId
      ? {
          _id: null,
          nameEn: firstNormalized?.nameEn || firstNormalized?.name || "—",
          nameAr:
            firstNormalized?.nameAr ||
            firstNormalized?.nameEn ||
            firstNormalized?.name ||
            "—",
          image: "",
          providerCategoryId: firstNormalized?.providerCategoryId || "",
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

  const normalizedCategory = category ? normalizeFields(category, ["image"]) : category;

  const normalizedImages = Array.isArray(p.images)
    ? p.images.map((img) => normalizeAssetUrl(img))
    : p.images;

  const categoryName =
    normalizedCategory?.nameEn ||
    normalizedCategory?.nameAr ||
    firstNormalized?.nameEn ||
    firstNormalized?.nameAr ||
    firstNormalized?.name ||
    toStr(rawCat?.name) ||
    "—";

  const categoryId =
    (catRef?._id && String(catRef._id)) ||
    (firstNormalized?.categoryRef && String(firstNormalized.categoryRef)) ||
    "";

  return {
    ...p,
    store: normalizedStore,
    images: normalizedImages,
    mainImage: normalizeAssetUrl(p.mainImage),
    thumbnail: normalizeAssetUrl(p.thumbnail),
    categories: normalizedCategories,
    category: normalizedCategory,
    categoryName,
    categoryId,
  };
}

function buildStorePopulateMatch(role) {
  if (isAdminRole(role)) return undefined;
  return { isActive: true };
}

function buildCategoryPopulateMatch(role, storeId = null) {
  if (isAdminRole(role)) {
    return storeId ? { store: storeId } : undefined;
  }

  return storeId
    ? { isActive: true, store: storeId }
    : { isActive: true };
}

/* ======================================================
   DB LIST
====================================================== */
async function listProductsFromDb({ store, filters, role = "" }) {
  const storeId = store?._id || null;

  const { query, page, limit, skip, sort, projection } = buildProductsDbQuery(
    filters,
    storeId,
    role
  );

  const q1 = applyProviderFilterToQuery(query, filters);
  const providerName = normalizeProviderName(filters?.provider);
  const q2 = await applyCategoryFilterToQuery(q1, filters, storeId, providerName);

  const finalQuery = await applyRoleVisibilityToQuery(q2, {
    role,
    storeId,
    providerName,
  });

  const mustHave = { store: 1, categories: 1, raw: 1 };
  const finalProjection = (() => {
    if (!projection || Object.keys(projection).length === 0) return projection;

    const vals = Object.values(projection);
    const isIncludeMode = vals.some((v) => v === 1 || v === true);
    if (!isIncludeMode) return projection;

    return { ...projection, ...mustHave };
  })();

  const storePopulateMatch = buildStorePopulateMatch(role);
  const categoryPopulateMatch = buildCategoryPopulateMatch(role, storeId);

  const [items, count] = await Promise.all([
    Products.find(finalQuery)
      .select(finalProjection)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({
        path: "store",
        select: "businessName domain provider providers isActive logo",
        ...(storePopulateMatch ? { match: storePopulateMatch } : {}),
      })
      .populate({
        path: "categories.categoryRef",
        select: "nameEn nameAr image isActive store provider providerCategoryId",
        ...(categoryPopulateMatch ? { match: categoryPopulateMatch } : {}),
      })
      .lean(),
    Products.countDocuments(finalQuery),
  ]);

  const cleaned = (items || [])
    .filter((p) => (isAdminRole(role) ? true : !!p.store))
    .map(normalizeProductDoc);

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
   GET PRODUCT BY DB _id
====================================================== */
async function getProductFromDbById({ productId, store, filters = {}, role = "" }) {
  const id = toStr(productId);
  if (!isObjectId(id)) {
    const err = new NotFoundException("Product not found");
    err.status = 404;
    throw err;
  }

  const storeId = store?._id || null;
  const providerName = normalizeProviderName(filters?.provider);
  const isAdmin = isAdminRole(role);
  const requestedIsActive = parseBooleanLike(filters.isActive);

  let query = {
    _id: new mongoose.Types.ObjectId(id),
  };

  if (storeId) query.store = storeId;
  if (providerName) query.provider = providerName;

  if (isAdmin) {
    if (requestedIsActive !== null) {
      query.isActive = requestedIsActive;
    }
  } else {
    query.isActive = true;
  }

  query = await applyRoleVisibilityToQuery(query, {
    role,
    storeId,
    providerName,
  });

  const storePopulateMatch = buildStorePopulateMatch(role);
  const categoryPopulateMatch = buildCategoryPopulateMatch(role, storeId);

  const doc = await Products.findOne(query)
    .populate({
      path: "store",
      select: "businessName domain provider providers isActive logo",
      ...(storePopulateMatch ? { match: storePopulateMatch } : {}),
    })
    .populate({
      path: "categories.categoryRef",
      select: "nameEn nameAr image isActive store provider providerCategoryId",
      ...(categoryPopulateMatch ? { match: categoryPopulateMatch } : {}),
    })
    .lean();

  if (!doc || (!isAdmin && !doc.store)) {
    const err = new NotFoundException("Product not found");
    err.status = 404;
    throw err;
  }

  return {
    success: true,
    code: 200,
    result: normalizeProductDoc(doc),
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
   MAIN ENTRY - LIST
====================================================== */
async function listUnifiedProducts({
  providerStoreId,
  filters = {},
  store: storeFromReq,
  role = "",
}) {
  const providerNameFromQuery = normalizeProviderName(filters.provider);
  const storeIdFromArg = toStr(providerStoreId);

  const hasStoreKey = !!storeFromReq;
  const hasStoreId = !!storeIdFromArg;

  if (!hasStoreKey && !hasStoreId) {
    const sync = String(filters.sync || "0") === "1";
    if (sync) {
      const err = new Error("Sync requires storeId (or req.store from middleware)");
      err.status = 400;
      throw err;
    }

    const dbResp = await listProductsFromDb({ store: null, filters, role });
    return { ...dbResp, sync: null };
  }

  const store =
    storeFromReq ||
    (await getStoreByProviderStoreId(
      storeIdFromArg,
      providerNameFromQuery || null,
      role
    ));

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

  const effectiveFilters = { ...filters, provider: providerName };

  const dbResp = await listProductsFromDb({
    store,
    filters: effectiveFilters,
    role,
  });

  return {
    ...dbResp,
    sync: syncMeta,
  };
}

/* ======================================================
   MAIN ENTRY - GET BY _id
====================================================== */
async function getUnifiedProductById({
  productId,
  providerStoreId,
  filters = {},
  store: storeFromReq,
  role = "",
}) {
  const providerNameFromQuery = normalizeProviderName(filters.provider);
  const storeIdFromArg = toStr(providerStoreId);

  const hasStoreKey = !!storeFromReq;
  const hasStoreId = !!storeIdFromArg;

  if (!hasStoreKey && !hasStoreId) {
    return getProductFromDbById({
      productId,
      store: null,
      filters,
      role,
    });
  }

  const store =
    storeFromReq ||
    (await getStoreByProviderStoreId(
      storeIdFromArg,
      providerNameFromQuery || null,
      role
    ));

  const { providerName } = pickProviderFromStore(
    store,
    storeIdFromArg,
    providerNameFromQuery || null
  );

  if (!providerName) {
    const err = new Error("Store provider is missing");
    err.status = 400;
    throw err;
  }

  const effectiveFilters = { ...filters, provider: providerName };

  return getProductFromDbById({
    productId,
    store,
    filters: effectiveFilters,
    role,
  });
}

module.exports = {
  listUnifiedProducts,
  getUnifiedProductById,
  getProductFromDbById,
  getStoreByProviderStoreId,
  listProductsFromDb,
};