// models/product/product.repo.js
// ✅ Full simplified file (fewer helper functions)
// - Upload product images
// - Remove ONE image (DB + disk)
// - Delete product permanently (DB + remove images directory)

const applySearchFilter = require("../../helpers/applySearchFilter");
const prepareQueryObjects = require("../../helpers/prepareQueryObjects");
const { normalizeText } = require("../../utils/helpers");

const fs = require("fs");
const path = require("path");

const storeModel = require("../store/store.model");
const categoryModel = require("../category/category.model");
const productModel = require("./product.model");

// optional: if your frontend sometimes sends full URL
const BASE_URL =
  (process.env.VITE_REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "").replace(/\/$/, "");

/* ----------------------------- CRUD ----------------------------- */

exports.createProduct = async (productData) => {
  const store =
    productData.store ||
    (productData.storeId
      ? (await storeModel
          .findOne({ storeId: String(productData.storeId) })
          .select({ _id: 1 })
          .lean())?._id
      : null);

  if (!store) {
    return { success: false, code: 400, message: "store (ObjectId) or storeId is required" };
  }

  const categoryId = productData.category;
  if (!categoryId) return { success: false, code: 400, message: "category is required" };

  const cat = await categoryModel.findById(categoryId).select({ _id: 1, store: 1 }).lean();
  if (!cat) return { success: false, code: 404, message: "Category not found" };

  if (String(cat.store) !== String(store)) {
    return { success: false, code: 400, message: "Category does not belong to this store" };
  }

  const images =
    Array.isArray(productData.images)
      ? productData.images.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim())
      : typeof productData.images === "string" && productData.images.trim()
      ? [productData.images.trim()]
      : [];

  const priceBefore = Number(productData.priceBefore ?? 0);
  const priceInput = productData.price !== undefined ? Number(productData.price) : 0;
  const discountInput = productData.discount !== undefined ? Number(productData.discount) : 0;

  const pb = Number.isFinite(priceBefore) ? priceBefore : 0;
  let p = Number.isFinite(priceInput) ? priceInput : 0;
  let d = Number.isFinite(discountInput) ? discountInput : 0;

  if (d < 0) d = 0;
  if (d > 100) d = 100;
  if ((!p || p <= 0) && pb > 0 && d > 0) p = +(pb * (1 - d / 100)).toFixed(2);

  const doc = await productModel.create({
    store,
    category: categoryId,
    name: String(productData.name || "").trim(),
    description: String(productData.description || "").trim(),
    images,
    priceBefore: pb,
    price: p,
    stock: Number.isFinite(Number(productData.stock)) ? Number(productData.stock) : 0,
    discount: d,
    isActive: typeof productData.isActive === "boolean" ? productData.isActive : true,
  });

  return { success: true, code: 201, result: doc };
};

exports.listProducts = async (
  filterObject,
  selectionObject = {},
  sortObject = {},
  options = { populate: false }
) => {
  const {
    filterObject: normalizedFilter,
    sortObject: normalizedSort,
    pageNumber,
    limitNumber,
  } = prepareQueryObjects(filterObject, sortObject, {
    sortableFields: ["createdAt", "name", "price", "priceBefore", "stock"],
    defaultSort: "-createdAt",
  });

  if (normalizedFilter?.storeId) {
    const s = await storeModel
      .findOne({ storeId: String(normalizedFilter.storeId) })
      .select({ _id: 1 })
      .lean();

    delete normalizedFilter.storeId;

    if (!s?._id) {
      return { success: true, code: 200, result: [], count: 0, page: pageNumber, limit: limitNumber };
    }
    normalizedFilter.store = s._id;
  }

  if (normalizedFilter?.isActive !== undefined) {
    const v = String(normalizedFilter.isActive).toLowerCase();
    normalizedFilter.isActive = v === "true" || v === "1";
  }

  const minPrice = filterObject.minPrice !== undefined ? Number(filterObject.minPrice) : null;
  const maxPrice = filterObject.maxPrice !== undefined ? Number(filterObject.maxPrice) : null;
  if ((minPrice !== null && Number.isFinite(minPrice)) || (maxPrice !== null && Number.isFinite(maxPrice))) {
    normalizedFilter.price = {};
    if (minPrice !== null && Number.isFinite(minPrice)) normalizedFilter.price.$gte = minPrice;
    if (maxPrice !== null && Number.isFinite(maxPrice)) normalizedFilter.price.$lte = maxPrice;
  }

  const minStock = filterObject.minStock !== undefined ? Number(filterObject.minStock) : null;
  if (minStock !== null && Number.isFinite(minStock)) normalizedFilter.stock = { $gte: minStock };

  const search = normalizeText(filterObject.search || filterObject.q || filterObject.keyword);
  if (search) normalizedFilter.search = search;

  const finalFilter = applySearchFilter(normalizedFilter, ["name", "description"]);

  let q = productModel
    .find(finalFilter)
    .select(selectionObject)
    .populate("store", "businessName storeId logo")
    .populate("category", "name image store isActive")
    .sort(normalizedSort)
    .limit(limitNumber)
    .skip((pageNumber - 1) * limitNumber)
    .lean();

  if (options?.populate) {
    q = q.populate("store", "businessName storeId logo").populate("category", "name image store isActive");
  }

  const [products, count] = await Promise.all([q, productModel.countDocuments(finalFilter)]);

  return { success: true, code: 200, result: products, count, page: pageNumber, limit: limitNumber };
};

