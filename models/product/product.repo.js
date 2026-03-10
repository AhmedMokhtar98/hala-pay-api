// models/product/product.repo.js

const applySearchFilter = require("../../helpers/applySearchFilter");
const prepareQueryObjects = require("../../helpers/prepareQueryObjects");
const { normalizeText } = require("../../utils/helpers");

const fs = require("fs");
const path = require("path");

const storeModel = require("../store/store.model");
const categoryModel = require("../category/category.model");
const productModel = require("./product.model");

const BASE_URL =
  (
    process.env.VITE_REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    process.env.API_BASE_URL ||
    ""
  ).replace(/\/$/, "");

const STORE_POPULATE = {
  path: "store",
  select: "businessName storeId logo",
};

const PRODUCT_CATEGORIES_POPULATE = {
  path: "categories.categoryRef",
  select: "name nameEn nameAr image store isActive providerCategoryId",
};

/* ----------------------------- helpers ----------------------------- */

const toStr = (v) => String(v ?? "").trim();

const toBool = (v, def = false) => {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1" || v === 1) return true;
  if (v === "false" || v === "0" || v === 0) return false;
  return def;
};

const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .filter((x) => typeof x === "string" && x.trim())
      .map((x) => x.trim());
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
};

const normalizePriceObject = (value, fallbackCurrency = "SAR") => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      amount: Math.max(0, toNum(value.amount, 0)),
      currency: toStr(value.currency) || fallbackCurrency,
    };
  }

  return {
    amount: Math.max(0, toNum(value, 0)),
    currency: fallbackCurrency,
  };
};

const normalizeUrls = (value) => ({
  admin: toStr(value?.admin),
  customer: toStr(value?.customer),
  product_card: toStr(value?.product_card),
});

const normalizeRating = (value) => ({
  count: Math.max(0, toNum(value?.count, 0)),
  rate: Math.max(0, toNum(value?.rate, 0)),
});

const normalizeVariant = (variant, fallbackCurrency = "SAR") => ({
  providerVariantId: toStr(variant?.providerVariantId),
  sku: toStr(variant?.sku),
  name: toStr(variant?.name),

  price: normalizePriceObject(variant?.price, fallbackCurrency),
  compareAtPrice: normalizePriceObject(variant?.compareAtPrice, fallbackCurrency),

  stock: Math.max(0, toNum(variant?.stock, 0)),
  unlimited: toBool(variant?.unlimited, false),
  isAvailable: toBool(variant?.isAvailable, true),

  options: variant?.options ?? null,
});

const normalizeImagePath = (input) => {
  let u = String(input || "").trim();
  if (!u) return "";

  try {
    u = decodeURIComponent(u);
  } catch (_) {}

  u = u.split("?")[0].split("#")[0];

  if (/^https?:\/\//i.test(u)) {
    if (BASE_URL && u.startsWith(BASE_URL)) {
      u = u.slice(BASE_URL.length);
    } else {
      try {
        const parsed = new URL(u);
        u = parsed.pathname || "";
      } catch (_) {
        const idx = u.indexOf("/", u.indexOf("//") + 2);
        u = idx >= 0 ? u.slice(idx) : u;
      }
    }
  }

  u = u.replace(/\\/g, "/");
  if (u && !u.startsWith("/")) u = `/${u}`;
  return u;
};

const resolveStoreId = async ({ store, storeId }) => {
  if (store) return store;

  if (!storeId) return null;

  const doc = await storeModel
    .findOne({ storeId: String(storeId) })
    .select({ _id: 1 })
    .lean();

  return doc?._id || null;
};

