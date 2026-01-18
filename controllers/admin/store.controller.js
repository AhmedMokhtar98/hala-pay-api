// controllers/admin/store.controller.js
const storeRepo = require("../../models/store/store.repo")
/* ---------------- controllers ---------------- */


exports.createStore = async (req, res) => {
  const operationResultObject = await storeRepo.createStore(req.body);
  return res.status(operationResultObject.code).json(operationResultObject);
}

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

exports.updateStore = async (req, res) => {
  const { storeId } = req.params;
  const operationResultObject = await storeRepo.updateStore(storeId, req.body);
  return res.status(operationResultObject.code).json(operationResultObject);
}

exports.uploadStoreImage = async (req, res) => {
  const { storeId } = req.query;

  // multer -> single("image")
  const file = req.file;

  const operationResultObject = await storeRepo.uploadStoreImage(storeId, file);

  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.removeStoreImage = async (req, res) => {
  const { storeId } = req.query;
  console.log("storeId in controller:", storeId);
  const operationResultObject = await storeRepo.removeStoreImage(storeId);
  return res.status(operationResultObject.code).json(operationResultObject);
}


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


exports.deleteStore = async (req, res) => {
  const { storeId } = req.params;
  const permanent = req.body.permanent;
  const operationResultObject = await storeRepo.deleteStore(storeId, permanent);
  return res.status(operationResultObject.code).json(operationResultObject);
};