const app = require("express").Router();
const authController = require("../../controllers/client/auth.controller")
const { createClientValidation, loginClientValidation } = require("../../validations/client.validation")
const validator = require("../../helpers/validation.helper")

app.post('/register', validator(createClientValidation), authController.register);
app.post('/login', validator(loginClientValidation), authController.login);
app.post('/guest', authController.loginAsGuest);


module.exports = app