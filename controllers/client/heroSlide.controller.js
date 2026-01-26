// controllers/client/heroSlide.controller.js
const heroSlideRepo = require("../../models/heroSlide/heroSlide.repo");

/* ---------------- controllers ---------------- */

exports.listHeroSlides = async (req, res) => {
  const filterObject = req.query;

  const operationResultObject = await heroSlideRepo.listHeroSlides(filterObject, {}, {});
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.getHeroSlide = async (req, res) => {
  const { slideId } = req.params;

  const operationResultObject = await heroSlideRepo.getHeroSlide(slideId);
  return res.status(operationResultObject.code).json(operationResultObject);
};