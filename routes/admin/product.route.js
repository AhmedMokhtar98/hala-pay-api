const router = require("express").Router();

const productController = require("../../controllers/admin/product.controller");
const errorHandler = require("../../middlewares/errorHandler");
const { uploadImage } = require("../../multer/uploadImage");
const validator = require("../../helpers/validation.helper");
const { loadStoreByProvider } = require("../../middlewares/loadStoreByProvider.middleware");

const {
  createProductValidation,
  productIdParamsValidation,
  updateProductValidation,
  deleteProductValidation,
  uploadProductImagesValidation,
  removeProductImageValidation,
  clearProductImagesValidation,
  listProductsValidation,
} = require("../../validations/product.validation");

const productImagesUpload = uploadImage({
  module: "products",
  idParam: "productId",
  maxSizeMB: 5,
});

// list
router.get( "/", validator(listProductsValidation), loadStoreByProvider, errorHandler(productController.listProducts) );

// create
router.post( "/", validator(createProductValidation), errorHandler(productController.createProduct) );

// upload images
router.put( "/images", validator(uploadProductImagesValidation), productImagesUpload.array("images", 10), errorHandler(productController.uploadProductImages) );

// remove one image
router.delete( "/images/remove", validator(removeProductImageValidation), errorHandler(productController.removeProductImage) );

// clear all images
router.delete( "/images/clear", validator(clearProductImagesValidation), errorHandler(productController.clearProductImages) );

// update product
router.put( "/:productId", validator(updateProductValidation), errorHandler(productController.updateProduct) );

// get product details
router.get( "/:productId", validator(productIdParamsValidation), errorHandler(productController.getProductDetails) );

// delete product
router.delete( "/:productId", validator(deleteProductValidation), errorHandler(productController.deleteProduct) );

module.exports = router;