const resolveCategories = async (payload, store) => {
  let inputCategories = Array.isArray(payload?.categories)
    ? payload.categories
    : [];

  if (!inputCategories.length && payload?.category) {
    inputCategories = [{ categoryRef: payload.category }];
  }

  if (!Array.isArray(inputCategories)) inputCategories = [];

  const categoryRefs = [
    ...new Set(
      inputCategories
        .map((c) => c?.categoryRef || c?.category || c?._id || null)
        .filter(Boolean)
        .map(String)
    ),
  ];

  if (!categoryRefs.length) {
    return { success: true, categories: [] };
  }

  const categoryDocs = await categoryModel
    .find({ _id: { $in: categoryRefs } })
    .select({
      _id: 1,
      store: 1,
      name: 1,
      nameEn: 1,
      nameAr: 1,
      providerCategoryId: 1,
    })
    .lean();

  if (categoryDocs.length !== categoryRefs.length) {
    return {
      success: false,
      code: 404,
      message: "One or more categories not found",
    };
  }

  const categoryDocsMap = new Map();

  for (const cat of categoryDocs) {
    if (String(cat.store) !== String(store)) {
      return {
        success: false,
        code: 400,
        message: "One or more categories do not belong to this store",
      };
    }
    categoryDocsMap.set(String(cat._id), cat);
  }

  const categories = inputCategories.map((item) => {
    const categoryRef = item?.categoryRef || item?.category || item?._id || null;
    const catDoc = categoryRef ? categoryDocsMap.get(String(categoryRef)) : null;

    return {
      providerCategoryId:
        toStr(item?.providerCategoryId) ||
        toStr(catDoc?.providerCategoryId) ||
        "",
      name: toStr(item?.name) || toStr(catDoc?.name) || "",
      nameEn: toStr(item?.nameEn) || toStr(catDoc?.nameEn) || "",
      nameAr: toStr(item?.nameAr) || toStr(catDoc?.nameAr) || "",
      categoryRef: catDoc?._id || null,
    };
  });

  return { success: true, categories };
};

const buildPriceState = (payload = {}, currentDoc = null) => {
  const currentCurrency =
    toStr(currentDoc?.price?.currency) ||
    toStr(currentDoc?.salePrice?.currency) ||
    toStr(currentDoc?.priceBefore?.currency) ||
    "SAR";

  const currency =
    toStr(payload?.price?.currency) ||
    toStr(payload?.salePrice?.currency) ||
    toStr(payload?.priceBefore?.currency) ||
    currentCurrency ||
    "SAR";

  const priceBeforeObj =
    payload?.priceBefore !== undefined
      ? normalizePriceObject(payload.priceBefore, currency)
      : normalizePriceObject(currentDoc?.priceBefore, currency);

  let priceObj =
    payload?.price !== undefined
      ? normalizePriceObject(payload.price, currency)
      : normalizePriceObject(currentDoc?.price, currency);

  let salePriceObj =
    payload?.salePrice !== undefined
      ? normalizePriceObject(payload.salePrice, currency)
      : normalizePriceObject(currentDoc?.salePrice, currency);

  let discount =
    payload?.discount !== undefined
      ? clamp(toNum(payload.discount, 0), 0, 100)
      : clamp(toNum(currentDoc?.discount, 0), 0, 100);

  const priceBeforeAmount = Math.max(0, toNum(priceBeforeObj.amount, 0));
  let priceAmount = Math.max(0, toNum(priceObj.amount, 0));
  let salePriceAmount = Math.max(0, toNum(salePriceObj.amount, 0));

  const priceWasProvided = payload?.price !== undefined;
  const salePriceWasProvided = payload?.salePrice !== undefined;
  const recomputeFromDiscount =
    payload?.discount !== undefined || payload?.priceBefore !== undefined;

  if (!salePriceWasProvided) {
    if (priceBeforeAmount > 0 && discount > 0 && (recomputeFromDiscount || salePriceAmount <= 0)) {
      salePriceAmount = +(priceBeforeAmount * (1 - discount / 100)).toFixed(2);
    } else if (salePriceAmount <= 0) {
      salePriceAmount = priceAmount > 0 ? priceAmount : priceBeforeAmount;
    }
  }

  if (!priceWasProvided) {
    if (priceAmount <= 0 || salePriceWasProvided || recomputeFromDiscount) {
      priceAmount = salePriceAmount > 0 ? salePriceAmount : priceBeforeAmount;
    }
  }

  return {
    priceBefore: {
      amount: priceBeforeAmount,
      currency,
    },
    price: {
      amount: Math.max(0, priceAmount),
      currency,
    },
    salePrice: {
      amount: Math.max(0, salePriceAmount > 0 ? salePriceAmount : priceAmount),
      currency,
    },
    discount,
  };
};

const normalizeDocumentImageState = (doc) => {
  const images = Array.isArray(doc.images) ? doc.images.filter(Boolean) : [];
  const normalizedImages = [];
  const seen = new Set();

  for (const img of images) {
    const normalized = normalizeImagePath(img);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    normalizedImages.push(normalized);
  }

  doc.images = normalizedImages;

  const mainImage = normalizeImagePath(doc.mainImage);
  const thumbnail = normalizeImagePath(doc.thumbnail);

  doc.mainImage = mainImage || normalizedImages[0] || "";
  doc.thumbnail = thumbnail || doc.mainImage || "";
};

