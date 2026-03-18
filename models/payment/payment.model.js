// payment.model.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "clients",
      required: true,
      index: true,
    },

    group: {
      type: Schema.Types.ObjectId,
      ref: "groups",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    method: {
      type: String,
      trim: true,
      default: "testing",
      enum: ["testing", "credit_card", "paypal", "bank_transfer", "wallet"],
    },

    status: {
      type: String,
      required: true,
      enum: ["pending", "success", "failed"],
      default: "pending",
      index: true,
    },

    transactionId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

paymentSchema.index({ group: 1, createdAt: -1 });
paymentSchema.index({ client: 1, createdAt: -1 });
paymentSchema.index({ group: 1, client: 1, createdAt: -1 });

paymentSchema.pre("save", function (next) {
  if (this.status === "success" && !this.paidAt) {
    this.paidAt = new Date();
  }

  next();
});

module.exports = mongoose.model("payments", paymentSchema);