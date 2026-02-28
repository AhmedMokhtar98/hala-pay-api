// common/http/httpClient.js
const axios = require("axios");
const qs = require("qs");

function safeJson(x) {
  try {
    if (typeof x === "string") return x;
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function createHttpClient({
  provider,
  baseURL,
  timeout = 30000,
  getAuthHeaders,
  defaultHeaders,
}) {
  return async function request({ storeId, method, path, params, data, headers }) {
    const authHeaders = getAuthHeaders ? await getAuthHeaders({ storeId }) : {};
    const resp = await axios.request({
      method,
      url: `${baseURL}${path}`,
      timeout,
      headers: {
        Accept: "application/json",
        ...(defaultHeaders || {}),
        ...(authHeaders || {}),
        ...(headers || {}),
      },
      params,
      paramsSerializer: (p) =>
        qs.stringify(p, { arrayFormat: "brackets", skipNulls: true }),
      data,
      validateStatus: () => true,
    });

    console.log(`[${provider}] Request:`, method, path, params || {});
    console.log(`[${provider}] Status:`, resp.status);

    if (resp.status >= 200 && resp.status < 300) return resp;

    const err = new Error(
      `[${provider}] HTTP ${resp.status} - ${safeJson(resp.data)}`
    );
    err.status = resp.status;
    err.data = resp.data;
    throw err;
  };
}

module.exports = { createHttpClient };