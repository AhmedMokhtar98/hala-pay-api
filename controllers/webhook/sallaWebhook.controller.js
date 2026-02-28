const crypto = require("crypto");
const { connectRedis } = require("../../redis/redis.config");

const { handleSallaOrder } = require("../../providers/salla/services/webhook/sallaOrder.handler");
const { handleSallaUninstall } = require("../../providers/salla/services/webhook/sallaUninstall.handler");

exports.handle = async (req, res) => {
  const redis = await connectRedis();

  try {
    const rawBody = req.body;
    const signature = req.headers["x-salla-signature"];

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ message: "Invalid raw body" });
    }

    if (!signature) {
      return res.status(400).json({ message: "Missing signature" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.SALLA_CLIENT_SECRET)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const payload = JSON.parse(rawBody.toString("utf8"));
    const event = payload?.event;
    const eventId = payload?.id;

    if (!eventId) return res.status(400).json({ message: "Missing event ID" });

    const key = `webhook:salla:${eventId}`;
    const exists = await redis.get(key);
    if (exists) return res.status(200).end();

    await redis.set(key, "1", { EX: 3600 });

    switch (event) {
      case "order.created":
      case "order.updated":
        await handleSallaOrder(payload);
        break;

      case "app.uninstalled":
        await handleSallaUninstall(payload);
        break;

      default:
        console.log("Unhandled event:", event);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};