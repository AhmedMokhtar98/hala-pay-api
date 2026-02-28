// controllers/providers/auth.controller.js
const { getAuthAdapter } = require("../../providers/auth");

function getProviderName(req) {
  return String(req.params.provider || "").toLowerCase().trim();
}

/**
 * Standard response behavior:
 * - If adapter returns { cookie } => set cookie
 * - If adapter returns { clearCookieName } => clear it
 * - If adapter returns { redirectUrl } => res.redirect
 * - Else => res.json
 */
function applyAdapterResponse(res, out) {
  if (out?.cookie) {
    const { name, value, options } = out.cookie;
    res.cookie(name, value, options);
  }
  if (out?.clearCookieName) {
    res.clearCookie(out.clearCookieName);
  }
  if (out?.redirectUrl) {
    return res.redirect(out.redirectUrl);
  }
  return res.status(out?.code || 200).json(out);
}

exports.startAuth = async (req, res) => {
  const provider = getProviderName(req);
  const adapter = getAuthAdapter(provider);

  const out = await adapter.startAuth({
    req,
    // usually not needed, but available:
    query: req.query,
    cookies: req.cookies,
  });

  return applyAdapterResponse(res, out);
};

exports.callback = async (req, res) => {
  const provider = getProviderName(req);
  const adapter = getAuthAdapter(provider);

  const out = await adapter.callback({
    req,
    query: req.query,
    cookies: req.cookies,
  });

  return applyAdapterResponse(res, out);
};

exports.status = async (req, res) => {
  const provider = getProviderName(req);
  const adapter = getAuthAdapter(provider);

  const out = await adapter.status({ req });
  return res.status(out?.code || 200).json(out);
};

exports.refresh = async (req, res) => {
  const provider = getProviderName(req);
  const adapter = getAuthAdapter(provider);

  const providerStoreId = String(req.params.storeId || "").trim();
  const out = await adapter.refresh({ req, providerStoreId });

  return res.status(out?.code || 200).json(out);
};

exports.disconnect = async (req, res) => {
  const provider = getProviderName(req);
  const adapter = getAuthAdapter(provider);

  const providerStoreId = String(req.params.storeId || "").trim();
  const out = await adapter.disconnect({ req, providerStoreId });

  return res.status(out?.code || 200).json(out);
};

exports.getAccountsUserInfo = async (req, res) => {
  const provider = getProviderName(req);
  const adapter = getAuthAdapter(provider);
    const providerStoreId = String(req.params.storeId || "").trim();
    const out = await adapter.getAccountsUserInfo({ req, providerStoreId });
    return res.status(out?.code || 200).json(out);
};