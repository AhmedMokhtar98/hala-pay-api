const app = require("express").Router();
const authController = require("../../controllers/client/auth.controller")
const validator = require("../../helpers/validation.helper")
const errorHandler = require("../../middlewares/errorHandler");
const { registerValidation, loginValidation, emailCheckValidation, sendOtpValidation, phoneCheckExistValidation, verifyOtpValidation, forgotPasswordValidation } = require("../../validations/client.auth.validation");

app.post('/email-check', validator(emailCheckValidation), errorHandler(authController.emailCheck));
app.post('/phone-check', validator(phoneCheckExistValidation), errorHandler(authController.phoneCheck));
app.post('/otp-send', validator(sendOtpValidation), errorHandler(authController.sendOTP));
app.post('/otp-verify', validator(verifyOtpValidation), errorHandler(authController.verifyOTP));
app.post('/register', validator(registerValidation), errorHandler(authController.register));
app.post('/login', validator(loginValidation), errorHandler(authController.login));// Login route 
app.post('/password/forgot', validator(forgotPasswordValidation), errorHandler(authController.forgotPassword));// Forgot password route 
// password reset route need to be handled 

app.post('/guest', errorHandler(authController.loginAsGuest));


module.exports = app