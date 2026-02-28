// providers/auth/helpers.js
const crypto = require("crypto");

// prevent duplicate callback using same code (DEV-friendly)
const usedCodes = new Map(); // key -> timestamp
const USED_TTL_MS = 10 * 60 * 1000;

function gcUsedCodes() {
  const now = Date.now();
  for (const [k, t] of usedCodes.entries()) {
    if (now - t > USED_TTL_MS) usedCodes.delete(k);
  }
}

function markCodeUsed(key) {
  gcUsedCodes();
  const k = String(key || "");
  if (!k) return false;
  if (usedCodes.has(k)) return true;
  usedCodes.set(k, Date.now());
  return false;
}

function makeState(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}

function isProd() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function makeStateCookie(providerName, state) {
  const name = `${providerName}_oauth_state`;
  return {
    name,
    value: state,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd(),
      maxAge: 10 * 60 * 1000,
    },
  };
}

module.exports = { markCodeUsed, makeState, makeStateCookie, isProd };