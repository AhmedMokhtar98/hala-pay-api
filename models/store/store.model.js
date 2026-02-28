// models/store/store.model.js
const mongoose = require("mongoose");

const authSchema = new mongoose.Schema(
  {
    accessToken: { type: String, default: "" },
    refreshToken: { type: String, default: "" },

    scope: { type: String, default: "" },
    tokenType: { type: String, default: "bearer" },

    // absolute expiry time
    expiresAt: { type: Date, default: null },

    // some providers use extra fields (shopify: shop, woocommerce: consumerKey, etc.)
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const providerSchema = new mongoose.Schema(
  {
    // "salla" | "shopify" | "woocommerce" | "zid" ...
    name: { type: String, required: true, lowercase: true, trim: true, index: true },

    // store identifier inside provider (ex: Salla merchant/store id)
    storeId: { type: String, required: true, trim: true, index: true },

    // optional: store domain/url inside provider (Shopify needs this often)
    domain: { type: String, default: "", trim: true },

    // merchant/user info snapshot from provider (optional)
    merchant: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const storeSchema = new mongoose.Schema(
  {
    businessName: { type: String, default: "", trim: true, index: true },

    // ✅ provider info
    provider: { type: providerSchema, required: true },

    // ✅ auth info (token-based OR api keys-based using auth.meta)
    auth: { type: authSchema, default: () => ({}) },

    logo: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true, index: true },

    // optional: internal notes / settings per store
    settings: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

/**
 * ✅ IMPORTANT:
 * Prevent duplicates per provider.
 * Example: you can have Salla storeId=107885722 and Shopify storeId=107885722 without conflict.
 */
storeSchema.index({ "provider.name": 1, "provider.storeId": 1 }, { unique: true });

// helpful index for lists
storeSchema.index({ isActive: 1, createdAt: -1 });

/**
 * ✅ Backward compatibility:
 * If your old code uses store.storeId / store.provider directly,
 * expose virtuals so you don't have to refactor everywhere at once.
 */
storeSchema.virtual("storeId").get(function () {
  return this.provider?.storeId;
});

storeSchema.virtual("providerName").get(function () {
  return this.provider?.name;
});

storeSchema.set("toJSON", { virtuals: true });
storeSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("stores", storeSchema);