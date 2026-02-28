// store/store.repo.js
const applySearchFilter = require("../../helpers/applySearchFilter");
const prepareQueryObjects = require("../../helpers/prepareQueryObjects");
const { ConflictException } = require("../../middlewares/errorHandler/exceptions");
// TODO: عدّل المسارات حسب مشروعك
const ProductsModel = require("../product/product.model");     // or ../../models/product/product.model
const CategoriesModel = require("../category/category.model"); // or ../../models/category/category.model

const {
  expiresAtFromSeconds,
  random9Digits,
  toPositiveInt,
  normalizeText,
  pickPagination,
} = require("../../utils/helpers");

const { getProviderAdapter } = require("../../providers"); // ✅ unified adapters registry
const storeModel = require("./store.model");

const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(process.cwd(), "public");

/** -------------------------
 * Helpers
 --------------------------*/
function providerKey(x) {
  return String(x || "").toLowerCase().trim();
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

async function generateUniqueStoreId(providerName) {
  let storeId;
  let exists = true;

  while (exists) {
    storeId = random9Digits();

    exists = await storeModel.exists({
      "provider.name": providerName,
      "provider.storeId": storeId,
    });
  }

  return String(storeId);
}

function normalizeStoreProviderInput(storeData = {}) {
  // Accept old payload styles:
  // - provider: "salla"
  // - providerName: "salla"
  // - provider: { name, storeId, domain, merchant }
  const p = storeData.provider;

  if (typeof p === "string") {
    return {
      name: providerKey(p),
      storeId: String(storeData.storeId || random9Digits()),
      domain: String(storeData.domain || ""),
      merchant: storeData.merchant ?? null,
    };
  }

  if (p && typeof p === "object") {
    return {
      name: providerKey(p.name),
      storeId: storeData.storeId ? String(storeData.storeId) : undefined,
      domain: String(p.domain || storeData.domain || ""),
      merchant: p.merchant ?? storeData.merchant ?? null,
    };
  }

  // fallback: providerName
  return {
    name: providerKey(storeData.providerName),
    storeId: String(storeData.storeId || random9Digits()),
    domain: String(storeData.domain || ""),
    merchant: storeData.merchant ?? null,
  };
}

/** -------------------------
 * CRUD Stores
 --------------------------*/

// ✅ Create store (manual / dummy) — useful for testing
exports.createStore = async (storeData = {}) => {
  const provider = normalizeStoreProviderInput(storeData);

  if (!provider.name) {
    throw new ConflictException("provider.name is required");
  }

  const providerName = providerKey(provider.name);

  // 🚫 Prevent manual creation for OAuth providers
  const OAUTH_PROVIDERS = ["salla", "shopify", "zid"];
  if (OAUTH_PROVIDERS.includes(providerName)) {
    throw new ConflictException(
      `${providerName} stores must be connected via OAuth`
    );
  }

  // 🔥 Auto-generate unique storeId if not provided
  if (!provider.storeId) {
    let exists = true;
    while (exists) {
      provider.storeId = random9Digits();
      exists = await storeModel.exists({
        "provider.name": providerName,
        "provider.storeId": provider.storeId,
      });
    }
  }

  // Prevent duplicates explicitly (extra safety)
  const duplicate = await storeModel.findOne({
    "provider.name": providerName,
    "provider.storeId": provider.storeId,
  });

  if (duplicate) {
    throw new ConflictException(
      "Store already exists for this provider/storeId"
    );
  }

  const newStore = new storeModel({
    businessName: (storeData.businessName || providerName || "").trim(),
    provider: {
      name: providerName,
      storeId: provider.storeId,
      domain: provider.domain || "",
      merchant: provider.merchant ?? null,
    },
    logo: storeData.logo || "",
    isActive: storeData.isActive ?? true,
    settings: storeData.settings ?? null,
  });

  await newStore.save();

  return {
    success: true,
    code: 201,
    result: newStore,
  };
};
exports.listStores = async (
  filterObject = {},
  selectionObject = {},
  sortObject = {}
) => {
  const {
    filterObject: normalizedFilter,
    sortObject: normalizedSort,
    pageNumber,
    limitNumber,
  } = prepareQueryObjects(filterObject, sortObject, {
    sortableFields: ["createdAt", "businessName", "isActive"],
    defaultSort: "-createdAt",
  });

  // Optional explicit filters
  const providerFilter = normalizedFilter?.providerName || normalizedFilter?.provider;
  const activeFilter =
    typeof normalizedFilter?.isActive !== "undefined"
      ? normalizedFilter.isActive
      : undefined;

  const baseFilter = {
    ...(providerFilter && { "provider.name": String(providerFilter).toLowerCase().trim() }),
    ...(typeof activeFilter !== "undefined" && { isActive: activeFilter === "true" || activeFilter === true }),
  };

  // Allow search across multiple fields
  const finalFilter = applySearchFilter(
    { ...normalizedFilter, ...baseFilter },
    ["businessName", "provider.name", "provider.storeId"]
  );

  const [stores, count] = await Promise.all([
    storeModel
      .find(finalFilter)
      .select(selectionObject)
      .sort(normalizedSort)
      .limit(limitNumber)
      .skip((pageNumber - 1) * limitNumber)
      .lean({ virtuals: true }),
    storeModel.countDocuments(finalFilter),
  ]);

  return {
    success: true,
    code: 200,
    result: stores,
    count,
    page: pageNumber,
    limit: limitNumber,
  };
};


exports.getStore = async (storeId) => {
  if (!storeId) {
    return { success: false, code: 400, message: "storeId is required" };
  }

  const store = await storeModel
    .findById(storeId)
    .lean({ virtuals: true });

  if (!store) {
    return { success: false, code: 404, message: "Store not found" };
  }

  if (store.isActive === false) {
    return { success: false, code: 404, message: "Store is inactive" };
  }

  return {
    success: true,
    code: 200,
    result: store,
  };
};

exports.updateStore = async (storeId, payload = {}) => {
  if (!storeId) {
    return { success: false, code: 400, message: "storeId is required" };
  }

  const doc = await storeModel.findById(storeId);
  if (!doc) {
    return { success: false, code: 404, message: "Store not found" };
  }

  // 🔐 Protect critical fields
  const PROTECTED_FIELDS = ["provider", "auth", "_id", "createdAt", "updatedAt"];

  PROTECTED_FIELDS.forEach((field) => {
    if (field in payload) {
      delete payload[field];
    }
  });

  // ✅ Allowed fields
  if (typeof payload.businessName !== "undefined") {
    doc.businessName = String(payload.businessName).trim();
  }

  if (typeof payload.logo !== "undefined") {
    doc.logo = String(payload.logo || "").trim();
  }

  if (typeof payload.isActive !== "undefined") {
    doc.isActive = Boolean(payload.isActive);
  }

  if (typeof payload.settings !== "undefined") {
    doc.settings = payload.settings;
  }

  await doc.save();

  return {
    success: true,
    code: 200,
    result: doc.toObject({ virtuals: true }),
  };
};
// لازم يكونوا موجودين فوق في نفس الملف (عدّل المسارات حسب مشروعك)
// const ProductsModel = require("../product/product.model");
// const CategoriesModel = require("../category/category.model");

exports.deleteStore = async (_id, deletePermanently = false) => {
  if (!_id) return { success: false, code: 400, message: "invalid id" };

  // =========================
  // HARD DELETE + CASCADE
  // =========================
  if (deletePermanently) {
    // ✅ get store first (so we can delete related docs + remove folder)
    const storeDoc = await storeModel.findById(_id).lean();
    if (!storeDoc) return { success: false, code: 404, message: "Store not found" };

    const mongoStoreId = storeDoc?._id;
    const providerStoreId = String(storeDoc?.provider?.storeId || "");

    // ✅ match common relations (supports multiple schema styles)
    const relatedMatch = {
      $or: [
        // ObjectId relations
        { store: mongoStoreId },
        { storeId: mongoStoreId },

        // string relations (some code stores ObjectId as string)
        { store: String(mongoStoreId) },
        { storeId: String(mongoStoreId) },

        // provider storeId relations (9 digits in your system)
        ...(providerStoreId
          ? [
              { providerStoreId },
              { storeId: providerStoreId },
              { "provider.storeId": providerStoreId },
            ]
          : []),
      ],
    };

    // ✅ delete related first (best practice)
    let productsDeleted = 0;
    let categoriesDeleted = 0;

    try {
      const [pRes, cRes] = await Promise.all([
        ProductsModel?.deleteMany ? ProductsModel.deleteMany(relatedMatch) : { deletedCount: 0 },
        CategoriesModel?.deleteMany ? CategoriesModel.deleteMany(relatedMatch) : { deletedCount: 0 },
      ]);

      productsDeleted = Number(pRes?.deletedCount || 0);
      categoriesDeleted = Number(cRes?.deletedCount || 0);
    } catch (e) {
      // لو حصل مشكلة في cascade delete، نوقف العملية (أفضل من حذف store لوحده)
      return {
        success: false,
        code: 500,
        message: `Failed to delete related products/categories: ${e?.message || e}`,
      };
    }

    // ✅ delete store
    const deleted = await storeModel.findByIdAndDelete(_id).lean();
    if (!deleted) return { success: false, code: 404, message: "Store not found" };

    // ✅ remove images folder
    try {
      const storeDir = path.join(
        PUBLIC_DIR,
        "images",
        "stores",
        String(deleted?.provider?.storeId || deleted?.storeId || "")
      );
      if (storeDir && fs.existsSync(storeDir)) {
        fs.rmSync(storeDir, { recursive: true, force: true });
      }
    } catch (_) {}

    return {
      success: true,
      code: 200,
      result: {
        message: "success.record_deleted",
        deleted: {
          products: productsDeleted,
          categories: categoriesDeleted,
        },
      },
    };
  }

  // =========================
  // SOFT DELETE (disable only)
  // =========================
  const updated = await storeModel
    .findOneAndUpdate({ _id, isActive: true }, { isActive: false }, { new: true })
    .lean();

  if (!updated) return { success: false, code: 404, message: "Store not found" };

  return { success: true, code: 200, result: { message: "success.record_disabled" } };
};
/** -------------------------
 * Products (Provider-agnostic)
 --------------------------*/

/**
 * ✅ getProducts (Unified entrypoint)
 * - Reads store doc from DB by _id (Mongo ObjectId)
 * - Detects provider => adapter.listProducts()
 * - Does NOT call ensureValidAccessToken here (adapter handles auth)
 */
exports.getProducts = async (filterObject = {}, storeMongoId) => {
  const store = await storeModel.findById(storeMongoId).lean();
  if (!store || store.isActive === false) {
    return { success: false, code: 404, message: "Store not found" };
  }

  const providerName = providerKey(store?.provider?.name || store?.providerName || store?.provider);
  if (!providerName) {
    return { success: false, code: 400, message: "Store provider is missing" };
  }

  const adapter = getProviderAdapter(providerName);

  const page = toPositiveInt(filterObject.page, 1);
  const limit = clampInt(toPositiveInt(filterObject.limit ?? filterObject.per_page ?? filterObject.perPage, 20), 1, 100);

  const keyword = normalizeText(filterObject.keyword || filterObject.search || filterObject.q);

  // accept category aliases
  const category =
    filterObject.category ??
    filterObject.category_id ??
    filterObject.categoryId ??
    filterObject.category_ids ??
    filterObject.categoryIds;

  // status (unified - adapter may or may not send it to provider)
  const status = filterObject.status ? String(filterObject.status).trim() : "";

  // pass filters to adapter
  const providerResp = await adapter.listProducts({
    store, // store contains provider + auth
    filters: {
      ...filterObject,
      page,
      limit,
      keyword,     // normalized
      category,    // original id
      status,      // unified
    },
  });

  // normalize response shape even if adapter returns something slightly different
  const list = Array.isArray(providerResp?.result) ? providerResp.result : [];
  const count = Number(providerResp?.count);
  const meta = pickPagination(
    { count: Number.isFinite(count) ? count : list.length },
    { page, per_page: limit, listLen: list.length }
  );

  return {
    success: true,
    code: 200,
    result: list,
    count: Number.isFinite(count) ? count : meta.count,
    page: meta.page,
    limit: meta.limit,
    provider: providerName,
  };
};

/** -------------------------
 * Store Logo upload/remove
 --------------------------*/

exports.uploadStoreImage = async (_id, file) => {
  if (!file?.filename) {
    return { success: false, code: 400, message: "image is required" };
  }

  const doc = await storeModel.findById(_id);
  if (!doc) {
    try {
      if (file?.path) fs.unlinkSync(file.path);
    } catch (_) {}
    return { success: false, code: 404, message: "Store not found" };
  }

  const sid = String(doc?.provider?.storeId || doc?.storeId || "");
  const storeDir = path.join(PUBLIC_DIR, "images", "stores", sid);

  try {
    if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  } catch (_) {}

  const targetPath = path.join(storeDir, file.filename);

  if (file?.path) {
    try {
      const src = path.resolve(file.path);
      const dst = path.resolve(targetPath);
      if (src !== dst) {
        try {
          fs.renameSync(src, dst);
        } catch (_) {
          try {
            fs.copyFileSync(src, dst);
            fs.unlinkSync(src);
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // remove old logo file
  const oldUrl = doc.logo;
  if (oldUrl && typeof oldUrl === "string") {
    try {
      const cleaned = oldUrl.split("?")[0].split("#")[0];
      const oldFileName = cleaned.split("/").pop();
      if (oldFileName) {
        const oldAbsPath = path.join(storeDir, oldFileName);
        if (fs.existsSync(oldAbsPath)) {
          try {
            fs.unlinkSync(oldAbsPath);
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  const imageUrl = `/images/stores/${sid}/${file.filename}`;
  doc.logo = imageUrl;
  await doc.save();

  return {
    success: true,
    code: 200,
    message: "Store logo updated",
    result: { storeId: sid, imageUrl: doc.logo },
  };
};

exports.removeStoreImage = async (_id) => {
  if (!_id) return { success: false, code: 400, message: "_id is required" };

  const doc = await storeModel.findById(_id);
  if (!doc) return { success: false, code: 404, message: "Store not found" };

  const sid = String(doc?.provider?.storeId || doc?.storeId || "");
  const storeDir = path.join(PUBLIC_DIR, "images", "stores", sid);
  const oldUrl = doc.logo;

  if (oldUrl && typeof oldUrl === "string") {
    try {
      const cleaned = oldUrl.split("?")[0].split("#")[0];
      const oldFileName = cleaned.split("/").pop();
      if (oldFileName) {
        const oldAbsPath = path.join(storeDir, oldFileName);
        if (fs.existsSync(oldAbsPath)) {
          try {
            fs.unlinkSync(oldAbsPath);
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  try {
    if (fs.existsSync(storeDir)) {
      const remaining = fs.readdirSync(storeDir);
      if (!remaining.length) fs.rmdirSync(storeDir);
    }
  } catch (_) {}

  doc.logo = "";
  await doc.save();

  return {
    success: true,
    code: 200,
    message: "Store logo removed",
    result: { storeId: sid, imageUrl: "" },
  };
};