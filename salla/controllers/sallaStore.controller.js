// salla/controllers/sallaStore.controller.js
const sallaRepo = require("../../salla/repos/salla.repo")
/* ---------------- controllers ---------------- */
exports.getOrders = async (req, res) => {
  const { storeId } = req.params;
  const operationResultObject = await sallaRepo.getOrders(req.query, storeId);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.getProducts = async (req, res) => {
  const { storeId } = req.params;
  const operationResultObject = await sallaRepo.getProducts(req.query, storeId);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.getStoreDetails = async (req, res) => {
  const sallaAccessToken = req.sallaAccessToken
  const operationResultObject = await sallaRepo.getStoreDetails(sallaAccessToken);
  return res.status(operationResultObject.code).json(operationResultObject);
};