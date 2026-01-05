// -------------------------------
// src/controllers/sallaAuth.controller.js
// -------------------------------
const crypto2 = require("crypto");
const tokenRepo2 = require("../repos/sallaToken.repo");
const sallaHttpRepo = require("../repos/sallaHttp.repo");
const { buildAuthUrl, exchangeCode, refreshAccessToken: refreshToken2, } = require("../services/sallaOAuth.service");
const { expiresAtFromSeconds: expiresAtFromSeconds2 } = require("../services/sallaToken.service");
const { ensureValidAccessToken } = require("../services/sallaToken.service");
// Prevent duplicate callback using same code (DEV-friendly)
const usedCodes = new Map(); // code -> timestamp
const USED_CODE_TTL_MS = 10 * 60 * 1000;

function gcUsedCodes() {
  const now = Date.now();
  for (const [k, t] of usedCodes.entries()) {
    if (now - t > USED_CODE_TTL_MS) usedCodes.delete(k);
  }
}

function makeState() {
  return crypto2.randomBytes(16).toString("hex");
}

// ✅ FIXED: storeId is in merchant.data.merchant.id in your payload
function extractStoreId(userInfoData) {
  const id =
    userInfoData?.data?.merchant?.id ?? // <--- your response
    userInfoData?.merchant?.id ??       // fallback
    userInfoData?.store?.id ??
    userInfoData?.store_id ??
    null;

  return id ? String(id) : "";
}

exports.startAuth = async (req, res) => {
  const state = makeState();

  res.cookie("salla_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 10 * 60 * 1000,
  });

  const url = buildAuthUrl({ state });
  console.log("Redirecting to Salla OAuth:", url);
  return res.redirect(url);
};

exports.callback = async (req, res) => {
  const { code, state } = req.query;

  if (!code) return res.status(400).json({ success: false, message: "Missing code" });

  gcUsedCodes();

  if (usedCodes.has(String(code))) {
    return res.status(409).json({
      success: false,
      message: "Authorization code already handled (duplicate callback). Please re-authorize.",
    });
  }
  usedCodes.set(String(code), Date.now());

  const expectedState = req.cookies?.salla_oauth_state;
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";

  if (expectedState) {
    if (!state || String(state) !== String(expectedState)) {
      return res.status(400).json({ success: false, message: "Invalid state" });
    }
    res.clearCookie("salla_oauth_state");
  } else {
    // Dashboard install flow => no cookie
    if (isProd) {
      return res.status(400).json({
        success: false,
        message:
          "Missing state cookie. Start OAuth from /api/v1/salla/auth or fix host mismatch (localhost vs 127.0.0.1).",
      });
    }
  }

  // 1) exchange code -> tokens
  const token = await exchangeCode(code);

  // 2) user info -> storeId
  const userInfoResp = await sallaHttpRepo.getUserInfo(token.access_token);
  const merchant = userInfoResp.data;

  const storeId = extractStoreId(merchant);
  if (!storeId) {
    return res.status(500).json({
      success: false,
      message: "Could not determine storeId from user/info response",
      merchant,
    });
  }

  // 3) save tokens per store
  await tokenRepo2.upsertByStoreId(storeId, {
    merchant,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    scope: token.scope || "",
    tokenType: token.token_type || "bearer",
    expiresAt: expiresAtFromSeconds2(token.expires_in),
  });

  if (process.env.APP_SUCCESS_REDIRECT) {
    return res.redirect(
      `${process.env.APP_SUCCESS_REDIRECT}?storeId=${encodeURIComponent(storeId)}`
    );
  }

  return res.json({ success: true, storeId });
};

exports.status = async (req, res) => {
  const items = await tokenRepo2.listConnected();
  return res.json({ success: true, count: items.length, result: items });
};

exports.refresh = async (req, res) => {
  const { storeId } = req.params;

  const doc = await tokenRepo2.findByStoreId(storeId);
  if (!doc) return res.status(404).json({ success: false, message: "Store not connected" });

  const refreshed = await refreshToken2(doc.refreshToken);

  await tokenRepo2.upsertByStoreId(storeId, {
    merchant: doc.merchant,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || doc.refreshToken,
    scope: refreshed.scope || doc.scope,
    tokenType: refreshed.token_type || doc.tokenType,
    expiresAt: expiresAtFromSeconds2(refreshed.expires_in),
  });

  return res.json({ success: true, storeId });
};

exports.disconnect = async (req, res) => {
  const { storeId } = req.params;
  await tokenRepo2.deleteByStoreId(storeId);
  return res.json({ success: true, storeId });
};


exports.me = async (req, res) => {
  const { storeId } = req.params;

  const accessToken = await ensureValidAccessToken(storeId);
  const resp = await sallaHttpRepo.getUserInfo(accessToken);

  return res.json({ success: true, result: resp.data });
};