const clientModel = require("./client.model");
const jwtHelper = require("../../helpers/jwt.helper");
const { NotFoundException, ConflictException, BadRequestException } = require("../../middlewares/errorHandler/exceptions");
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
  if (!mongoose.Types.ObjectId.isValid(_id))
    throw new BadRequestException("errors.invalid_id");

  const client = await clientModel.findById(_id);
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

  const finalFilter = applySearchFilter(normalizedFilter, [
    "firstName",
    "lastName",
    "email",
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
  formObject = normalize(formObject);

  // Find existing client
  const existing = await clientModel.findById(_id);
  if (!existing) throw new NotFoundException("errors.not_found");

  // Check uniqueness of email/phone
  await checkUniqueness(formObject, existing._id);

  // If password is provided, update it separately so the schema hash works
  if (formObject.password) {
    existing.password = formObject.password; // schema will hash on save
  }

  // Update other fields
  for (const key of Object.keys(formObject)) {
    if (key !== "password") {
      existing[key] = formObject[key];
    }
  }

  // Save the document (will trigger pre-save hook for password)
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
exports.remove = async (_id) => {
  const deleted = await clientModel.findByIdAndDelete(_id);
  if (!deleted) throw new NotFoundException("errors.not_found");

  return {
    success: true,
    code: 200,
    result: { message: "Client deleted successfully" },
  };
};

/* ----------------------------------
   LOGIN / PASSWORD COMPARE
----------------------------------- */
exports.comparePassword = async (email, password) => {
  const client = await clientModel
    .findOne({ email: email.toLowerCase() })
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
  const client = await clientModel.findOne({ email: email.toLowerCase() });
  if (!client) throw new NotFoundException("errors.not_found");

  client.password = newPassword; // schema hashes it
  await client.save();

  return {
    success: true,
    code: 200,
    result: { message: "success.operation_successful" },
  };
};

/* =========================================================
   🔐 SINGLE UNIQUENESS FUNCTION
========================================================= */
const checkUniqueness = async ({ email, phoneNumber }, excludeId = null) => {
  if (!email && !phoneNumber) return;

  const query = [];
  if (email) query.push({ email });
  if (phoneNumber) query.push({ phoneNumber });

  const existing = await clientModel.findOne({
    $or: query,
    ...(excludeId && { _id: { $ne: excludeId } }),
  });

  if (!existing) return;

  if (email && existing.email === email)
    throw new ConflictException("errors.email_used");

  if (phoneNumber && existing.phoneNumber === phoneNumber)
    throw new ConflictException("errors.phone_used");
};

/* =========================================================
   🧼 NORMALIZER
========================================================= */
const normalize = (obj) => {
  if (obj.email) obj.email = obj.email.toLowerCase();
  return obj;
};
