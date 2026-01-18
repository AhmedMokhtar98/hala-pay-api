const router = require("express").Router();
const categoryController = require("../../controllers/admin/category.controller");
const validator = require("../../helpers/validation.helper");
const errorHandler = require("../../middlewares/errorHandler");
const { uploadImage } = require("../../multer/uploadImage");
const { uploadCategoryImageValidation, removeCategoryImageValidation } = require("../../validations/category.validation");
const categoryImageUpload = uploadImage({ module: "categories", idParam: "categoryId" });

// You must plug your multer here:
// const { uploadCategoryImagesMulter } = require("../../multer/uploadImage");
// router.post("/upload-images", uploadCategoryImagesMulter.array("images", 10), categoryController.uploadCategoryImages);

router.post("/", errorHandler(categoryController.createCategory));

router.put( "/image", validator(uploadCategoryImageValidation), categoryImageUpload.single("image"), errorHandler(categoryController.uploadCategoryImage) );
router.delete( "/image/remove", validator(removeCategoryImageValidation), errorHandler(categoryController.removeCategoryImage) );


router.put("/:categoryId", errorHandler(categoryController.updateCategory));
router.get("/", errorHandler(categoryController.listCategories));
router.get("/:categoryId", errorHandler(categoryController.getCategoryDetails));
router.delete("/:categoryId", errorHandler(categoryController.deleteCategory));
// upload images endpoint (query style like your store controller)


module.exports = router;
