const app = require("express").Router();
const storeController = require("../../controllers/client/store.controller");
const errorHandler = require("../../middlewares/errorHandler");
const validateObjectId = require("../../helpers/validateObjectId");

app.get("/",  errorHandler(storeController.listStores));
app.get("/:storeId", validateObjectId("storeId"), errorHandler(storeController.getStoreDetails));
// Products
app.get("/:storeId/products", errorHandler(storeController.getProducts));

// Export the router
module.exports = app;