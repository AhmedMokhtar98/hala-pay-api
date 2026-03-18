// controllers/admin/product.controller.js
const productRepo = require("../../models/product/product.repo");
const { listUnifiedProducts, getProductFromDbById, getUnifiedProductById } = require("../../providers/services/products/unifiedProducts.service");


exports.listProducts = async (req, res) => {
  const provider = String(req.query.provider || "").toLowerCase().trim();
  const providerStoreId = String(req.query.storeId || "").trim();
  const role = req?.user?.role;

  // ✅ keep provider in filters only if provided
  const filters = { ...req.query };
  if (provider) filters.provider = provider;

  const result = await listUnifiedProducts({
    providerStoreId: providerStoreId || null,
    filters,
    store: req.store || null, // ✅ set by middleware (optional)
    role, // ✅ set by middleware (optional)
  });

  return res.status(result?.code || 200).json(result);
};


exports.getProductDetails = async (req, res) => {
  const { productId } = req.params;
  const role = req?.user?.role;
  const operationResultObject = await getUnifiedProductById({
    productId,
    providerStoreId: req.query.storeId || req.query.providerStoreId,
    filters: req.query,
    store: req.store,
    role, // ✅ set by middleware (optional)
  });

  return res.status(operationResultObject.code).json(operationResultObject);
};