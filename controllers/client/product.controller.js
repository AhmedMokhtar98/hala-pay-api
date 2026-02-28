// controllers/admin/product.controller.js
const productRepo = require("../../models/product/product.repo");
const { listUnifiedProducts } = require("../../providers/services/products/unifiedProducts.service");


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

  const populate =
    String(req.query.populate || "").toLowerCase() === "true" ||
    String(req.query.populate || "") === "1";

  const operationResultObject = await productRepo.getProduct(productId, { populate });
  return res.status(operationResultObject.code).json(operationResultObject);
};