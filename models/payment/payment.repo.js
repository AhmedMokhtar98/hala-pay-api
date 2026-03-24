// models/payment/payment.repo.js
const { default: mongoose } = require("mongoose");
const {
  BadRequestException,
  NotFoundException,
} = require("../../middlewares/errorHandler/exceptions");

const groupModel = require("../group/group.model");
const clientModel = require("../client/client.model");
const paymentModel = require("./payment.model");

const prepareQueryObjects = require("../../helpers/prepareQueryObjects");

const PAYMENT_POPULATE = [
  {
    path: "client",
    model: clientModel,
    select:
      "firstName lastName email phoneCode phoneNumber isActive isEmailVerified isPhoneVerified createdAt",
  },
  {
    path: "group",
    model: groupModel,
    select:
      "name title groupName status targetAmount collectedAmount purchaseLock deadLine createdAt",
  },
];

exports.topUpGroup = async (groupId, clientId, payload = {}) => {
  if (!clientId) {
    throw new BadRequestException("errors.unauthorized");
  }

  const { amount, transactionStatus, method = "testing", note = "" } = payload;
  const now = new Date();
  const session = await mongoose.startSession();

  try {
    let response = null;

    await session.withTransaction(async () => {
      const group = await groupModel.findOne({
        _id: groupId,
        isActive: true,
      }).session(session);

      if (!group) {
        throw new BadRequestException("errors.groupNotFound");
      }

      if (group.status === "deleted") {
        throw new BadRequestException("errors.groupDeleted");
      }

      if (group.status === "purchased") {
        throw new BadRequestException("errors.groupPurchased");
      }

      if (group.status === "funded") {
        throw new BadRequestException("errors.groupAlreadyFunded");
      }

      if (group.purchaseLock) {
        throw new BadRequestException("errors.groupLocked");
      }

      const contributor = group.contributors.find(
        (c) => String(c.client) === String(clientId)
      );

      if (!contributor) {
        throw new BadRequestException("errors.groupContributorNotFound");
      }

      const currentCollected = Number(group.collectedAmount || 0);
      const targetAmount = Number(group.targetAmount || 0);
      const remainingAmount = Math.max(0, targetAmount - currentCollected);

      if (remainingAmount <= 0) {
        throw new BadRequestException("errors.groupAlreadyFunded");
      }

      if (Number(amount || 0) > remainingAmount) {
        throw new BadRequestException("errors.amountExceedsRemaining");
      }

      const generatedTransactionId = `grp_${transactionStatus}_${group._id}_${clientId}_${Date.now()}`;

      if (transactionStatus === "failed") {
        const [payment] = await paymentModel.create(
          [
            {
              client: clientId,
              group: group._id,
              amount,
              method,
              status: "failed",
              transactionId: generatedTransactionId,
              note: note || "Group top-up failed",
            },
          ],
          { session }
        );

        response = {
          success: false,
          code: 200,
          message: "errors.paymentFailed",
          result: {
            paymentId: payment._id,
            groupId: group._id,
            contributorClientId: clientId,
            requestedAmount: amount,
            method: payment.method,
            paymentStatus: payment.status,
            requestTransactionStatus: transactionStatus,
            transactionStatus: false,
            transactionId: payment.transactionId,
            paidAmount: Number(contributor.paidAmount || 0),
            collectedAmount: group.collectedAmount,
            targetAmount: group.targetAmount,
            remainingAmount,
            groupStatus: group.status,
            purchaseLock: group.purchaseLock,
            fundedAt: group.fundedAt,
            paidAt: null,
            createdAt: payment.createdAt || now,
          },
        };

        return;
      }

      contributor.paidAmount =
        Number(contributor.paidAmount || 0) + Number(amount || 0);
      contributor.paidAt = now;
      contributor.transactionStatus = true;
      contributor.transactionId = generatedTransactionId;

      const nextCollectedAmount = currentCollected + Number(amount || 0);

      if (nextCollectedAmount >= targetAmount) {
        group.purchaseLock = true;
      }

      await group.save({ session });

      const [payment] = await paymentModel.create(
        [
          {
            client: clientId,
            group: group._id,
            amount,
            method,
            status: "success",
            transactionId: generatedTransactionId,
            note: note || "Group top-up success",
          },
        ],
        { session }
      );

      const updatedContributor = group.contributors.find(
        (c) => String(c.client) === String(clientId)
      );

      response = {
        success: true,
        code: 200,
        message: "success.groupToppedUp",
        result: {
          paymentId: payment._id,
          groupId: group._id,
          contributorClientId: clientId,
          requestedAmount: amount,
          method: payment.method,
          paymentStatus: payment.status,
          requestTransactionStatus: transactionStatus,
          transactionStatus: updatedContributor?.transactionStatus || false,
          transactionId: payment.transactionId,
          paidAmount: Number(updatedContributor?.paidAmount || 0),
          collectedAmount: group.collectedAmount,
          targetAmount: group.targetAmount,
          remainingAmount: Math.max(
            0,
            Number(group.targetAmount || 0) - Number(group.collectedAmount || 0)
          ),
          groupStatus: group.status,
          purchaseLock: group.purchaseLock,
          fundedAt: group.fundedAt,
          paidAt: updatedContributor?.paidAt || payment.paidAt || now,
          createdAt: payment.createdAt || now,
        },
      };
    });

    return response;
  } finally {
    await session.endSession();
  }
};

