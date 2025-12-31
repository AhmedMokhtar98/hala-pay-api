// routes/client/index.route.js
let express = require("express");
const app = express();
const authRoutes = require("./auth.route");
const clientRoutes = require("./client.route");
const emailRoutes = require("./email.route");
const allowedUsers = ["client"]
let checkToken = require("../../helpers/jwt.helper").verifyToken;

app.use(authRoutes)
app.use("/email", emailRoutes);
app.use(checkToken(allowedUsers), clientRoutes);


module.exports = app