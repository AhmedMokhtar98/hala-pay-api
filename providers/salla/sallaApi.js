// providers/salla/sallaApi.js
const { createHttpClient } = require("../common/http/httpClient");
const { ensureValidAccessToken } = require("./services/sallaToken.service");

const SALLA_BASE_URL = "https://api.salla.dev";

const sallaRequest = createHttpClient({
  provider: "Salla",
  baseURL: SALLA_BASE_URL,
  timeout: 30000,
  getAuthHeaders: async ({ storeId }) => {
    const accessToken = await ensureValidAccessToken(storeId);
    return { Authorization: `Bearer ${accessToken}` };
  },
});

module.exports = { sallaRequest };