/* ----------------------------------
   FIND ONE
----------------------------------- */
exports.find = async (filterObject = {}) => {
  const finalFilter = normalizeFilter(filterObject);

  const payment = await paymentModel.findOne(finalFilter).populate(PAYMENT_POPULATE);
  if (!payment) throw new NotFoundException("errors.not_found");

  return payment;
};

/* ----------------------------------
   GET BY ID
----------------------------------- */
exports.get = async (_id) => {
  validateObjectId(_id);

  const payment = await paymentModel
    .findById(_id)
    .populate(PAYMENT_POPULATE)
    .lean();

  if (!payment) throw new NotFoundException("errors.not_found");

  return {
    success: true,
    code: 200,
    result: payment,
  };
};

/* ----------------------------------
   LIST PAYMENTS
----------------------------------- */
exports.list = async (
  filterObject = {},
  selectionObject = {},
  sortObject = {}
) => {
  const {
    filterObject: preparedFilter,
    sortObject: preparedSort,
    pageNumber,
    limitNumber,
  } = prepareQueryObjects(filterObject, sortObject, {
    sortableFields: [
      "createdAt",
      "updatedAt",
      "amount",
      "status",
      "method",
      "transactionId",
      "paidAt",
    ],
    defaultSort: "-createdAt",
  });

  let finalFilter = normalizeFilter(preparedFilter);

  finalFilter = await appendGlobalSearchFilter(finalFilter);

  const [payments, count] = await Promise.all([
    paymentModel
      .find(finalFilter)
      .sort(preparedSort)
      .select(selectionObject)
      .populate(PAYMENT_POPULATE)
      .limit(limitNumber)
      .skip((pageNumber - 1) * limitNumber)
      .lean(),
    paymentModel.countDocuments(finalFilter),
  ]);

  return {
    success: true,
    code: 200,
    result: payments,
    count,
    page: pageNumber,
    limit: limitNumber,
  };
};

