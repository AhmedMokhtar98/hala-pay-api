// models/group/group.repo.js
const fs = require("fs");
const path = require("path");

const applySearchFilter = require("../../helpers/applySearchFilter");
const prepareQueryObjects = require("../../helpers/prepareQueryObjects");
const mongoose = require("mongoose");
const YallaPayOrder = require("../order/order.model");

const {
  NotFoundException,
  BadRequestException,
} = require("../../middlewares/errorHandler/exceptions");

const groupModel = require("./group.model");
const productModel = require("../product/product.model"); // adjust if needed
const clientModel = require("../client/client.model");
const { createYallaPayOrder } = require("../../providers/salla/services/order.service");
const { normalizeAssetUrl } = require("../../helpers/url.helper");
const PUBLIC_DIR = path.join(process.cwd(), "public");

/* ---------------------------
  Utils
--------------------------- */

function normStr(v) {
  return String(v || "").trim();
}

function normNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeUnlink(p) {
  if (!p) return;
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {}
}

/**
 * Product must exist (return full doc so you can use price + store)
 * - no ObjectId validation here (handled in Joi)
 */
async function resolveProductOrThrow(productId) {
  if (!productId) throw new BadRequestException("errors.required_product");

  const doc = await productModel.findById(productId).lean();
  if (!doc) throw new NotFoundException("errors.product_not_found");

  // product must have store (we don't validate its format here)
  if (!doc.store) {
    throw new BadRequestException("errors.product_store_missing");
  }

  return doc; // { _id, price, store, ... }
}

/**
 * Always populate the same way (no options)
 */
function populateGroupQuery(query) {
  return query
    .populate("store", "businessName storeId logo")
    .populate("product", "name title images image price")
    .populate("creator", "firstName lastName phone email image")
    .populate("contributors.client", "firstName lastName phone email image");
}
function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizePhoneDigits(value = "") {
  return String(value).replace(/[^\d]/g, "").trim();
}

function sanitizePhoneCode(value = "") {
  const digits = sanitizePhoneDigits(value);
  return digits ? `+${digits}` : "";
}

function isPhoneLikeSearch(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return false;
  return /^[+]?\d[\d\s\-()]{5,}$/.test(raw);
}

function appendAndCondition(baseFilter = {}, extraCondition = {}) {
  if (!extraCondition || Object.keys(extraCondition).length === 0) return baseFilter;
  if (!baseFilter || Object.keys(baseFilter).length === 0) return extraCondition;

  return {
    $and: [baseFilter, extraCondition],
  };
}

function buildPhoneCandidates({ search = "", phone = "", phoneCode = "", phoneNumber = "" }) {
  const exactPhoneNumbers = new Set();
  const fullPhones = new Set();

  const addPhoneNumberVariants = (digits) => {
    const clean = sanitizePhoneDigits(digits);
    if (!clean) return;

    exactPhoneNumbers.add(clean);

    if (clean.startsWith("0") && clean.length > 1) {
      exactPhoneNumbers.add(clean.slice(1));
    }

    if (clean.startsWith("20") && clean.length > 2) {
      const local = clean.slice(2);
      exactPhoneNumbers.add(local);

      if (!local.startsWith("0")) {
        exactPhoneNumbers.add(`0${local}`);
      }
    }
  };

  const addFullPhoneVariants = (rawValue) => {
    const raw = String(rawValue || "").trim();
    if (!raw) return;

    const digits = sanitizePhoneDigits(raw);
    if (!digits) return;

    if (raw.startsWith("+")) {
      fullPhones.add(`+${digits}`);
    }

    if (digits.startsWith("20")) {
      fullPhones.add(`+${digits}`);
    }
  };

  if (phoneNumber) {
    addPhoneNumberVariants(phoneNumber);
  }

  if (phoneCode && phoneNumber) {
    const code = sanitizePhoneCode(phoneCode);
    const numberDigits = sanitizePhoneDigits(phoneNumber);
    const local = numberDigits.startsWith("0")
      ? numberDigits.slice(1)
      : numberDigits;

    if (code && local) {
      fullPhones.add(`${code}${local}`);
    }
  }

  if (phone) {
    addPhoneNumberVariants(phone);
    addFullPhoneVariants(phone);
  }

  if (search && isPhoneLikeSearch(search)) {
    addPhoneNumberVariants(search);
    addFullPhoneVariants(search);
  }

  return {
    exactPhoneNumbers: [...exactPhoneNumbers].filter(Boolean),
    fullPhones: [...fullPhones].filter(Boolean),
  };
}
/* ---------------------------
  CRUD
--------------------------- */
exports.createGroup = async (groupData = {}) => {
  const name = normStr(groupData.name);
  if (!name) throw new BadRequestException("errors.required_group_name");

  const product = await resolveProductOrThrow(groupData.product);

  const price = normNum(product.price.amount, NaN);
  if (!Number.isFinite(price) || price < 0) {
    throw new BadRequestException("errors.invalid_product_price");
  }

  // ✅ build contributors list (push creator/client as first contributor)
  const creatorClient = groupData.creator; // should be client ObjectId (validated by Joi)
  const contributors = Array.isArray(groupData.contributors)
    ? [...groupData.contributors]
    : [];

  if (creatorClient) {
    const alreadyAdded = contributors.some(
      (c) => String(c?.client) === String(creatorClient)
    );

    if (!alreadyAdded) {
      contributors.unshift({
        client: creatorClient,
        paidAmount: 0,
        paidAt: null,
        transactionStatus: false,
      });
    }
  }

  const created = await groupModel.create({
    name,
    description: normStr(groupData.description),
    image: normStr(groupData.image),
    creator: creatorClient,

    product: product._id,
    store: String(product.store), // derived from product
    targetAmount: price,          // derived from product price
    collectedAmount: 0,

    contributors, // ✅ includes creator

    status: groupData.status || "active",
    deadLine: groupData.deadLine || null,
    isActive: groupData.isActive !== undefined ? !!groupData.isActive : true,
  });

  const doc = await populateGroupQuery(groupModel.findById(created._id)).lean();
  return { success: true, code: 201, result: doc };
};

