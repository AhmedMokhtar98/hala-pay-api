// -------------------------------
// src/services/sallaToken.service.js
// -------------------------------
const { expiresAtFromSeconds, isExpiringSoon } = require("../../utils/helpers");
const SallaStoreTokenModel = require("../../models/store/store.model");
const { refreshAccessToken } = require("./sallaOAuth.service");

exports.ensureValidAccessToken = async (storeId) => {
  const doc = await SallaStoreTokenModel.findOne({ storeId });
  if (!doc) {
    const err = new Error("Store not connected");
    err.status = 404;
    throw err;
  }

  if (isExpiringSoon(doc.expiresAt)) {
    const refreshed = await refreshAccessToken(doc.refreshToken);
    const payload = {
      businessName: "salla",
      merchant: doc.merchant,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || doc.refreshToken,
      scope: refreshed.scope || doc.scope,
      tokenType: refreshed.token_type || doc.tokenType,
      expiresAt: expiresAtFromSeconds(refreshed.expires_in),
    };
    await SallaStoreTokenModel.updateOne( { storeId }, { $set: { storeId, ...payload } }, { upsert: true } );

    return refreshed.access_token;
  }

  return doc.accessToken;
};

