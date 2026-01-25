const app = require("express").Router();
const clientController = require("../../controllers/client/client.controller")
const { updateClientValidation } = require("../../validations/client.validation")
const validator = require("../../helpers/validation.helper")
const { checkIdentity } = require("../../helpers/authorizer.helper")
// const { uploadImagesToMemory } = require("../../helpers/uploader.helper")
// const uploadedFiles = uploadImagesToMemory()

app.get("/", checkIdentity("_id"), clientController.getClient);
app.put("/update", checkIdentity("_id"), validator(updateClientValidation), clientController.updateClient);

// app.post("/image", checkIdentity("_id"), uploadedFiles.array('image', 1), clientController.uploadImage)
// app.delete("/image", checkIdentity("_id"), clientController.deleteImage)



module.exports = app