exports.listGroups = async (filterObject = {}, selectionObject = {}, sortObject = {}) => {
  const {
    search,
    phone,
    phoneCode,
    phoneNumber,
    ...restFilterObject
  } = filterObject || {};

  const rawSearch = String(search || "").trim();
  const searchLooksLikePhone = isPhoneLikeSearch(rawSearch);

  const {
    filterObject: normalizedFilter,
    sortObject: normalizedSort,
    pageNumber,
    limitNumber,
  } = prepareQueryObjects(restFilterObject, sortObject, {
    sortableFields: ["createdAt", "name", "targetAmount", "collectedAmount", "deadLine", "status"],
    defaultSort: "-createdAt",
  });

  /* ---------------- targetAmount range (price from/to) ---------------- */

  const toNumOrNull = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const minTargetAmount = toNumOrNull(
    normalizedFilter.minPrice ??
      normalizedFilter.from ??
      normalizedFilter.minTargetAmount ??
      normalizedFilter.minTarget ??
      normalizedFilter.targetFrom
  );

  const maxTargetAmount = toNumOrNull(
    normalizedFilter.maxPrice ??
      normalizedFilter.to ??
      normalizedFilter.maxTargetAmount ??
      normalizedFilter.maxTarget ??
      normalizedFilter.targetTo
  );

  [
    "minPrice",
    "maxPrice",
    "from",
    "to",
    "minTargetAmount",
    "maxTargetAmount",
    "minTarget",
    "maxTarget",
    "targetFrom",
    "targetTo",
  ].forEach((k) => delete normalizedFilter[k]);

  if (minTargetAmount !== null || maxTargetAmount !== null) {
    normalizedFilter.targetAmount = {
      ...(minTargetAmount !== null ? { $gte: minTargetAmount } : {}),
      ...(maxTargetAmount !== null ? { $lte: maxTargetAmount } : {}),
    };
  }

  /* ---------------- search ---------------- */

  let finalFilter = { ...normalizedFilter };

  if (rawSearch && !searchLooksLikePhone) {
    const safeRegex = new RegExp(escapeRegex(rawSearch), "i");

    finalFilter = appendAndCondition(finalFilter, {
      $or: [
        { name: safeRegex },
        { description: safeRegex },
      ],
    });
  }

  /* ---------------- phone search: creator + contributors.client ---------------- */

  const phoneCandidates = buildPhoneCandidates({
    search,
    phone,
    phoneCode,
    phoneNumber,
  });

  const hasPhoneSearch =
    phoneCandidates.exactPhoneNumbers.length > 0 ||
    phoneCandidates.fullPhones.length > 0;

  if (hasPhoneSearch) {
    const clientPhoneOrConditions = [];

    if (phoneCandidates.exactPhoneNumbers.length) {
      clientPhoneOrConditions.push({
        phoneNumber: { $in: phoneCandidates.exactPhoneNumbers },
      });
    }

    for (const fullPhone of phoneCandidates.fullPhones) {
      clientPhoneOrConditions.push({
        $expr: {
          $eq: [{ $concat: ["$phoneCode", "$phoneNumber"] }, fullPhone],
        },
      });
    }

    const matchedClients = await clientModel
      .find({ $or: clientPhoneOrConditions }, { _id: 1 })
      .lean();

    const matchedClientIds = matchedClients.map((item) => item._id);

    if (!matchedClientIds.length) {
      return {
        success: true,
        code: 200,
        result: [],
        count: 0,
        page: pageNumber,
        limit: limitNumber,
      };
    }

    finalFilter = appendAndCondition(finalFilter, {
      $or: [
        { creator: { $in: matchedClientIds } },
        { "contributors.client": { $in: matchedClientIds } },
      ],
    });
  }

  /* ---------------- selection safety ---------------- */

  const ensureStoreSelected = (sel = {}) => {
    if (!sel || Object.keys(sel).length === 0) return sel;

    const values = Object.values(sel).map((v) => Number(v));
    const isIncludeMode = values.some((v) => v === 1);

    if (isIncludeMode) {
      return {
        ...sel,
        store: 1,
        product: 1,
        contributors: 1,
        creator: 1,
      };
    }

    return sel;
  };

  const safeSelection = ensureStoreSelected(selectionObject);

  /* ---------------- query ---------------- */

  const query = populateGroupQuery(
    groupModel
      .find(finalFilter)
      .select(safeSelection)
      .sort(normalizedSort)
      .limit(limitNumber)
      .skip((pageNumber - 1) * limitNumber)
  );

  const [groups, count] = await Promise.all([
    query.lean(),
    groupModel.countDocuments(finalFilter),
  ]);

  /* ---------------- normalize assets ---------------- */

  const normalizeImagesArray = (arr) =>
    Array.isArray(arr) ? arr.map((img) => normalizeAssetUrl(img)) : arr;

  const normalizeParticipant = (item) => {
    if (!item || typeof item !== "object") return item;

    return {
      ...item,
      image: normalizeAssetUrl(item.image),
      avatar: normalizeAssetUrl(item.avatar),
      logo: normalizeAssetUrl(item.logo),
      images: normalizeImagesArray(item.images),
    };
  };

  const normalizedGroups = groups.map((group) => ({
    ...group,

    image: normalizeAssetUrl(group.image),
    logo: normalizeAssetUrl(group.logo),
    images: normalizeImagesArray(group.images),

    store: group.store
      ? {
          ...group.store,
          logo: normalizeAssetUrl(group.store.logo),
          image: normalizeAssetUrl(group.store.image),
          images: normalizeImagesArray(group.store.images),
        }
      : group.store,

    product: group.product
      ? {
          ...group.product,
          image: normalizeAssetUrl(group.product.image),
          logo: normalizeAssetUrl(group.product.logo),
          images: normalizeImagesArray(group.product.images),
          mainImage: normalizeAssetUrl(group.product.mainImage),
          thumbnail: normalizeAssetUrl(group.product.thumbnail),
        }
      : group.product,

    creator: group.creator ? normalizeParticipant(group.creator) : group.creator,

    contributors: Array.isArray(group.contributors)
      ? group.contributors.map((contributor) => ({
          ...contributor,
          client: contributor?.client
            ? normalizeParticipant(contributor.client)
            : contributor?.client,
        }))
      : group.contributors,
  }));

  return {
    success: true,
    code: 200,
    result: normalizedGroups,
    count,
    page: pageNumber,
    limit: limitNumber,
  };
};
exports.getGroup = async (groupId) => {
  const doc = await populateGroupQuery(groupModel.findById(groupId)).lean();
  if (!doc) throw new NotFoundException("errors.group_not_found");

  const normalizeImagesArray = (arr) =>
    Array.isArray(arr) ? arr.map((img) => normalizeAssetUrl(img)) : arr;

  const normalizeParticipant = (item) => {
    if (!item || typeof item !== "object") return item;

    return {
      ...item,
      image: normalizeAssetUrl(item.image),
      avatar: normalizeAssetUrl(item.avatar),
      logo: normalizeAssetUrl(item.logo),
      images: normalizeImagesArray(item.images),
    };
  };

  const normalizedGroup = {
    ...doc,

    image: normalizeAssetUrl(doc.image),
    logo: normalizeAssetUrl(doc.logo),
    images: normalizeImagesArray(doc.images),

    store: doc.store
      ? {
          ...doc.store,
          logo: normalizeAssetUrl(doc.store.logo),
          image: normalizeAssetUrl(doc.store.image),
          images: normalizeImagesArray(doc.store.images),
        }
      : doc.store,

    product: doc.product
      ? {
          ...doc.product,
          image: normalizeAssetUrl(doc.product.image),
          logo: normalizeAssetUrl(doc.product.logo),
          images: normalizeImagesArray(doc.product.images),
          mainImage: normalizeAssetUrl(doc.product.mainImage),
          thumbnail: normalizeAssetUrl(doc.product.thumbnail),
        }
      : doc.product,

    creator: doc.creator ? normalizeParticipant(doc.creator) : doc.creator,

    contributors: Array.isArray(doc.contributors)
      ? doc.contributors.map(normalizeParticipant)
      : doc.contributors,
  };

  return {
    success: true,
    code: 200,
    result: normalizedGroup,
  };
};

