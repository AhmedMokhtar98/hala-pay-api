// routes/admin/heroSlide.routes.js
const router = require("express").Router();

const heroSlideController = require("../../controllers/admin/heroSlide.controller.js");
const validator = require("../../helpers/validation.helper");
const errorHandler = require("../../middlewares/errorHandler");

const {
  createHeroSlideValidation,
  updateHeroSlideValidation,
  uploadHeroSlideImageValidation,
  removeHeroSlideImageValidation,
} = require("../../validations/heroSlide.validation");

const { uploadImage } = require("../../multer/uploadImage");

// ✅ multer: save to /public/images/hero-slides/:slideId/
const heroSlideImageUpload = uploadImage({
  module: "hero-slides",
  idParam: ["slideId", "_id", "id"],     // ✅ accepts slideId or _id or id
  requireObjectId: true,                // ✅ ensure valid ObjectId
});

router.post("/", validator(createHeroSlideValidation), errorHandler(heroSlideController.createHeroSlide));

/* ---------------------------
  Image (single)
  PUT /image?slideId=<id>
--------------------------- */

// ✅ Upload hero slide image
router.put( "/image", validator(uploadHeroSlideImageValidation), heroSlideImageUpload.single("image"), errorHandler(heroSlideController.uploadHeroSlideImage) );

// ✅ Remove hero slide image
// DELETE /image?slideId=<id>
router.delete( "/image", validator(removeHeroSlideImageValidation), errorHandler(heroSlideController.removeHeroSlideImage) );
router.put("/", validator(updateHeroSlideValidation), errorHandler(heroSlideController.updateHeroSlide));

router.get("/", errorHandler(heroSlideController.listHeroSlides));
router.get("/:slideId", errorHandler(heroSlideController.getHeroSlide));
router.delete("/:slideId", errorHandler(heroSlideController.deleteHeroSlide));

module.exports = router;
