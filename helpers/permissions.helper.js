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

// PERMISSIONS
const permissionEndPoints = new Set([
  "GET /admin/permissions",
]);

const permissions = new Map();
permissions.set("admins", adminEndPoints);
permissions.set("roles", roleEndPoints);
permissions.set("clients", clientEndPoints);
permissions.set("permissions", permissionEndPoints);

module.exports = { permissions };