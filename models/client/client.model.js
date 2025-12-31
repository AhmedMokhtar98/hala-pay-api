const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const saltrounds = 10; // stronger salt

const clientSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true, select: false }, // hide password
  image: { type: Object, default: {} },
  isActive: { type: Boolean, default: true },
  agreeToTerms: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  joinDate: { type: Date, default: Date.now },
  os: { type: String, default: "" },
  // Optional: relationships
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, { default: [] }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Client' }, { default: [] }],
//   contributions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contribution' }],
}, { timestamps: true });

// Hash password before saving
clientSchema.pre("save", async function(next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, saltrounds);
  }
  next();
});

// Compare password method
clientSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Optional: method to return safe JSON without password
clientSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("Client", clientSchema);
