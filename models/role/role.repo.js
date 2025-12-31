// repos/role.repo.js
// ✅ FULL FIXED (NO LEGACY + CANONICAL PERMISSIONS + /admin prefix compatible)
// ✅ IMPORTANT: do NOT import permissions here (repo shouldn't care)
// ✅ IMPORTANT: do NOT have two different normalizers in two places
//    -> we will reuse validatePermissions() from authorizer.helper.js (single source of truth)
// ✅ Repo stores canonical permissions (same canonicalization used in authorizer.helper.js)
//
// Requirements:
// - helpers/permissions.helper.js must contain MANUAL endpoints like "GET /admin/admins"
// - helpers/authorizer.helper.js validatePermissions normalizes + checks against system sets

const roleModel = require("./role.model");
const prepareQueryObjects = require("../../helpers/prepareQueryObjects");
const applySearchFilter = require("../../helpers/applySearchFilter");

const {
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  UnprocessableEntityException,
} = require("../../middlewares/errorHandler/exceptions");

const { validatePermissions } = require("../../helpers/authorizer.helper");

/** =========================
 * Helpers
 * ========================= */

// ✅ SAME canonical used in authorizer.helper.js
function normalizePermissionKey(s) {
  s = String(s).trim().replace(/\s+/g, " ");
  const m = s.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i);
  if (!m) return s.toUpperCase();

  const method = m[1].toUpperCase();
  let path = String(m[2] || "").trim();

  path = path.split("?")[0];
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  path = path.toLowerCase();
  path = path.replace(/:(_?id)\b/g, ":id");

  return `${method} ${path}`;
}

// Normalize only what we need (name + permissions)
function normalizeRolePayload(formObject = {}) {
  if (!formObject || typeof formObject !== "object") {
    throw new BadRequestException("errors.bad_request");
  }

  const obj = { ...formObject };

  if (obj.name != null) obj.name = String(obj.name).trim().toLowerCase();

  if (obj.permissions != null) {
    if (typeof obj.permissions !== "object" || Array.isArray(obj.permissions)) {
      throw new BadRequestException("errors.invalid_permissions_payload");
    }

    const normalized = {};
    for (const moduleName in obj.permissions) {
      const arr = obj.permissions[moduleName];
      if (!Array.isArray(arr)) {
        throw new BadRequestException("errors.permissions_must_be_array", { module: moduleName });
      }
      normalized[moduleName] = arr.map(normalizePermissionKey);
    }
    obj.permissions = normalized;
  }

  return obj;
}

/** =========================
 * Repo methods
 * ========================= */

exports.find = async (filterObject) => {
  const resultObject = await roleModel.findOne(filterObject).lean();
  if (!resultObject) throw new NotFoundException("errors.not_found");
  return { success: true, code: 200, result: resultObject };
};

exports.get = async (id) => {
  const resultObject = await roleModel.findById(id).lean();
  if (!resultObject) throw new NotFoundException("errors.not_found");
  return { success: true, code: 200, result: resultObject };
};

exports.list = async (filterObject, selectionObject = {}, sortObject = {}) => {
  const {
    filterObject: normalizedFilter,
    sortObject: normalizedSort,
    pageNumber,
    limitNumber,
  } = await prepareQueryObjects(filterObject, sortObject, {
    sortableFields: ["name", "createdAt", "updatedAt"],
    defaultSort: "createdAt",
  });

  const finalFilter = applySearchFilter(normalizedFilter, ["name"]);

  const query = roleModel
    .find(finalFilter)
    .sort(normalizedSort)
    .select(selectionObject)
    .limit(limitNumber)
    .skip((pageNumber - 1) * limitNumber)
    .lean();

  const [roles, count] = await Promise.all([
    query,
    roleModel.countDocuments(finalFilter),
  ]);

  return {
    success: true,
    code: 200,
    result: roles,
    count,
    pageNumber,
    limitNumber,
  };
};

exports.create = async function (formObject) {
  // normalize name + canonical permissions for storage
  const normalized = normalizeRolePayload(formObject);

  // name required
  if (!normalized.name) {
    throw new UnprocessableEntityException(["name is required"], "errors.unprocessable_entity");
  }

  // permissions required (if you want it optional, change this condition)
  if (!normalized.permissions) {
    throw new UnprocessableEntityException(["permissions is required"], "errors.unprocessable_entity");
  }

  // ✅ validate permissions ONLY here (throws)
  // validatePermissions will ALSO sanitize/normalize and compare against system sets
  validatePermissions(normalized.permissions);

  // unique name check
  await this.assertNameUniqueOnCreate(normalized.name);

  const resultObject = new roleModel(normalized);
  await resultObject.save();

  if (!resultObject) throw new BadRequestException("errors.failed_creat_role");

  return { success: true, code: 201, result: resultObject };
};

exports.update = async function (_id, formObject) {
  if (!_id) throw new BadRequestException("errors.bad_request");
  if (!formObject || typeof formObject !== "object") throw new BadRequestException("errors.bad_request");

  const existing = await roleModel.findById(_id).lean();
  if (!existing) throw new NotFoundException("errors.not_found");

  const normalized = normalizeRolePayload(formObject);

  // unique name if updated
  if (normalized.name) {
    await this.assertNameUniqueOnUpdate(normalized.name, _id);
  }

  // validate only if permissions included
  if (normalized.permissions) validatePermissions(normalized.permissions);

  const resultObject = await roleModel.findByIdAndUpdate(_id, normalized, { new: true });
  if (!resultObject) throw new InternalServerErrorException("errors.internal_server_error");

  return { success: true, code: 200, result: resultObject };
};

exports.updateDirectly = async (_id, formObject) => {
  if (!_id) throw new BadRequestException("errors.bad_request");
  if (!formObject || typeof formObject !== "object") throw new BadRequestException("errors.bad_request");

  const normalized = normalizeRolePayload(formObject);

  if (normalized.permissions) validatePermissions(normalized.permissions);

  const resultObject = await roleModel.findByIdAndUpdate(_id, normalized, { new: true });
  if (!resultObject) throw new NotFoundException("errors.not_found");

  return { success: true, code: 200, result: resultObject };
};

exports.remove = async (_id) => {
  if (!_id) throw new BadRequestException("errors.bad_request");

  const resultObject = await roleModel.findByIdAndDelete(_id);
  if (!resultObject) throw new NotFoundException("errors.not_found");

  return { success: true, code: 200, result: { message: "ok" } };
};

/** =========================
 * Uniqueness helpers (throw)
 * ========================= */

exports.assertNameUniqueOnCreate = async function (name) {
  const duplicate = await roleModel.findOne({ name }).select("_id").lean();
  if (duplicate) throw new ConflictException("errors.name_used");
  return true;
};

exports.assertNameUniqueOnUpdate = async function (name, currentId) {
  const duplicate = await roleModel.findOne({ name }).select("_id").lean();
  if (duplicate && String(duplicate._id) !== String(currentId)) {
    throw new ConflictException("errors.name_used");
  }
  return true;
};
