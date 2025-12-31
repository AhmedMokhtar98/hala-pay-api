const app = require("express").Router();
const roleController = require("../../controllers/admin/role.controller")
const { createRoleValidation, updateRoleValidation } = require("../../validations/role.validation")
const validator = require("../../helpers/validation.helper");
const errorHandler = require("../../middlewares/errorHandler");

app.get("/", roleController.listRoles);
app.get("/:id", errorHandler(roleController.getRole));

app.post("/", validator(createRoleValidation), errorHandler(roleController.createRole));
app.put("/:id", validator(updateRoleValidation), errorHandler(roleController.updateRole));
app.delete("/:id", errorHandler(roleController.removeRole));


module.exports = app
