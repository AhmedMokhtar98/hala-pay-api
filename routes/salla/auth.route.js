// routes/salla/auth.route.js
const { Router } = require("express");
const router = Router();
const ctrl = require("../../salla/controllers/sallaAuth.controller");
const errorHandler = require("../../middlewares/errorHandler");
const { SallaTokenMiddleWare } = require("../../salla/middleware/sallaToken.middleware");

router.get("/", errorHandler(ctrl.startAuth));
router.get("/callback", errorHandler(ctrl.callback));
router.get("/status", errorHandler(ctrl.status));
router.post("/refresh/:storeId", errorHandler(ctrl.refresh));
router.post("/disconnect/:storeId", errorHandler(ctrl.disconnect));

router.get("/me/:storeId", SallaTokenMiddleWare, errorHandler(ctrl.me));

module.exports = router;
