// helpers/jwt.helper.js
"use strict";

const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const {
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
} = require("../middlewares/errorHandler/exceptions");

/* -----------------------------
  Helpers
----------------------------- */

function assertEnv(key, errKey) {
  const val = process.env[key];
  if (!val || typeof val !== "string" || !val.trim()) {
    throw new InternalServerErrorException(errKey || "errors.missing_secret");
  }
  return val;
}

/**
 * Remove standard JWT meta fields from payload
 */
function stripTokenMeta(payload) {
  if (!payload || typeof payload !== "object") return {};
  // eslint-disable-next-line no-unused-vars
  const { exp, iat, nbf, jti, iss, aud, sub, ...clean } = payload;
  return clean;
}

function getBearerToken(req) {
  const h = req?.headers?.authorization;
  if (!h || typeof h !== "string") return null;
  if (!h.startsWith("Bearer ")) return null;
  const token = h.slice("Bearer ".length).trim();
  return token || null;
}

function toUnixSeconds(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const ms = d.getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/* -----------------------------
  Access/Refresh Tokens
----------------------------- */

/**
 * Generate access & refresh tokens
 * - strips any JWT meta fields from payloadObject
 * - adds tid + type
 */
exports.generateToken = (payloadObject = {}) => {
  try {
    const accessSecret = assertEnv("ACCESS_TOKEN_SECRET", "errors.missing_access_token_secret");
    const refreshSecret = assertEnv("REFRESH_TOKEN_SECRET", "errors.missing_refresh_token_secret");

    const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY || "7d";
    const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || "30d"; 

    const cleanPayload = stripTokenMeta(payloadObject);

    const accessToken = jwt.sign(
      { ...cleanPayload, tid: uuidv4(), type: "access" },
      accessSecret,
      { expiresIn: accessExpiry }
    );

    const refreshToken = jwt.sign(
      { ...cleanPayload, tid: uuidv4(), type: "refresh" },
      refreshSecret,
      { expiresIn: refreshExpiry }
    );

    return { accessToken, refreshToken };
  } catch (err) {
    console.error("Token generation failed:", err);
    throw err instanceof Error
      ? err
      : new InternalServerErrorException("errors.token_generation_failed");
  }
};

/**
 * Verify access token & (optional) role(s)
 * - roles: [] means "any authenticated user"
 * - supports decoded.roles as array OR decoded.role as string
 */
exports.verifyToken = (roles = []) => {
  return (req, res, next) => {
    try {
      const token = getBearerToken(req);
      if (!token) return next(new UnauthorizedException("errors.missing_token"));

      const accessSecret = assertEnv("ACCESS_TOKEN_SECRET", "errors.missing_access_token_secret");

      const decoded = jwt.verify(token, accessSecret, {
        algorithms: ["HS256"],
        // clockTolerance: 5, // optional if you want
      });

      if (decoded?.type !== "access") {
        return next(new ForbiddenException("errors.invalid_or_expired_token"));
      }

      if (Array.isArray(roles) && roles.length) {
        const userRoles = Array.isArray(decoded.roles)
          ? decoded.roles
          : decoded.role
            ? [decoded.role]
            : [];

        const ok = userRoles.some((r) => roles.includes(r));
        if (!ok) return next(new ForbiddenException("errors.access_denied"));
      }

      // attach clean user (no meta)
      req.user = stripTokenMeta(decoded);
      req.user.tid = decoded.tid;
      req.user.type = decoded.type;
      req.user.exp = decoded.exp;

      return next();
    } catch (err) {
      // jsonwebtoken throws specific errors; map them cleanly
      if (err?.name === "TokenExpiredError" || err?.name === "JsonWebTokenError" || err?.name === "NotBeforeError") {
        return next(new ForbiddenException("errors.invalid_or_expired_token"));
      }
      return next(err instanceof Error ? err : new UnauthorizedException("errors.unauthorized"));
    }
  };
};

/**
 * Refresh access token using a refresh token
 * - validates token type === "refresh"
 * - rotates refresh token too (returns new access+refresh)
 */
exports.refreshAccessToken = async (currentRefreshToken) => {
  try {
    if (!currentRefreshToken) {
      throw new UnauthorizedException("errors.missing_refresh_token");
    }

    const refreshSecret = assertEnv("REFRESH_TOKEN_SECRET", "errors.missing_refresh_token_secret");

    const decoded = jwt.verify(currentRefreshToken, refreshSecret, {
      algorithms: ["HS256"],
    });

    if (decoded?.type !== "refresh") {
      throw new UnauthorizedException("errors.expected_refresh_token");
    }

    if (!decoded?.tid) {
      throw new UnauthorizedException("errors.missing_refresh_token_id");
    }

    // build payload for new tokens (remove jwt meta + internal type)
    const cleanDecoded = stripTokenMeta(decoded);
    // note: we DO NOT carry old tid/type forward
    const { accessToken, refreshToken } = exports.generateToken(cleanDecoded);

    return {
      success: true,
      code: 200,
      message: "success.token_refreshed",
      result: cleanDecoded,
      token: { accessToken, refreshToken },
    };
  } catch (err) {
    console.error("Refresh Token Error:", err);

    // preserve your custom exceptions if you threw them above
    if (
      err instanceof UnauthorizedException ||
      err instanceof ForbiddenException ||
      err instanceof BadRequestException ||
      err instanceof InternalServerErrorException
    ) {
      throw err;
    }

    if (err?.name === "TokenExpiredError" || err?.name === "JsonWebTokenError" || err?.name === "NotBeforeError") {
      throw new UnauthorizedException("errors.invalid_or_expired_refresh_token");
    }

    throw new UnauthorizedException("errors.invalid_or_expired_refresh_token");
  }
};

/* -----------------------------
  Dummy Store Tokens
----------------------------- */

exports.generateDummyStoreToken = (payloadObject = {}) => {
  try {
    const accessSecret = assertEnv("ACCESS_DUMMY_TOKEN_SECRET", "errors.missing_access_dummy_token_secret");
    const refreshSecret = assertEnv("REFRESH_DUMMY_TOKEN_SECRET", "errors.missing_refresh_dummy_token_secret");

    const accessExpiry = "1m";
    const refreshExpiry = "1y";

    const cleanPayload = stripTokenMeta(payloadObject);

    const accessToken = jwt.sign(
      { ...cleanPayload, tid: uuidv4(), type: "access" },
      accessSecret,
      { expiresIn: accessExpiry }
    );

    const refreshToken = jwt.sign(
      { ...cleanPayload, tid: uuidv4(), type: "refresh" },
      refreshSecret,
      { expiresIn: refreshExpiry }
    );

    return { accessToken, refreshToken, refreshExpiry };
  } catch (err) {
    console.error("Dummy Token generation failed:", err);
    throw err instanceof Error
      ? err
      : new InternalServerErrorException("errors.token_generation_failed");
  }
};

/* ---------------------------
  Group Invite Token (JWT)
  - payload: { gid, ...extra }
  - exp: exact group.deadLine (absolute unix seconds)
--------------------------- */

exports.generateGroupInviteToken = ({ groupId, deadLine, extra = {} } = {}) => {
  try {
    const secret = assertEnv("GROUP_INVITE_JWT_SECRET", "errors.missing_group_invite_secret");

    if (!groupId) throw new BadRequestException("errors.required_group_id");

    const exp = toUnixSeconds(deadLine);
    if (!exp) throw new BadRequestException("errors.required_deadline");

    const now = Math.floor(Date.now() / 1000);
    if (exp <= now) throw new BadRequestException("errors.deadline_passed");

    const cleanExtra = stripTokenMeta(extra);

    // IMPORTANT:
    // - We set exp manually in the payload to match the group deadline exactly
    // - We use noTimestamp so no iat is added
    const token = jwt.sign(
      {
        ...cleanExtra,
        gid: String(groupId),
        tid: uuidv4(),
        type: "group_invite",
        exp, // exact absolute expiry
      },
      secret,
      {
        algorithm: "HS256",
        noTimestamp: true,
      }
    );

    return { token, exp };
  } catch (err) {
    console.error("Group Invite Token generation failed:", err);
    throw err instanceof Error
      ? err
      : new InternalServerErrorException("errors.token_generation_failed");
  }
};

exports.verifyGroupInviteToken = (token) => {
  try {
    const secret = assertEnv("GROUP_INVITE_JWT_SECRET", "errors.missing_group_invite_secret");

    if (!token) throw new BadRequestException("errors.required_token");

    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  
    if (decoded?.type !== "group_invite" || !decoded?.gid) {
      throw new ForbiddenException("errors.invalid_or_expired_invite");
    }

    return decoded; // { gid, exp, tid, type, ...extra }
  } catch (err) {
    console.error("Group Invite Token verify failed:", err);

    // keep your explicit errors if thrown above
    if (err instanceof BadRequestException || err instanceof ForbiddenException || err instanceof InternalServerErrorException) {
      throw err;
    }

    if (err?.name === "TokenExpiredError" || err?.name === "JsonWebTokenError" || err?.name === "NotBeforeError") {
      throw new ForbiddenException("errors.invalid_or_expired_invite");
    }

    throw new ForbiddenException("errors.invalid_or_expired_invite");
  }
};
