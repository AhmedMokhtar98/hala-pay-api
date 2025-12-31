const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },

    // permissions shape:
    // {
    //   admins: ["GET /admins", "PUT /admins/:id", ...],
    //   clients: ["GET /clients", ...],
    //   ...
    // }
    permissions: {
      type: Object, // keep it object to match your current design
      default: {},
    },
  },
  { timestamps: true }
);

// ✅ Prevent OverwriteModelError
const Role = mongoose.models.roles || mongoose.model("roles", roleSchema);

module.exports = Role;
