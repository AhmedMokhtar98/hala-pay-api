const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "groups",
      required: true,
      index: true,
    },

    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "stores",
      required: true,
      index: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "products",
      required: true,
    },

    provider: {
      type: String,
      default: "salla",
      index: true,
    },

    providerOrderId: {
      type: String,
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["created", "failed"],
      default: "created",
    },

    rawResponse: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true }
);

schema.index({ group: 1 }, { unique: true }); // 🔐 prevent duplicate order per group

module.exports = mongoose.model("Order", schema);