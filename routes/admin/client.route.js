const app = require("express").Router();
const clientController = require("../../controllers/admin/client.controller");
const validateObjectId = require("../../helpers/validateObjectId");
const validationHelper = require("../../helpers/validation.helper");
const errorHandler = require("../../middlewares/errorHandler");
const { createClientValidationForAdmin, updateClientValidationForAdmin } = require("../../validations/client.validation");

app.get("/", errorHandler(clientController.list)); // Route to fetch all users
app.post("/", validationHelper(createClientValidationForAdmin), errorHandler(clientController.create)); // Route to create a new user
app.get("/:id", validateObjectId("id"), errorHandler(clientController.get)); // Route to get a user by ID
app.put("/:id", validateObjectId("id"), validationHelper(updateClientValidationForAdmin), errorHandler(clientController.update)); // Route to update a user by ID
app.delete("/:id", validateObjectId("id"), errorHandler(clientController.remove)); // Route to delete a user by ID
// Export the router
module.exports = app;