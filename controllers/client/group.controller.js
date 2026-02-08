// controllers/client/group.controller.js
const groupRepo = require("../../models/group/group.client.repo");

/* ---------------- controllers ---------------- */

exports.createGroup = async (req, res) => {
  // ✅ enforce creator from auth (ignore any creator sent from client)
  const clientId = req.user?._id;

  const op = await groupRepo.createGroup({
    ...req.body,
    creator: clientId,
  });

  return res.status(op.code).json(op);
};

exports.listGroups = async (req, res) => {
  // ✅ return only groups that belong to this client (creator OR contributor)
  const clientId = req.user?._id;

  const filterObject = req.query;
  const op = await groupRepo.listGroups(clientId, filterObject, {}, {});
  return res.status(op.code).json(op);
};

exports.getGroupDetails = async (req, res) => {
  // use _id param style like your validations (or keep groupId if your route is /:groupId)
  const groupId = req.params.groupId || req.params._id;

  // ✅ ensure the client can access this group
  const clientId = req.user?._id;

  const op = await groupRepo.getGroup(clientId, groupId);
  return res.status(op.code).json(op);
};

exports.updateGroup = async (req, res) => {
  const groupId = req.params.groupId || req.params._id;
  const clientId = req.user?._id;

  // ✅ client can update only his group (creator OR contributor) — adjust policy in repo
  const op = await groupRepo.updateGroup(clientId, groupId, req.body);
  return res.status(op.code).json(op);
};

exports.deleteGroup = async (req, res) => {
  const groupId = req.params.groupId || req.params._id;
  const clientId = req.user?._id;

  // ✅ permanent is TRUE only if explicitly true / "true" / 1 / "1"
  const permanent =
    req.body?.permanent === true ||
    req.body?.permanent === "true" ||
    req.body?.permanent === 1 ||
    req.body?.permanent === "1";

  // ✅ client delete policy in repo (usually only creator can delete)
  const op = await groupRepo.deleteGroup(clientId, groupId, permanent);
  return res.status(op.code).json(op);
};

exports.uploadGroupImage = async (req, res) => {
  const groupId = req.query._id || req.query.groupId;
  const clientId = req.user?._id;
  const file = req.file;

  // ✅ only creator can upload image (recommended) — enforced in repo
  const op = await groupRepo.uploadGroupImage(clientId, groupId, file);
  return res.status(op.code).json(op);
};

exports.removeGroupImage = async (req, res) => {
  const groupId = req.query._id || req.query.groupId;
  const clientId = req.user?._id;

  // ✅ only creator can remove image (recommended) — enforced in repo
  const op = await groupRepo.removeGroupImage(clientId, groupId);
  return res.status(op.code).json(op);
};
