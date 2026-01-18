// salla/repos/sallaAuth.repo.js
const axios = require("axios");
const crypto = require("crypto");
const SallaStoreTokenModel = require("../../models/store/store.model");
const { buildAuthUrl, exchangeCode, refreshAccessToken: refreshToken, } = require("../services/sallaOAuth.service");

const { expiresAtFromSeconds } = require("../../utils/helpers");

// Prevent duplicate callback using same code (DEV-friendly)
const usedCodes = new Map(); // code -> timestamp
const USED_CODE_TTL_MS = 10 * 60 * 1000;

function gcUsedCodes() {
  const now = Date.now();
  for (const [k, t] of usedCodes.entries()) {
    if (now - t > USED_CODE_TTL_MS) usedCodes.delete(k);
  }
}

function makeState() { return crypto.randomBytes(16).toString("hex"); }

// ✅ storeId extractor (based on your payload)
function extractStoreId(userInfoData) {
  const id =
    userInfoData?.data?.merchant?.id ??
    userInfoData?.merchant?.id ??
    userInfoData?.store?.id ??
    userInfoData?.store_id ??
    null;

    return id ? String(id) : "";
}

async function getAccountsUserInfo(accessToken) {
  // This is what you used in your snippet
  const resp = await axios.get("https://accounts.salla.sa/oauth2/user/info", {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 30_000,
  });
  return resp.data;
}

exports.startAuth = async () => {
  const state = makeState();
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const url = buildAuthUrl({ state });
  return {
    success: true,
    code: 302,
    redirectUrl: url,
    cookie: {
      name: "salla_oauth_state",
      value: state,
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd, // ✅ better than hard-coded false
        maxAge: 10 * 60 * 1000,
      },
    },
  };
};


exports.callback = async ({ query, cookies }) => {
  const code = query?.code;
  const state = query?.state;

  if (!code) {
    return { success: false, code: 400, message: "Missing code" };
  }

  gcUsedCodes();

  if (usedCodes.has(String(code))) {
    return {
      success: false,
      code: 409,
      message:
        "Authorization code already handled (duplicate callback). Please re-authorize.",
    };
  }
  usedCodes.set(String(code), Date.now());

  const expectedState = cookies?.salla_oauth_state;
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";

  // State validation only if cookie exists (your original behavior)
  if (expectedState) {
    if (!state || String(state) !== String(expectedState)) {
      return { success: false, code: 400, message: "Invalid state" };
    }
  } else {
    // Dashboard install flow => no cookie
    if (isProd) {
      return {
        success: false,
        code: 400,
        message:
          "Missing state cookie. Start OAuth from /api/v1/salla/auth or fix host mismatch (localhost vs 127.0.0.1).",
      };
    }
  }

  // 1) exchange code -> tokens
  const token = await exchangeCode(code);

  // 2) user info -> storeId
  const merchant = await getAccountsUserInfo(token.access_token);

  const storeId = extractStoreId(merchant);
  if (!storeId) {
    return {
      success: false,
      code: 500,
      message: "Could not determine storeId from user/info response",
      merchant,
    };
  }

  // 3) save tokens per store
  const payload = {
    businessName: "salla",
    merchant,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    scope: token.scope || "",
    tokenType: token.token_type || "bearer",
    expiresAt: expiresAtFromSeconds(token.expires_in),
  };

  await SallaStoreTokenModel.updateOne(
    { storeId },
    { $set: { storeId, ...payload } },
    { upsert: true }
  );

  // optional redirect
  if (process.env.APP_SUCCESS_REDIRECT) {
    return {
      success: true,
      code: 302,
      storeId,
      redirectUrl: `${process.env.APP_SUCCESS_REDIRECT}?storeId=${encodeURIComponent(
        storeId
      )}`,
      clearCookieName: expectedState ? "salla_oauth_state" : undefined,
    };
  }

  return {
    success: true,
    code: 200,
    storeId,
    clearCookieName: expectedState ? "salla_oauth_state" : undefined,
  };
};

exports.status = async () => {
  const items = await SallaStoreTokenModel.find({})
    .select({ storeId: 1, expiresAt: 1, scope: 1, merchant: 1, updatedAt: 1 })
    .lean();

  return {
    success: true,
    code: 200,
    count: items.length,
    result: items,
  };
};

exports.refresh = async (storeId) => {
  const sid = storeId
  if (!sid) return { success: false, code: 400, message: "storeId is required" };

  const doc = await SallaStoreTokenModel.findOne({ storeId: sid });
  if (!doc) return { success: false, code: 404, message: "Store not connected" };
  const refreshed = await refreshToken(doc.refreshToken);

  const payload = {
    businessName: "salla",
    merchant: doc.merchant,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || doc.refreshToken,
    scope: refreshed.scope || doc.scope,
    tokenType: refreshed.token_type || doc.tokenType,
    expiresAt: expiresAtFromSeconds(refreshed.expires_in),
  };

  await SallaStoreTokenModel.updateOne(
    { storeId: sid },
    { $set: { storeId: sid, ...payload } },
    { upsert: true }
  );

  return { success: true, code: 200, storeId: sid };
};


exports.disconnect = async (storeId) => {
  const sid = String(storeId || "");
  if (!sid) return { success: false, code: 400, message: "storeId is required" };

  await SallaStoreTokenModel.deleteOne({ storeId: sid });
  return { success: true, code: 200, storeId: sid };
};


