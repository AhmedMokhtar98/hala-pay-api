const axios = require("axios");
const webhookController = require("../../controllers/admin/webhook.controller");


const list = async (filter = {}, projection = {}, options = {}, store_id) => {
  const ACCESS_TOKEN = webhookController.getToken(store_id);

  if (!ACCESS_TOKEN) {
    return res.status(401).json({
      error: "No access token found. Install the app first.",
    });
  }

    const response = await axios.get(
      "https://api.salla.dev/admin/v2/products",
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    return {
      code: 200,
      data: response.data,
    };
    
}
module.exports = {
  list,
};