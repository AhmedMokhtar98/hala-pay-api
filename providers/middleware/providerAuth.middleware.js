// middlewares/providerAuth.middleware.js
const { getProviderAdapter } = require("..");
const Stores = require("../../models/store/store.model");

function isExpiringSoon(expiresAt, skewSeconds = 60) {
  if (!expiresAt) return true;
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  if (!Number.isFinite(exp)) return true;
  return exp - now <= skewSeconds * 1000;
}

function boolParam(v) {
  return String(v ?? "").trim() === "1" || String(v ?? "").toLowerCase() === "true";
}

/**
 * ✅ Generic middleware:
 * - Reads :provider and :storeId (provider store id)
 * - Loads Store by { provider.name, provider.storeId }
 * - If token is expiring: refresh using provider adapter (if supported)
 * - Attaches:
 *   req.store
 *   req.providerName
 *   req.providerStoreId
 *   req.providerAuth (auth snapshot)
 *   req.providerAccessToken (if token-based)
 *
 * Usage examples:
 * router.get("/:provider/store/:storeId/products", providerAuth(), ctrl.listProducts)
 */
function providerAuth(options = {}) {
  const skewSeconds = Number(options.skewSeconds ?? process.env.PROVIDER_AUTH_SKEW_SECONDS ?? 60) || 60;

  return async function providerAuthMiddleware(req, res, next) {
    try {
      const providerName = String(req.params.provider || req.query.provider || "").trim().toLowerCase();
      const providerStoreId = String(req.params.storeId || req.query.storeId || "").trim();

      if (!providerName) {
        return res.status(400).json({ success: false, message: "provider is required" });
      }
      if (!providerStoreId) {
        return res.status(400).json({ success: false, message: "storeId is required" });
      }

      // ✅ Find store in unified schema
      const store = await Stores.findOne({
        "provider.name": providerName,
        "provider.storeId": providerStoreId,
        isActive: true,
      });

      if (!store) {
        return res.status(404).json({ success: false, message: "Store not connected" });
      }

      const adapter = getProviderAdapter(providerName);

      // Optional: allow bypass refresh (debug)
      const noRefresh = boolParam(req.query.noRefresh);

      // ✅ Refresh token only if provider supports it
      const hasRefresh = typeof adapter.refreshAuth === "function";

      if (!noRefresh && hasRefresh && isExpiringSoon(store.auth?.expiresAt, skewSeconds)) {
        const refreshed = await adapter.refreshAuth({
          store: store.toObject(),
        });

        // adapter returns normalized auth update payload
        // { accessToken, refreshToken, scope, tokenType, expiresAt, meta? }
        if (refreshed && typeof refreshed === "object") {
          if (refreshed.accessToken != null) store.auth.accessToken = String(refreshed.accessToken || "");
          if (refreshed.refreshToken != null) store.auth.refreshToken = String(refreshed.refreshToken || store.auth.refreshToken || "");
          if (refreshed.scope != null) store.auth.scope = String(refreshed.scope || "");
          if (refreshed.tokenType != null) store.auth.tokenType = String(refreshed.tokenType || store.auth.tokenType || "bearer");
          if (refreshed.expiresAt != null) store.auth.expiresAt = refreshed.expiresAt ? new Date(refreshed.expiresAt) : null;
          if (refreshed.meta !== undefined) store.auth.meta = refreshed.meta;

          await store.save();
        }
      }

      // ✅ attach to request
      req.store = store;
      req.providerName = providerName;
      req.providerStoreId = providerStoreId;
      req.providerAuth = store.auth ? store.auth.toObject?.() ?? store.auth : store.auth;

      // token-based providers
      req.providerAccessToken = store.auth?.accessToken || "";

      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { providerAuth, isExpiringSoon };