/* ----------------------------- CRUD ----------------------------- */

exports.createProduct = async (productData) => {
  try {
    const store = await resolveStoreId(productData);

    if (!store) {
      return {
        success: false,
        code: 400,
        message: "store is required",
      };
    }

    const provider = toStr(productData.provider);
    if (!provider) {
      return {
        success: false,
        code: 400,
        message: "provider is required",
      };
    }

    const images = normalizeStringArray(productData.images);
    const mainImage = normalizeImagePath(productData.mainImage) || normalizeImagePath(images[0]) || "";
    const thumbnail = normalizeImagePath(productData.thumbnail) || mainImage || "";

    const { priceBefore, price, salePrice, discount } = buildPriceState(productData);

    const categoriesResult = await resolveCategories(productData, store);
    if (!categoriesResult.success) return categoriesResult;

    const variants = Array.isArray(productData.variants)
      ? productData.variants.map((v) => normalizeVariant(v, price.currency))
      : [];

    const doc = await productModel.create({
      store,
      provider,
      providerProductId: toStr(productData.providerProductId),

      name: toStr(productData.name),
      description: toStr(productData.description),

      images: images.map(normalizeImagePath).filter(Boolean),
      mainImage,
      thumbnail,

      priceBefore,
      price,
      salePrice,

      stock: Math.max(0, toNum(productData.stock, 0)),
      unlimited: toBool(productData.unlimited, false),
      isAvailable: toBool(productData.isAvailable, true),
      isActive: toBool(productData.isActive, true),

      status: toStr(productData.status) || "active",
      sku: toStr(productData.sku),

      categories: categoriesResult.categories,
      variants,

      rating: normalizeRating(productData.rating),
      discount,

      urls: normalizeUrls(productData.urls),

      weight: Math.max(0, toNum(productData.weight, 0)),
      weightUnit: toStr(productData.weightUnit) || "kg",

      raw: productData.raw ?? null,
    });

    normalizeDocumentImageState(doc);
    await doc.save();
    await doc.populate([STORE_POPULATE, PRODUCT_CATEGORIES_POPULATE]);

    return {
      success: true,
      code: 201,
      result: doc,
    };
  } catch (error) {
    if (error?.code === 11000) {
      return {
        success: false,
        code: 409,
        message: "Product already exists for this store/provider/providerProductId",
      };
    }

    return {
      success: false,
      code: 500,
      message: error?.message || "Failed to create product",
    };
  }
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
    sortableFields: [
      "createdAt",
      "name",
      "price",
      "price.amount",
      "priceBefore",
      "priceBefore.amount",
      "salePrice",
      "salePrice.amount",
      "stock",
    ],
    defaultSort: "-createdAt",
  });

  const toNumberOrNull = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  if (normalizedFilter?.storeId) {
    const s = await storeModel
      .findOne({ storeId: String(normalizedFilter.storeId) })
      .select({ _id: 1 })
      .lean();

    delete normalizedFilter.storeId;

    if (!s?._id) {
      return {
        success: true,
        code: 200,
        result: [],
        count: 0,
        page: pageNumber,
        limit: limitNumber,
      };
    }

    normalizedFilter.store = s._id;
  }

  if (normalizedFilter?.category) {
    normalizedFilter["categories.categoryRef"] = normalizedFilter.category;
    delete normalizedFilter.category;
  }

  if (normalizedFilter?.categoryRef) {
    normalizedFilter["categories.categoryRef"] = normalizedFilter.categoryRef;
    delete normalizedFilter.categoryRef;
  }

  if (normalizedFilter?.categoryId) {
    const categoryDoc = await categoryModel
      .findOne({ categoryId: String(normalizedFilter.categoryId) })
      .select({ _id: 1 })
      .lean();

    delete normalizedFilter.categoryId;

    if (!categoryDoc?._id) {
      return {
        success: true,
        code: 200,
        result: [],
        count: 0,
        page: pageNumber,
        limit: limitNumber,
      };
    }

    normalizedFilter["categories.categoryRef"] = categoryDoc._id;
  }

  if (normalizedFilter?.isActive !== undefined) {
    normalizedFilter.isActive = toBool(normalizedFilter.isActive, false);
  }

  if (normalizedFilter?.isAvailable !== undefined) {
    normalizedFilter.isAvailable = toBool(normalizedFilter.isAvailable, false);
  }

  if (normalizedFilter?.unlimited !== undefined) {
    normalizedFilter.unlimited = toBool(normalizedFilter.unlimited, false);
  }

  let minPrice = toNumberOrNull(normalizedFilter.minPrice ?? filterObject?.minPrice);
  let maxPrice = toNumberOrNull(normalizedFilter.maxPrice ?? filterObject?.maxPrice);
  delete normalizedFilter.minPrice;
  delete normalizedFilter.maxPrice;

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  if (minPrice !== null || maxPrice !== null) {
    normalizedFilter["price.amount"] = {};
    if (minPrice !== null) normalizedFilter["price.amount"].$gte = minPrice;
    if (maxPrice !== null) normalizedFilter["price.amount"].$lte = maxPrice;
  }

  const minStock = toNumberOrNull(normalizedFilter.minStock ?? filterObject?.minStock);
  const maxStock = toNumberOrNull(normalizedFilter.maxStock ?? filterObject?.maxStock);
  delete normalizedFilter.minStock;
  delete normalizedFilter.maxStock;

  if (minStock !== null || maxStock !== null) {
    normalizedFilter.stock = {};
    if (minStock !== null) normalizedFilter.stock.$gte = minStock;
    if (maxStock !== null) normalizedFilter.stock.$lte = maxStock;
  }

  const search = normalizeText(
    normalizedFilter.search || normalizedFilter.q || normalizedFilter.keyword
  );
  delete normalizedFilter.q;
  delete normalizedFilter.keyword;

  if (search) {
    normalizedFilter.search = search;
  }

  const finalFilter = applySearchFilter(normalizedFilter, [
    "name",
    "description",
    "sku",
    "categories.name",
    "categories.nameEn",
    "categories.nameAr",
  ]);

  if (normalizedSort.price !== undefined) {
    normalizedSort["price.amount"] = normalizedSort.price;
    delete normalizedSort.price;
  }

  if (normalizedSort.priceBefore !== undefined) {
    normalizedSort["priceBefore.amount"] = normalizedSort.priceBefore;
    delete normalizedSort.priceBefore;
  }

  if (normalizedSort.salePrice !== undefined) {
    normalizedSort["salePrice.amount"] = normalizedSort.salePrice;
    delete normalizedSort.salePrice;
  }

  const priceSort = String(
    filterObject?.priceSort || normalizedFilter?.priceSort || ""
  ).toLowerCase();
  delete normalizedFilter.priceSort;

  if (priceSort === "asc") normalizedSort["price.amount"] = 1;
  if (priceSort === "desc") normalizedSort["price.amount"] = -1;

  let query = productModel
    .find(finalFilter)
    .select(selectionObject)
    .sort(normalizedSort)
    .limit(limitNumber)
    .skip((pageNumber - 1) * limitNumber);

  if (options?.populate) {
    query = query.populate([STORE_POPULATE, PRODUCT_CATEGORIES_POPULATE]);
  }

  const [products, count] = await Promise.all([
    query.lean(),
    productModel.countDocuments(finalFilter),
  ]);

  return {
    success: true,
    code: 200,
    result: products,
    count,
    page: pageNumber,
    limit: limitNumber,
  };
};

