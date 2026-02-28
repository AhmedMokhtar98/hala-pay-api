// middlewares/loadStoreByProvider.middleware.js
const Stores = require("../models/store/store.model");

function toStr(v) {
  return String(v ?? "").trim();
}

function normProvider(v) {
  return toStr(v).toLowerCase();
}

/**
 * Optional store loader:
 * - if NO provider AND NO storeId => just next() (global mode)
 * - if storeId exists (provider optional) => resolve store (supports store.provider and store.providers[])
 * - attaches:
 *   req.store
 *   req.providerName (best guess / selected provider name)
 *   req.providerStoreId
 */
async function loadStoreByProvider(req, res, next) {
  try {
    const provider = normProvider(req.query.provider);
    const providerStoreId = toStr(req.query.storeId);

    // ✅ GLOBAL MODE: allow /products with no provider/storeId
    if (!provider && !providerStoreId) return next();

    // if provider exists but storeId not provided -> still allow (provider-only mode)
    // no store to load in that case, service will filter by provider across all stores
    if (provider && !providerStoreId) {
      req.providerName = provider;
      return next();
    }

    // if storeId exists (provider optional) => load store
    const q = provider
      ? {
          isActive: true,
          $or: [
            { "provider.name": provider, "provider.storeId": providerStoreId },
            { providers: { $elemMatch: { name: provider, storeId: providerStoreId } } },
          ],
        }
      : {
          isActive: true,
          $or: [
            { "provider.storeId": providerStoreId },
            { "providers.storeId": providerStoreId },
          ],
        };

    const store = await Stores.findOne(q);
    if (!store) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: "Store not found",
        provider: provider || null,
        storeId: providerStoreId,
      });
    }

    // pick provider name if not provided
    let pickedProvider = provider;

    if (!pickedProvider) {
      // 1) legacy store.provider
      const legacy = store?.provider;
      if (legacy && toStr(legacy.storeId) === providerStoreId) {
        pickedProvider = normProvider(legacy.name);
      }

      // 2) multi store.providers[]
      if (!pickedProvider && Array.isArray(store.providers)) {
        const hit = store.providers.find((p) => toStr(p?.storeId) === providerStoreId);
        if (hit) pickedProvider = normProvider(hit.name);
      }
    }

    req.store = store;
    req.providerName = pickedProvider || "";
    req.providerStoreId = providerStoreId;

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { loadStoreByProvider };