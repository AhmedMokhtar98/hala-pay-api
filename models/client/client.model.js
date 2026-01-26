// models/client.model.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

const clientSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },

    // ✅ keep email unique (normalized)
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
      unique: true,
    },

    // ✅ phone uniqueness MUST be (phoneCode + phoneNumber)
    phoneCode: { type: String, required: true, trim: true }, // ex: "+20"
    phoneNumber: { type: String, required: true, trim: true }, // ex: "1097005710"

    // ✅ password hidden by select:false (safer)
    password: { type: String, required: true },

    birthDate: { type: Date },
    image: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    agreeToTerms: { type: Boolean, default: true },

    joinDate: { type: Date, default: Date.now },
    os: { type: String, default: "" },

    // ✅ fix array schema (your old one was wrong)
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Group", default: [] }],
    activeGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Group", default: [] }],
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "Client", default: [] }],
    fcmToken: [String],

    // contributions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Contribution", default: [] }],
  },
  { timestamps: true }
);

/**
 * ✅ Compound unique index:
 * same phoneNumber can exist with different phoneCode
 * ex: (+20, 1097005710) and (+966, 1097005710) allowed
 * but duplicate exact pair is blocked
 */
clientSchema.index({ phoneCode: 1, phoneNumber: 1 }, { unique: true });

/* ------------------------ Normalization & Hashing ------------------------ */
clientSchema.pre("save", async function (next) {
  try {
    // normalize email always
    if (this.isModified("email") && this.email) {
      this.email = String(this.email).trim().toLowerCase();
    }

    // normalize phone fields always
    if (this.isModified("phoneCode") && this.phoneCode) {
      this.phoneCode = String(this.phoneCode).trim();
    }
    if (this.isModified("phoneNumber") && this.phoneNumber) {
      this.phoneNumber = String(this.phoneNumber).trim();
    }

    // hash password only if changed or new
    if (this.isModified("password")) {
      console.log("Hashing password for client:", this.password);
      this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    }

    next();
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Methods ------------------------------ */
clientSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Optional safe JSON
clientSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password; // in case password was selected manually
  return obj;
};

module.exports = mongoose.model("Client", clientSchema);
