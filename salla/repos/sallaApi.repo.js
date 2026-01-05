const axios = require("axios");

// Salla base API (most public APIs)
const BASE_URL = "https://api.salla.dev"; 
// If your docs say a different base (e.g. api.salla.sa), change it here.

exports.request = async ({ accessToken, method, path, params, data }) => {
  return axios.request({
    method,
    url: `${BASE_URL}${path}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    params,
    data,
  });
};
