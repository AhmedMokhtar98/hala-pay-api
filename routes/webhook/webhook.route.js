// routes/webhook/webhook.route.js
const express = require("express");
const router = express.Router();
const webhookController = require("../../controllers/admin/webhook.controller");

// This preserves the raw bytes for HMAC verification
router.post("/salla", webhookController.captureToken);

module.exports = router;
