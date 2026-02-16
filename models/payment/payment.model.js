// payment.model.js
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        client: { type: mongoose.Schema.Types.ObjectId, ref: "clients", required: true, index: true, },
        group: { type: mongoose.Schema.Types.ObjectId, ref: "groups", required: true, index: true, },
        amount: { type: Number, required: true, min: 0, },
        method: { type: String, required: true, enum: ["credit_card", "paypal", "bank_transfer", "cash"], },
        status: { type: String, required: true, enum: ["pending", "completed", "failed"], default: "pending", },
        transactionId: { type: String, trim: true, },
        createdAt: { type: Date, default: Date.now, },
        updatedAt: { type: Date, default: Date.now, },
    },
    { timestamps: true }
);

const Payment = mongoose.model("payments", paymentSchema);

module.exports = Payment;