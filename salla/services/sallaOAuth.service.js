const axios2 = require("axios");

const AUTH_URL = "https://accounts.salla.sa/oauth2/auth";
const TOKEN_URL = "https://accounts.salla.sa/oauth2/token";

exports.buildAuthUrl = ({ state }) => {
  // IMPORTANT: DO NOT include client_secret here
  const params = new URLSearchParams({
    client_id: process.env.SALLA_CLIENT_ID,
    response_type: "code",
    scope: "offline_access",
    redirect_uri: process.env.SALLA_CALLBACK_URL,
    state,
  });

  return `${AUTH_URL}?${params.toString()}`;
};

exports.exchangeCode = async (code) => {
  const res = await axios2.post(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.SALLA_CLIENT_ID,
      client_secret: process.env.SALLA_CLIENT_SECRET,
      redirect_uri: process.env.SALLA_CALLBACK_URL,
      code: String(code),
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return res.data;
};

exports.refreshAccessToken = async (refreshToken) => {
  const res = await axios2.post(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.SALLA_CLIENT_ID,
      client_secret: process.env.SALLA_CLIENT_SECRET,
      refresh_token: String(refreshToken),
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return res.data;
};
