// routes/salla/auth.route.js
const { Router } = require("express");
const router = Router();
const ctrl = require("../../salla/controllers/sallaAuth.controller");
const errorHandler = require("../../middlewares/errorHandler");

router.get("/", errorHandler(ctrl.startAuth));
router.get("/callback", errorHandler(ctrl.callback));
router.get("/status", errorHandler(ctrl.status));
router.post("/refresh/:storeId", errorHandler(ctrl.refresh));
router.post("/disconnect/:storeId", errorHandler(ctrl.disconnect));


module.exports = router;
