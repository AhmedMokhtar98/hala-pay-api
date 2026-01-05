// -------------------------------
// src/services/sallaToken.service.js
// -------------------------------
const tokenRepo = require("../repos/sallaToken.repo");
const { refreshAccessToken } = require("./sallaOAuth.service");

function expiresAtFromSeconds(expiresInSec) {
  const s = Number(expiresInSec || 0);
  return new Date(Date.now() + s * 1000);
}

function isExpiringSoon(expiresAt, skewSeconds = 60) {
  const exp = new Date(expiresAt).getTime();
  return exp - Date.now() <= skewSeconds * 1000;
}

exports.expiresAtFromSeconds = expiresAtFromSeconds;

exports.ensureValidAccessToken = async (storeId) => {
  const doc = await tokenRepo.findByStoreId(storeId);
  if (!doc) {
    const err = new Error("Store not connected");
    err.status = 404;
    throw err;
  }

  if (isExpiringSoon(doc.expiresAt)) {
    const refreshed = await refreshAccessToken(doc.refreshToken);

    await tokenRepo.upsertByStoreId(storeId, {
      merchant: doc.merchant,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || doc.refreshToken,
      scope: refreshed.scope || doc.scope,
      tokenType: refreshed.token_type || doc.tokenType,
      expiresAt: expiresAtFromSeconds(refreshed.expires_in),
    });

    return refreshed.access_token;
  }

  return doc.accessToken;
};

