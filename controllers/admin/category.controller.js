// controllers/admin/category.controller.js
const categoryRepo = require("../../models/category/category.repo");

/* ---------------- controllers ---------------- */

exports.createCategory = async (req, res) => {
  const operationResultObject = await categoryRepo.createCategory(req.body);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.listCategories = async (req, res) => {
  const filterObject = req.query;

  const operationResultObject = await categoryRepo.listCategories(
    filterObject,
    {},
    {},
    {}
  );

  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.getCategoryDetails = async (req, res) => {
  const { categoryId } = req.params;

  const operationResultObject = await categoryRepo.getCategory(categoryId);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.updateCategory = async (req, res) => {
  const { categoryId } = req.params;
  const operationResultObject = await categoryRepo.updateCategory(categoryId, req.body);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.deleteCategory = async (req, res) => {
  const { categoryId } = req.params;

  // ✅ permanent is TRUE only if it is explicitly true / "true" / 1 / "1"
  const permanent =
    req.body?.permanent === true ||
    req.body?.permanent === "true" ||
    req.body?.permanent === 1 ||
    req.body?.permanent === "1";

  const operationResultObject = await categoryRepo.deleteCategory(
    categoryId,
    permanent
  );

  return res.status(operationResultObject.code).json(operationResultObject);
};



exports.uploadCategoryImage = async (req, res) => {
  const { categoryId } = req.query;
  const file = req.file;

  const op = await categoryRepo.uploadCategoryImage(categoryId, file);
  return res.status(op.code).json(op);
};

exports.removeCategoryImage = async (req, res) => {
  const { categoryId } = req.query;

  const op = await categoryRepo.removeCategoryImage(categoryId);
  return res.status(op.code).json(op);
};
