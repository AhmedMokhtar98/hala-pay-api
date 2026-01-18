const { Router } = require("express");
const ctrl = require("../../salla/controllers/sallaStore.controller");
const errorHandler = require("../../middlewares/errorHandler");
const { SallaTokenMiddleWare } = require("../../salla/middleware/sallaToken.middleware");

const router = Router();

router.get("/:storeId", SallaTokenMiddleWare, errorHandler(ctrl.getStoreDetails));
router.get("/:storeId/orders", errorHandler(ctrl.getOrders));
router.get("/:storeId/products", errorHandler(ctrl.getProducts));

module.exports = router;
