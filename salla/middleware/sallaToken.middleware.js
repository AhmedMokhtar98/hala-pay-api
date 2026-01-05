const SallaStoreToken = require("../models/SallaStoreToken.model");
const { refreshAccessToken } = require("../services/sallaOAuth.service");

function isExpiringSoon(expiresAt, skewSeconds = 60) {
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  return exp - now <= skewSeconds * 1000;
}

async function SallaTokenMiddleWare(req, res, next) {
  try {
    const storeId = String(req.params.storeId || req.query.storeId || "");
    if (!storeId) return res.status(400).json({ success: false, message: "storeId is required" });

    const doc = await SallaStoreToken.findOne({ storeId });
    if (!doc) return res.status(404).json({ success: false, message: "Store not connected" });

    if (isExpiringSoon(doc.expiresAt)) {
      const refreshed = await refreshAccessToken(doc.refreshToken);

      doc.accessToken = refreshed.access_token;
      doc.refreshToken = refreshed.refresh_token || doc.refreshToken;
      doc.scope = refreshed.scope || doc.scope;
      doc.tokenType = refreshed.token_type || doc.tokenType;

      const expiresInSec = Number(refreshed.expires_in || 0);
      doc.expiresAt = new Date(Date.now() + expiresInSec * 1000);

      await doc.save();
    }

    req.sallaAccessToken = doc.accessToken;
    req.sallaStore = doc;

    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { SallaTokenMiddleWare };
