// controllers/admin/heroSlide.controller.js
const heroSlideRepo = require("../../models/heroSlide/heroSlide.repo");

/* ---------------- controllers ---------------- */

exports.createHeroSlide = async (req, res) => {
  const operationResultObject = await heroSlideRepo.createHeroSlide(req.body);
  return res.status(operationResultObject.code).json(operationResultObject);
};

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

exports.updateHeroSlide = async (req, res) => {
  const { slideId } = req.params;

  const operationResultObject = await heroSlideRepo.updateHeroSlide(slideId, req.body);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.deleteHeroSlide = async (req, res) => {
  const { slideId } = req.params;
  const permanent = req.body?.permanent;

  const operationResultObject = await heroSlideRepo.deleteHeroSlide(slideId, permanent);
  return res.status(operationResultObject.code).json(operationResultObject);
};

/* ---------------- Image ---------------- */

// ✅ upload image (route uses params: /:slideId/image)
exports.uploadHeroSlideImage = async (req, res) => {
  const { _id } = req.query;
  const file = req.file;

  const op = await heroSlideRepo.uploadHeroSlideImage(_id, file);
  return res.status(op.code).json(op);
};

// ✅ remove image (route uses params: /:slideId/image/remove)
exports.removeHeroSlideImage = async (req, res) => {
  const { _id } = req.query;

  const op = await heroSlideRepo.removeHeroSlideImage(_id);
  return res.status(op.code).json(op);
};
