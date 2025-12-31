const axios = require("axios");

const CLIENT_ID = process.env.SALLA_CLIENT_ID;
const CLIENT_SECRET = process.env.SALLA_CLIENT_SECRET;
const REDIRECT_URI = process.env.SALLA_REDIRECT_URI;

// Redirect user to Salla OAuth page
exports.authorize = (req, res) => {
  const scopes = encodeURIComponent("products orders offline_access");
  const state = "random_state_string";

  const authUrl = `https://accounts.salla.sa/oauth2/auth?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=${scopes}&state=${state}`;

  console.log("Redirecting to Salla auth URL:", authUrl);
  res.redirect(authUrl);
};

// Handle OAuth callback (not used in Easy Mode, just for Custom Mode)
exports.callback = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Authorization code missing");

  try {
    const tokenResp = await axios.post(
      "https://accounts.salla.sa/oauth2/token",
      {
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const { access_token, refresh_token } = tokenResp.data;
    console.log("Access token:", access_token);

    res.json({ access_token, refresh_token });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Failed to exchange code for token");
  }
};

// Fetch products for a store using stored token
exports.getProducts = async (req, res) => {
   const { storeId } = req.params;
  const tokenData = storeTokens[storeId];

  if (!tokenData) return res.status(400).json({ error: "Store not authorized" });

  try {
    const response = await axios.get("https://api.salla.dev/admin/v2/products", {
      headers: {
        Authorization: `Bearer ${tokenData.accessToken}`,
      },
    });

    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch products" });
  }
};
