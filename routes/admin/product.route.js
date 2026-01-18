const router = require("express").Router();

const productController = require("../../controllers/admin/product.controller");
const errorHandler = require("../../middlewares/errorHandler");
const { uploadImage } = require("../../multer/uploadImage");
const productImagesUpload = uploadImage({ module: "products", idParam: "productId", maxSizeMB: 5, });
const { createProductValidation, listProductsValidation, productIdParamsValidation, updateProductValidation, deleteProductValidation, uploadProductImagesValidation, } = require("../../validations/product.validation");
const validator = require("../../helpers/validation.helper")


router.get("/", validator(listProductsValidation), errorHandler(productController.listProducts));

router.post("/", validator(createProductValidation), errorHandler(productController.createProduct));

router.put( "/images", validator(uploadProductImagesValidation), productImagesUpload.array("images", 10), errorHandler(productController.uploadProductImages) );
router.delete("/images/remove", validator(uploadProductImagesValidation), errorHandler(productController.removeProductImage) );

router.put( "/:productId", validator(updateProductValidation), errorHandler(productController.updateProduct) );
router.get( "/:productId", validator(productIdParamsValidation), errorHandler(productController.getProductDetails) );

router.delete( "/:productId", validator(deleteProductValidation), errorHandler(productController.deleteProduct) );


module.exports = router;