exports.updateGroup = async (groupId, body = {}) => {
  const existing = await groupModel.findById(groupId).select({ _id: 1 }).lean();
  if (!existing) throw new NotFoundException("errors.group_not_found");

  // normalize name if provided
  if (body?.name !== undefined) {
    const name = normStr(body.name);
    if (!name) throw new BadRequestException("errors.required_group_name");
    body.name = name;
  }

  // if product changes => validate + sync store + sync targetAmount
  if (body?.product !== undefined) {
    const productDoc = await resolveProductOrThrow(body.product);

    body.product = productDoc._id;
    body.store = String(productDoc.store);

    const price = normNum(productDoc.price, NaN);
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException("errors.invalid_product_price");
    }
    body.targetAmount = price;
  }

  // validate numbers if provided
  if (body?.targetAmount !== undefined) {
    const targetAmount = normNum(body.targetAmount, NaN);
    if (!Number.isFinite(targetAmount) || targetAmount < 0) {
      throw new BadRequestException("errors.invalid_target_amount");
    }
    body.targetAmount = targetAmount;
  }

  if (body?.collectedAmount !== undefined) {
    const collectedAmount = normNum(body.collectedAmount, NaN);
    if (!Number.isFinite(collectedAmount) || collectedAmount < 0) {
      throw new BadRequestException("errors.invalid_collected_amount");
    }
    body.collectedAmount = collectedAmount;
  }

  const updated = await groupModel.findByIdAndUpdate(groupId, body, {
    new: true,
  });

  if (!updated) throw new NotFoundException("errors.group_not_found");

  /* =========================================================
     🔥 AUTO PURCHASE TRIGGER
  ========================================================= */

  try {
    if (
      updated.collectedAmount >= updated.targetAmount &&
      updated.status !== "purchased"
    ) {
      // 🔥 Don't block response if purchase fails
      await checkAndPurchaseGroup(updated._id);
    }
  } catch (err) {
    console.error("Auto purchase failed:", err.message);
  }

  const doc = await populateGroupQuery(
    groupModel.findById(updated._id)
  ).lean();

  return {
    success: true,
    code: 200,
    result: doc,
  };
};