exports.getProduct = async (productId) => {
  let q = productModel.findById(productId);

  const doc = await q.lean().populate("store", "businessName storeId logo").populate("category", "name image store isActive");
  if (!doc) return { success: false, code: 404, message: "Product not found" };

  return { success: true, code: 200, result: doc };
};

exports.updateProduct = async (productId, payload) => {
  const doc = await productModel.findById(productId);
  if (!doc) return { success: false, code: 404, message: "Product not found" };

  let nextStore = doc.store;

  if (payload?.store || payload?.storeId) {
    const store =
      payload.store ||
      (payload.storeId
        ? (await storeModel
            .findOne({ storeId: String(payload.storeId) })
            .select({ _id: 1 })
            .lean())?._id
        : null);

    if (!store) return { success: false, code: 404, message: "Store not found" };
    nextStore = store;
    doc.store = store;
  }

  if (payload?.category !== undefined) {
    const cat = await categoryModel.findById(payload.category).select({ _id: 1, store: 1 }).lean();
    if (!cat) return { success: false, code: 404, message: "Category not found" };
    if (String(cat.store) !== String(nextStore)) {
      return { success: false, code: 400, message: "Category does not belong to this store" };
    }
    doc.category = payload.category;
  }

  if (payload?.name !== undefined) doc.name = String(payload.name || "").trim();
  if (payload?.description !== undefined) doc.description = String(payload.description || "").trim();

  if (payload?.images !== undefined) {
    doc.images =
      Array.isArray(payload.images)
        ? payload.images.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim())
        : typeof payload.images === "string" && payload.images.trim()
        ? [payload.images.trim()]
        : [];
  }

  if (payload?.priceBefore !== undefined) doc.priceBefore = Number.isFinite(Number(payload.priceBefore)) ? Number(payload.priceBefore) : 0;
  if (payload?.price !== undefined) doc.price = Number.isFinite(Number(payload.price)) ? Number(payload.price) : 0;

  if (payload?.discount !== undefined) {
    let d = Number(payload.discount);
    d = Number.isFinite(d) ? d : 0;
    if (d < 0) d = 0;
    if (d > 100) d = 100;
    doc.discount = d;
  }

  if (payload?.stock !== undefined) doc.stock = Number.isFinite(Number(payload.stock)) ? Number(payload.stock) : 0;

  if (payload?.isActive !== undefined) {
    doc.isActive =
      typeof payload.isActive === "boolean"
        ? payload.isActive
        : String(payload.isActive).toLowerCase() === "true" || String(payload.isActive) === "1";
  }

  const pb2 = Number(doc.priceBefore || 0);
  const p2 = Number(doc.price || 0);
  const d2 = Number(doc.discount || 0);
  if ((!p2 || p2 <= 0) && pb2 > 0 && d2 > 0) doc.price = +(pb2 * (1 - d2 / 100)).toFixed(2);

  await doc.save();
  return { success: true, code: 200, result: doc };
};

