// controllers/admin/store.controller.js
const storeRepo = require("../../models/store/store.repo")
/* ---------------- controllers ---------------- */




exports.listStores = async (req, res) => {
  const filterObject = req.query;
  const operationResultObject = await storeRepo.listStores(filterObject, { accessToken: 0, refreshToken: 0, tokenType: 0, expiresAt: 0, scope: 0, merchant: 0 }, {});
  return res.status(operationResultObject.code).json(operationResultObject);
}

exports.getStoreDetails = async (req, res) => {
  const { storeId } = req.params;
  console.log("storeId in controller:", storeId);
  const operationResultObject = await storeRepo.getStore(storeId);
  return res.status(operationResultObject.code).json(operationResultObject);
};


exports.getOrders = async (req, res) => {
  const { storeId } = req.params;
  const operationResultObject = await storeRepo.getOrders(req.query, storeId);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.getProducts = async (req, res) => {
  const { storeId } = req.params;
  const operationResultObject = await storeRepo.getProducts(req.query, storeId);
  return res.status(operationResultObject.code).json(operationResultObject);
};
