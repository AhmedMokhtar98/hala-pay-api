// routes/index.route.js
const express = require("express");
const webhookRoutes = require("./webhook/index.route");
const adminRoutes = require("./admin/index.route");
const clientRoutes = require("./client/index.route");
const sallaRoutes = require("./salla/index.route");
const validateObjectId = require("../helpers/validateObjectId");
const errorHandler = require("../middlewares/errorHandler");
const { NotFoundException } = require("../middlewares/errorHandler/exceptions");

const router = express.Router();

// Root route
router.get("/", errorHandler(async (req, res) => {
  res.render("index");
}));

// -------------------------
// Webhook route (RAW body for HMAC)
// -------------------------
router.use("/salla", sallaRoutes);

router.use(
  "/webhook", 
  express.raw({ type: "application/json" }), // override JSON parsing
  webhookRoutes
);

// -------------------------
// Normal API routes (JSON parsing applies)
// -------------------------
router.use("/admin", validateObjectId(), adminRoutes);
router.use("/client", clientRoutes);

// Catch-all undefined routes
router.all("*", errorHandler(async (req) => {
  throw new NotFoundException("errors.invalid_request");
}));

module.exports = router;
