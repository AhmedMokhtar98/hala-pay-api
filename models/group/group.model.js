const mongoose = require("mongoose");
const { Schema } = mongoose;

/* =========================================================
   UTIL: Calculate collectedAmount
========================================================= */

const calcCollectedAmount = (contributors = []) => {
  if (!Array.isArray(contributors)) return 0;

  return contributors.reduce((sum, c) => {
    const ok = c?.transactionStatus === true;
    const amt = Number(c?.paidAmount ?? 0);

    if (!ok || !Number.isFinite(amt) || amt <= 0) return sum;

    return sum + amt;
  }, 0);
};

/* =========================================================
   SCHEMA
========================================================= */

const groupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "", trim: true },
    image: { type: String, default: "" },

    product: {
      type: Schema.Types.ObjectId,
      ref: "products",
      required: true,
      index: true,
    },

    store: {
      type: Schema.Types.ObjectId,
      ref: "stores",
      required: true,
      index: true,
    },

    targetAmount: { type: Number, required: true, min: 0 },

    collectedAmount: { type: Number, default: 0, min: 0 },

    creator: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },

    contributors: {
      type: [
        {
          client: {
            type: Schema.Types.ObjectId,
            ref: "Client",
            required: true,
            index: true,
          },
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

    // 🔥 YallaPay Integration
    providerOrderId: {
      type: String,
      default: "",
      index: true,
    },

    purchaseLock: {
      type: Boolean,
      default: false,
      index: true,
    },

    fundedAt: {
      type: Date,
      default: null,
    },

    purchasedAt: {
      type: Date,
      default: null,
    },

    deadLine: { type: Date, default: null },

    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* =========================================================
   INDEXES (Optimized for Production)
========================================================= */

groupSchema.index({ store: 1, status: 1 });
groupSchema.index({ product: 1, status: 1 });
groupSchema.index({ status: 1, isActive: 1, deadLine: 1 });
groupSchema.index({ creator: 1, status: 1, createdAt: -1 });
groupSchema.index({ providerOrderId: 1 });

/* =========================================================
   AUTO CALC collectedAmount (CREATE / SAVE)
========================================================= */

groupSchema.pre("save", function (next) {
  this.collectedAmount = calcCollectedAmount(this.contributors);

  // 🔥 Auto move to funded
  if (
    this.collectedAmount >= this.targetAmount &&
    this.status === "active"
  ) {
    this.status = "funded";
    this.fundedAt = new Date();
  }

  next();
});

/* =========================================================
   AUTO CALC collectedAmount (UPDATE OPERATIONS)
========================================================= */

const applyCollectedInUpdate = async function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || {};
  const $unset = update.$unset || {};

  // prevent manual override
  delete update.collectedAmount;
  delete $set.collectedAmount;
  delete $unset.collectedAmount;

  const usesAtomic =
    !!update.$push?.contributors ||
    !!update.$pull?.contributors ||
    !!update.$addToSet?.contributors;

  if (usesAtomic) {
    const doc = await this.model.findOne(this.getQuery()).lean();
    if (!doc) return next();

    let final = doc.contributors || [];

    if (update.$pull?.contributors) {
      const cond = update.$pull.contributors;
      if (cond?.client) {
        final = final.filter(
          (c) => String(c.client) !== String(cond.client)
        );
      }
    }

    if (update.$push?.contributors) {
      const pushed = update.$push.contributors;
      if (pushed?.$each && Array.isArray(pushed.$each))
        final = [...final, ...pushed.$each];
      else if (pushed) final = [...final, pushed];
    }

    if (update.$addToSet?.contributors) {
      const item = update.$addToSet.contributors;
      const arr =
        item?.$each && Array.isArray(item.$each) ? item.$each : [item];

      const seen = new Set(final.map((c) => String(c.client)));

      arr.forEach((x) => {
        const k = String(x?.client || "");
        if (k && !seen.has(k)) {
          final.push(x);
          seen.add(k);
        }
      });
    }

    const newValue = calcCollectedAmount(final);

    update.$set = {
      ...$set,
      collectedAmount: newValue,
    };

    // 🔥 Auto funded on update
    if (newValue >= doc.targetAmount && doc.status === "active") {
      update.$set.status = "funded";
      update.$set.fundedAt = new Date();
    }

    this.setUpdate(update);
    return next();
  }

  this.setUpdate(update);
  next();
};

groupSchema.pre("findOneAndUpdate", applyCollectedInUpdate);
groupSchema.pre("updateOne", applyCollectedInUpdate);
groupSchema.pre("updateMany", applyCollectedInUpdate);

/* =========================================================
   EXPORT
========================================================= */

module.exports = mongoose.model("groups", groupSchema);