exports.deleteProduct = async (_id, deletePermanently = false) => {
  if (!_id) return { success: false, code: 400, message: "invalid id" };

  if (deletePermanently) {
    // delete record
    const deleted = await productModel.findByIdAndDelete(_id).lean();
    if (!deleted) return { success: false, code: 404, message: "Product not found" };

    // delete product images directory (try common roots)
    const dirs = [
      path.join(process.cwd(), "public", "images", "products", String(_id)),
      path.join(process.cwd(), "uploads", "images", "products", String(_id)),
      path.join(process.cwd(), "storage", "images", "products", String(_id)),
    ];

    for (const dir of dirs) {
      try {
        if (fs.existsSync(dir)) {
          if (fs.rmSync) fs.rmSync(dir, { recursive: true, force: true });
          else fs.rmdirSync(dir, { recursive: true });
        }
      } catch (_) {}
    }

    return { success: true, code: 200, result: { message: "record_deleted" } };
  }

  const updated = await productModel
    .findOneAndUpdate({ _id, isActive: true }, { isActive: false }, { new: true })
    .lean();

  if (!updated) return { success: false, code: 404, message: "Product not found" };

  return { success: true, code: 200, result: { message: "record_disabled" } };
};

/* ----------------------------- Images ----------------------------- */

exports.uploadProductImages = async (productId, files) => {
  if (!productId) return { success: false, code: 400, message: "productId is required" };
  if (!Array.isArray(files) || files.length === 0) {
    return { success: false, code: 400, message: "images are required" };
  }

  const doc = await productModel.findById(productId);
  if (!doc) {
    // cleanup uploaded files if product not found
    for (const f of files) {
      try {
        if (f?.path) fs.unlinkSync(f.path);
      } catch (_) {}
    }
    return { success: false, code: 404, message: "Product not found" };
  }

  const urls = files
    .filter((f) => f?.filename)
    .map((f) => `/images/products/${productId}/${f.filename}`);

  const current = Array.isArray(doc.images) ? doc.images : [];
  for (const u of urls) if (!current.includes(u)) current.push(u);

  doc.images = current;
  await doc.save();

  return {
    success: true,
    code: 200,
    message: "Product images updated",
    result: { productId: String(doc._id), images: doc.images },
  };
};

exports.removeProductImage = async (productId, imageUrl) => {
  if (!productId) return { success: false, code: 400, message: "productId is required" };
  if (!imageUrl) return { success: false, code: 400, message: "imageUrl is required" };

  // normalize imageUrl (raw path OR full url OR encoded)
  let u = String(imageUrl).trim();
  try { u = decodeURIComponent(u); } catch (_) {}
  u = u.split("?")[0].split("#")[0];

  if (/^https?:\/\//i.test(u)) {
    if (BASE_URL && u.startsWith(BASE_URL)) u = u.slice(BASE_URL.length);
    else {
      const idx = u.indexOf("/", u.indexOf("//") + 2);
      u = idx >= 0 ? u.slice(idx) : u;
    }
  }

  u = u.replace(/\\/g, "/");
  if (!u.startsWith("/")) u = `/${u}`;

  const allowedPrefix = `/images/products/${productId}/`;
  if (!u.startsWith(allowedPrefix)) {
    return { success: false, code: 400, message: "Invalid imageUrl" };
  }

  const doc = await productModel.findById(productId);
  if (!doc) return { success: false, code: 404, message: "Product not found" };

  const current = Array.isArray(doc.images) ? doc.images : [];
  const next = current.filter((x) => String(x) !== u);
  if (next.length === current.length) return { success: false, code: 404, message: "Image not found in product" };

  doc.images = next;
  await doc.save();

  // delete file from disk by trying common roots
  const relative = u.replace(/^\/+/, ""); // "images/products/<id>/file.png"
  const roots = [path.join(process.cwd(), "public"), process.cwd(), path.join(process.cwd(), "uploads"), path.join(process.cwd(), "storage")];

  let deleted = false;
  for (const root of roots) {
    try {
      const filePath = path.resolve(path.join(root, relative));
      const rootPath = path.resolve(root);

      // safety: ensure inside root
      if (!filePath.startsWith(rootPath + path.sep)) continue;

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted = true;

        // remove dir if empty
        try {
          const dir = path.dirname(filePath);
          const remain = fs.readdirSync(dir).filter((x) => x && x !== ".DS_Store");
          if (remain.length === 0) fs.rmdirSync(dir);
        } catch (_) {}

        break;
      }
    } catch (_) {}
  }

  return {
    success: true,
    code: 200,
    message: deleted
      ? "Product image removed"
      : "Product image removed from DB, but file not found on disk",
    result: { productId: String(doc._id), images: doc.images },
  };
};
