const app = require("express").Router();
const storeController = require("../../controllers/admin/store.controller");
const validator = require("../../helpers/validation.helper")
const { uploadImage } = require("../../multer/uploadImage");
const { createStoreValidation, removeStoreImageValidation, uploadStoreImageValidation } = require("../../validations/store.validation");
const storeImageUpload = uploadImage({ module: "stores", idParam: "storeId" });
const errorHandler = require("../../middlewares/errorHandler");
const validateObjectId = require("../../helpers/validateObjectId");

app.post("/", validator(createStoreValidation),  errorHandler(storeController.createStore));
app.get("/",  errorHandler(storeController.listStores));
app.put( "/logo",validateObjectId("storeId"),  storeImageUpload.single("image"), errorHandler(storeController.uploadStoreImage) );
app.delete( "/logo/remove", validateObjectId("storeId"), errorHandler(storeController.removeStoreImage) );
app.get("/:storeId", validateObjectId("storeId"), errorHandler(storeController.getStoreDetails));
app.put("/:storeId", validateObjectId("storeId"), errorHandler(storeController.updateStore));
app.delete("/:storeId", errorHandler(storeController.deleteStore));
// Products
app.get("/:storeId/products", errorHandler(storeController.getProducts));

// Export the router
module.exports = app;