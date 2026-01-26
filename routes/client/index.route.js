// routes/client/index.route.js
let express = require("express");
const app = express();
const authRoutes = require("./auth.route");
const clientRoutes = require("./client.route");
const categoriesRoutes = require("./category.route");
const storesRoutes = require("./store.route");
const productsRoutes = require("./product.route");
const heroAdsRoutes = require("./heroAds.route");
const emailRoutes = require("./email.route");
const allowedUsers = ["client"]
let checkToken = require("../../helpers/jwt.helper").verifyToken;

app.use("/auth", authRoutes);
app.use("/categories", checkToken(allowedUsers), categoriesRoutes);
app.use("/stores", checkToken(allowedUsers), storesRoutes);
app.use("/products", checkToken(allowedUsers), productsRoutes);
app.use("/hero-ads", checkToken(allowedUsers), heroAdsRoutes);
app.use("/email", checkToken(allowedUsers), emailRoutes);
app.use(checkToken(allowedUsers), clientRoutes);


module.exports = app