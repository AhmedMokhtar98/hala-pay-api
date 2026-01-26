// store.repo.js
const applySearchFilter = require("../../helpers/applySearchFilter");
const { generateDummyStoreToken } = require("../../helpers/jwt.helper");
const prepareQueryObjects = require("../../helpers/prepareQueryObjects");
const { ConflictException } = require("../../middlewares/errorHandler/exceptions");
const { axiosRequest } = require("../../salla/services/axiosRequest.service");
const { ensureValidAccessToken } = require("../../salla/services/sallaToken.service");
const {
  expiresAtFromSeconds,
  random9Digits,
  toPositiveInt,
  normalizeText,
  pickPagination,
} = require("../../utils/helpers");

const storeModel = require("./store.model");
const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(process.cwd(), "public");

exports.createStore = async (storeData) => {
  const existingStore = await storeModel.findOne({
    businessName: storeData.businessName,
  });
  if (existingStore) {
    throw new ConflictException("Store with this business name already exists");
  }

  const { accessToken, refreshToken, refreshExpiry } =
    await generateDummyStoreToken(storeData);

  const newStore = new storeModel({
    businessName: storeData.businessName || "",
    storeId: random9Digits(),
    accessToken,
    refreshToken,
    expiresAt: expiresAtFromSeconds(refreshExpiry),
  });

  await newStore.save();
  return { success: true, code: 201, result: newStore };
};

exports.listStores = async (
  filterObject,
  selectionObject = {},
  sortObject = {}
) => {
  const {
    filterObject: normalizedFilter,
    sortObject: normalizedSort,
    pageNumber,
    limitNumber,
  } = prepareQueryObjects(filterObject, sortObject, {
    sortableFields: ["createdAt", "businessName"],
    defaultSort: "-createdAt",
  });

  const finalFilter = applySearchFilter(normalizedFilter, ["businessName"]);

  const [stores, count] = await Promise.all([
    storeModel
      .find(finalFilter)
      .select(selectionObject)
      .sort(normalizedSort)
      .limit(limitNumber)
      .skip((pageNumber - 1) * limitNumber)
      .lean(),
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
  const store = await storeModel.findById(storeId).lean();
  if (!store) return { success: false, code: 404, message: "Store not found" };
  return { success: true, code: 200, result: store };
};

exports.updateStore = async (storeId, payload) => {
  const doc = await storeModel.findById(storeId);
  if (!doc) return { success: false, code: 404, message: "Store not found" };

  Object.keys(payload || {}).forEach((key) => {
    doc[key] = payload[key];
  });

  await doc.save();
  return { success: true, code: 200, result: doc };
};

exports.getProducts = async (filterObject, storeId) => {
  const page = toPositiveInt(filterObject.page, 1);
  const per_page = toPositiveInt(filterObject.limit, 20);
  const search = normalizeText(filterObject.search || filterObject.q || filterObject.keyword);

  const accessToken = await ensureValidAccessToken(storeId);

  const params = { page, per_page };
  if (search) params.keyword = search;

  const resp = await axiosRequest({
    accessToken,
    method: "GET",
    path: "/admin/v2/products",
    params,
  });

  const data = resp?.data || {};
  const list = data?.data || [];
  const meta = pickPagination(data, { page, per_page, listLen: list.length });

  return {
    success: true,
    code: 200,
    result: list,
    count: meta.count,
    page: meta.page,
    limit: meta.limit,
  };
};

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

  const storeDir = path.join(PUBLIC_DIR, "images", "stores", String(doc.storeId));
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

  const imageUrl = `/images/stores/${doc.storeId}/${file.filename}`;
  doc.logo = imageUrl;
  await doc.save();

  return {
    success: true,
    code: 200,
    message: "Store logo updated",
    result: {
      storeId: doc.storeId,
      imageUrl: doc.logo,
    },
  };
};

exports.removeStoreImage = async (_id) => {
  if (!_id) return { success: false, code: 400, message: "_id is required" };

  const doc = await storeModel.findById(_id);
  if (!doc) return { success: false, code: 404, message: "Store not found" };

  const storeDir = path.join(PUBLIC_DIR, "images", "stores", String(doc.storeId));
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
    result: { storeId: doc.storeId, imageUrl: "" },
  };
};

exports.deleteStore = async (_id, deletePermanently = false) => {
  if (!_id) return { success: false, code: 400, message: "invalid id" };

  if (deletePermanently) {
    const deleted = await storeModel.findByIdAndDelete(_id).lean();
    if (!deleted) return { success: false, code: 404, message: "Store not found" };

    try {
      const storeDir = path.join(PUBLIC_DIR, "images", "stores", String(deleted.storeId));
      if (fs.existsSync(storeDir)) {
        fs.rmSync(storeDir, { recursive: true, force: true });
      }
    } catch (_) {}

    return { success: true, code: 200, result: { message: "success.record_deleted" } };
  }

  const updated = await storeModel
    .findOneAndUpdate({ _id, isActive: true }, { isActive: false }, { new: true })
    .lean();

  if (!updated) return { success: false, code: 404, message: "Store not found" };

  return { success: true, code: 200, result: { message: "success.record_disabled" } };
};