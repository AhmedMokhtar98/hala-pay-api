// controllers/admin/product.controller.js
const productRepo = require("../../models/product/product.repo");
// controllers/unifiedProducts.controller.js
const { listUnifiedProducts, getUnifiedProductById } = require("../../providers/services/products/unifiedProducts.service");


exports.createProduct = async (req, res) => {
  const operationResultObject = await productRepo.createProduct(req.body);
  return res.status(operationResultObject.code).json(operationResultObject);
};


exports.listProducts = async (req, res) => {
  const provider = String(req.query.provider || "").toLowerCase().trim();
  const providerStoreId = String(req.query.storeId || "").trim();

  // ✅ keep provider in filters only if provided
  const filters = { ...req.query };
  if (provider) filters.provider = provider;

  const result = await listUnifiedProducts({
    providerStoreId: providerStoreId || null,
    filters,
    store: req.store || null, // ✅ set by middleware (optional)
  });

  return res.status(result?.code || 200).json(result);
};



exports.getProductDetails = async (req, res) => {
  const { productId } = req.params;

  const operationResultObject = await getUnifiedProductById({
    productId,
    providerStoreId: req.query.storeId || req.query.providerStoreId,
    filters: req.query,
    store: req.store,
  });

  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.updateProduct = async (req, res) => {
  const { productId } = req.params;
  const operationResultObject = await productRepo.updateProduct(productId, req.body);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.deleteProduct = async (req, res) => {
  const { productId } = req.params;

  const permanent = req.body.permanent;

  const operationResultObject = await productRepo.deleteProduct(productId, permanent);
  return res.status(operationResultObject.code).json(operationResultObject);
};



exports.uploadProductImages = async (req, res) => {
  const { productId } = req.query;
  const files = req.files;

  const operationResultObject = await productRepo.uploadProductImages(productId, files);
  return res.status(operationResultObject.code).json(operationResultObject);
};


exports.removeProductImage = async (req, res) => {
  const { productId, imageUrl } = req.query;

  const operationResultObject = await productRepo.removeProductImage(productId, imageUrl);
  return res.status(operationResultObject.code).json(operationResultObject);
};