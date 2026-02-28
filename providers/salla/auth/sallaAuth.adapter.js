// providers/salla/auth/sallaAuth.adapter.js
const axios = require("axios");
const {
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
} = require("../services/sallaOAuth.service");

// ✅ based on your payload
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

const sallaAuthAdapter = {
  name: "salla",

  buildAuthUrl: async ({ state }) => buildAuthUrl({ state }),

  exchangeCode: async ({ code }) => exchangeCode(code),

  refreshAccessToken: async ({ refreshToken }) => refreshAccessToken(refreshToken),

  getUserInfo: async ({ accessToken }) => getAccountsUserInfo(accessToken),

  extractStoreId,

  extractDomain: () => "",

  extractAuthMeta: () => null,
};

module.exports = { sallaAuthAdapter };