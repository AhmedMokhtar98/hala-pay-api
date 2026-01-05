const mongoose = require("mongoose");

const SallaStoreTokenSchema = new mongoose.Schema(
  {
    // store identifier (from user info endpoint)
    storeId: { type: String, required: true, unique: true, index: true },

    // merchant/user info snapshot (optional but useful)
    merchant: { type: Object, default: null },

    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },

    scope: { type: String, default: "" },
    tokenType: { type: String, default: "bearer" },

    // store absolute expiry time
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SallaStoreToken", SallaStoreTokenSchema);
