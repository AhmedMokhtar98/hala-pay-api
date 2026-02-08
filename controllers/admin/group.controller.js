// controllers/admin/group.controller.js
const groupRepo = require("../../models/group/group.repo");

/* ---------------- controllers ---------------- */

exports.createGroup = async (req, res) => {
  const op = await groupRepo.createGroup(req.body);
  return res.status(op.code).json(op);
};

exports.listGroups = async (req, res) => {
  const filterObject = req.query;
  const op = await groupRepo.listGroups(filterObject, {}, {}, {});
  return res.status(op.code).json(op);
};

exports.getGroupDetails = async (req, res) => {
  const { _id } = req.params;

  const op = await groupRepo.getGroup(_id);
  return res.status(op.code).json(op);
};

exports.updateGroup = async (req, res) => {
  const { _id } = req.params;
  const op = await groupRepo.updateGroup(_id, req.body);
  return res.status(op.code).json(op);
};

exports.deleteGroup = async (req, res) => {
  const { _id } = req.params;

  // ✅ permanent is TRUE only if it is explicitly true / "true" / 1 / "1"
  const permanent = req.body?.permanent === true || req.body?.permanent === "true" 

  const op = await groupRepo.deleteGroup(_id, permanent);
  return res.status(op.code).json(op);
};

exports.uploadGroupImage = async (req, res) => {
  const { _id } = req.query;
  const file = req.file;

  const op = await groupRepo.uploadGroupImage(_id, file);
  return res.status(op.code).json(op);
};

exports.removeGroupImage = async (req, res) => {
  const { _id } = req.query;

  console.log("Removing image for group ID:", _id);
  const op = await groupRepo.removeGroupImage(_id);
  return res.status(op.code).json(op);
};
