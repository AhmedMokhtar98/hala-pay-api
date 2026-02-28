// providers/auth/adapters/salla.auth.js
const axios = require("axios");
const Stores = require("../../../models/store/store.model");
const { expiresAtFromSeconds } = require("../../../utils/helpers");

const { buildAuthUrl, exchangeCode, refreshAccessToken } = require("../../salla/services/sallaOAuth.service");
const { makeState, makeStateCookie, markCodeUsed, isProd } = require("../helpers");
const { registerWebhooksForStore } = require("../../salla/services/sallaWebhook.service");

// provider name constant
const PROVIDER = "salla";

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
  const resp = await axios.get("https://accounts.salla.sa/oauth2/user/info", {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 30_000,
  });
  return resp.data;
}

async function upsertUnifiedStore({ storeId, merchant, token }) {
  const payload = {
    businessName: merchant?.data?.merchant?.name || merchant?.merchant?.name || merchant?.store?.name || null,
    provider: {
      name: PROVIDER,
      storeId: String(storeId),
      domain: merchant?.data?.merchant?.domain || merchant?.merchant?.domain || merchant?.store?.domain || null,
      merchant: merchant || null,
    },
    auth: {
      accessToken: token.access_token || "",
      refreshToken: token.refresh_token || "",
      scope: token.scope || "",
      tokenType: token.token_type || "bearer",
      expiresAt: expiresAtFromSeconds(token.expires_in),
      meta: null,
    },
    logo: merchant?.data?.merchant?.avatar,
    isActive: true,
  };

  await Stores.updateOne(
    { "provider.name": PROVIDER, "provider.storeId": String(storeId) },
    { $set: payload },
    { upsert: true }
  );

  return payload;
}

const sallaAuth = {
  name: PROVIDER,

  async startAuth() {
    const state = makeState();
    const url = buildAuthUrl({ state });

    return {
      success: true,
      code: 302,
      redirectUrl: url,
      cookie: makeStateCookie(PROVIDER, state),
    };
  },

  async callback({ query, cookies }) {
    const code = query?.code;
    const state = query?.state;

    if (!code) return { success: false, code: 400, message: "Missing code" };

    // prevent duplicate callback with same code
    const duplicated = markCodeUsed(`${PROVIDER}:code:${code}`);
    if (duplicated) {
      return {
        success: false,
        code: 409,
        message: "Authorization code already handled (duplicate callback). Please re-authorize.",
      };
    }

    const cookieName = `${PROVIDER}_oauth_state`;
    const expectedState = cookies?.[cookieName];

    // validate state if cookie exists
    if (expectedState) {
      if (!state || String(state) !== String(expectedState)) {
        return { success: false, code: 400, message: "Invalid state" };
      }
    } else if (isProd()) {
      return { success: false, code: 400, message: "Missing state cookie in production." };
    }

    // exchange code
    const token = await exchangeCode(code);

    // get merchant/user info
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

    await upsertUnifiedStore({ storeId, merchant, token });
    // await registerWebhooksForStore(storeId); // 
    // optional redirect
    if (process.env.APP_SUCCESS_REDIRECT) {
      return {
        success: true,
        code: 302,
        storeId,
        redirectUrl: `${process.env.APP_SUCCESS_REDIRECT}?storeId=${encodeURIComponent(storeId)}&provider=${PROVIDER}`,
        clearCookieName: expectedState ? cookieName : undefined,
      };
    }

    return {
      success: true,
      code: 200,
      storeId,
      provider: PROVIDER,
      clearCookieName: expectedState ? cookieName : undefined,
    };
  },

  async status() {
    const items = await Stores.find({ "provider.name": PROVIDER })
      .select({
        "provider.storeId": 1,
        "provider.merchant": 1,
        "auth.expiresAt": 1,
        "auth.scope": 1,
        updatedAt: 1,
        isActive: 1,
      })
      .lean();

    return {
      success: true,
      code: 200,
      provider: PROVIDER,
      count: items.length,
      result: items,
    };
  },

  async refresh({ providerStoreId }) {
    const sid = String(providerStoreId || "");
    if (!sid) return { success: false, code: 400, message: "storeId is required" };

    const doc = await Stores.findOne({ "provider.name": PROVIDER, "provider.storeId": sid });
    if (!doc) return { success: false, code: 404, message: "Store not connected" };

    const refreshed = await refreshAccessToken(doc.auth?.refreshToken);

    await Stores.updateOne(
      { _id: doc._id },
      {
        $set: {
          "auth.accessToken": refreshed.access_token,
          "auth.refreshToken": refreshed.refresh_token || doc.auth?.refreshToken,
          "auth.scope": refreshed.scope || doc.auth?.scope || "",
          "auth.tokenType": refreshed.token_type || doc.auth?.tokenType || "bearer",
          "auth.expiresAt": expiresAtFromSeconds(refreshed.expires_in),
        },
      }
    );

    return { success: true, code: 200, provider: PROVIDER, storeId: sid };
  },

  async disconnect({ providerStoreId }) {
    const sid = String(providerStoreId || "");
    if (!sid) return { success: false, code: 400, message: "storeId is required" };

    await Stores.deleteOne({ "provider.name": PROVIDER, "provider.storeId": sid });
    return { success: true, code: 200, provider: PROVIDER, storeId: sid };
  },

  async getAccountsUserInfo({ providerStoreId }) {
    const sid = String(providerStoreId || "");
    if (!sid) return { success: false, code: 400, message: "storeId is required" };
    const doc = await Stores.findOne({ "provider.name": PROVIDER, "provider.storeId": sid });
    if (!doc) return { success: false, code: 404, message: "Store not connected" };
    return { success: true, code: 200, provider: PROVIDER, storeId: sid, result: doc };
  }
};

module.exports = { sallaAuth };