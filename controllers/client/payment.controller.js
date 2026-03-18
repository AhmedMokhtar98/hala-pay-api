const paymentRepo = require("../../models/payment/payment.repo");



exports.topUpGroup = async (req, res) => {
  const clientId = req.user?._id;
  const { groupId } = req.params;

  const op = await paymentRepo.topUpGroup(groupId, clientId, req.body);

  return res.status(op.code).json(op);
};