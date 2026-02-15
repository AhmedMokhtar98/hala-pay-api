const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const {
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
} = require("../middlewares/errorHandler/exceptions");

/**
 * Remove standard JWT meta fields from payload
 */
function stripTokenMeta(payload) {
  const { exp, iat, nbf, jti, ...clean } = payload;
  return clean;
}

/**
 * Generate access & refresh tokens
 */
exports.generateToken = (payloadObject) => {
  try {
    const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY || "1d";
    const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || "5m";

    const cleanPayload = stripTokenMeta(payloadObject);

    const accessToken = jwt.sign(
      {
        ...cleanPayload,
        tid: uuidv4(),
        type: "access",
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: accessExpiry }
    );

    const refreshToken = jwt.sign(
      {
        ...cleanPayload,
        tid: uuidv4(),
        type: "refresh",
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: refreshExpiry }
    );

    return { accessToken, refreshToken };
  } catch (err) {
    console.error("Token generation failed:", err);
    throw new InternalServerErrorException(
      "errors.token_generation_failed"
    );
  }
};

/**
 * Verify access token & role
 */
exports.verifyToken = (roles = []) => {
  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

      if (!token) {
        return next(new UnauthorizedException("errors.missing_token"));
      }

      jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        (err, decoded) => {
          if (err) {
            return next(
              new ForbiddenException("errors.invalid_or_expired_token")
            );
          }

          if (
            roles.length &&
            (!decoded.role || !roles.includes(decoded.role))
          ) {
            return next(
              new ForbiddenException("errors.access_denied")
            );
          }

          req.user = decoded;
          next();
        }
      );
    } catch (err) {
      next(
        err instanceof Error
          ? err
          : new UnauthorizedException("errors.unauthorized")
      );
    }
  };
};



exports.refreshAccessToken = async (currentRefreshToken) => {
  try {

    const decoded = jwt.verify(currentRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    if (decoded.type !== "refresh") {
      throw new UnauthorizedException("errors.expected_refresh_token");
    }

    const refreshTokenId = decoded.tid;

    if ( !refreshTokenId ) {
      throw new UnauthorizedException("errors.missing_refresh_token_id");
    }

    const cleanDecoded = stripTokenMeta(decoded);
    let updatedPayload = { ...cleanDecoded };

    const { accessToken, refreshToken } = await exports.generateToken(updatedPayload);

    return {
      success: true,
      code: 200,
      message: "success.token_refreshed",
      result: updatedPayload,
      token:{
        accessToken,
        refreshToken
      }
    };
  } catch (err) {
    console.error("Refresh Token Error:", err);
    throw new UnauthorizedException("errors.invalid_or_expired_refresh_token");
  }
};



exports.generateDummyStoreToken = async (payloadObject) => {
  try {
    const accessExpiry =  "1m";
    const refreshExpiry = "1y";

    const cleanPayload = stripTokenMeta(payloadObject);

    const accessToken = jwt.sign(
      {
        ...cleanPayload,
        tid: uuidv4(),
        type: "access",
      },
      process.env.ACCESS_DUMMY_TOKEN_SECRET,
      { expiresIn: accessExpiry }
    );

    const refreshToken = jwt.sign(
      {
        ...cleanPayload,
        tid: uuidv4(),
        type: "refresh",
      },
      process.env.REFRESH_DUMMY_TOKEN_SECRET,
      { expiresIn: refreshExpiry }
    );

    return { accessToken, refreshToken, refreshExpiry};
  } catch (err) {
    console.error("Token generation failed:", err);
    throw new InternalServerErrorException(
      "errors.token_generation_failed"
    );
  }
};


/* ---------------------------
  Group Invite Token (JWT)
  - payload: { gid }
  - exp: group.deadLine
--------------------------- */

const GROUP_INVITE_SECRET = process.env.GROUP_INVITE_JWT_SECRET;

function toUnixSeconds(dateLike) {
  const ms = new Date(dateLike).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/**
 * Generate Group Invite Token
 * ✅ contains gid + exp(deadLine)
 */
exports.generateGroupInviteToken = ({ groupId, deadLine, extra = {} } = {}) => {
  try {
    if (!GROUP_INVITE_SECRET) {
      throw new InternalServerErrorException("errors.missing_group_invite_secret");
    }

    if (!groupId) throw new BadRequestException("errors.required_group_id");

    const exp = toUnixSeconds(deadLine);
    if (!exp) throw new BadRequestException("errors.required_deadline");

    const now = Math.floor(Date.now() / 1000);
    if (exp <= now) throw new BadRequestException("errors.deadline_passed");

    // (اختياري) تمنع meta fields لو حد بعت في extra بالخطأ
    const cleanExtra = stripTokenMeta(extra);

    const token = jwt.sign(
      {
        ...cleanExtra,
        gid: String(groupId),
        tid: uuidv4(),
        type: "group_invite",
        exp, // ✅ fixed absolute expiry = group.deadLine
      },
      GROUP_INVITE_SECRET,
      {
        algorithm: "HS256",
        noTimestamp: true, // عشان ما يضيفش iat تلقائي
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

/**
 * Verify Group Invite Token
 * ✅ returns decoded payload (includes gid)
 */
exports.verifyGroupInviteToken = (token) => {
  try {
    if (!GROUP_INVITE_SECRET) {
      throw new InternalServerErrorException("errors.missing_group_invite_secret");
    }
    if (!token) throw new BadRequestException("errors.required_token");

    const decoded = jwt.verify(token, GROUP_INVITE_SECRET, {
      algorithms: ["HS256"],
    });

    if (decoded?.type !== "group_invite" || !decoded?.gid) {
      throw new ForbiddenException("errors.invalid_or_expired_invite");
    }

    return decoded; // { gid, exp, tid, type, ... }
  } catch (err) {
    console.error("Group Invite Token verify failed:", err);
    throw new ForbiddenException("errors.invalid_or_expired_invite");
  }
};
