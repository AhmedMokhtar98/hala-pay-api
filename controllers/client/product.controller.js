// controllers/admin/product.controller.js
const productRepo = require("../../models/product/product.repo");

exports.listProducts = async (req, res) => {
  const filterObject = req.query;

  const populate =
    String(req.query.populate || "").toLowerCase() === "true" ||
    String(req.query.populate || "") === "1";

  const operationResultObject = await productRepo.listProducts(
    filterObject,
    {},
    {},
    { populate }
  );

  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.getProductDetails = async (req, res) => {
  const { productId } = req.params;

  const populate =
    String(req.query.populate || "").toLowerCase() === "true" ||
    String(req.query.populate || "") === "1";

  const operationResultObject = await productRepo.getProduct(productId, { populate });
  return res.status(operationResultObject.code).json(operationResultObject);
};