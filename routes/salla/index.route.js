// routes/salla/index.route.js
const express = require("express");
const app = express();
const productsRoutes = require("./product.route");
const authRoutes = require("./auth.route");
const errorHandler = require("../../middlewares/errorHandler");

// Other routes...
app.use( "/auth", errorHandler(authRoutes));
app.use("/products", productsRoutes);

module.exports = app;
    