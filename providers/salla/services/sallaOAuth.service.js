// providers/salla/services/sallaOAuth.service.js
const axios = require("axios");
const qs = require("qs");

/**
 * Salla OAuth base (accounts server)
 */
const SALLA_ACCOUNTS_BASE = "https://accounts.salla.sa";

/**
 * ENV required:
 * - SALLA_CLIENT_ID
 * - SALLA_CLIENT_SECRET
 * - SALLA_REDIRECT_URI   (must match in Salla app settings)
 *
 * Optional:
 * - SALLA_SCOPE (space separated)
 */
function mustEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`Missing env: ${name}`);
    err.status = 500;
    throw err;
  }
  return String(v);
}

function safeJson(x) {
  try {
    if (typeof x === "string") return x;
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function normalizeAxiosError(e, tag = "SallaOAuth") {
  const status = e?.response?.status || e?.status || 500;
  const data = e?.response?.data ?? e?.data ?? null;

  const err = new Error(
    `[${tag}] HTTP ${status} - ${safeJson(data || e?.message || e)}`
  );
  err.status = status;
  err.data = data;
  return err;
}

/**
 * Build the authorization URL (redirect user to Salla)
 */
function buildAuthUrl({ state } = {}) {
  const client_id = mustEnv("SALLA_CLIENT_ID");
  const redirect_uri = mustEnv("SALLA_REDIRECT_URI");

  const scope = String(process.env.SALLA_SCOPE || "").trim();

  const params = {
    response_type: "code",
    client_id,
    redirect_uri,
    state: state ? String(state) : undefined,
    scope: scope || undefined,
  };

  const query = qs.stringify(params, { skipNulls: true });
  return `${SALLA_ACCOUNTS_BASE}/oauth2/auth?${query}`;
}

/**
 * Exchange auth code -> access token + refresh token
 */
async function exchangeCode(code) {
  try {
    const client_id = mustEnv("SALLA_CLIENT_ID");
    const client_secret = mustEnv("SALLA_CLIENT_SECRET");
    const redirect_uri = mustEnv("SALLA_REDIRECT_URI");

    const body = {
      grant_type: "authorization_code",
      code: String(code),
      client_id,
      client_secret,
      redirect_uri,
    };

    const resp = await axios.post(
      `${SALLA_ACCOUNTS_BASE}/oauth2/token`,
      qs.stringify(body),
      {
        timeout: 30_000,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        validateStatus: () => true,
      }
    );

    if (resp.status >= 200 && resp.status < 300) {
      // typical: { access_token, refresh_token, expires_in, scope, token_type }
      return resp.data;
    }

    const err = new Error(
      `[SallaOAuth] token exchange failed HTTP ${resp.status} - ${safeJson(
        resp.data
      )}`
    );
    err.status = resp.status;
    err.data = resp.data;
    throw err;
  } catch (e) {
    throw normalizeAxiosError(e, "SallaOAuth");
  }
}

/**
 * Refresh access token using refresh_token
 */
async function refreshAccessToken(refreshToken) {
  try {
    const client_id = mustEnv("SALLA_CLIENT_ID");
    const client_secret = mustEnv("SALLA_CLIENT_SECRET");

    const body = {
      grant_type: "refresh_token",
      refresh_token: String(refreshToken),
      client_id,
      client_secret,
    };

    const resp = await axios.post(
      `${SALLA_ACCOUNTS_BASE}/oauth2/token`,
      qs.stringify(body),
      {
        timeout: 30_000,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        validateStatus: () => true,
      }
    );

    if (resp.status >= 200 && resp.status < 300) {
      return resp.data;
    }

    const err = new Error(
      `[SallaOAuth] refresh failed HTTP ${resp.status} - ${safeJson(resp.data)}`
    );
    err.status = resp.status;
    err.data = resp.data;
    throw err;
  } catch (e) {
    throw normalizeAxiosError(e, "SallaOAuth");
  }
}

module.exports = {
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
};