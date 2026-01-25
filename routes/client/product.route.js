const router = require("express").Router();
const productController = require("../../controllers/admin/product.controller");
const errorHandler = require("../../middlewares/errorHandler");
const { listProductsValidation, productIdParamsValidation} = require("../../validations/product.validation");
const validator = require("../../helpers/validation.helper")

router.get("/", validator(listProductsValidation), errorHandler(productController.listProducts));

router.get( "/:productId", validator(productIdParamsValidation), errorHandler(productController.getProductDetails) );



module.exports = router;
