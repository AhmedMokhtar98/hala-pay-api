// providers/auth/types.js

/**
 * Adapter interface:
 *
 * {
 *   name: "salla" | "shopify" | ...
 *   startAuth({ req, query, cookies }) => { success, code, redirectUrl?, cookie? }
 *   callback({ req, query, cookies }) => { success, code, redirectUrl?, clearCookieName? }
 *   status({ req }) => { success, code, ... }
 *   refresh({ req, providerStoreId }) => { success, code, ... }
 *   disconnect({ req, providerStoreId }) => { success, code, ... }
 * }
 */

module.exports = {};