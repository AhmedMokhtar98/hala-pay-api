// routes/index.route.js
const express = require("express");
const app = express();
const webhookRoutes = require("./webhook.route");

// Other routes...
app.use("/", webhookRoutes);

module.exports = app;
