// -------------------------------
// src/repositories/sallaHttp.repo.js
// -------------------------------
const axios = require("axios");

exports.getUserInfo = async (accessToken) => {
  return axios.get("https://accounts.salla.sa/oauth2/user/info", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
};