const router = require("express").Router();
const searchController = require("../../controllers/client/search.controller");
const errorHandler = require("../../middlewares/errorHandler");
// const { listProductsValidation } = require("../../validations/product.validation");
// const validator = require("../../helpers/validation.helper")

router.get("/", errorHandler(searchController.searchAll));


module.exports = router;
