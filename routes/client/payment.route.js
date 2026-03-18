// routes/admin/group.route.js
const router = require("express").Router();

const paymentController = require("../../controllers/client/payment.controller");
const validator = require("../../helpers/validation.helper");
const errorHandler = require("../../middlewares/errorHandler");
const { topUpGroupValidation } = require("../../validations/payment.validation");

router.post("/topup/:groupId", validator(topUpGroupValidation), errorHandler(paymentController.topUpGroup) );

module.exports = router;
