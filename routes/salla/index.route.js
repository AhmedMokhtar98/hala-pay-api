// routes/salla/index.route.js
const express = require("express");
const app = express();
const sallaStoreRoutes = require("./sallaStore.route");
const authRoutes = require("./auth.route");

// Other routes...
app.use( "/auth", authRoutes);
app.use("/store", sallaStoreRoutes);

module.exports = app;
    