const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "stores",
      required: true,
      index: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "categories",
      required: true,
      index: true,
    },

    name: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.every((s) => typeof s === "string"),
        message: "images must be an array of strings",
      },
    },

    priceBefore: {
      type: Number,
      default: 0,
      min: 0,
    },

    price: {
      type: Number,
      default: 0,
      min: 0,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.pre("validate", function (next) {
  const pb = Number(this.priceBefore || 0);
  const p = Number(this.price || 0);

  if (pb > 0 && p > 0 && pb < p) {
    this.invalidate("priceBefore", "priceBefore must be >= price");
  }

  if (pb > 0 && p > 0) {
    const d = Math.round(((pb - p) / pb) * 100);
    this.discount = Math.min(100, Math.max(0, d));
  }

  next();
});

productSchema.virtual("finalPrice").get(function () {
  const p = Number(this.price || 0);
  if (p > 0) return p;

  const pb = Number(this.priceBefore || 0);
  const d = Number(this.discount || 0);

  if (pb > 0 && d > 0) return Math.max(0, +(pb * (1 - d / 100)).toFixed(2));
  return 0;
});

productSchema.virtual("hasDiscount").get(function () {
  return Number(this.priceBefore || 0) > 0 && Number(this.price || 0) > 0 && Number(this.priceBefore) > Number(this.price);
});

productSchema.index({ store: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model("products", productSchema);
