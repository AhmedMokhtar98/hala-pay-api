const app = require("express").Router();
const clientController = require("../../controllers/client/client.controller")
const { updateClientValidation, resetClientPasswordValidation } = require("../../validations/client.validation")
const validator = require("../../helpers/validation.helper")
const { checkIdentity } = require("../../helpers/authorizer.helper")
// const { uploadImagesToMemory } = require("../../helpers/uploader.helper")
// const uploadedFiles = uploadImagesToMemory()


app.put("/update", checkIdentity("_id"), validator(updateClientValidation), clientController.updateClient);
app.put("/password", checkIdentity("_id"), validator(resetClientPasswordValidation), clientController.resetPassword);
app.delete("/remove", checkIdentity("_id"), clientController.removeClient);

app.get("/get", checkIdentity("_id"), clientController.getClient);

// app.post("/image", checkIdentity("_id"), uploadedFiles.array('image', 1), clientController.uploadImage)
// app.delete("/image", checkIdentity("_id"), clientController.deleteImage)



module.exports = app
