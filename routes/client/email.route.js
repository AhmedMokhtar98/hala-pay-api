const app = require("express").Router();
const emailController = require("../../controllers/emailServices/email.controller")

app.post('/verify', emailController.emailVerify);
app.post('/support', emailController.support);
app.post('/password-reset-request', emailController.passwordResetRequest);
app.put("/password-reset", emailController.resetPassword);


module.exports = app
