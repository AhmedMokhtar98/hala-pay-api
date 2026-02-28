// models/product/product.model.js
const mongoose = require("mongoose");

const priceSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "SAR", trim: true },
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    providerVariantId: { type: String, default: "", trim: true, index: true },

    sku: { type: String, default: "", trim: true },
    name: { type: String, default: "", trim: true },

    price: { type: priceSchema, default: () => ({}) },
    compareAtPrice: { type: priceSchema, default: () => ({}) },

    stock: { type: Number, default: 0, min: 0 },
    unlimited: { type: Boolean, default: false },

    isAvailable: { type: Boolean, default: true },
    options: { type: mongoose.Schema.Types.Mixed, default: null }, // size/color mapping
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    // link to your connected store (internal)
    store: { type: mongoose.Schema.Types.ObjectId, ref: "stores", required: true, index: true },

    // provider identity
    provider: { type: String, required: true, lowercase: true, trim: true, index: true },
    providerProductId: { type: String, required: true, trim: true, index: true },

    // basic info
    name: { type: String, default: "", trim: true, index: true },
    description: { type: String, default: "", trim: true },

    // urls
    urls: {
      customer: { type: String, default: "", trim: true },
      admin: { type: String, default: "", trim: true },
      product_card: { type: String, default: "", trim: true },
    },

    // images
    thumbnail: { type: String, default: "", trim: true },
    mainImage: { type: String, default: "", trim: true },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.every((s) => typeof s === "string"),
        message: "images must be an array of strings",
      },
    },

    // pricing
    price: { type: priceSchema, default: () => ({}) },
    compareAtPrice: { type: priceSchema, default: () => ({}) }, // priceBefore
    salePrice: { type: priceSchema, default: () => ({}) },

    // inventory / availability
    stock: { type: Number, default: 0, min: 0 },
    unlimited: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true, index: true },

    // status mapping (unified)
    // active | draft | archived
    status: { type: String, default: "active", index: true },

    // categories (provider category IDs + optional refs)
    categories: [
      {
        providerCategoryId: { type: String, default: "", trim: true, index: true },
        name: { type: String, default: "", trim: true },
        categoryRef: { type: mongoose.Schema.Types.ObjectId, ref: "categories", default: null },
      },
    ],

    // variants (optional)
    variants: { type: [variantSchema], default: [] },

    // meta
    sku: { type: String, default: "", trim: true, index: true },
    weight: { type: Number, default: 0, min: 0 },
    weightUnit: { type: String, default: "kg", trim: true },

    rating: {
      count: { type: Number, default: 0, min: 0 },
      rate: { type: Number, default: 0, min: 0 },
    },

    // snapshot of provider object
    raw: { type: mongoose.Schema.Types.Mixed, default: null },

    // flags
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// prevent duplicates per store+provider+id
productSchema.index({ store: 1, provider: 1, providerProductId: 1 }, { unique: true });

// helper virtuals
productSchema.virtual("discountPercent").get(function () {
  const before = Number(this.compareAtPrice?.amount || 0);
  const now = Number(this.price?.amount || 0);
  if (before > 0 && now > 0 && before > now) {
    return Math.round(((before - now) / before) * 100);
  }
  return 0;
});

productSchema.virtual("finalPrice").get(function () {
  const sale = Number(this.salePrice?.amount || 0);
  if (sale > 0) return sale;
  const now = Number(this.price?.amount || 0);
  return now;
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("products", productSchema);