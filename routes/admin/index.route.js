// routes/admin/index.route.js
let express = require("express");
const app = express();
let roles = require("./roles.route");
const authRoutes = require("./auth.route");
const adminRoutes = require("./admin.route");
const permissionRoutes = require("./permissions.route");
const clientRoutes = require("./client.route");
const productRoutes = require("./product.route");
const allowedUsers = ["superAdmin", "admin"]
let { isAuthorized } = require("../../helpers/authorizer.helper")
let checkToken = require("../../helpers/jwt.helper").verifyToken;

app.use(authRoutes)
app.use("/admins", checkToken(allowedUsers), isAuthorized, adminRoutes);
app.use("/clients", checkToken(allowedUsers), isAuthorized, clientRoutes);
app.use("/products", checkToken(allowedUsers), isAuthorized, productRoutes);
app.use("/roles", checkToken(allowedUsers), isAuthorized, roles);
app.use("/permissions", checkToken(allowedUsers), isAuthorized, permissionRoutes);

module.exports = app