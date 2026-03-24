// helpers/permissions.helper.js

// ADMINS
const adminEndPoints = new Set([
  "POST /admin/admins",
  "GET /admin/admins",
  "GET /admin/admins/:id",
  "PUT /admin/admins/:id",
  "DELETE /admin/admins/:id",

  "PATCH /admin/admins/:id/image",
  "PATCH /admin/admins/:id/password",
  "PATCH /admin/admins/:id/role",
]);

// ROLES
const roleEndPoints = new Set([
  "POST /admin/roles",
  "GET /admin/roles",
  "GET /admin/roles/:id",
  "PUT /admin/roles/:id",
  "DELETE /admin/roles/:id",
]);

// CLIENTS
const clientEndPoints = new Set([
  "POST /admin/clients",
  "GET /admin/clients",
  "GET /admin/clients/:id",
  "PUT /admin/clients/:id",
  "DELETE /admin/clients/:id",

  "PATCH /admin/clients/:id/password",
]);
//  Store
const storeEndPoints = new Set([
  "POST /admin/stores",
  "PUT /admin/stores/:storeId",
  "PUT /admin/stores/logo",
  "PUT /admin/stores/logo/remove",
  "GET /admin/stores",
  "GET /admin/stores/:storeId",
  "GET /admin/stores/:storeId/products",
  "GET /admin/stores/:storeId/orders",
  "DELETE /admin/stores/:storeId",
]);


const categoriesEndPoints = new Set([
  "POST /admin/categories",
  "PUT /admin/categories",
  "GET /admin/categories",
  "GET /admin/categories/:categoryId",
  "DELETE /admin/categories/:categoryId",
  "PUT /admin/categories/image",
]);

const productsEndPoints = new Set([
  "POST /admin/products",
  "PUT /admin/products/:productId",
  "GET /admin/products",
  "GET /admin/products/:productId",
  "DELETE /admin/products/:productId",
  "PUT /admin/products/images",
  "DELETE /admin/products/images/remove",
  "DELETE /admin/products/images/clear",
]);

const groupEndPoints = new Set([
  "POST /admin/groups",
  "PUT /admin/groups/:_id",
  "GET /admin/groups",
  "GET /admin/groups/:_id",
  "DELETE /admin/groups/:_id",
  "PUT /admin/groups/image",
  "DELETE /admin/groups/image/remove",
]);

const paymentsEndPoints = new Set([
  "GET /admin/payments",
  "GET /admin/payments/:_id",
  "DELETE /admin/payments/:_id",
]);

// PERMISSIONS
const permissionEndPoints = new Set([
  "GET /admin/permissions",
]);

const permissions = new Map();
permissions.set("admins", adminEndPoints);
permissions.set("roles", roleEndPoints);
permissions.set("clients", clientEndPoints);
permissions.set("permissions", permissionEndPoints);
permissions.set("stores", storeEndPoints);
permissions.set("categories", categoriesEndPoints);
permissions.set("products", productsEndPoints);
permissions.set("groups", groupEndPoints);
permissions.set("payments", paymentsEndPoints);
module.exports = { permissions };