// controllers/admin/product.controller.js
const productRepo = require("../../models/product/product.repo");

exports.createProduct = async (req, res) => {
  const operationResultObject = await productRepo.createProduct(req.body);
  return res.status(operationResultObject.code).json(operationResultObject);
};

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