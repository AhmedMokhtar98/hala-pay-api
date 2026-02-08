// models/group/group.client.repo.js
const path = require("path");
const fs = require("fs");

const applySearchFilter = require("../../helpers/applySearchFilter");
const prepareQueryObjects = require("../../helpers/prepareQueryObjects");

const {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} = require("../../middlewares/errorHandler/exceptions");

const groupModel = require("./group.model");
const productModel = require("../product/product.model"); // adjust if needed

const PUBLIC_DIR = path.join(process.cwd(), "public");

/* ---------------------------
  Helpers
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

async function resolveProductOrThrow(productId) {
  if (!productId) throw new BadRequestException("errors.required_product");

  const doc = await productModel.findById(productId).lean();
  if (!doc) throw new NotFoundException("errors.product_not_found");

  if (!doc.store) throw new BadRequestException("errors.product_store_missing");
  return doc;
}

function populateGroupQuery(query) {
  return query
    .populate("store", "businessName storeId logo")
    .populate("product", "name title images image price")
    .populate("contributors.client", "firstName lastName phone email image")
    .populate("creator", "firstName lastName phone email image");
}

function belongsFilter(clientId) {
  return {
    $or: [{ creator: clientId }, { "contributors.client": clientId }],
  };
}

/**
 * creator-only guard:
 * - if group exists but not owned => 403
 * - if not exists => 404
 */
async function assertCreatorOrThrow(clientId, groupId) {
  if (!clientId) throw new BadRequestException("errors.unauthorized");

  const owned = await groupModel
    .findOne({ _id: groupId, creator: clientId })
    .select({ _id: 1 })
    .lean();

  if (owned) return true;

  const exists = await groupModel.findById(groupId).select({ _id: 1 }).lean();
  if (exists) throw new ForbiddenException("errors.forbidden");

  throw new NotFoundException("errors.group_not_found");
}

/* ---------------------------
  Client Repo API (used by controllers/client/group.controller.js)
--------------------------- */

/**
 * createGroup (client)
 * - creator MUST come from auth (controller enforces)
 * - also pushes creator into contributors if not already there
 */
exports.createGroup = async (payload = {}) => {
  const creatorId = payload.creator;
  if (!creatorId) throw new BadRequestException("errors.unauthorized");

  const name = normStr(payload.name);
  if (!name) throw new BadRequestException("errors.required_group_name");

  const product = await resolveProductOrThrow(payload.product);

  const price = normNum(product.price, NaN);
  if (!Number.isFinite(price) || price < 0) {
    throw new BadRequestException("errors.invalid_product_price");
  }

  const contributors = Array.isArray(payload.contributors)
    ? [...payload.contributors]
    : [];

  const alreadyAdded = contributors.some(
    (c) => String(c?.client) === String(creatorId)
  );

  if (!alreadyAdded) {
    contributors.unshift({
      client: creatorId,
      paidAmount: 0,
      paidAt: null,
      transactionStatus: false,
    });
  }

  const created = await groupModel.create({
    name,
    description: normStr(payload.description),
    image: normStr(payload.image),

    creator: creatorId,

    product: product._id,
    store: String(product.store),
    targetAmount: price,
    collectedAmount: 0,

    contributors,

    status: payload.status || "active",
    deadLine: payload.deadLine || null,
    isActive: payload.isActive !== undefined ? !!payload.isActive : true,
  });

  const doc = await populateGroupQuery(groupModel.findById(created._id)).lean();
  return { success: true, code: 201, result: doc };
};

/**
 * listGroups (client)
 * - returns only groups where client is creator OR contributor
 */
exports.listGroups = async (clientId, filterObject = {}, selectionObject = {}, sortObject = {}) => {
  if (!clientId) throw new BadRequestException("errors.unauthorized");

  const {
    filterObject: normalizedFilter,
    sortObject: normalizedSort,
    pageNumber,
    limitNumber,
  } = prepareQueryObjects(filterObject, sortObject, {
    sortableFields: ["createdAt", "name", "targetAmount", "collectedAmount", "deadLine", "status"],
    defaultSort: "-createdAt",
  });

  const finalFilter = applySearchFilter(
    { ...normalizedFilter, ...belongsFilter(clientId) },
    ["name", "description"]
  );

  const ensureStoreSelected = (sel = {}) => {
    if (!sel || Object.keys(sel).length === 0) return sel;

    const values = Object.values(sel).map((v) => Number(v));
    const isIncludeMode = values.some((v) => v === 1);

    if (isIncludeMode) return { ...sel, store: 1, product: 1, contributors: 1, creator: 1 };
    return sel;
  };

  const safeSelection = ensureStoreSelected(selectionObject);

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

  return { success: true, code: 200, result: groups, count, page: pageNumber, limit: limitNumber };
};

