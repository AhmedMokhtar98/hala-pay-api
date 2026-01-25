// helpers/authorizer.helper.js

const { permissions } = require("./permissions.helper");
const {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} = require("../middlewares/errorHandler/exceptions");

/** -------------------------
 * Canonical normalization:
 * - METHOD uppercase
 * - PATH lowercase
 * - ALL params => :id
 * ------------------------- */
function normalizePermissionKey(s) {
  s = String(s).trim().replace(/\s+/g, " ");
  const m = s.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i);
  if (!m) return s.toUpperCase();

  const method = m[1].toUpperCase();
  let path = String(m[2] || "").trim();

  // Windows backslashes safety
  path = path.replace(/\\/g, "/");

  // remove query, trailing slash
  path = path.split("?")[0];
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  // lowercase path
  path = path.toLowerCase();

  // ✅ normalize ANY param name to :id (/:roleId, /:_id => /:id)
  path = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, ":id");

  return `${method} ${path}`;
}

function normalizePath(p) {
  if (!p) return "/";
  let s = String(p).replace(/\\/g, "/");
  s = s.split("?")[0];
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

/**
 * ✅ Cut anything before "/admin"
 * "/api/v1/admin/roles" => "/admin/roles"
 */
function toAdminPath(urlOrPath) {
  const p = normalizePath(urlOrPath || "/");
  const lower = p.toLowerCase();
  const idx = lower.indexOf("/admin");
  if (idx === -1) return p;
  return p.slice(idx);
}



/**
 * Build Express route PATTERN under "/admin"
 * Uses req.baseUrl + req.route.path (best) to get "/admin/roles/:id"
 */
function replaceObjectIdsWithParam(path) {
  // 24-hex Mongo ObjectId anywhere in path segment => :id
  return String(path).replace(/\/[a-f0-9]{24}(?=\/|$)/gi, "/:id");
}

function buildAdminRoutePattern(req) {
  const base = toAdminPath(req.baseUrl || "");
  const routePath =
    req.route && typeof req.route.path === "string"
      ? normalizePath(req.route.path)
      : "";

  // ✅ Best: Express knows the pattern
  if (routePath) {
    const merged = normalizePath(
      `${base}${routePath === "/" ? "" : routePath}`
    ) || "/admin";

    return merged.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, ":id");
  }

  // ✅ Fallback: use originalUrl/path and replace real ids
  const orig = toAdminPath(req.originalUrl || req.path || base);
  const normalized = normalizePath(orig);

  return replaceObjectIdsWithParam(normalized).replace(
    /:([a-zA-Z_][a-zA-Z0-9_]*)/g,
    ":id"
  );
}



function getRequesterId(req) {
  return (
    req.params?.id ||
    req.params?._id ||
    req.query?.id ||
    req.query?._id ||
    req.body?.id ||
    req.body?._id ||
    req?.user?._id
  );
}

function ensureIdentity(req) {
  const requesterId = getRequesterId(req);
  if (!req.user || !req.user._id || !requesterId) return false;
  return String(requesterId) === String(req.user._id);
}

/** =========================
 * sanitizePermissionsObject
 * ========================= */
function sanitizePermissionsObject(listOfPermissions) {
  if (
    !listOfPermissions ||
    typeof listOfPermissions !== "object" ||
    Array.isArray(listOfPermissions)
  ) {
    throw new BadRequestException("errors.invalid_permissions_payload");
  }

  const out = {};
  for (const moduleName in listOfPermissions) {
    const requested = listOfPermissions[moduleName];

    if (!Array.isArray(requested)) {
      throw new BadRequestException("errors.permissions_must_be_array", {
        module: moduleName,
      });
    }

    out[moduleName] = requested.map((p) => String(p).trim());
  }

  return out;
}

/** =========================
 * validatePermissions (NO legacy)
 * - expects exact strings like:
 *   "GET /admin/admins"
 *   "PUT /admin/roles/:id"
 * ========================= */