exports.deleteGroup = async (_id, permanent = false) => {
  if (permanent) {
    const deleted = await groupModel.findByIdAndDelete(_id).lean();
    if (!deleted) throw new NotFoundException("errors.group_not_found");

    try {
      const groupDir = path.join(PUBLIC_DIR, "images", "groups", String(_id));
      if (fs.existsSync(groupDir)) {
        fs.rmSync(groupDir, { recursive: true, force: true });
      }
    } catch (_) {}

    return {
      success: true,
      code: 200,
      message: "success.record_deleted",
    };
  }

  const updated = await groupModel
    .findByIdAndUpdate(
      _id,
      { isActive: false },
      { new: true }
    )
    .lean();

  if (!updated) {
    throw new NotFoundException("errors.group_not_found");
  }

  return {
    success: true,
    code: 200,
    message: "success.record_disabled",
  };
};

/* ---------------------------
  Image Upload (STRING) + Remove
--------------------------- */

exports.uploadGroupImage = async (groupId, file) => {
  if (!groupId) {
    if (file?.path) safeUnlink(file.path);
    throw new BadRequestException("errors.required_group_id");
  }

  if (!file?.filename) throw new BadRequestException("errors.required_image");

  const doc = await groupModel.findById(groupId);
  if (!doc) {
    if (file?.path) safeUnlink(file.path);
    throw new NotFoundException("errors.group_not_found");
  }

  const imageUrl = `/images/groups/${groupId}/${file.filename}`;

  const oldUrl = doc.image;
  const prefix = `/images/groups/${groupId}/`;

  if (oldUrl && typeof oldUrl === "string" && oldUrl.startsWith(prefix)) {
    const oldFileName = oldUrl.split("/").pop();
    if (oldFileName && oldFileName !== file.filename) {
      const oldAbsPath = path.join(
        PUBLIC_DIR,
        "images",
        "groups",
        String(groupId),
        oldFileName
      );
      safeUnlink(oldAbsPath);
    }
  }

  doc.image = imageUrl;
  await doc.save();

  const populated = await populateGroupQuery(groupModel.findById(groupId)).lean();

  return {
    success: true,
    code: 200,
    message: "success.image_updated",
    result: populated,
  };
};

