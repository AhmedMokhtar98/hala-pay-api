// routes/providers/auth.route.js
const { Router } = require("express");
const router = Router();

const ctrl = require("../../controllers/providers/auth.controller");
const errorHandler = require("../../middlewares/errorHandler");

/**
 * Generic provider auth routes:
 *
 * GET  /api/v1/providers/auth/:provider            -> startAuth (redirect)
 * GET  /api/v1/providers/auth/:provider/callback   -> callback
 * GET  /api/v1/providers/auth/:provider/status     -> status
 * POST /api/v1/providers/auth/:provider/refresh/:storeId -> refresh tokens (providerStoreId)
 * POST /api/v1/providers/auth/:provider/disconnect/:storeId -> disconnect store
 */

router.get("/:provider", errorHandler(ctrl.startAuth));
router.get("/:provider/callback", errorHandler(ctrl.callback));
router.get("/:provider/status", errorHandler(ctrl.status));
router.get("/:provider/:storeId", errorHandler(ctrl.getAccountsUserInfo));
router.post("/:provider/refresh/:storeId", errorHandler(ctrl.refresh));
router.post("/:provider/disconnect/:storeId", errorHandler(ctrl.disconnect));

module.exports = router;