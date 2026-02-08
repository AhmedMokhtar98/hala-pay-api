// routes/admin/index.route.js
let express = require("express");
const app = express();
let roles = require("./roles.route");
const authRoutes = require("./auth.route");
const adminRoutes = require("./admin.route");
const permissionRoutes = require("./permissions.route");
const clientRoutes = require("./client.route");
const categoriesRoutes = require("./category.route");
const storesRoutes = require("./store.route");
const productsRoutes = require("./product.route");
const heroSlideRoutes = require("./heroAds.route");
const groupRoutes = require("./group.route");
const allowedUsers = ["superAdmin", "admin"]
let { isAuthorized } = require("../../helpers/authorizer.helper")
let checkToken = require("../../helpers/jwt.helper").verifyToken;

app.use(authRoutes)
app.use("/admins", checkToken(allowedUsers), isAuthorized, adminRoutes);
app.use("/clients", checkToken(allowedUsers), isAuthorized, clientRoutes);
app.use("/categories", checkToken(allowedUsers), isAuthorized, categoriesRoutes);
app.use("/stores", checkToken(allowedUsers), isAuthorized, storesRoutes);
app.use("/products", checkToken(allowedUsers), isAuthorized, productsRoutes);
app.use("/roles", checkToken(allowedUsers), isAuthorized, roles);
app.use("/permissions", checkToken(allowedUsers), isAuthorized, permissionRoutes);
app.use("/groups", checkToken(allowedUsers), isAuthorized, groupRoutes);
app.use("/hero-ads", checkToken(allowedUsers), isAuthorized, heroSlideRoutes);

module.exports = app