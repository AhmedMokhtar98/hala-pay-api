// routes/client/index.route.js
let express = require("express");
const app = express();
const authRoutes = require("./auth.route");
const clientRoutes = require("./client.route");
const categoriesRoutes = require("./category.route");
const storesRoutes = require("./category.route");
const productsRoutes = require("./product.route");
const emailRoutes = require("./email.route");
const allowedUsers = ["client"]
let checkToken = require("../../helpers/jwt.helper").verifyToken;

app.use("/auth", authRoutes);
app.use("/categories", categoriesRoutes);
app.use("/stores", storesRoutes);
app.use("/products", productsRoutes);
app.use("/email", emailRoutes);
app.use(checkToken(allowedUsers), clientRoutes);


module.exports = app