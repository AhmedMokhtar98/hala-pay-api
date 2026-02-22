// models/group/group.model.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const calcCollectedAmount = (contributors = []) => {
  if (!Array.isArray(contributors)) return 0;
  return contributors.reduce((sum, c) => {
    const ok = c?.transactionStatus === true;
    const amt = Number(c?.paidAmount ?? 0);
    if (!ok || !Number.isFinite(amt) || amt <= 0) return sum;
    return sum + amt;
  }, 0);
};

const groupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "", trim: true },
    image: { type: String, default: "" },

    product: { type: Schema.Types.ObjectId, ref: "products", required: true, index: true },
    store: { type: Schema.Types.ObjectId, ref: "stores", required: true, index: true },

    targetAmount: { type: Number, required: true, min: 0 },

    // ✅ will be auto-calculated
    collectedAmount: { type: Number, default: 0, min: 0 },

    creator: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },

    contributors: {
      type: [
        {
          client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
          paidAmount: { type: Number, default: 0, min: 0 },
          paidAt: { type: Date, default: null },
          transactionStatus: { type: Boolean, default: false },
          transactionId: { type: String, trim: true, default: "" },
        },
      ],
      default: [],
    },

    status: {
      type: String,
      default: "active",
      enum: ["active", "closed", "deleted", "funded", "purchased"],
      index: true,
    },

    deadLine: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

/* =========================
   ✅ PERFECT INDEXES
   ========================= */

// 1) Store page / dashboard filters
groupSchema.index({ store: 1, status: 1 });

// 2) Product page filters
groupSchema.index({ product: 1, status: 1 });

// 3) ✅ Cron job: close expired active groups fast
// query: { status:"active", isActive:true, deadLine:{$lte: now} }
groupSchema.index({ status: 1, isActive: 1, deadLine: 1 });

// 4) (Optional but recommended) My groups / admin list by creator
// Often used with sorting by newest
groupSchema.index({ creator: 1, status: 1, createdAt: -1 });

/* ---------------- AUTO CALC collectedAmount ---------------- */

// create/save
groupSchema.pre("save", function (next) {
  this.collectedAmount = calcCollectedAmount(this.contributors);
  next();
});

// updates via findOneAndUpdate / updateOne / etc
const applyCollectedInUpdate = async function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || {};
  const $unset = update.$unset || {};

  // if someone tries to set/unset collectedAmount manually -> ignore it
  delete update.collectedAmount;
  delete $set.collectedAmount;
  delete $unset.collectedAmount;

  // only recalc if contributors is being changed
  const incomingContrib =
    update.contributors ??
    $set.contributors ??
    (update.$push?.contributors ? null : null);

  // If $push/$pull is used, we need to fetch final doc to recalc safely
  const usesAtomic =
    !!update.$push?.contributors || !!update.$pull?.contributors || !!update.$addToSet?.contributors;

  if (incomingContrib !== undefined && incomingContrib !== null && !usesAtomic) {
    const newValue = calcCollectedAmount(incomingContrib);
    update.$set = { ...$set, collectedAmount: newValue };
    this.setUpdate(update);
    return next();
  }

  if (usesAtomic) {
    const doc = await this.model.findOne(this.getQuery()).lean();
    const current = doc?.contributors || [];

    let final = current;

    if (update.$pull?.contributors) {
      const cond = update.$pull.contributors;
      if (cond?.client) {
        final = final.filter((c) => String(c.client) !== String(cond.client));
      }
    }

    if (update.$push?.contributors) {
      const pushed = update.$push.contributors;
      if (pushed?.$each && Array.isArray(pushed.$each)) final = [...final, ...pushed.$each];
      else if (pushed) final = [...final, pushed];
    }

    if (update.$addToSet?.contributors) {
      const item = update.$addToSet.contributors;
      const arr = item?.$each && Array.isArray(item.$each) ? item.$each : [item];
      const seen = new Set(final.map((c) => String(c.client?._id || c.client)));
      arr.forEach((x) => {
        const k = String(x?.client?._id || x?.client || "");
        if (k && !seen.has(k)) {
          final.push(x);
          seen.add(k);
        }
      });
    }

    const newValue = calcCollectedAmount(final);
    update.$set = { ...$set, collectedAmount: newValue };
    this.setUpdate(update);
    return next();
  }

  this.setUpdate(update);
  next();
};

groupSchema.pre("findOneAndUpdate", applyCollectedInUpdate);
groupSchema.pre("updateOne", applyCollectedInUpdate);
groupSchema.pre("updateMany", applyCollectedInUpdate);

module.exports = mongoose.model("groups", groupSchema);