/* ----------------------------------
   DELETE PAYMENT
----------------------------------- */
exports.remove = async (_id, deletePermanently = false) => {
  validateObjectId(_id);

  const supportsSoftDelete = Boolean(paymentModel?.schema?.path("isActive"));

  if (deletePermanently || !supportsSoftDelete) {
    const deleted = await paymentModel.findOneAndDelete({ _id });

    if (!deleted) throw new NotFoundException("errors.not_found");

    return {
      success: true,
      code: 200,
      result: {
        message: deletePermanently
          ? "success.payment_deleted_permanently"
          : "success.payment_deleted",
      },
    };
  }

  const updated = await paymentModel.findOneAndUpdate(
    { _id, isActive: { $ne: false } },
    {
      $set: {
        isActive: false,
        updatedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!updated) throw new NotFoundException("errors.not_found");

  return {
    success: true,
    code: 200,
    result: {
      message: "success.payment_deleted",
    },
  };
};

/* =========================================================
   HELPERS
========================================================= */

function validateObjectId(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestException("errors.invalid_id");
  }
}

function normalizeFilter(filterObject = {}) {
  const normalized = { ...filterObject };

  if (normalized._id && mongoose.Types.ObjectId.isValid(normalized._id)) {
    normalized._id = new mongoose.Types.ObjectId(normalized._id);
  }

  if (normalized.client && mongoose.Types.ObjectId.isValid(normalized.client)) {
    normalized.client = new mongoose.Types.ObjectId(normalized.client);
  }

  if (normalized.group && mongoose.Types.ObjectId.isValid(normalized.group)) {
    normalized.group = new mongoose.Types.ObjectId(normalized.group);
  }

  if (normalized.method != null) {
    normalized.method = String(normalized.method).trim().toLowerCase();
  }

  if (normalized.status != null) {
    normalized.status = String(normalized.status).trim().toLowerCase();
  }

  if (normalized.transactionId != null) {
    normalized.transactionId = String(normalized.transactionId).trim();
  }

  if (normalized.note != null) {
    normalized.note = String(normalized.note).trim();
  }

  const minAmount =
    normalized.minAmount !== undefined &&
    normalized.minAmount !== null &&
    normalized.minAmount !== ""
      ? Number(normalized.minAmount)
      : null;

  const maxAmount =
    normalized.maxAmount !== undefined &&
    normalized.maxAmount !== null &&
    normalized.maxAmount !== ""
      ? Number(normalized.maxAmount)
      : null;

  if (minAmount !== null || maxAmount !== null) {
    normalized.amount = {};
    if (minAmount !== null && !Number.isNaN(minAmount)) {
      normalized.amount.$gte = minAmount;
    }
    if (maxAmount !== null && !Number.isNaN(maxAmount)) {
      normalized.amount.$lte = maxAmount;
    }
  }

  delete normalized.minAmount;
  delete normalized.maxAmount;

  const createdFrom = normalized.createdFrom ? new Date(normalized.createdFrom) : null;
  const createdTo = normalized.createdTo ? new Date(normalized.createdTo) : null;

  if (
    (createdFrom && !Number.isNaN(createdFrom.getTime())) ||
    (createdTo && !Number.isNaN(createdTo.getTime()))
  ) {
    normalized.createdAt = normalized.createdAt || {};

    if (createdFrom && !Number.isNaN(createdFrom.getTime())) {
      normalized.createdAt.$gte = createdFrom;
    }

    if (createdTo && !Number.isNaN(createdTo.getTime())) {
      normalized.createdAt.$lte = createdTo;
    }
  }

  delete normalized.createdFrom;
  delete normalized.createdTo;

  const paidFrom = normalized.paidFrom ? new Date(normalized.paidFrom) : null;
  const paidTo = normalized.paidTo ? new Date(normalized.paidTo) : null;

  if (
    (paidFrom && !Number.isNaN(paidFrom.getTime())) ||
    (paidTo && !Number.isNaN(paidTo.getTime()))
  ) {
    normalized.paidAt = normalized.paidAt || {};

    if (paidFrom && !Number.isNaN(paidFrom.getTime())) {
      normalized.paidAt.$gte = paidFrom;
    }

    if (paidTo && !Number.isNaN(paidTo.getTime())) {
      normalized.paidAt.$lte = paidTo;
    }
  }

  delete normalized.paidFrom;
  delete normalized.paidTo;

  return normalized;
}

async function appendGlobalSearchFilter(filterObject = {}) {
  const finalFilter = { ...filterObject };

  const rawSearch =
    filterObject.search ??
    filterObject.keyword ??
    filterObject.q ??
    filterObject.any;

  delete finalFilter.search;
  delete finalFilter.keyword;
  delete finalFilter.q;
  delete finalFilter.any;

  if (rawSearch == null || String(rawSearch).trim() === "") {
    return finalFilter;
  }

  const search = String(rawSearch).trim();
  const regex = new RegExp(escapeRegex(search), "i");
  const orConditions = [];

  // direct payment fields
  orConditions.push(
    { transactionId: regex },
    { method: regex },
    { status: regex },
    { note: regex }
  );

  // by amount if search is number
  const numericValue = Number(search);
  if (!Number.isNaN(numericValue)) {
    orConditions.push({ amount: numericValue });
  }

  // search by payment/client/group object id directly
  if (mongoose.Types.ObjectId.isValid(search)) {
    const objectId = new mongoose.Types.ObjectId(search);
    orConditions.push(
      { _id: objectId },
      { client: objectId },
      { group: objectId }
    );
  }

  // search in clients
  const matchedClients = await clientModel
    .find({
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phoneCode: regex },
        { phoneNumber: regex },
      ],
    })
    .select("_id")
    .lean();

  if (matchedClients.length) {
    orConditions.push({
      client: { $in: matchedClients.map((item) => item._id) },
    });
  }

  // search in groups
  const matchedGroups = await groupModel
    .find({
      $or: [
        { name: regex },
        { title: regex },
        { groupName: regex },
        { status: regex },
      ],
    })
    .select("_id")
    .lean();

  if (matchedGroups.length) {
    orConditions.push({
      group: { $in: matchedGroups.map((item) => item._id) },
    });
  }

  if (!orConditions.length) {
    return finalFilter;
  }

  if (finalFilter.$or?.length) {
    return {
      ...finalFilter,
      $and: [
        { $or: finalFilter.$or },
        { $or: orConditions },
      ],
      $or: undefined,
    };
  }

  return {
    ...finalFilter,
    $or: orConditions,
  };
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}