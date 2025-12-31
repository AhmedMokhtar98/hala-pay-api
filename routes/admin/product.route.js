const app = require("express").Router();
const productController = require("../../controllers/admin/product.controller");
const errorHandler = require("../../middlewares/errorHandler");

app.get("/", errorHandler(productController.list)); // Route to fetch all users
// Export the router
module.exports = app;