exports.getProduct = async (productId) => {
  const doc = await productModel
    .findById(productId)
    .populate([STORE_POPULATE, PRODUCT_CATEGORIES_POPULATE])
    .lean();

  if (!doc) {
    return {
      success: false,
      code: 404,
      message: "Product not found",
    };
  }

  return {
    success: true,
    code: 200,
    result: doc,
  };
};

exports.updateProduct = async (productId, payload) => {
  try {
    const doc = await productModel.findById(productId);
    if (!doc) {
      return {
        success: false,
        code: 404,
        message: "Product not found",
      };
    }

    let nextStore = doc.store;

    if (payload?.store || payload?.storeId) {
      const resolvedStore = await resolveStoreId(payload);
      if (!resolvedStore) {
        return {
          success: false,
          code: 404,
          message: "Store not found",
        };
      }

      nextStore = resolvedStore;
      doc.store = resolvedStore;
    }

    if (
      payload?.categories !== undefined ||
      payload?.category !== undefined
    ) {
      const categoriesResult = await resolveCategories(payload, nextStore);
      if (!categoriesResult.success) return categoriesResult;
      doc.categories = categoriesResult.categories;
    }

    if (payload?.provider !== undefined) doc.provider = toStr(payload.provider);
    if (payload?.providerProductId !== undefined) {
      doc.providerProductId = toStr(payload.providerProductId);
    }

    if (payload?.name !== undefined) doc.name = toStr(payload.name);
    if (payload?.description !== undefined) doc.description = toStr(payload.description);

    if (payload?.images !== undefined) {
      doc.images = normalizeStringArray(payload.images)
        .map(normalizeImagePath)
        .filter(Boolean);
    }

    if (payload?.mainImage !== undefined) {
      doc.mainImage = normalizeImagePath(payload.mainImage);
    }

    if (payload?.thumbnail !== undefined) {
      doc.thumbnail = normalizeImagePath(payload.thumbnail);
    }

    if (
      payload?.priceBefore !== undefined ||
      payload?.price !== undefined ||
      payload?.salePrice !== undefined ||
      payload?.discount !== undefined
    ) {
      const nextPrices = buildPriceState(payload, doc);
      doc.priceBefore = nextPrices.priceBefore;
      doc.price = nextPrices.price;
      doc.salePrice = nextPrices.salePrice;
      doc.discount = nextPrices.discount;
    }

    if (payload?.stock !== undefined) {
      doc.stock = Math.max(0, toNum(payload.stock, 0));
    }

    if (payload?.unlimited !== undefined) {
      doc.unlimited = toBool(payload.unlimited, false);
    }

    if (payload?.isAvailable !== undefined) {
      doc.isAvailable = toBool(payload.isAvailable, true);
    }

    if (payload?.isActive !== undefined) {
      doc.isActive = toBool(payload.isActive, true);
    }

    if (payload?.status !== undefined) doc.status = toStr(payload.status);
    if (payload?.sku !== undefined) doc.sku = toStr(payload.sku);

    if (payload?.variants !== undefined) {
      const currency =
        toStr(payload?.price?.currency) ||
        toStr(doc?.price?.currency) ||
        "SAR";

      doc.variants = Array.isArray(payload.variants)
        ? payload.variants.map((v) => normalizeVariant(v, currency))
        : [];
    }

    if (payload?.rating !== undefined) {
      doc.rating = normalizeRating(payload.rating);
    }

    if (payload?.urls !== undefined) {
      doc.urls = normalizeUrls(payload.urls);
    }

    if (payload?.weight !== undefined) {
      doc.weight = Math.max(0, toNum(payload.weight, 0));
    }

    if (payload?.weightUnit !== undefined) {
      doc.weightUnit = toStr(payload.weightUnit) || "kg";
    }

    if (payload?.raw !== undefined) {
      doc.raw = payload.raw ?? null;
    }

    normalizeDocumentImageState(doc);

    await doc.save();
    await doc.populate([STORE_POPULATE, PRODUCT_CATEGORIES_POPULATE]);

    return {
      success: true,
      code: 200,
      result: doc,
    };
  } catch (error) {
    if (error?.code === 11000) {
      return {
        success: false,
        code: 409,
        message: "Product already exists for this store/provider/providerProductId",
      };
    }

    return {
      success: false,
      code: 500,
      message: error?.message || "Failed to update product",
    };
  }
};

