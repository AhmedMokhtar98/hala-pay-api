const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: "stores", required: true, },
    name: { type: String, default: "" },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("categories", categorySchema);
