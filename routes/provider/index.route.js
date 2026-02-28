// routes/provider/index.route.js
const express = require("express");
const app = express();

const authRoutes = require("./auth.route");

app.use("/auth", authRoutes);

module.exports = app;