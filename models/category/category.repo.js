// category.repo.js
const fs = require("fs");
const path = require("path");

const applySearchFilter = require("../../helpers/applySearchFilter");
const prepareQueryObjects = require("../../helpers/prepareQueryObjects");
const { ConflictException } = require("../../middlewares/errorHandler/exceptions");

const categoryModel = require("./category.model");
const storeModel = require("../store/store.model");

const PUBLIC_DIR = path.join(process.cwd(), "public");

/** Escape regex special chars */
function escapeRegExp(str = "") {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resolve store reference from payload/query:
 * accepts:
 *  - store (ObjectId)
 *  - storeId (9 digits string in stores collection)
 */
async function resolveStoreId({ store, storeId }) {
  if (store) return store;

  if (storeId) {
    const storeDoc = await storeModel
      .findOne({ storeId: String(storeId) })
      .select({ _id: 1 })
      .lean();
    if (!storeDoc) return null;
    return storeDoc._id;
  }

  return null;
}

/* ---------------------------
  CRUD
--------------------------- */

exports.createCategory = async (categoryData) => {
  const store = await resolveStoreId({
    store: categoryData.store,
    storeId: categoryData.storeId,
  });

  if (!store) {
    return { success: false, code: 400, message: "store (ObjectId) or storeId is required" };
  }

  const name = String(categoryData.name || "").trim();
  const description = String(categoryData.description || "").trim();

  if (name) {
    const existing = await categoryModel.findOne({
      store,
      name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" },
    });

    if (existing) {
      throw new ConflictException("Category with this name already exists for this store");
    }
  }

  // ✅ IMPORTANT: do NOT set image: [] because schema is String
  const doc = await categoryModel.create({
    store,
    name,
    description,
    // image will default to "" in schema
  });

  return { success: true, code: 201, result: doc };
};

exports.listCategories = async (
  filterObject,
  selectionObject = {},
  sortObject = {},
  options = { populateStore: true }
) => {
  const {
    filterObject: normalizedFilter,
    sortObject: normalizedSort,
    pageNumber,
    limitNumber,
  } = prepareQueryObjects(filterObject, sortObject, {
    sortableFields: ["createdAt", "name"],
    defaultSort: "-createdAt",
  });

  if (normalizedFilter?.storeId) {
    const resolved = await resolveStoreId({ storeId: normalizedFilter.storeId });
    delete normalizedFilter.storeId;

    if (!resolved) {
      return { success: true, code: 200, result: [], count: 0, page: pageNumber, limit: limitNumber };
    }

    normalizedFilter.store = resolved;
  }

  const finalFilter = applySearchFilter(normalizedFilter, ["name", "description"]);

  let query = categoryModel
    .find(finalFilter)
    .select(selectionObject)
    .populate("store", "businessName storeId logo")
    .sort(normalizedSort)
    .limit(limitNumber)
    .skip((pageNumber - 1) * limitNumber);

  if (options?.populateStore) {
    query = query.populate("store", "businessName storeId logo");
  }

  const [categories, count] = await Promise.all([
    query.lean(),
    categoryModel.countDocuments(finalFilter),
  ]);

  return { success: true, code: 200, result: categories, count, page: pageNumber, limit: limitNumber };
};

exports.getCategory = async (categoryId, options = { populateStore: true }) => {
  let query = categoryModel.findById(categoryId);

  if (options?.populateStore) {
    query = query.populate("store", "businessName storeId logo");
  }

  const doc = await query.lean();
  if (!doc) return { success: false, code: 404, message: "Category not found" };

  return { success: true, code: 200, result: doc };
};

exports.updateCategory = async (categoryId, payload) => {
  const doc = await categoryModel.findById(categoryId);
  if (!doc) return { success: false, code: 404, message: "Category not found" };

  if (payload?.store || payload?.storeId) {
    const resolved = await resolveStoreId({ store: payload.store, storeId: payload.storeId });
    if (!resolved) return { success: false, code: 404, message: "Store not found" };
    doc.store = resolved;
  }

  if (payload?.name !== undefined) doc.name = String(payload.name || "").trim();
  if (payload?.description !== undefined) doc.description = String(payload.description || "").trim();

  if (doc.name) {
    const existing = await categoryModel.findOne({
      _id: { $ne: doc._id },
      store: doc.store,
      name: { $regex: `^${escapeRegExp(doc.name)}$`, $options: "i" },
    });

    if (existing) {
      throw new ConflictException("Category with this name already exists for this store");
    }
  }

  await doc.save();
  return { success: true, code: 200, result: doc };
};

exports.deleteCategory = async (_id, deletePermanently = false) => {
  if (!_id) return { success: false, code: 400, message: "invalid id" };

  if (deletePermanently) {
    const deleted = await categoryModel.findByIdAndDelete(_id).lean();
    if (!deleted) return { success: false, code: 404, message: "Category not found" };

    try {
      const categoryDir = path.join(PUBLIC_DIR, "images", "categories", String(_id));
      if (fs.existsSync(categoryDir)) {
        fs.rmSync(categoryDir, { recursive: true, force: true });
      }
    } catch (_) {}

    return { success: true, code: 200, result: { message: "record_deleted" } };
  }

  const updated = await categoryModel
    .findOneAndUpdate({ _id, isActive: true }, { isActive: false }, { new: true })
    .lean();

  if (!updated) return { success: false, code: 404, message: "Category not found" };

  return { success: true, code: 200, result: { message: "record_disabled" } };
};

/* ---------------------------
  Image Upload (STRING) + Remove (separate endpoint)
--------------------------- */

exports.uploadCategoryImage = async (categoryId, file) => {
  if (!categoryId) {
    if (file?.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }
    return { success: false, code: 400, message: "categoryId is required" };
  }

  if (!file?.filename) {
    return { success: false, code: 400, message: "image file is required" };
  }

  const doc = await categoryModel.findById(categoryId);
  if (!doc) {
    if (file?.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) {}
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
      const oldAbsPath = path.join(PUBLIC_DIR, "images", "categories", String(categoryId), oldFileName);
      if (fs.existsSync(oldAbsPath)) {
        try { fs.unlinkSync(oldAbsPath); } catch (_) {}
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
      const oldAbsPath = path.join(PUBLIC_DIR, "images", "categories", String(categoryId), oldFileName);
      if (fs.existsSync(oldAbsPath)) {
        try { fs.unlinkSync(oldAbsPath); } catch (_) {}
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
