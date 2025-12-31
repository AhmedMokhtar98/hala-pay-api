const bcrypt = require("bcrypt");
const adminModel = require("./admin.model");
const jwtHelper = require("../../helpers/jwt.helper");
const prepareQueryObjects = require("../../helpers/prepareQueryObjects");
const applySearchFilter = require("../../helpers/applySearchFilter");

const {
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} = require("../../middlewares/errorHandler/exceptions");

const SALT_ROUNDS = 10;

// ============================
// Helpers (internal)
// ============================

function normalizeLowercase(formObject = {}) {
  const obj = { ...formObject };
  if (obj.email) obj.email = String(obj.email).toLowerCase();
  if (obj.userName) obj.userName = String(obj.userName).toLowerCase();
  return obj;
}

async function assertUserNameUnique(userName, ignoreId = null) {
  const existing = await adminModel
    .findOne({ userName: String(userName).toLowerCase() })
    .select({ _id: 1 })
    .lean();

  if (
    existing &&
    (!ignoreId || existing._id.toString() !== ignoreId.toString())
  ) {
    throw new ConflictException("errors.userName_exists");
  }
}

// ============================
// LOGIN
// ============================

exports.login = async (userData) => {
  const { userName, password } = userData;

  const normalizedUserName = String(userName || "").toLowerCase().trim();
  if (!normalizedUserName || !password) {
    throw new UnauthorizedException("errors.invalid_credentials");
  }

  // لازم نجيب password عشان نقارن
  const admin = await adminModel
    .findOne({ userName: normalizedUserName })
    .populate({ path: "permission", select: "name permissions" })
    .lean();
    console.log("Admin found during login:", admin); // Debug log

  if (!admin) throw new UnauthorizedException("errors.invalid_credentials");

  const passwordMatch = await bcrypt.compare(password, admin.password);
  if (!passwordMatch) throw new UnauthorizedException("errors.password_incorrect");

  const payload = {
    _id: admin._id,
    name: admin.name,
    userName: admin.userName,
    permission: admin.permission, // populated object أو id حسب حالتك
    role: admin.role,
  };

  const token = jwtHelper.generateToken(payload);

  // remove sensitive info
  delete admin.password;

  return { success: true, code: 200, result: { admin, token } };
};

// ============================
// GET BY ID
// ============================

exports.get = async (adminId) => {
  const admin = await adminModel
    .findById(adminId)
    .populate({ path: "permission", select: "name permissions" })
    .select({ password: 0, token: 0 })
    .lean();

  if (!admin) throw new NotFoundException("errors.admin_not_found");

  return { success: true, code: 200, result: admin };
};

// ============================
// LIST
// ============================

exports.list = async (filterObject, selectionObject = {}, sortObject = {}) => {
  const {
    filterObject: normalizedFilter,
    sortObject: normalizedSort,
    pageNumber,
    limitNumber,
  } = await prepareQueryObjects(filterObject, sortObject, {
    sortableFields: ["name", "userName", "createdAt"],
    defaultSort: "createdAt",
  });

  const finalFilter = applySearchFilter(normalizedFilter, ["name", "userName"]);

  const query = adminModel
    .find(finalFilter)
    .populate({ path: "permission", select: "name permissions" })
    .sort(normalizedSort)
    .select(selectionObject)
    .limit(limitNumber)
    .skip((pageNumber - 1) * limitNumber)
    .lean();

  const [admins, count] = await Promise.all([
    query,
    adminModel.countDocuments(finalFilter),
  ]);

  return { success: true, code: 200, result: admins, count };
};

// ============================
// CREATE
// ============================

exports.create = async (formObject) => {
  const body = normalizeLowercase(formObject);

  if (!body.userName) throw new ConflictException("errors.userName_required");
  if (!body.password) throw new ConflictException("errors.password_required");

  await assertUserNameUnique(body.userName);

  body.password = await bcrypt.hash(body.password, SALT_ROUNDS);

  const admin = await adminModel.create(body);

  const result = admin.toObject();
  delete result.password;
  delete result.token;

  return { success: true, code: 201, result };
};

// ============================
// UPDATE
// ============================

exports.update = async (_id, formObject) => {
  const body = normalizeLowercase(formObject);

  if (body.userName) {
    await assertUserNameUnique(body.userName, _id);
  }

  if (body.password) {
    body.password = await bcrypt.hash(body.password, SALT_ROUNDS);
  }

  const updated = await adminModel
    .findByIdAndUpdate(_id, body, { new: true })
    .populate({ path: "permission", select: "name permissions" })
    .select({ password: 0, token: 0 })
    .lean();

  if (!updated) throw new NotFoundException("errors.admin_not_found");

  return { success: true, code: 200, result: updated, message: "success.record_updated" };
};

// ============================
// REMOVE
// ============================
exports.remove = async (_id, deletePermenantly = false) => {
  if (!_id) throw new BadRequestException("errors.invalid_id");

  // ✅ Hard delete (permanent)
  if (deletePermenantly) {
    console.log("Performing hard delete for admin ID:", _id); // Debug log
    const deleted = await adminModel.findByIdAndDelete(_id).lean();
    console.log("Deleted admin document:", deleted); // Debug log
    if (!deleted) throw new NotFoundException("errors.admin_not_found");

    return {
      success: true,
      code: 200,
      result: { message: "success.record_deleted" },
    };
  }

  // ✅ Soft delete (disable)
  const updated = await adminModel
    .findOneAndUpdate(
      { _id, isActive: true }, // only if currently active
      { isActive: false },
      { new: true }
    )
    .lean();

  if (!updated) throw new NotFoundException("errors.admin_not_found");

  return {
    success: true,
    code: 200,
    result: { message: "success.record_disabled" },
  };
};


// ============================
// OPTIONAL: comparePassword (لو محتاجها فعلاً)
// ============================

exports.comparePassword = async (userName, passwordString) => {
  const normalizedUserName = String(userName || "").toLowerCase().trim();
  const admin = await adminModel
    .findOne({ userName: normalizedUserName })
    .select({ password: 1 })
    .lean();

  if (!admin) throw new UnauthorizedException("errors.invalid_credentials");

  const match = await bcrypt.compare(passwordString, admin.password);
  if (!match) throw new UnauthorizedException("errors.password_incorrect");

  return { success: true, code: 200, result: true };
};

// (لو عايز تفضل exports.convertToLowerCase و exports.checkUserNameUnique)
// تقدر تخليهم wrappers حوالين الـ helpers اللي فوق.
exports.convertToLowerCase = normalizeLowercase;
exports.checkUserNameUnique = async (userName, ignoreId = null) => {
  await assertUserNameUnique(userName, ignoreId);
  return { success: true, code: 200 };
};
