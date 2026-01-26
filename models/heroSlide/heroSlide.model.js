// models/HeroSlide.js
const mongoose = require("mongoose");

const HeroSlideSchema = new mongoose.Schema(
  {
    title: {
      en: { type: String, trim: true, required: true },
      ar: { type: String, trim: true, default: "" },
    },

    subtitle: {
      en: { type: String, trim: true, default: "" },
      ar: { type: String, trim: true, default: "" },
    },

    image: { type: String, trim: true, required: false, default: "" },

    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },

    isActive: { type: Boolean, default: true },
    store: { type: mongoose.Schema.Types.ObjectId, ref: "stores", required: false  },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "categories", required: false  },
  },
  { timestamps: true }
);

// ✅ correct index (no position in schema)
HeroSlideSchema.index({ isActive: 1, createdAt: -1 });
HeroSlideSchema.index({ store: 1 });
HeroSlideSchema.index({ category: 1 });

module.exports = mongoose.model("HeroSlide", HeroSlideSchema);
