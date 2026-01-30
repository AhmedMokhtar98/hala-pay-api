// models/group/group.model.js
const mongoose = require("mongoose");

const { Schema } = mongoose;

const groupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "", trim: true },
    image: { type: String, default: "" },

    product: {
      type: Schema.Types.ObjectId,
      ref: "products",
      required: true,
      index: true,
    },

    store: {
      type: Schema.Types.ObjectId,
      ref: "stores",
      required: true,
      index: true,
    },

    targetAmount: { type: Number, required: true, min: 0 },
    collectedAmount: { type: Number, default: 0, min: 0 },

    // contributors as array of objects (no separate new Schema)
    contributors: {
      type: [
        {
          client: {
            type: Schema.Types.ObjectId,
            ref: "clients",
            required: true,
            index: true,
          },
          paidAmount: { type: Number, default: 0, min: 0 },
          paidAt: { type: Date, default: null },
          transactionStatus: { type: Boolean, default: false }, // true = successful
        },
      ],
      default: [],
    },

    status: {
      type: String,
      default: "active",
      enum: ["active", "closed", "deleted", "funded", "purchased"],
      index: true,
    },

    deadLine: { type: Date, default: null },

    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// helpful indexes
groupSchema.index({ store: 1, status: 1 });
groupSchema.index({ product: 1, status: 1 });
groupSchema.index({ isActive: 1, deadLine: 1 });

module.exports = mongoose.model("groups", groupSchema);
