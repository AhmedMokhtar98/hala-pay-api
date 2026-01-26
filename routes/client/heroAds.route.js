// routes/client/heroSlide.routes.js
const router = require("express").Router();
const heroSlideController = require("../../controllers/admin/heroSlide.controller.js");
const errorHandler = require("../../middlewares/errorHandler");

router.get("/", errorHandler(heroSlideController.listHeroSlides));
router.get("/:slideId", errorHandler(heroSlideController.getHeroSlide));

module.exports = router;