exports.deleteProduct = async (_id, deletePermanently = false) => {
  if (!_id) {
    return {
      success: false,
      code: 400,
      message: "invalid id",
    };
  }

  if (deletePermanently) {
    const deleted = await productModel.findByIdAndDelete(_id).lean();

    if (!deleted) {
      return {
        success: false,
        code: 404,
        message: "Product not found",
      };
    }

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

    return {
      success: true,
      code: 200,
      result: { message: "success.record_deleted" },
    };
  }

  const updated = await productModel
    .findByIdAndUpdate(_id, { isActive: false }, { new: true })
    .lean();

  if (!updated) {
    return {
      success: false,
      code: 404,
      message: "Product not found",
    };
  }

  return {
    success: true,
    code: 200,
    result: { message: "success.record_disabled" },
  };
};

/* ----------------------------- Images ----------------------------- */

exports.uploadProductImages = async (productId, files) => {
  if (!productId) {
    return {
      success: false,
      code: 400,
      message: "productId is required",
    };
  }

  if (!Array.isArray(files) || files.length === 0) {
    return {
      success: false,
      code: 400,
      message: "images are required",
    };
  }

  const doc = await productModel.findById(productId);
  if (!doc) {
    for (const f of files) {
      try {
        if (f?.path) fs.unlinkSync(f.path);
      } catch (_) {}
    }

    return {
      success: false,
      code: 404,
      message: "Product not found",
    };
  }

  const uploadedUrls = files
    .filter((f) => f?.filename)
    .map((f) => `/images/products/${productId}/${f.filename}`)
    .map(normalizeImagePath)
    .filter(Boolean);

  const current = Array.isArray(doc.images) ? doc.images : [];
  const seen = new Set(current.map((x) => normalizeImagePath(x)).filter(Boolean));

  for (const u of uploadedUrls) {
    if (!seen.has(u)) {
      current.push(u);
      seen.add(u);
    }
  }

  doc.images = current.map(normalizeImagePath).filter(Boolean);

  if (!normalizeImagePath(doc.mainImage)) {
    doc.mainImage = doc.images[0] || "";
  }

  if (!normalizeImagePath(doc.thumbnail)) {
    doc.thumbnail = normalizeImagePath(doc.mainImage) || doc.images[0] || "";
  }

  await doc.save();

  return {
    success: true,
    code: 200,
    message: "Product images updated",
    result: {
      productId: String(doc._id),
      images: doc.images,
      mainImage: doc.mainImage,
      thumbnail: doc.thumbnail,
    },
  };
};

