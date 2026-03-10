// category.repo.js
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const applySearchFilter = require("../../helpers/applySearchFilter");
const prepareQueryObjects = require("../../helpers/prepareQueryObjects");
const {
  ConflictException,
  NotFoundException,
} = require("../../middlewares/errorHandler/exceptions");

const categoryModel = require("./category.model");
const storeModel = require("../store/store.model");
const { normalizeAssetUrl } = require("../../helpers/url.helper");

const PUBLIC_DIR = path.join(process.cwd(), "public");

/* ---------------------------
  Utils
--------------------------- */

/** Escape regex special chars */
function escapeRegExp(str = "") {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalize optional strings (trim + default "") */
function normStr(v) {
  return String(v || "").trim();
}

function toStr(v) {
  return String(v ?? "").trim();
}

function parseMulti(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.flatMap(parseMulti);
  const s = String(v).trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function isObjectId(x) {
  const s = toStr(x);
  return mongoose.Types.ObjectId.isValid(s);
}

function normProvider(x) {
  const s = toStr(x).toLowerCase();
  return s && s !== "all" ? s : "";
}

function emptyList(pageNumber, limitNumber) {
  return {
    success: true,
    code: 200,
    result: [],
    count: 0,
    page: pageNumber,
    limit: limitNumber,
  };
}

/**
 * Resolve store reference from payload/query:
 * accepts:
 *  - store (ObjectId)
 *  - storeId:
 *      - internal ObjectId
 *      - provider storeId (like salla store id)
 *  - provider (optional) to disambiguate when storeId is provider storeId
 *
 * Supports BOTH store.provider.* and store.providers.* shapes.
 */
async function resolveStoreId({ store, storeId, provider = null }) {
  if (store) return store;

  const storeIdStr = toStr(storeId);
  const providerName = normProvider(provider);

  if (!storeIdStr) return null;

  // 1) internal ObjectId
  if (isObjectId(storeIdStr)) {
    return new mongoose.Types.ObjectId(storeIdStr);
  }

  // 2) BEST: provider + providerStoreId
  if (providerName) {
    const doc = await storeModel
      .findOne({
        isActive: true,
        $or: [
          { "provider.name": providerName, "provider.storeId": storeIdStr },
          { "providers.name": providerName, "providers.storeId": storeIdStr },
          // legacy: some projects had top-level storeId
          { storeId: storeIdStr, "provider.name": providerName },
        ],
      })
      .select({ _id: 1 })
      .lean();

    return doc?._id || null;
  }

  // 3) storeId alone (provider storeId OR legacy top-level)
  const docs = await storeModel
    .find({
      isActive: true,
      $or: [
        { "provider.storeId": storeIdStr },
        { "providers.storeId": storeIdStr },
        { storeId: storeIdStr }, // legacy
      ],
    })
    .select({ _id: 1 })
    .lean();

  if (!docs?.length) return null;
  if (docs.length === 1) return docs[0]._id;

  // ambiguous: return $in for list queries (caller may use it)
  return { $in: docs.map((d) => d._id) };
}

/**
 * Apply store filter from query:
 * supports:
 * - store (ObjectId) already in filter => keep
 * - storeId (ObjectId OR provider storeId)
 * - provider (optional) + storeId
 * - provider only => all stores for provider
 *
 * Returns: { empty: true } when store not found.
 */
async function applyProviderAndStoreFilter(normalizedFilter, pageNumber, limitNumber) {
  if (!normalizedFilter || typeof normalizedFilter !== "object") {
    return { ok: true };
  }

  // if already filtered by store, do nothing
  if (normalizedFilter.store) return { ok: true };

  const provider =
    normalizedFilter.provider ??
    normalizedFilter.providerName ??
    normalizedFilter.provider_name;

  const storeIdRaw =
    normalizedFilter.storeId ??
    normalizedFilter.providerStoreId ??
    normalizedFilter.provider_store_id;

  const providerName = normProvider(provider);
  const storeIdStr = toStr(storeIdRaw);

  // remove non-schema filter keys so they don't affect category search
  if (normalizedFilter.provider !== undefined) delete normalizedFilter.provider;
  if (normalizedFilter.providerName !== undefined) delete normalizedFilter.providerName;
  if (normalizedFilter.provider_name !== undefined) delete normalizedFilter.provider_name;

  if (normalizedFilter.storeId !== undefined) delete normalizedFilter.storeId;
  if (normalizedFilter.providerStoreId !== undefined) delete normalizedFilter.providerStoreId;
  if (normalizedFilter.provider_store_id !== undefined) delete normalizedFilter.provider_store_id;

  // A) storeId provided
  if (storeIdStr) {
    // allow multi store ids: storeId=1,2,3 (each can be ObjectId or provider storeId)
    const vals = parseMulti(storeIdStr).filter((x) => toStr(x).toLowerCase() !== "all");

    // if only one => resolve normally
    if (vals.length <= 1) {
      const resolved = await resolveStoreId({
        storeId: vals[0] || storeIdStr,
        provider: providerName || null,
      });

      if (!resolved) return { empty: true, response: emptyList(pageNumber, limitNumber) };

      normalizedFilter.store = resolved;
      return { ok: true };
    }

    // multi => resolve each (best effort) then $in
    const resolvedIds = [];
    for (const v of vals) {
      const resolved = await resolveStoreId({
        storeId: v,
        provider: providerName || null,
      });
      if (resolved && resolved.$in && Array.isArray(resolved.$in)) {
        resolvedIds.push(...resolved.$in);
      } else if (resolved) {
        resolvedIds.push(resolved);
      }
    }

    const uniq = Array.from(
      new Set(resolvedIds.map((x) => String(x)))
    ).map((s) => new mongoose.Types.ObjectId(s));

    if (!uniq.length) return { empty: true, response: emptyList(pageNumber, limitNumber) };

    normalizedFilter.store = { $in: uniq };
    return { ok: true };
  }

  // B) provider ONLY => store in all stores of provider
  if (providerName) {
    const stores = await storeModel
      .find({
        isActive: true,
        $or: [{ "provider.name": providerName }, { "providers.name": providerName }],
      })
      .select({ _id: 1 })
      .lean();

    if (!stores?.length) return { empty: true, response: emptyList(pageNumber, limitNumber) };

    normalizedFilter.store = { $in: stores.map((s) => s._id) };
    return { ok: true };
  }

  return { ok: true };
}

/**
 * Enforce uniqueness per store for nameEn/nameAr (case-insensitive exact match).
 * - If both are empty => skip (allowed).
 * - If one is provided, check only that one.
 */
async function ensureUniqueNamesPerStore({ store, nameEn, nameAr, excludeId = null }) {
  const conditions = [];

  if (nameEn) {
    conditions.push({
      nameEn: { $regex: `^${escapeRegExp(nameEn)}$`, $options: "i" },
    });
  }

  if (nameAr) {
    conditions.push({
      nameAr: { $regex: `^${escapeRegExp(nameAr)}$`, $options: "i" },
    });
  }

  if (!conditions.length) return;

  const filter = { store, $or: conditions };
  if (excludeId) filter._id = { $ne: excludeId };

  const existing = await categoryModel.findOne(filter).select({ _id: 1 }).lean();
  if (existing) {
    throw new ConflictException("Category with this name already exists for this store");
  }
}

/* ---------------------------
  CRUD
--------------------------- */

exports.createCategory = async (categoryData = {}) => {
  const store = await resolveStoreId({
    store: categoryData.store,
    storeId: categoryData.storeId,
    provider: categoryData.provider || categoryData.providerName,
  });

  if (!store) {
    return {
      success: false,
      code: 400,
      message: "store (ObjectId) or storeId (+ optional provider) is required",
    };
  }

  const nameEn = normStr(categoryData.nameEn);
  const nameAr = normStr(categoryData.nameAr);
  const descriptionEn = normStr(categoryData.descriptionEn);
  const descriptionAr = normStr(categoryData.descriptionAr);

  await ensureUniqueNamesPerStore({ store, nameEn, nameAr });

  const doc = await categoryModel.create({
    store,
    nameEn,
    nameAr,
    descriptionEn,
    descriptionAr,
  });

  return { success: true, code: 201, result: doc };
};

exports.listCategories = async (
  filterObject,
  selectionObject = {},
  sortObject = {},
  options = {}
) => {
  const {
    filterObject: normalizedFilter,
    sortObject: normalizedSort,
    pageNumber,
    limitNumber,
  } = prepareQueryObjects(filterObject, sortObject, {
    sortableFields: ["createdAt", "nameEn", "nameAr"],
    defaultSort: "createdAt",
  });

  // handle provider + storeId filtering
  const storeRes = await applyProviderAndStoreFilter(
    normalizedFilter,
    pageNumber,
    limitNumber
  );
  if (storeRes?.empty) return storeRes.response;

  const finalFilter = applySearchFilter(normalizedFilter, [
    "nameEn",
    "nameAr",
    "descriptionEn",
    "descriptionAr",
  ]);

  const ensureStoreSelected = (sel = {}) => {
    if (!sel || Object.keys(sel).length === 0) return sel;

    const values = Object.values(sel).map((v) => Number(v));
    const isIncludeMode = values.some((v) => v === 1);

    if (isIncludeMode) return { ...sel, store: 1 };

    if (Number(sel.store) === 0) {
      const copy = { ...sel };
      delete copy.store;
      return copy;
    }

    return sel;
  };

  const safeSelection = ensureStoreSelected(selectionObject);

  /* ======================================================
     DEDUPE HELPERS
  ====================================================== */
  const normalizeArabicText = (value) =>
    String(value || "")
      .replace(/[\u064B-\u065F\u0670]/g, "") // remove tashkeel
      .replace(/ـ/g, "") // tatweel
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي");

  const normalizeNameForDedup = (value) => {
    const s = normalizeArabicText(
      String(value || "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[_\-./\\]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );

    return s;
  };

  const getCategoryDedupKey = (category) => {
    const nameAr = normalizeNameForDedup(category?.nameAr);
    const nameEn = normalizeNameForDedup(category?.nameEn);

    // prefer Arabic name if exists, otherwise English
    return nameAr || nameEn || "";
  };

  const categoryScore = (category) => {
    let score = 0;

    if (category?.image) score += 3;
    if (category?.descriptionEn) score += 1;
    if (category?.descriptionAr) score += 1;
    if (category?.nameEn) score += 1;
    if (category?.nameAr) score += 1;
    if (category?.store?._id) score += 1;
    if (category?.store?.logo) score += 1;

    return score;
  };

  /* ======================================================
     FETCH ALL MATCHED -> NORMALIZE -> DEDUPE -> PAGINATE
  ====================================================== */

  const categories = await categoryModel
    .find(finalFilter)
    .populate({
      path: "store",
      select: "businessName domain logo storeId provider providers isActive",
      match: { isActive: true },
    })
    .select(safeSelection)
    .sort(normalizedSort)
    .lean();

  const normalizedCategories = categories.map((category) => ({
    ...category,
    image: normalizeAssetUrl(category.image),
    store: category.store
      ? {
          ...category.store,
          logo: normalizeAssetUrl(category.store.logo),
        }
      : category.store,
  }));

  const dedupMap = new Map();

  for (const category of normalizedCategories) {
    const key = getCategoryDedupKey(category);

    // لو مفيش اسم أصلاً، خليه unique بالـ _id
    const finalKey = key || `__no_name__:${String(category._id)}`;

    const existing = dedupMap.get(finalKey);

    if (!existing) {
      dedupMap.set(finalKey, category);
      continue;
    }

    // keep the richer / better version
    if (categoryScore(category) > categoryScore(existing)) {
      dedupMap.set(finalKey, category);
    }
  }

  const uniqueCategories = Array.from(dedupMap.values());
  const count = uniqueCategories.length;

  const start = (pageNumber - 1) * limitNumber;
  const end = start + limitNumber;
  const paginatedCategories = uniqueCategories.slice(start, end);

  return {
    success: true,
    code: 200,
    result: paginatedCategories,
    count,
    page: pageNumber,
    limit: limitNumber,
  };
};

exports.getCategory = async (categoryId) => {
  let query = categoryModel.findById(categoryId);

  query = query.populate({
    path: "store",
    select: "businessName domain logo storeId provider providers isActive",
    match: { isActive: true },
  });

  const doc = await query.lean();
  if (!doc) {
    return { success: false, code: 404, message: "Category not found" };
  }

  const normalizedDoc = {
    ...doc,
    image: normalizeAssetUrl(doc.image),
    store: doc.store
      ? {
          ...doc.store,
          logo: normalizeAssetUrl(doc.store.logo),
        }
      : doc.store,
  };

  return { success: true, code: 200, result: normalizedDoc };
};

exports.updateCategory = async (categoryId, body = {}) => {
  const updated = await categoryModel.findByIdAndUpdate(categoryId, body, { new: true });

  if (!updated) {
    throw new NotFoundException("errors.category_not_found");
  }

  return {
    success: true,
    code: 200,
    result: updated,
  };
};

exports.deleteCategory = async (_id, permanent = false) => {
  // ✅ only true triggers permanent delete
  if (permanent) {
    const deleted = await categoryModel.findByIdAndDelete(_id).lean();
    if (!deleted) {
      return { success: false, code: 404, message: "errors.category_not_found" };
    }

    // best effort remove images folder
    try {
      const categoryDir = path.join(PUBLIC_DIR, "images", "categories", String(_id));
      if (fs.existsSync(categoryDir))
        fs.rmSync(categoryDir, { recursive: true, force: true });
    } catch (_) {}

    return { success: true, code: 200, message: "success.record_deleted" };
  }

  // ✅ default behavior: soft delete (disable)
  const updated = await categoryModel
    .findOneAndUpdate({ _id, isActive: true }, { isActive: false }, { new: true })
    .lean();

  if (!updated) {
    const exists = await categoryModel.findById(_id).select({ _id: 1 }).lean();
    if (!exists) return { success: false, code: 404, message: "errors.category_not_found" };

    // already disabled
    return { success: true, code: 200, message: "success.record_disabled" };
  }

  return { success: true, code: 200, message: "success.record_disabled" };
};

/* ---------------------------
  Image Upload (STRING) + Remove (separate endpoint)
--------------------------- */

exports.uploadCategoryImage = async (categoryId, file) => {
  if (!categoryId) {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (_) {}
    }
    return { success: false, code: 400, message: "categoryId is required" };
  }

  if (!file?.filename) {
    return { success: false, code: 400, message: "image file is required" };
  }

  const doc = await categoryModel.findById(categoryId);
  if (!doc) {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (_) {}
    }
    return { success: false, code: 404, message: "Category not found" };
  }

  // new url
  const imageUrl = `/images/categories/${categoryId}/${file.filename}`;

  // delete old file if exists and inside our folder
  const oldUrl = doc.image;
  const prefix = `/images/categories/${categoryId}/`;

  if (oldUrl && typeof oldUrl === "string" && oldUrl.startsWith(prefix)) {
    const oldFileName = oldUrl.split("/").pop();
    if (oldFileName && oldFileName !== file.filename) {
      const oldAbsPath = path.join(
        PUBLIC_DIR,
        "images",
        "categories",
        String(categoryId),
        oldFileName
      );
      if (fs.existsSync(oldAbsPath)) {
        try {
          fs.unlinkSync(oldAbsPath);
        } catch (_) {}
      }
    }
  }

  doc.image = imageUrl; // ✅ STRING
  await doc.save();

  return {
    success: true,
    code: 200,
    message: "Category image updated",
    result: { categoryId: String(doc._id), imageUrl },
  };
};

exports.removeCategoryImage = async (categoryId) => {
  if (!categoryId) return { success: false, code: 400, message: "categoryId is required" };

  const doc = await categoryModel.findById(categoryId);
  if (!doc) return { success: false, code: 404, message: "Category not found" };

  const oldUrl = doc.image;
  const prefix = `/images/categories/${categoryId}/`;

  if (oldUrl && typeof oldUrl === "string" && oldUrl.startsWith(prefix)) {
    const oldFileName = oldUrl.split("/").pop();
    if (oldFileName) {
      const oldAbsPath = path.join(
        PUBLIC_DIR,
        "images",
        "categories",
        String(categoryId),
        oldFileName
      );
      if (fs.existsSync(oldAbsPath)) {
        try {
          fs.unlinkSync(oldAbsPath);
        } catch (_) {}
      }
    }

    // cleanup empty folder (best effort)
    try {
      const dir = path.join(PUBLIC_DIR, "images", "categories", String(categoryId));
      if (fs.existsSync(dir)) {
        const remaining = fs.readdirSync(dir);
        if (!remaining.length) fs.rmdirSync(dir);
      }
    } catch (_) {}
  }

  doc.image = ""; // ✅ clear STRING
  await doc.save();

  return {
    success: true,
    code: 200,
    message: "Category image removed",
    result: { categoryId: String(doc._id), imageUrl: "" },
  };
};