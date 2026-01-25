const router = require("express").Router();
const categoryController = require("../../controllers/client/category.controller");
const errorHandler = require("../../middlewares/errorHandler");

router.get("/", errorHandler(categoryController.listCategories));
router.get("/:categoryId", errorHandler(categoryController.getCategoryDetails));

module.exports = router;
