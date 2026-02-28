// routes/index.route.js
const express = require("express");
// const webhookRoutes = require("./webhook/index.route");
const adminRoutes = require("./admin/index.route");
const clientRoutes = require("./client/index.route");
const providerRoutes = require("./provider/index.route");
const validateObjectId = require("../helpers/validateObjectId");
const errorHandler = require("../middlewares/errorHandler");
const { NotFoundException } = require("../middlewares/errorHandler/exceptions");
const webhookRoutes = require("./webhook/index.route");

const router = express.Router();

// Root route
router.get("/", errorHandler(async (req, res) => {
  res.render("index");
}));

// -------------------------
// Webhook route (RAW body for HMAC)
// -------------------------

router.use( "/webhook", express.raw({ type: "application/json" }), webhookRoutes );

// -------------------------
// Normal API routes (JSON parsing applies)
// -------------------------
router.use("/admin", validateObjectId(), adminRoutes);
router.use("/client", clientRoutes);
router.use("/provider", providerRoutes);
// Catch-all undefined routes
router.all("*", errorHandler(async (req) => {
  throw new NotFoundException("errors.invalid_request");
}));

module.exports = router;
