const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  store: { type: mongoose.Schema.Types.ObjectId, ref: "stores", index: true },

  provider: { type: String, required: true, index: true },
  providerCategoryId: { type: String, index: true },

  nameEn: String,
  nameAr: String,
  image: String,

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

categorySchema.index(
  { store: 1, provider: 1, providerCategoryId: 1 },
  { unique: true }
);
module.exports = mongoose.model("categories", categorySchema);
