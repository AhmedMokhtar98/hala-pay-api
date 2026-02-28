// providers/salla/services/sallaToken.service.js
const Stores = require("../../../models/store/store.model");
const { refreshAccessToken } = require("./sallaOAuth.service");
const { expiresAtFromSeconds } = require("../../../utils/helpers");

async function ensureValidAccessToken(providerStoreId) {
  const store = await Stores.findOne({
    "provider.name": "salla",
    "provider.storeId": String(providerStoreId),
    isActive: true,
  });

  if (!store) {
    const err = new Error("Store not connected");
    err.status = 404;
    throw err;
  }

  const accessToken = store.auth?.accessToken;
  const refreshToken = store.auth?.refreshToken;
  const expiresAt = store.auth?.expiresAt ? new Date(store.auth.expiresAt) : null;

  if (!accessToken) {
    const err = new Error("Missing access token");
    err.status = 401;
    throw err;
  }

  // if no expiresAt => assume ok
  if (!expiresAt) return accessToken;

  // refresh if expiring soon (60s)
  const now = Date.now();
  if (expiresAt.getTime() - now > 60_000) return accessToken;

  if (!refreshToken) {
    const err = new Error("Missing refresh token");
    err.status = 401;
    throw err;
  }

  const refreshed = await refreshAccessToken(refreshToken);

  const payload = {
    "auth.accessToken": refreshed.access_token,
    "auth.refreshToken": refreshed.refresh_token || refreshToken,
    "auth.scope": refreshed.scope || store.auth?.scope || "",
    "auth.tokenType": refreshed.token_type || store.auth?.tokenType || "bearer",
    "auth.expiresAt": expiresAtFromSeconds(refreshed.expires_in),
  };

  await Stores.updateOne({ _id: store._id }, { $set: payload });

  return refreshed.access_token;
}

module.exports = { ensureValidAccessToken };