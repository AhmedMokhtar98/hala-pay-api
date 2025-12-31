const express = require("express");
const router = express.Router();
const sallaController = require("../../controllers/admin/salla.controller");

// Fetch products for a store
router.get("/products/:store_id", sallaController.getProducts);

module.exports = router;
