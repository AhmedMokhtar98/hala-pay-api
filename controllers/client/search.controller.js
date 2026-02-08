// controllers/public/suggest.controller.js
const suggestRepo = require("../../models/suggest/suggest.repo");

exports.searchAll = async (req, res) => {
  const q = req.query.q || "";
  const type = req.query.type; // "product" | "store" | "category" | "product,category"
  const limit = Number(req.query.limit || 12);
  const perType = Number(req.query.perType || 6);

  const op = await suggestRepo.searchAll({ q, type, limit, perType });
  return res.status(op.code).json(op);
};
