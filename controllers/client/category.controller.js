const categoryRepo = require("../../models/category/category.repo");

/* ---------------- controllers ---------------- */
exports.listCategories = async (req, res) => {
  const filterObject = req.query;

  // optional: populate store if ?populateStore=true
  const populateStore =
    String(req.query.populateStore || "").toLowerCase() === "true" ||
    String(req.query.populateStore || "") === "1";

  const operationResultObject = await categoryRepo.listCategories(
    filterObject,
    {},
    {},
    { populateStore }
  );

  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.getCategoryDetails = async (req, res) => {
  const { categoryId } = req.params;

  const operationResultObject = await categoryRepo.getCategory(categoryId);
  return res.status(operationResultObject.code).json(operationResultObject);
};
