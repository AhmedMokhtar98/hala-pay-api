// controllers/admin/webhook.controller.js
const crypto = require("crypto");

// In-memory storage for demo purposes
const merchantTokens = {};

/**
 * Verify Salla webhook signature using timing-safe comparison
 * @param {Buffer} rawBody - raw body buffer
 * @param {string} signature - X-Salla-Signature header
 * @param {string} secret - your webhook secret from .env
 * @returns {boolean}
 */
const verifySignature = (rawBody, signature, secret) => {
  if (!signature) return false;
  if (!rawBody || !Buffer.isBuffer(rawBody)) return false;

  // Compute HMAC SHA256 of the raw body
  const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    // Timing-safe comparison
    return crypto.timingSafeEqual(Buffer.from(hmac, "utf8"), Buffer.from(signature, "utf8"));
  } catch (err) {
    console.error("Timing-safe comparison failed:", err);
    return false;
  }
};

/**
 * Capture token webhook
 * @param {Request} req
 * @param {Response} res
 */
exports.captureToken = (req, res) => {
  console.log("Webhook hit");

  const signature = req.headers["x-salla-signature"];
  const secret = process.env.SALLA_WEBHOOK_SECRET;

  if (!secret) {
    console.error("SALLA_WEBHOOK_SECRET not set");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  // Verify signature
  if (!verifySignature(req.body, signature, secret)) {
    console.error("Invalid signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Parse JSON payload
  let payload;
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch (err) {
    console.error("Failed to parse JSON payload:", err);
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const { store_id, access_token, refresh_token } = payload;

  if (!store_id || !access_token) {
    return res.status(400).json({ error: "Missing store_id or access_token" });
  }

  // Store tokens in memory
  merchantTokens[store_id] = {
    access_token,
    refresh_token,
    received_at: new Date(),
  };

  console.log(`Access token stored for store ${store_id}`);
  console.log("Current tokens:", merchantTokens);

  res.status(200).json({ success: true });
};

/**
 * Utility: Get token for a specific store
 */
exports.getToken = (store_id) => merchantTokens[store_id]?.access_token || null;

/**
 * Utility: Get all stored tokens (debug)
 */
exports.getAllTokens = () => merchantTokens;