/**
 * getGroup (client)
 * - must belong to client (creator OR contributor)
 */
exports.getGroup = async (clientId, groupId) => {
  if (!clientId) throw new BadRequestException("errors.unauthorized");

  const doc = await populateGroupQuery(
    groupModel.findOne({ _id: groupId, ...belongsFilter(clientId) })
  ).lean();

  if (!doc) throw new NotFoundException("errors.group_not_found");
  return { success: true, code: 200, result: doc };
};

/**
 * updateGroup (client)
 * - creator ONLY
 */
exports.updateGroup = async (clientId, groupId, body = {}) => {
  await assertCreatorOrThrow(clientId, groupId);

  if (body?.name !== undefined) {
    const name = normStr(body.name);
    if (!name) throw new BadRequestException("errors.required_group_name");
    body.name = name;
  }

  // product change => sync store + targetAmount
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

  // validate optional numbers (if sent)
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

  const updated = await groupModel.findOneAndUpdate(
    { _id: groupId, creator: clientId },
    body,
    { new: true }
  );

  if (!updated) throw new NotFoundException("errors.group_not_found");

  const doc = await populateGroupQuery(groupModel.findById(updated._id)).lean();
  return { success: true, code: 200, result: doc };
};

/**
 * deleteGroup (client)
 * - creator ONLY
 */
exports.deleteGroup = async (clientId, groupId, permanent = false) => {
  await assertCreatorOrThrow(clientId, groupId);

  if (permanent) {
    const deleted = await groupModel
      .findOneAndDelete({ _id: groupId, creator: clientId })
      .lean();

    if (!deleted) throw new NotFoundException("errors.group_not_found");

    // best effort remove images folder
    try {
      const groupDir = path.join(PUBLIC_DIR, "images", "groups", String(groupId));
      if (fs.existsSync(groupDir)) fs.rmSync(groupDir, { recursive: true, force: true });
    } catch (_) {}

    return { success: true, code: 200, message: "success.record_deleted" };
  }

  const updated = await groupModel
    .findOneAndUpdate(
      { _id: groupId, creator: clientId, isActive: true },
      { isActive: false },
      { new: true }
    )
    .lean();

  if (!updated) {
    const exists = await groupModel.findById(groupId).select({ _id: 1 }).lean();
    if (!exists) throw new NotFoundException("errors.group_not_found");
    return { success: true, code: 200, message: "success.record_disabled" };
  }

  return { success: true, code: 200, message: "success.record_disabled" };
};

/**
 * uploadGroupImage (client)
 * - creator ONLY
 */
exports.uploadGroupImage = async (clientId, groupId, file) => {
  await assertCreatorOrThrow(clientId, groupId);

  if (!groupId) {
    if (file?.path) safeUnlink(file.path);
    throw new BadRequestException("errors.required_group_id");
  }

  if (!file?.filename) throw new BadRequestException("errors.required_image");

  const doc = await groupModel.findOne({ _id: groupId, creator: clientId });
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
      const oldAbsPath = path.join(PUBLIC_DIR, "images", "groups", String(groupId), oldFileName);
      safeUnlink(oldAbsPath);
    }
  }

  doc.image = imageUrl;
  await doc.save();

  const populated = await populateGroupQuery(groupModel.findById(groupId)).lean();
  return { success: true, code: 200, message: "success.image_updated", result: populated };
};

/**
 * removeGroupImage (client)
 * - creator ONLY
 */
exports.removeGroupImage = async (clientId, groupId) => {
  await assertCreatorOrThrow(clientId, groupId);

  if (!groupId) throw new BadRequestException("errors.required_group_id");

  const doc = await groupModel.findOne({ _id: groupId, creator: clientId });
  if (!doc) throw new NotFoundException("errors.group_not_found");

  const oldUrl = doc.image;
  const prefix = `/images/groups/${groupId}/`;

  if (oldUrl && typeof oldUrl === "string" && oldUrl.startsWith(prefix)) {
    const oldFileName = oldUrl.split("/").pop();
    if (oldFileName) {
      const oldAbsPath = path.join(PUBLIC_DIR, "images", "groups", String(groupId), oldFileName);
      safeUnlink(oldAbsPath);
    }

    // cleanup empty folder (best effort)
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
  return { success: true, code: 200, message: "success.image_removed", result: populated };
};
