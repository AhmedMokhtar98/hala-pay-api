const mongoose = require("mongoose");

const priceSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "SAR", trim: true },
  },
  { _id: false }
);

const productCategorySchema = new mongoose.Schema(
  {
    providerCategoryId: { type: String, default: "", trim: true, index: true },
    name: { type: String, default: "", trim: true },
    nameEn: { type: String, default: "", trim: true },
    nameAr: { type: String, default: "", trim: true },
    categoryRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "categories",
      default: null,
      index: true,
    },
  },
  { _id: true }
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
    options: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "stores",
      required: true,
      index: true,
    },

    provider: { type: String, required: true, trim: true, index: true },
    providerProductId: { type: String, default: "", trim: true, index: true },

    name: { type: String, default: "", trim: true },
    description: { type: String, default: "" },

    images: { type: [String], default: [] },
    mainImage: { type: String, default: "" },
    thumbnail: { type: String, default: "" },

    priceBefore: { type: priceSchema, default: () => ({}) },
    price: { type: priceSchema, default: () => ({}) },
    salePrice: { type: priceSchema, default: () => ({}) },

    stock: { type: Number, default: 0, min: 0 },
    unlimited: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },

    status: { type: String, default: "active", trim: true },
    sku: { type: String, default: "", trim: true },

    categories: {
      type: [productCategorySchema],
      default: [],
    },

    variants: {
      type: [variantSchema],
      default: [],
    },

    rating: {
      count: { type: Number, default: 0, min: 0 },
      rate: { type: Number, default: 0, min: 0 },
    },

    discount: { type: Number, default: 0, min: 0 },

    urls: {
      admin: { type: String, default: "" },
      customer: { type: String, default: "" },
      product_card: { type: String, default: "" },
    },

    weight: { type: Number, default: 0, min: 0 },
    weightUnit: { type: String, default: "kg", trim: true },

    raw: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

productSchema.index(
  { store: 1, provider: 1, providerProductId: 1 },
  { unique: true }
);

productSchema.index({ "categories.categoryRef": 1 });
productSchema.index({ "categories.name": 1 });
productSchema.index({ "categories.nameEn": 1 });
productSchema.index({ "categories.nameAr": 1 });

module.exports = mongoose.model("products", productSchema);