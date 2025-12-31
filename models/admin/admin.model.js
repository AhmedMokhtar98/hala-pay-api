const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 5;

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    userName: { type: String, required: true, unique: true },
    // dropDups قديم/متشال من MongoDB indexes — سيبه لو عندك سبب، لكن الأفضل تشيله

    password: { type: String, required: true },

    image: { type: Object, default: {} },

    // NOTE:
    // انت كاتب permission ObjectId ref roles (يعني RoleId)
    // لكن في isAuthorized كنت متوقع permission = { admins: [...] }
    // فإما تغيّرها ل Mixed/Object أو تعمل populate للـ role وتجلب permissions منه
    permission: { type: mongoose.Types.ObjectId, ref: "roles", index: true },

    role: {
      type: String,
      enum: ["superAdmin", "admin", "chat"],
      default: "admin",
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

adminSchema.pre("save", async function (next) {
  try {
    // ✅ مهم: ما تعملش hash إلا لو password اتغير
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    return next();
  } catch (err) {
    return next(err);
  }
});

// ✅ Prevent OverwriteModelError
const Admin =
  mongoose.models.admins || mongoose.model("admins", adminSchema);

module.exports = Admin;
