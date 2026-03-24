const app = require("express").Router();
const paymentsController = require("../../controllers/admin/payments.controller");
const validateObjectId = require("../../helpers/validateObjectId");
const errorHandler = require("../../middlewares/errorHandler");

app.get("/", errorHandler(paymentsController.list)); 
app.get("/:id", validateObjectId("id"), errorHandler(paymentsController.get));
app.delete("/:id", validateObjectId("id"), errorHandler(paymentsController.remove)); 
// Export the router
module.exports = app;