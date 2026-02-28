// providers/index.js
const { sallaAdapter } = require("./salla/sallaAdapter");

// later: add shopifyAdapter, wooAdapter, zidAdapter ...
const adapters = {
  salla: sallaAdapter,
  // shopify: shopifyAdapter,
  // woocommerce: wooAdapter,
};

function getProviderAdapter(providerName) {
  const key = String(providerName || "").toLowerCase().trim();
  const adapter = adapters[key];
  if (!adapter) {
    const err = new Error(`Unsupported provider: ${providerName}`);
    err.status = 400;
    throw err;
  }
  return adapter;
}

module.exports = { getProviderAdapter };