const { Router } = require("express");
const router = Router();

const ctrl = require("../../controllers/webhook/sallaWebhook.controller");

router.post("/salla", ctrl.handle);

module.exports = router;