const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    businessName: { type: String, default: "" },
    provider: { type: String, default: null },
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
    logo: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("stores", storeSchema);