exports.validatePermissions = (listOfPermissions) => {
  const safePermissions = sanitizePermissionsObject(listOfPermissions);

  for (const moduleName in safePermissions) {
    const systemSet = permissions.get(moduleName);
    if (!systemSet) {
      throw new ConflictException("errors.invalid_permission_module", {
        module: moduleName,
      });
    }

    const requested = safePermissions[moduleName];
    const invalid = [];

    for (const rawPerm of requested) {
      const normalized = normalizePermissionKey(rawPerm);

      // compare canonical to canonical
      const found = [...systemSet].some(
        (p) => normalizePermissionKey(p) === normalized
      );

      if (!found) invalid.push(normalized);
    }

    if (invalid.length) {
      throw new ConflictException("errors.permission_not_found", {
        module: moduleName,
        permissions: invalid,
      });
    }
  }

  return true;
};

/** =========================
 * Extract permissions from req.user in ALL shapes
 * ========================= */
function extractUserPermissions(reqUser) {
  if (!reqUser) return {};

  // shape: req.user.permissions = { admins:[...], ... }
  if (
    reqUser.permissions &&
    typeof reqUser.permissions === "object" &&
    !Array.isArray(reqUser.permissions)
  ) {
    return reqUser.permissions;
  }

  // shape: req.user.permission = { admins:[...], ... }
  if (
    reqUser.permission &&
    typeof reqUser.permission === "object" &&
    !Array.isArray(reqUser.permission)
  ) {
    // role doc shape: { _id, name, permissions: {admins:[]...} }
    if (
      reqUser.permission.permissions &&
      typeof reqUser.permission.permissions === "object" &&
      !Array.isArray(reqUser.permission.permissions)
    ) {
      return reqUser.permission.permissions;
    }
    return reqUser.permission;
  }

  // recovery: if accidentally arrays
  const recover = (arr) => {
    const map = {};
    for (const p of arr) {
      const norm = normalizePermissionKey(p);
      const path = norm.split(" ")[1] || "";
      const moduleName = String(path)
        .replace(/^\/admin\/?/, "")
        .split("/")[0];
      if (!moduleName) continue;
      if (!map[moduleName]) map[moduleName] = [];
      map[moduleName].push(norm);
    }
    return map;
  };

  if (Array.isArray(reqUser.permission)) return recover(reqUser.permission);
  if (Array.isArray(reqUser.permissions)) return recover(reqUser.permissions);

  return {};
}

/** =========================
 * isAuthorized
 * - builds permKey from Express PATTERN under "/admin"
 * - checks against extracted permission map
 * ========================= */
exports.isAuthorized = (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedException("errors.unauthorized");
    if (req.user?.role === "superAdmin") return next();

    // ✅ "/admin/roles/:id"
    const adminPattern = buildAdminRoutePattern(req);
    const permKey = normalizePermissionKey(`${req.method} ${adminPattern}`);

    // ✅ moduleName after "/admin/"
    const moduleName = normalizePath(adminPattern)
      .replace(/^\/admin\/?/, "")
      .split("/")[0];

    if (!moduleName) throw new ForbiddenException("errors.forbidden");
    if (!permissions.get(moduleName)) throw new ForbiddenException("errors.forbidden");

    // ✅ self endpoints require identity match
    const selfAllowed = new Set(
      [
        // admins self
        "GET /admin/admins/me",
        "PUT /admin/admins/me/password",
        "PUT /admin/admins/me/image",
      ].map(normalizePermissionKey)
    );

    if (selfAllowed.has(permKey)) {
      if (!ensureIdentity(req)) throw new UnauthorizedException("errors.unauthorized");
      return next();
    }

    const permsMap = extractUserPermissions(req.user);
    const modulePerms = permsMap[moduleName] || [];

    const normalizedModulePerms = Array.isArray(modulePerms)
      ? modulePerms.map(normalizePermissionKey)
      : [];

    if (normalizedModulePerms.includes(permKey)) return next();

    // ✅ Debug (uncomment while testing)
    console.log({ baseUrl: req.baseUrl, routePath: req.route?.path, adminPattern, permKey, moduleName, permsMap });

    throw new ForbiddenException("errors.forbidden");
  } catch (err) {
    return next(err);
  }
};

exports.checkIdentity = () => (req, res, next) => {
  try {
    if (!ensureIdentity(req)) throw new UnauthorizedException("errors.unauthorized");
    return next();
  } catch (err) {
    return next(err);
  }
};

// optional exports for tests
exports._internals = {
  normalizePermissionKey,
  normalizePath,
  toAdminPath,
  buildAdminRoutePattern,
  extractUserPermissions,
};
