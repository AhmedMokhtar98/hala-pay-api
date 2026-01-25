const clientModel = require("./client.model");
const jwtHelper = require("../../helpers/jwt.helper");
const {
  NotFoundException,
  ConflictException,
  BadRequestException,
} = require("../../middlewares/errorHandler/exceptions");
const mongoose = require("mongoose");
const applySearchFilter = require("../../helpers/applySearchFilter");
const prepareQueryObjects = require("../../helpers/prepareQueryObjects");

/* ----------------------------------
   CREATE CLIENT
----------------------------------- */
exports.create = async (formObject) => {
  formObject = normalize(formObject);

  await checkUniqueness(formObject);

  const client = new clientModel(formObject);
  await client.save(); // password hashing handled by schema

  return { success: true, code: 201, result: client };
};

/* ----------------------------------
   FIND ONE
----------------------------------- */
exports.find = async (filterObject) => {
  const client = await clientModel.findOne(filterObject);
  if (!client) throw new NotFoundException("errors.not_found");
  return client;
};

/* ----------------------------------
   GET BY ID
----------------------------------- */
exports.get = async (_id) => {

  const client = await clientModel.findById(_id);
  // delete sensitive info
  delete client?.password;
  if (!client) throw new NotFoundException("errors.not_found");

  return { success: true, code: 200, result: client };
};

/* ----------------------------------
   LIST CLIENTS
----------------------------------- */
exports.list = async (filterObject, selectionObject = {}, sortObject = {}) => {
  const {
    filterObject: normalizedFilter,
    sortObject: normalizedSort,
    pageNumber,
    limitNumber,
  } = prepareQueryObjects(filterObject, sortObject, {
    sortableFields: ["createdAt", "firstName", "lastName", "email"],
    defaultSort: "-createdAt",
  });

  // ✅ include phoneCode & phoneNumber if you want to search by both
  const finalFilter = applySearchFilter(normalizedFilter, [
    "firstName",
    "lastName",
    "email",
    "phoneCode",
    "phoneNumber",
  ]);

  const [clients, count] = await Promise.all([
    clientModel
      .find(finalFilter)
      .sort(normalizedSort)
      .select(selectionObject)
      .limit(limitNumber)
      .skip((pageNumber - 1) * limitNumber)
      .lean(),
    clientModel.countDocuments(finalFilter),
  ]);

  return {
    success: true,
    code: 200,
    result: clients,
    count,
    page: pageNumber,
    limit: limitNumber,
  };
};

/* ----------------------------------
   UPDATE CLIENT
----------------------------------- */
exports.update = async (_id, formObject) => {
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    throw new BadRequestException("errors.invalid_id");
  }

  formObject = normalize(formObject);

  const existing = await clientModel.findById(_id);
  if (!existing) throw new NotFoundException("errors.not_found");

  // ✅ Check uniqueness of email / phone pair (excluding same client)
  await checkUniqueness(formObject, existing._id);

  // ✅ Password updated separately (so pre-save hash works)
  if (formObject.password) {
    existing.password = formObject.password;
  }

  // ✅ Update other fields
  for (const key of Object.keys(formObject)) {
    if (key !== "password") {
      existing[key] = formObject[key];
    }
  }

  const updated = await existing.save();
  return { success: true, code: 200, result: updated };
};

/* ----------------------------------
   UPDATE MANY
----------------------------------- */
exports.updateMany = async (filterObject, formObject) => {
  const result = await clientModel.updateMany(filterObject, formObject);
  return { success: true, code: 200, result };
};

/* ----------------------------------
   DELETE CLIENT
----------------------------------- */
exports.remove = async (_id, deletePermanently = false) => {

  // ✅ Permanent delete (Hard delete)
  if (deletePermanently) {
    const deleted = await clientModel.findOneAndDelete({ _id });
    if (!deleted) throw new NotFoundException("errors.not_found");

    return {
      success: true,
      code: 200,
      result: { message: "success.client_deleted_permanently" },
    };
  }

  // ✅ Soft delete (Deactivate)
  const updated = await clientModel.findOneAndUpdate(
    { _id, isActive: { $ne: false } }, // avoid re-deleting (already inactive)
    {
      $set: {
        isActive: false,
        updatedAt: new Date(),
      },
    },
    { new: true }
  );

  // if not found OR already inactive -> treat as not found (as you intended)
  if (!updated) throw new NotFoundException("errors.not_found");

  return {
    success: true,
    code: 200,
    result: { message: "success.client_deleted" },
  };
};


/* ----------------------------------
   LOGIN / PASSWORD COMPARE
----------------------------------- */
exports.comparePassword = async (email, password) => {
  email = String(email || "").trim().toLowerCase();

  const client = await clientModel
    .findOne({ email })
    .select("+password");

  if (!client) throw new NotFoundException("errors.not_found");

  const match = await client.comparePassword(password);
  if (!match) throw new ConflictException("errors.password_incorrect");

  return { success: true, code: 200, result: client };
};

/* ----------------------------------
   RESET PASSWORD
----------------------------------- */
exports.resetPassword = async (email, newPassword) => {
  email = String(email || "").trim().toLowerCase();

  const client = await clientModel.findOne({ email });
  if (!client) throw new NotFoundException("errors.not_found");

  client.password = newPassword;
  await client.save();

  return {
    success: true,
    code: 200,
    result: { message: "success.operation_successful" },
  };
};

/* =========================================================
   🔐 SINGLE UNIQUENESS FUNCTION
   - Email is unique alone
   - Phone is unique as (phoneCode + phoneNumber)
   - excludeId: ignore current client on update
========================================================= */
const checkUniqueness = async (
  { email, phoneCode, phoneNumber },
  excludeId = null
) => {
  const hasEmail = !!(email && String(email).trim());
  const hasPhonePair =
    !!(phoneCode && String(phoneCode).trim()) &&
    !!(phoneNumber && String(phoneNumber).trim());

  if (!hasEmail && !hasPhonePair) return;

  const orQuery = [];

  if (hasEmail) {
    const normalizedEmail = String(email).trim().toLowerCase();
    orQuery.push({ email: normalizedEmail });
  }

  if (hasPhonePair) {
    const normalizedPhoneCode = String(phoneCode).trim();
    const normalizedPhoneNumber = String(phoneNumber).trim();
    orQuery.push({
      phoneCode: normalizedPhoneCode,
      phoneNumber: normalizedPhoneNumber,
    });
  }

  const existing = await clientModel
    .findOne({
      $or: orQuery,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
    .select({ email: 1, phoneCode: 1, phoneNumber: 1 })
    .lean();

  if (!existing) return;

  if (
    hasEmail &&
    existing.email === String(email).trim().toLowerCase()
  ) {
    throw new ConflictException("errors.email_used");
  }

  if (
    hasPhonePair &&
    existing.phoneCode === String(phoneCode).trim() &&
    existing.phoneNumber === String(phoneNumber).trim()
  ) {
    throw new ConflictException("errors.phone_used");
  }
};

/* =========================================================
   🧼 NORMALIZER
   - Normalizes email to lower-case
   - Trims phoneCode/phoneNumber
========================================================= */
const normalize = (obj = {}) => {
  const normalized = { ...obj };

  if (normalized.email) {
    normalized.email = String(normalized.email).trim().toLowerCase();
  }

  if (normalized.phoneCode) {
    normalized.phoneCode = String(normalized.phoneCode).trim();
  }

  if (normalized.phoneNumber) {
    normalized.phoneNumber = String(normalized.phoneNumber).trim();
  }

  return normalized;
};
