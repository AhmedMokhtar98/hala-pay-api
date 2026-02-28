const axios = require("axios");
const { ensureValidAccessToken } = require("./sallaToken.service");

async function registerWebhooksForStore(storeId) {
  const accessToken = await ensureValidAccessToken(storeId);

  const events = [
    "order.created",
    "order.updated",
    "product.created",
    "product.updated",
    "app.uninstalled"
  ];

  const baseUrl = process.env.SERVER_URL;

  for (const event of events) {
    await axios.post(
      "https://api.salla.dev/admin/v2/webhooks",
      {
        name: event,
        url: `${baseUrl}/api/v1/webhook/salla`,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
  }
}

module.exports = { registerWebhooksForStore };