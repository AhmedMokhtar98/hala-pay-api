const app = require("express").Router();
const clientController = require("../../controllers/client/client.controller")
const { updateClientValidation, changePasswordValidation, } = require("../../validations/client.validation")
const validator = require("../../helpers/validation.helper")
const { checkIdentity } = require("../../helpers/authorizer.helper");
const { verifyOtpValidation } = require("../../validations/client.auth.validation");
const errorHandler = require("../../middlewares/errorHandler");
const { uploadImage } = require("../../multer/uploadImage");
const clientImageUpload = uploadImage({ module: "clients", allowIdFromUser: true, requireObjectId: true, maxSizeMB: 3, });

app.get("/", checkIdentity("_id"), errorHandler(clientController.getClient));
app.put("/", checkIdentity("_id"), validator(updateClientValidation), errorHandler(clientController.updateClient));
app.delete("/", checkIdentity("_id"), errorHandler(clientController.removeAccount));
app.put("/phone", checkIdentity("_id"), validator(verifyOtpValidation), errorHandler(clientController.updatePhoneNumber));
app.put("/password", checkIdentity("_id"), validator(changePasswordValidation), errorHandler(clientController.updatePassword));
app.put("/image", checkIdentity("_id"), clientImageUpload.single("image"), errorHandler(clientController.uploadImage));
app.delete("/image", checkIdentity("_id"), errorHandler(clientController.deleteImage));

// app.post("/image", checkIdentity("_id"), uploadedFiles.array('image', 1), clientController.uploadImage)
// app.delete("/image", checkIdentity("_id"), clientController.deleteImage)



module.exports = app
