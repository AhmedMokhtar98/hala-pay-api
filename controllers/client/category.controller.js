const categoryRepo = require("../../models/category/category.repo");

/* ---------------- controllers ---------------- */
exports.listCategories = async (req, res) => {
  const filterObject = req.query;
  console.log(`filterObject`, filterObject);
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
