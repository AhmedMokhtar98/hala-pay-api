const app = require("express").Router();
const authController = require("../../controllers/admin/auth.controller");
const validator = require("../../helpers/validation.helper");
const errorHandler = require("../../middlewares/errorHandler");
const { loginValidation } = require("../../validations/admin.validation")
app.post("/login", validator(loginValidation), errorHandler(authController.login));
app.post("/refresh-token", errorHandler(authController.refreshToken));

module.exports = app
