// models/payment/payment.repo.js
const { default: mongoose } = require("mongoose");
const { BadRequestException, } = require("../../middlewares/errorHandler/exceptions");
const groupModel = require("../group/group.model");
const paymentModel = require("../payment/payment.model");

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

      // validate requested amount first for all statuses
      if (Number(amount || 0) > remainingAmount) {
        throw new BadRequestException("errors.amountExceedsRemaining");
      }

      const generatedTransactionId = `grp_${transactionStatus}_${group._id}_${clientId}_${Date.now()}`;

      // failed -> save payment history only
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