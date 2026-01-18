const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const {
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
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
    const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || "30d";

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
    console.log("Attempting to verify refresh token...");

    const decoded = jwt.verify(currentRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    console.log("Decoded refresh token:", decoded);

    if (decoded.type !== "refresh") {
      throw new UnauthorizedException("Expected a refresh token.");
    }

    const refreshTokenId = decoded.tid;

    if ( !refreshTokenId ) {
      throw new UnauthorizedException("Refresh token is missing required information.");
    }

    const cleanDecoded = stripTokenMeta(decoded);
    let updatedPayload = { ...cleanDecoded };

    const { accessToken, refreshToken } = await exports.generateToken(updatedPayload);

    return {
      success: true,
      code: 200,
      message: "Token refreshed successfully.",
      result: updatedPayload,
      token: accessToken,
      refreshToken
    };
  } catch (err) {
    console.error("Refresh Token Error:", err);
    throw new UnauthorizedException("Invalid or expired refresh token.");
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