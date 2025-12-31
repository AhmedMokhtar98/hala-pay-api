// controllers/role.controller.js
const roleRepo = require("../../models/role/role.repo");
const adminRepo = require("../../models/admin/admin.repo");
const { BadRequestException } = require("../../middlewares/errorHandler/exceptions");

exports.createRole = async (req, res) => {
  const operationResultObject = await roleRepo.create(req.body);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.listRoles = async (req, res) => {
 const filterObject = req.query;
  const operationResultObject = await roleRepo.list(filterObject, {}, {});
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.getRole = async (req, res) => {
  const id = req.params?.id;
  const operationResultObject = await roleRepo.get(id);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.updateRole = async (req, res) => {
  const roleId = req.params?.id;
  const formObject = req.body;
  const operationResultObject = await roleRepo.update(roleId, formObject);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.removeRole = async (req, res) => {
  const roleId = req.params?.id;
  const operationResultObject = await roleRepo.remove(roleId);
  return res.status(operationResultObject.code).json(operationResultObject);
};
