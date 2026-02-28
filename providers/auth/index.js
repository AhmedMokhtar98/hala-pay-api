// providers/auth/index.js
const { sallaAuth } = require("./adapters/salla.auth");
// const { shopifyAuth } = require("./adapters/shopify.auth");
// const { woocommerceAuth } = require("./adapters/woocommerce.auth");
// const { zidAuth } = require("./adapters/zid.auth");

const authAdapters = {
  salla: sallaAuth,
//   shopify: shopifyAuth,
//   woocommerce: woocommerceAuth,
//   zid: zidAuth,
};

function getAuthAdapter(providerName) {
  const key = String(providerName || "").toLowerCase().trim();
  const adapter = authAdapters[key];
  if (!adapter) {
    const err = new Error(
      `Unsupported auth provider: "${providerName}". Supported: ${Object.keys(authAdapters).join(", ")}`
    );
    err.status = 400;
    throw err;
  }
  return adapter;
}

function registerAuthAdapter(name, adapter) {
  const key = String(name || "").toLowerCase().trim();
  if (!key) throw new Error("registerAuthAdapter: name is required");
  if (!adapter) throw new Error("registerAuthAdapter: adapter is required");
  authAdapters[key] = adapter;
  return authAdapters[key];
}

module.exports = { getAuthAdapter, registerAuthAdapter, authAdapters };