exports.removeGroupImage = async (groupId) => {
  if (!groupId) throw new BadRequestException("errors.required_group_id");

  const doc = await groupModel.findById(groupId);
  if (!doc) throw new NotFoundException("errors.group_not_found");

  const oldUrl = doc.image;
  const prefix = `/images/groups/${groupId}/`;

  if (oldUrl && typeof oldUrl === "string" && oldUrl.startsWith(prefix)) {
    const oldFileName = oldUrl.split("/").pop();
    if (oldFileName) {
      const oldAbsPath = path.join(
        PUBLIC_DIR,
        "images",
        "groups",
        String(groupId),
        oldFileName
      );
      safeUnlink(oldAbsPath);
    }

    try {
      const dir = path.join(PUBLIC_DIR, "images", "groups", String(groupId));
      if (fs.existsSync(dir)) {
        const remaining = fs.readdirSync(dir);
        if (!remaining.length) fs.rmdirSync(dir);
      }
    } catch (_) {}
  }

  doc.image = "";
  await doc.save();

  const populated = await populateGroupQuery(groupModel.findById(groupId)).lean();

  return {
    success: true,
    code: 200,
    message: "success.image_removed",
    result: populated,
  };
};


/**
 * 🔥 Safely purchase funded group
 * - Prevents race conditions
 * - Prevents duplicate orders
 * - Uses transaction
 * - Uses purchaseLock
 */
async function checkAndPurchaseGroup(groupId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const group = await groupModel.findById(groupId).session(session);
    if (!group) throw new Error("Group not found");

    // 🛑 Already purchased
    if (group.status === "purchased") {
      await session.abortTransaction();
      session.endSession();
      return null;
    }

    // 🛑 Not fully funded
    if (group.collectedAmount < group.targetAmount) {
      await session.abortTransaction();
      session.endSession();
      return null;
    }

    // 🛑 Someone already processing it
    if (group.purchaseLock === true) {
      await session.abortTransaction();
      session.endSession();
      return null;
    }

    // 🔐 Lock group
    group.purchaseLock = true;
    await group.save({ session });

    // 🛑 Double safety (idempotency)
    const existingOrder = await YallaPayOrder.findOne({
      group: group._id,
    }).session(session);

    if (existingOrder) {
      group.status = "purchased";
      group.providerOrderId = existingOrder.providerOrderId;
      group.purchasedAt = new Date();
      group.purchaseLock = false;

      await group.save({ session });
      await session.commitTransaction();
      session.endSession();

      return existingOrder;
    }

    await session.commitTransaction();
    session.endSession();

    // 🚀 Call Salla OUTSIDE transaction
    const order = await createYallaPayOrder({ group });

    await groupModel.updateOne(
      { _id: group._id },
      {
        $set: {
          status: "purchased",
          providerOrderId: order.providerOrderId,
          purchasedAt: new Date(),
          purchaseLock: false,
        },
      }
    );

    return order;

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    // 🔓 Unlock on failure
    await groupModel.updateOne(
      { _id: groupId },
      { $set: { purchaseLock: false } }
    );

    throw err;
  }
}

/**
 * Optional manual trigger wrapper
 */
async function purchaseGroupNow(groupId) {
  const order = await checkAndPurchaseGroup(groupId);

  return {
    success: true,
    code: 200,
    result: order,
  };
}

module.exports = {
  createGroup: exports.createGroup,
  listGroups: exports.listGroups,
  getGroup: exports.getGroup,
  updateGroup: exports.updateGroup,
  deleteGroup: exports.deleteGroup,
  uploadGroupImage: exports.uploadGroupImage,
  removeGroupImage: exports.removeGroupImage,
  checkAndPurchaseGroup,
  purchaseGroupNow,
};