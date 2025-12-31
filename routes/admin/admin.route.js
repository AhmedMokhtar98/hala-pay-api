const app = require("express").Router();
const adminController = require("../../controllers/admin/admin.controller")
const { createAdminValidation, updateAdminValidation, resetPasswordValidation } = require("../../validations/admin.validation")
const validator = require("../../helpers/validation.helper")
const errorHandler = require("../../middlewares/errorHandler/index.js");
const validateObjectId = require("../../helpers/validateObjectId.js");


app.post("/", validator(createAdminValidation), errorHandler(adminController.createAdmin));
app.put("/role", validator(updateAdminValidation), errorHandler(adminController.updateAdminRole));
app.put("/password", validator(resetPasswordValidation), errorHandler(adminController.resetPassword));
app.get("/:id", validateObjectId("id"), errorHandler(adminController.getAdmin));
app.put("/:id", validator(updateAdminValidation), validateObjectId("id"), errorHandler(adminController.updateAdmin));
app.delete("/:id", validateObjectId("id"), errorHandler(adminController.removeAdmin));
app.get("/", errorHandler(adminController.listAdmins));


module.exports = app
