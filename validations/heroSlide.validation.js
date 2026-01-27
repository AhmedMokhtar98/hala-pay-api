const Joi = require("joi");

/* ------------------------------ Options ------------------------------ */

const joiOptions = {
  abortEarly: false,
  allowUnknown: false,
  stripUnknown: false,
};

/* ------------------------------ ObjectId ------------------------------ */

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.base": "errors.validObjectId",
    "string.pattern.base": "errors.invalidObjectId",
  });

/* ------------------------------ Helpers ------------------------------ */

// ✅ Required EN + AR (for TITLE)
const makeRequiredLangSchema = ({
  requiredKey = "errors.requiredTitle",
  validKey = "errors.validTitle",
  baseKey = "errors.validTitle",
} = {}) =>
  Joi.object({
    en: Joi.string().trim().required().messages({
      "string.base": validKey,
      "string.empty": requiredKey,
      "any.required": requiredKey,
    }),
    ar: Joi.string().trim().required().messages({
      "string.base": validKey,
      "string.empty": requiredKey,
      "any.required": requiredKey,
    }),
  })
    .required()
    .messages({
      "object.base": baseKey,
    })
    .unknown(false);

// ✅ Optional EN + AR (for SUBTITLE)
const makeOptionalLangSchema = ({
  validKey = "errors.validSubtitle",
  baseKey = "errors.validSubtitle",
} = {}) =>
  Joi.object({
    en: Joi.string().trim().allow("").messages({
      "string.base": validKey,
    }),
    ar: Joi.string().trim().allow("").messages({
      "string.base": validKey,
    }),
  })
    .optional()
    .messages({
      "object.base": baseKey,
    })
    .unknown(false);

// ✅ Date: allow null or date
const makeNullableDateSchema = ({
  invalidKey = "errors.invalidDate",
} = {}) =>
  Joi.date()
    .allow(null)
    .messages({
      "date.base": invalidKey,
    });

/* ------------------------------ Exports ------------------------------ */

module.exports = {
  /* ============================== CREATE ============================== */

  createHeroSlideValidation: {
    body: Joi.object({
      // ✅ title: EN + AR REQUIRED
      title: makeRequiredLangSchema({
        requiredKey: "errors.requiredTitle",
        validKey: "errors.validTitle",
        baseKey: "errors.validTitle",
      }),

      // ✅ subtitle: EN + AR OPTIONAL
      subtitle: makeOptionalLangSchema({
        validKey: "errors.validSubtitle",
        baseKey: "errors.validSubtitle",
      }).default({ en: "", ar: "" }),

      startAt: makeNullableDateSchema({
        invalidKey: "errors.invalidStartAt",
      }).optional(),

      endAt: makeNullableDateSchema({
        invalidKey: "errors.invalidEndAt",
      }).optional(),

      isActive: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsActive",
      }),

      store: objectId.optional(),

      category: objectId.required().messages({
        "string.base": "errors.validCategoryId",
        "string.pattern.base": "errors.invalidCategoryId",
        "any.required": "errors.requiredCategoryId",
      }),
    })
      .custom((obj, helpers) => {
        // ✅ validate date range if both provided
        if (obj.startAt && obj.endAt) {
          const s = new Date(obj.startAt);
          const e = new Date(obj.endAt);
          if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s > e) {
            return helpers.error("any.invalid");
          }
        }
        return obj;
      }, "date range")
      .messages({
        "any.invalid": "errors.invalidDateRange",
        "object.unknown": "errors.fieldNotAllowed",
      })
      .options(joiOptions),
  },

  /* ============================== UPDATE ============================== */

  updateHeroSlideValidation: {
    params: Joi.object({
      slideId: objectId.required().messages({
        "any.required": "errors.requiredHeroSlideId",
      }),
    }).options(joiOptions),

    body: Joi.object({
      // ✅ title optional, BUT if sent → EN + AR REQUIRED
      title: makeRequiredLangSchema({
        requiredKey: "errors.requiredTitle",
        validKey: "errors.validTitle",
        baseKey: "errors.validTitle",
      }).optional(),

      // ✅ subtitle always optional
      subtitle: makeOptionalLangSchema({
        validKey: "errors.validSubtitle",
        baseKey: "errors.validSubtitle",
      }).optional(),

      startAt: makeNullableDateSchema({
        invalidKey: "errors.invalidStartAt",
      }).optional(),

      endAt: makeNullableDateSchema({
        invalidKey: "errors.invalidEndAt",
      }).optional(),

      isActive: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsActive",
      }),

      store: objectId.optional(),
      category: objectId.optional(),
    })
      .min(1) // ✅ at least one field
      .custom((obj, helpers) => {
        const hasStart = Object.prototype.hasOwnProperty.call(obj, "startAt");
        const hasEnd = Object.prototype.hasOwnProperty.call(obj, "endAt");

        if (!hasStart || !hasEnd) return obj;
        if (!obj.startAt || !obj.endAt) return obj;

        const s = new Date(obj.startAt);
        const e = new Date(obj.endAt);

        if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s > e) {
          return helpers.error("any.invalid");
        }

        return obj;
      }, "date range")
      .messages({
        "object.min": "errors.noFieldsToUpdate",
        "any.invalid": "errors.invalidDateRange",
        "object.unknown": "errors.fieldNotAllowed",
      })
      .options(joiOptions),
  },

  /* ============================== IMAGE ============================== */

  uploadHeroSlideImageValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true),
    query: Joi.object({
      _id: objectId.required().messages({
        "any.required": "errors.requiredHeroSlideId",
      }),
    }),
  },

  removeHeroSlideImageValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true),
    query: Joi.object({
      _id: objectId.required().messages({
        "any.required": "errors.requiredHeroSlideId",
      }),
    }),
  },
};
