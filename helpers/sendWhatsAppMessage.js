// utils/waretechOtp.js
'use strict';

const axios = require("axios");

function maskKey(key = "") {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}


async function sendWhatsAppOtp(
  { to, otp },
  {
    baseUrl = "https://web.waretech.tech",
    apiKey = process.env.WHATSAPP_API_KEY,
    timeoutMs = 15000,
    retries = 2,
  } = {}
) {
  const phone = String(to || "").trim();
  const code = String(otp ?? "").trim();

  if (!apiKey) {
    throw new Error("WHATSAPP_API_KEY is missing");
  }
  if (!phone.startsWith("+") || phone.length < 8) {
    throw new Error("Invalid `to` phone number. Use E.164 like +2010xxxxxxx");
  }
  if (!code) {
    throw new Error("Invalid `otp` value");
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/api/public/send-otp`;

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(
        url,
        { to: phone, otp: code },
        {
          timeout: timeoutMs,
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          validateStatus: () => true, // we handle status manually
        }
      );

      if (res.status >= 200 && res.status < 300) {
        return {
          ok: true,
          status: res.status,
          data: res.data,
        };
      }

      // Non-2xx: treat as error
      const err = new Error(`WhatsApp send-otp failed with status ${res.status}`);
      err.status = res.status;
      err.responseData = res.data;
      throw err;
    } catch (err) {
      lastErr = err;

      // retry only for network/timeouts/5xx
      const status = err?.status || err?.response?.status;
      const isTimeout = err?.code === "ECONNABORTED";
      const isNetwork = !status && (err?.code || err?.message);
      const is5xx = typeof status === "number" && status >= 500;

      const shouldRetry = attempt < retries && (isTimeout || isNetwork || is5xx);
      if (!shouldRetry) break;

      // simple backoff: 300ms, 700ms, 1200ms...
      const delayMs = 300 + attempt * 400;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // Add safe debug info (no full key)
  lastErr.debug = {
    endpoint: url,
    apiKey: maskKey(apiKey),
  };
  throw lastErr;
}

module.exports = { sendWhatsAppOtp };
