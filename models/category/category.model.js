const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: "stores", required: true, index: true, },
    nameEn: { type: String, default: "" },
    nameAr: { type: String, default: "" },
    descriptionEn: { type: String, default: "" },
    descriptionAr: { type: String, default: "" },
    image: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("categories", categorySchema);