exports.removeProductImage = async (productId, imageUrl) => {
  if (!productId) {
    return {
      success: false,
      code: 400,
      message: "productId is required",
    };
  }

  if (!imageUrl) {
    return {
      success: false,
      code: 400,
      message: "imageUrl is required",
    };
  }

  const normalizedUrl = normalizeImagePath(imageUrl);
  const allowedPrefix = `/images/products/${productId}/`;

  if (!normalizedUrl.startsWith(allowedPrefix)) {
    return {
      success: false,
      code: 400,
      message: "Invalid imageUrl",
    };
  }

  const doc = await productModel.findById(productId);
  if (!doc) {
    return {
      success: false,
      code: 404,
      message: "Product not found",
    };
  }

  const current = Array.isArray(doc.images) ? doc.images : [];
  const removeIndex = current.findIndex(
    (x) => normalizeImagePath(x) === normalizedUrl
  );

  if (removeIndex === -1) {
    return {
      success: false,
      code: 404,
      message: "Image not found in product",
    };
  }

  current.splice(removeIndex, 1);
  doc.images = current.map(normalizeImagePath).filter(Boolean);

  if (normalizeImagePath(doc.mainImage) === normalizedUrl) {
    doc.mainImage = doc.images[0] || "";
  }

  if (normalizeImagePath(doc.thumbnail) === normalizedUrl) {
    doc.thumbnail = doc.mainImage || doc.images[0] || "";
  }

  await doc.save();

  const relative = normalizedUrl.replace(/^\/+/, "");
  const roots = [
    path.join(process.cwd(), "public"),
    process.cwd(),
    path.join(process.cwd(), "uploads"),
    path.join(process.cwd(), "storage"),
  ];

  let deleted = false;

  for (const root of roots) {
    try {
      const filePath = path.resolve(path.join(root, relative));
      const rootPath = path.resolve(root);

      if (!filePath.startsWith(rootPath + path.sep)) continue;

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted = true;

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
    result: {
      productId: String(doc._id),
      images: doc.images,
      mainImage: doc.mainImage,
      thumbnail: doc.thumbnail,
    },
  };
};

exports.clearProductImages = async (productId) => {
  if (!productId) {
    return {
      success: false,
      code: 400,
      message: "productId is required",
    };
  }

  const doc = await productModel.findById(productId);
  if (!doc) {
    return {
      success: false,
      code: 404,
      message: "Product not found",
    };
  }

  doc.images = [];
  doc.mainImage = "";
  doc.thumbnail = "";
  await doc.save();

  const dirs = [
    path.join(process.cwd(), "public", "images", "products", String(productId)),
    path.join(process.cwd(), "uploads", "images", "products", String(productId)),
    path.join(process.cwd(), "storage", "images", "products", String(productId)),
  ];

  for (const dir of dirs) {
    try {
      if (fs.existsSync(dir)) {
        if (fs.rmSync) fs.rmSync(dir, { recursive: true, force: true });
        else fs.rmdirSync(dir, { recursive: true });
      }
    } catch (_) {}
  }

  return {
    success: true,
    code: 200,
    message: "Product images cleared",
    result: {
      productId: String(doc._id),
      images: [],
      mainImage: "",
      thumbnail: "",
    },
  };
};